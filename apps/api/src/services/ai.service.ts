import type { LogEntry, LogFilter } from "@log-monitor/shared";
import { fetchForAI } from "./log.service.js";
import { getAnthropicClient } from "../lib/anthropic.js";
import { prisma } from "../lib/prisma.js";

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const SUMMARIZE_SYSTEM = `You are a senior SRE analyzing application logs. You receive structured log data and must:
(1) summarize the errors in plain English,
(2) identify the most likely root cause,
(3) group similar errors into named categories,
(4) suggest concrete next debugging steps.
Be concise. Use markdown. Only reference what is in the logs.`;

const GROUP_ERRORS_SYSTEM = `You are a senior SRE analyzing application logs. Group the provided error logs into semantic categories. Return ONLY valid JSON — no prose, no code fences.`;

// ---------------------------------------------------------------------------
// Rate limiting — 10 req/min per IP, max 3 concurrent Anthropic calls
// ---------------------------------------------------------------------------

const ipWindows = new Map<string, number[]>();
let concurrentCalls = 0;
const MAX_CONCURRENT = 3;
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

export function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const times = (ipWindows.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  times.push(now);
  ipWindows.set(ip, times);

  if (times.length > RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - times[0])) / 1000);
    return { allowed: false, retryAfter };
  }
  return { allowed: true };
}

export function checkConcurrency(): boolean {
  return concurrentCalls < MAX_CONCURRENT;
}

// ---------------------------------------------------------------------------
// Smart log sampling
// ---------------------------------------------------------------------------

function sampleLogs(logs: LogEntry[], max: number): LogEntry[] {
  if (logs.length <= max) return logs;

  // Newest half
  const recentSlice = Math.floor(max * 0.5);
  const recent = logs.slice(0, recentSlice);

  // Peak-error hour
  const buckets = new Map<string, LogEntry[]>();
  for (const log of logs) {
    const key = log.timestamp.slice(0, 13);
    const b = buckets.get(key) ?? [];
    b.push(log);
    buckets.set(key, b);
  }
  const peakBucket = [...buckets.values()].sort((a, b) => b.length - a.length)[0] ?? [];
  const peakSlice = Math.floor(max * 0.3);
  const peak = peakBucket.slice(0, peakSlice);

  // Diverse unique messages
  const seenMessages = new Set([...recent, ...peak].map((l) => l.message));
  const unique = logs
    .filter((l) => !seenMessages.has(l.message))
    .slice(0, max - recent.length - peak.length);

  // Deduplicate by id
  const seenIds = new Set<string>();
  return [...recent, ...peak, ...unique]
    .filter((l) => {
      if (seenIds.has(l.id)) return false;
      seenIds.add(l.id);
      return true;
    })
    .slice(0, max);
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function logsToText(logs: LogEntry[]): string {
  return logs
    .map((l) => {
      const meta = l.metadata ? ` | meta: ${JSON.stringify(l.metadata)}` : "";
      const trace = l.traceId ? ` | trace: ${l.traceId}` : "";
      return `[${l.timestamp}] ${l.level} ${l.service}: ${l.message}${trace}${meta}`;
    })
    .join("\n");
}

function buildSummarizePrompt(logs: LogEntry[], filter: Omit<LogFilter, "cursor" | "limit">): string {
  const services = [...new Set(logs.map((l) => l.service))];
  const levels = [...new Set(logs.map((l) => l.level))];
  const from = logs.at(-1)?.timestamp ?? "unknown";
  const to = logs.at(0)?.timestamp ?? "unknown";

  return [
    `Analyze the following ${logs.length} log entries.`,
    `Services: ${services.join(", ")}`,
    `Levels present: ${levels.join(", ")}`,
    `Time range: ${from} → ${to}`,
    filter.search ? `Search filter: "${filter.search}"` : "",
    "",
    "Provide:",
    "## Summary",
    "2-3 sentences of what went wrong.",
    "",
    "## Root Cause",
    "Most likely cause.",
    "",
    "## Error Groups",
    "List of distinct error patterns with counts.",
    "",
    "## Next Steps",
    "3-5 actionable debugging steps.",
    "",
    "--- LOGS ---",
    logsToText(logs),
    "--- END LOGS ---",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

function buildGroupErrorsPrompt(logs: LogEntry[]): string {
  return [
    `Group these ${logs.length} error log entries into semantic categories.`,
    `Return JSON matching this schema exactly:`,
    `{ "groups": [ { "name": string, "count": number, "pattern": string, "examples": string[], "suggestedFix": string } ] }`,
    "",
    "--- LOGS ---",
    logsToText(logs),
    "--- END LOGS ---",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// streamSummary — SSE-friendly streaming
// ---------------------------------------------------------------------------

export interface StreamSummaryOptions {
  filter: Omit<LogFilter, "cursor" | "limit">;
  maxLogs?: number;
  onToken: (token: string) => void;
  onDone: (full: string, logCount: number, services: string[]) => Promise<void> | void;
  onError: (err: Error) => void;
}

export async function streamSummary(opts: StreamSummaryOptions): Promise<void> {
  const {
    filter,
    maxLogs = parseInt(process.env.AI_MAX_LOGS_PER_SUMMARY ?? "200", 10),
    onToken,
    onDone,
    onError,
  } = opts;

  if (!checkConcurrency()) {
    onError(new Error("Server is handling too many AI requests. Please try again in a moment."));
    return;
  }

  concurrentCalls++;
  try {
    const all = await fetchForAI(filter, maxLogs * 2);
    if (all.length === 0) {
      onError(new Error("No logs match the current filters."));
      return;
    }

    const sampled = sampleLogs(all, maxLogs);
    const prompt = buildSummarizePrompt(sampled, filter);
    const services = [...new Set(sampled.map((l) => l.service))];
    const model = process.env.CLAUDE_MODEL ?? "claude-3-5-sonnet-20241022";

    const client = getAnthropicClient();
    const stream = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SUMMARIZE_SYSTEM,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    });

    let fullText = "";
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        const text = event.delta.text;
        fullText += text;
        onToken(text);
      }
    }

    await onDone(fullText, sampled.length, services);
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    concurrentCalls--;
  }
}

// ---------------------------------------------------------------------------
// groupErrors — structured JSON response (non-streaming)
// ---------------------------------------------------------------------------

export interface ErrorGroup {
  name: string;
  count: number;
  pattern: string;
  examples: string[];
  suggestedFix: string;
}

export async function groupErrors(
  filter: Omit<LogFilter, "cursor" | "limit">,
  maxLogs = 200,
): Promise<{ groups: ErrorGroup[] }> {
  if (!checkConcurrency()) {
    throw new Error("Server is handling too many AI requests. Please try again in a moment.");
  }

  // Override levels to only ERROR/FATAL for grouping
  const errorFilter = { ...filter, levels: ["ERROR", "FATAL"] as LogFilter["levels"] };
  concurrentCalls++;

  try {
    const all = await fetchForAI(errorFilter, maxLogs * 2);
    if (all.length === 0) {
      return { groups: [] };
    }

    const sampled = sampleLogs(all, maxLogs);
    const prompt = buildGroupErrorsPrompt(sampled);
    const model = process.env.CLAUDE_MODEL ?? "claude-3-5-sonnet-20241022";

    const client = getAnthropicClient();
    const message = await client.messages.create({
      model,
      max_tokens: 2048,
      system: GROUP_ERRORS_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0]?.type === "text" ? message.content[0].text : "{}";
    return JSON.parse(raw) as { groups: ErrorGroup[] };
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error("AI returned malformed JSON. Please try again.");
    }
    throw err;
  } finally {
    concurrentCalls--;
  }
}

// ---------------------------------------------------------------------------
// DB persistence
// ---------------------------------------------------------------------------

export async function saveSummary(params: {
  prompt: string;
  response: string;
  logCount: number;
  fromTime: Date;
  toTime: Date;
  services: string[];
  model: string;
}) {
  return prisma.aISummary.create({ data: params });
}

export async function getRecentSummaries(limit = 20) {
  return prisma.aISummary.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      response: true,
      logCount: true,
      fromTime: true,
      toTime: true,
      services: true,
      model: true,
    },
  });
}
