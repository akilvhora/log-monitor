import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { detectFormat } from "../lib/parsers/detect.js";
import { parseJSON } from "../lib/parsers/json.parser.js";
import { parseNDJSON } from "../lib/parsers/ndjson.parser.js";
import { parseCSV } from "../lib/parsers/csv.parser.js";
import { parseText } from "../lib/parsers/text.parser.js";
import { normalizeLevel, parseTimestamp } from "../lib/parsers/normalize.js";
import type { ParseResult, RawRow, RowError, ColumnMapping } from "../lib/parsers/types.js";

// ---------------------------------------------------------------------------
// Column alias auto-detection
// ---------------------------------------------------------------------------

const FIELD_ALIASES: Record<keyof ColumnMapping, string[]> = {
  level:       ["level", "severity", "loglevel", "log_level", "lvl", "priority"],
  message:     ["message", "msg", "text", "body", "log", "description"],
  timestamp:   ["timestamp", "time", "ts", "datetime", "date", "@timestamp", "created_at", "created"],
  service:     ["service", "app", "application", "source", "logger", "name"],
  host:        ["host", "hostname", "server", "machine", "node"],
  environment: ["environment", "env", "stage"],
  traceId:     ["traceid", "trace_id", "trace", "x-trace-id"],
  spanId:      ["spanid", "span_id", "span"],
};

export function suggestMapping(headers: string[]): Partial<ColumnMapping> {
  const normalizedHeaders = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const mapping: Partial<ColumnMapping> = {};

  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [keyof ColumnMapping, string[]][]) {
    for (const alias of aliases) {
      const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
      const idx = normalizedHeaders.indexOf(cleanAlias);
      if (idx !== -1) {
        mapping[field] = headers[idx];
        break;
      }
    }
  }

  return mapping;
}

// ---------------------------------------------------------------------------
// In-memory upload session store (TTL: 10 minutes)
// ---------------------------------------------------------------------------

interface UploadSession {
  rows: RawRow[];
  format: string;
  headers: string[];
  parseErrors: RowError[];
  timer: ReturnType<typeof setTimeout>;
}

const sessions = new Map<string, UploadSession>();

export function storeUploadSession(data: Omit<UploadSession, "timer">): string {
  const uploadId = randomUUID();
  const timer = setTimeout(() => sessions.delete(uploadId), 10 * 60_000);
  sessions.set(uploadId, { ...data, timer });
  return uploadId;
}

export function consumeUploadSession(uploadId: string): UploadSession | null {
  const session = sessions.get(uploadId);
  if (!session) return null;
  clearTimeout(session.timer);
  sessions.delete(uploadId);
  return session;
}

// ---------------------------------------------------------------------------
// Parse dispatcher
// ---------------------------------------------------------------------------

export function parseFile(
  content: string,
  fileNameHint?: string,
): { result: ParseResult; errors: RowError[] } {
  // Check for binary content
  const nullBytes = [...content.slice(0, 512)].filter((c) => c === "\0").length;
  if (nullBytes > 5) throw new Error("File appears to be binary, not a text log file");

  const sample = content.slice(0, 4096);
  const format = detectFormat(sample);

  let result: ParseResult;
  let errors: RowError[] = [];

  switch (format) {
    case "json":
      result = parseJSON(content);
      break;
    case "ndjson": {
      const { result: r, errors: e } = parseNDJSON(content);
      result = r;
      errors = e;
      break;
    }
    case "csv":
      result = parseCSV(content);
      break;
    case "text":
      result = parseText(content);
      break;
  }

  // For text format, pre-fill service with filename stem if not in rows
  if (format === "text" && fileNameHint) {
    const stem = fileNameHint.replace(/\.[^.]+$/, "");
    for (const row of result.rows) {
      if (!row.service || row.service === "unknown") {
        row.service = stem;
      }
    }
  }

  return { result, errors };
}

// ---------------------------------------------------------------------------
// Row normalization
// ---------------------------------------------------------------------------

interface NormalizeOptions {
  mapping: ColumnMapping;
  fileNameStem: string;
  importJobId: string;
}

function normalizeRow(
  raw: RawRow,
  rowIndex: number,
  opts: NormalizeOptions,
): { row: ReturnType<typeof buildDbRow> | null; errors: RowError[] } {
  const { mapping, fileNameStem } = opts;
  const errors: RowError[] = [];

  // Level — required
  const rawLevel = raw[mapping.level];
  const level = normalizeLevel(rawLevel);
  if (!level) {
    return {
      row: null,
      errors: [{ row: rowIndex, message: `Cannot normalize level value: "${rawLevel}"`, level: "error" }],
    };
  }

  // Message — required
  const message = String(raw[mapping.message] ?? "").trim();
  if (!message) {
    return {
      row: null,
      errors: [{ row: rowIndex, message: "Message field is empty", level: "error" }],
    };
  }

  // Timestamp
  const rawTs = mapping.timestamp ? raw[mapping.timestamp] : undefined;
  const { date: timestamp, warn: tsWarn } = parseTimestamp(rawTs);
  if (tsWarn && rawTs !== undefined && rawTs !== null) {
    errors.push({ row: rowIndex, message: `Could not parse timestamp "${rawTs}", using current time`, level: "warn" });
  }

  // Optional fields
  const service = String((raw[mapping.service ?? ""] ?? fileNameStem) || "unknown").trim() || fileNameStem;
  const host = mapping.host ? (raw[mapping.host] != null ? String(raw[mapping.host]) : undefined) : undefined;
  const environment = mapping.environment
    ? String(raw[mapping.environment] ?? "production")
    : "production";
  const traceId = mapping.traceId ? (raw[mapping.traceId] != null ? String(raw[mapping.traceId]) : undefined) : undefined;
  const spanId = mapping.spanId ? (raw[mapping.spanId] != null ? String(raw[mapping.spanId]) : undefined) : undefined;

  // Metadata — unmapped columns
  const mappedCols = new Set(Object.values(mapping).filter(Boolean));
  const metaEntries = Object.entries(raw).filter(([k]) => !mappedCols.has(k));
  const metadata: Record<string, unknown> = {};
  for (const [k, v] of metaEntries) {
    metadata[k] = v;
  }

  return {
    row: buildDbRow({ level, message, timestamp, service, host, environment, traceId, spanId, metadata, importJobId: opts.importJobId }),
    errors,
  };
}

function buildDbRow(fields: {
  level: string; message: string; timestamp: Date; service: string;
  host?: string; environment: string; traceId?: string; spanId?: string;
  metadata: Record<string, unknown>; importJobId: string;
}) {
  return {
    level: fields.level,
    message: fields.message,
    timestamp: fields.timestamp,
    service: fields.service,
    host: fields.host,
    environment: fields.environment,
    traceId: fields.traceId,
    spanId: fields.spanId,
    metadata: Object.keys(fields.metadata).length > 0
      ? fields.metadata as unknown as Prisma.InputJsonValue
      : undefined,
    importJobId: fields.importJobId,
  };
}

// ---------------------------------------------------------------------------
// Background import runner
// ---------------------------------------------------------------------------

const BATCH_SIZE = 500;
const MAX_STORED_ERRORS = 100;

export async function runImport(
  jobId: string,
  rows: RawRow[],
  mapping: ColumnMapping,
  fileNameStem: string,
  initialErrors: RowError[],
): Promise<void> {
  await prisma.importJob.update({
    where: { id: jobId },
    data: { status: "processing", startedAt: new Date(), totalRows: rows.length },
  });

  const allErrors: RowError[] = [...initialErrors];
  const dbRows: ReturnType<typeof buildDbRow>[] = [];
  let skippedRows = 0;
  let errorRows = 0;

  // Normalize all rows
  for (let i = 0; i < rows.length; i++) {
    const { row, errors } = normalizeRow(rows[i], i + 1, { mapping, fileNameStem, importJobId: jobId });
    for (const e of errors) {
      if (e.level === "warn") errorRows++;
      if (allErrors.length < MAX_STORED_ERRORS) allErrors.push(e);
    }
    if (row === null) {
      skippedRows++;
    } else {
      dbRows.push(row);
    }
  }

  // Batch insert
  let importedRows = 0;
  try {
    for (let i = 0; i < dbRows.length; i += BATCH_SIZE) {
      const batch = dbRows.slice(i, i + BATCH_SIZE);
      await prisma.logEntry.createMany({ data: batch });
      importedRows += batch.length;

      // Update progress every batch
      await prisma.importJob.update({
        where: { id: jobId },
        data: { importedRows },
      });
    }

    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: "done",
        completedAt: new Date(),
        importedRows,
        skippedRows,
        errorRows,
        parseErrors: allErrors.length > 0 ? allErrors as unknown as Prisma.InputJsonValue : undefined,
      },
    });
  } catch (err) {
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        completedAt: new Date(),
        importedRows,
        skippedRows,
        errorRows,
        parseErrors: [
          ...allErrors.slice(0, 99),
          { row: -1, message: `Import failed: ${(err as Error).message}`, level: "error" },
        ] as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
