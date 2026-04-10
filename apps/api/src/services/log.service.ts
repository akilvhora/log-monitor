import { prisma } from "../lib/prisma.js";
import type { LogEntry, LogFilter, LogStats } from "@log-monitor/shared";

function toLogEntry(row: {
  id: string;
  timestamp: Date;
  level: string;
  service: string;
  message: string;
  metadata: unknown;
  traceId: string | null;
  spanId: string | null;
  host: string | null;
  environment: string;
  createdAt: Date;
}): LogEntry {
  return {
    id: row.id,
    timestamp: row.timestamp.toISOString(),
    level: row.level as LogEntry["level"],
    service: row.service,
    message: row.message,
    metadata: row.metadata as Record<string, unknown> | null,
    traceId: row.traceId,
    spanId: row.spanId,
    host: row.host,
    environment: row.environment,
    createdAt: row.createdAt.toISOString(),
  };
}

function buildWhere(filter: Omit<LogFilter, "cursor" | "limit">): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  if (filter.levels && filter.levels.length > 0) {
    where.level = { in: filter.levels };
  }
  if (filter.service) {
    where.service = filter.service;
  }
  if (filter.from || filter.to) {
    where.timestamp = {
      ...(filter.from ? { gte: new Date(filter.from) } : {}),
      ...(filter.to   ? { lte: new Date(filter.to) }   : {}),
    };
  }
  if (filter.search) {
    where.message = { contains: filter.search, mode: "insensitive" };
  }

  return where;
}

export async function queryLogs(filter: LogFilter): Promise<{
  data: LogEntry[];
  nextCursor: string | null;
  total: number;
}> {
  const limit = Math.min(filter.limit ?? 50, 500);
  const where = buildWhere(filter);

  const [rows, total] = await Promise.all([
    prisma.logEntry.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    }),
    prisma.logEntry.count({ where }),
  ]);

  const hasMore = rows.length > limit;
  const data = rows.slice(0, limit).map(toLogEntry);
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return { data, nextCursor, total };
}

export async function getStats(filter: Omit<LogFilter, "cursor" | "limit">): Promise<LogStats> {
  const where = buildWhere(filter);

  const grouped = await prisma.logEntry.groupBy({
    by: ["level"],
    where,
    _count: { id: true },
  });

  const byLevel = { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0, FATAL: 0 } as Record<string, number>;
  let total = 0;

  for (const g of grouped) {
    byLevel[g.level] = g._count.id;
    total += g._count.id;
  }

  return { total, byLevel } as LogStats;
}

export async function getServices(): Promise<string[]> {
  const rows = await prisma.logEntry.findMany({
    select: { service: true },
    distinct: ["service"],
    orderBy: { service: "asc" },
  });
  return rows.map((r) => r.service);
}

export async function fetchForAI(
  filter: Omit<LogFilter, "cursor" | "limit">,
  maxLogs = 200,
): Promise<LogEntry[]> {
  const where = buildWhere(filter);
  const rows = await prisma.logEntry.findMany({
    where,
    orderBy: { timestamp: "desc" },
    take: maxLogs,
  });
  return rows.map(toLogEntry);
}

export async function exportLogs(
  filter: Omit<LogFilter, "cursor" | "limit">,
  maxLogs = 10_000,
): Promise<LogEntry[]> {
  const where = buildWhere(filter);
  const rows = await prisma.logEntry.findMany({
    where,
    orderBy: { timestamp: "desc" },
    take: maxLogs,
  });
  return rows.map(toLogEntry);
}

export function toCsv(logs: LogEntry[]): string {
  const headers: (keyof LogEntry)[] = [
    "id", "timestamp", "level", "service", "message",
    "host", "environment", "traceId", "spanId",
  ];

  const escape = (v: unknown): string => {
    if (v == null) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const rows = logs.map((log) =>
    headers.map((h) => escape(log[h])).join(","),
  );

  return [headers.join(","), ...rows].join("\r\n");
}
