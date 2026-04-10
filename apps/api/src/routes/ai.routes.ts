import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { LogFilter } from "@log-monitor/shared";
import {
  checkRateLimit,
  streamSummary,
  saveSummary,
  groupErrors,
  getRecentSummaries,
} from "../services/ai.service.js";

const FilterBody = z.object({
  levels: z.string().optional(),
  service: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
});

function parseFilter(raw: z.infer<typeof FilterBody>): Omit<LogFilter, "cursor" | "limit"> {
  return {
    levels: raw.levels ? (raw.levels.split(",") as LogFilter["levels"]) : undefined,
    service: raw.service || undefined,
    from: raw.from || undefined,
    to: raw.to || undefined,
    search: raw.search || undefined,
  };
}

export const aiRoutes: FastifyPluginAsync = async (app) => {
  // -------------------------------------------------------------------------
  // POST /api/ai/summarize  — SSE streaming
  // -------------------------------------------------------------------------
  app.post("/api/ai/summarize", async (request, reply) => {
    // Rate limit
    const ip = (request.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim()
      ?? request.ip
      ?? "unknown";

    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return reply.status(429).send({
        error: "RateLimitExceeded",
        message: `Too many AI requests. Retry after ${rateCheck.retryAfter}s.`,
        statusCode: 429,
      });
    }

    // Validate body
    const parsed = FilterBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "ValidationError",
        message: parsed.error.message,
        statusCode: 400,
      });
    }

    const filter = parseFilter(parsed.data);

    // Set up SSE
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });

    let closed = false;
    reply.raw.on("close", () => { closed = true; });

    const send = (event: string, data: unknown) => {
      if (!closed) reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    await streamSummary({
      filter,
      onToken: (token) => send("token", { text: token }),
      onDone: async (full, logCount, services) => {
        let savedId: string | undefined;
        try {
          const from = filter.from ? new Date(filter.from) : new Date(Date.now() - 86_400_000);
          const to = filter.to ? new Date(filter.to) : new Date();
          const model = process.env.CLAUDE_MODEL ?? "claude-3-5-sonnet-20241022";
          const record = await saveSummary({
            prompt: JSON.stringify(filter),
            response: full,
            logCount,
            fromTime: from,
            toTime: to,
            services,
            model,
          });
          savedId = record.id;
        } catch {
          // Non-fatal — still send done event
        }
        send("done", { id: savedId, logCount, services });
        reply.raw.end();
      },
      onError: (err) => {
        send("error", { message: err.message });
        reply.raw.end();
      },
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/ai/group-errors  — structured JSON clustering
  // -------------------------------------------------------------------------
  app.post("/api/ai/group-errors", async (request, reply) => {
    const ip = (request.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim()
      ?? request.ip
      ?? "unknown";

    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return reply.status(429).send({
        error: "RateLimitExceeded",
        message: `Too many AI requests. Retry after ${rateCheck.retryAfter}s.`,
        statusCode: 429,
      });
    }

    const parsed = FilterBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "ValidationError",
        message: parsed.error.message,
        statusCode: 400,
      });
    }

    const filter = parseFilter(parsed.data);

    try {
      const result = await groupErrors(filter);
      return reply.send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return reply.status(500).send({ error: "AIError", message, statusCode: 500 });
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/ai/summaries  — history
  // -------------------------------------------------------------------------
  app.get("/api/ai/summaries", async (_request, reply) => {
    const summaries = await getRecentSummaries();
    return reply.send(summaries);
  });
};
