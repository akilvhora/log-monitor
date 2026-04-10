import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { subscribeToNewLogs } from "../services/ingest.service.js";
import { prisma } from "../lib/prisma.js";
import type { LogEntry } from "@log-monitor/shared";

function toEntry(row: {
  id: string; timestamp: Date; level: string; service: string;
  message: string; metadata: unknown; traceId: string | null;
  spanId: string | null; host: string | null; environment: string; createdAt: Date;
}): LogEntry {
  return {
    id: row.id, timestamp: row.timestamp.toISOString(),
    level: row.level as LogEntry["level"], service: row.service,
    message: row.message, metadata: row.metadata as Record<string, unknown> | null,
    traceId: row.traceId, spanId: row.spanId, host: row.host,
    environment: row.environment, createdAt: row.createdAt.toISOString(),
  };
}

function send(ws: WebSocket, data: unknown) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

export async function wsRoutes(fastify: FastifyInstance) {
  fastify.get("/live", { websocket: true }, (connection) => {
    const ws: WebSocket = (connection as unknown as { socket: WebSocket }).socket;
    let lastCreatedAt: Date | null = null;

    // On connect, record the latest log timestamp so we only push NEW entries
    prisma.logEntry
      .findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } })
      .then((row) => { lastCreatedAt = row?.createdAt ?? new Date(); });

    // Poll DB every 2s for logs that arrived since last check
    const pollInterval = setInterval(async () => {
      if (ws.readyState !== ws.OPEN) return;
      if (!lastCreatedAt) return;

      const since = lastCreatedAt;
      const newRows = await prisma.logEntry.findMany({
        where: { createdAt: { gt: since } },
        orderBy: { createdAt: "asc" },
        take: 50,
      });

      if (newRows.length > 0) {
        lastCreatedAt = newRows[newRows.length - 1].createdAt;
        for (const row of newRows) send(ws, toEntry(row));
      }
    }, 2000);

    // Also subscribe to ingest service for immediate push on POST /api/ingest
    const unsubscribe = subscribeToNewLogs((entry) => {
      lastCreatedAt = new Date(entry.createdAt);
      send(ws, entry);
    });

    ws.on("close", () => {
      clearInterval(pollInterval);
      unsubscribe();
    });

    ws.on("error", () => {
      clearInterval(pollInterval);
      unsubscribe();
    });
  });
}
