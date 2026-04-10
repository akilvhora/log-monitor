import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { LogEntry } from "@log-monitor/shared";

export interface IngestPayload {
  level: string;
  service: string;
  message: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  traceId?: string;
  spanId?: string;
  host?: string;
  environment?: string;
}

// Subscribers for live tail (WebSocket push)
const subscribers = new Set<(entry: LogEntry) => void>();

export function subscribeToNewLogs(cb: (entry: LogEntry) => void) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export async function ingestLog(payload: IngestPayload): Promise<LogEntry> {
  const row = await prisma.logEntry.create({
    data: {
      level:       payload.level,
      service:     payload.service,
      message:     payload.message,
      timestamp:   payload.timestamp ? new Date(payload.timestamp) : new Date(),
      metadata:    payload.metadata != null ? payload.metadata as Prisma.InputJsonValue : Prisma.JsonNull,
      traceId:     payload.traceId,
      spanId:      payload.spanId,
      host:        payload.host,
      environment: payload.environment ?? "production",
    },
  });

  const entry: LogEntry = {
    id:          row.id,
    timestamp:   row.timestamp.toISOString(),
    level:       row.level as LogEntry["level"],
    service:     row.service,
    message:     row.message,
    metadata:    row.metadata as Record<string, unknown> | null,
    traceId:     row.traceId,
    spanId:      row.spanId,
    host:        row.host,
    environment: row.environment,
    createdAt:   row.createdAt.toISOString(),
  };

  for (const cb of subscribers) cb(entry);

  return entry;
}
