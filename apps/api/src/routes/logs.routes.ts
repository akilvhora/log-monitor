import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { queryLogs, getStats, getServices, exportLogs, toCsv } from "../services/log.service.js";

const LogLevelEnum = z.enum(["DEBUG", "INFO", "WARN", "ERROR", "FATAL"]);

const logsQuerySchema = z.object({
  levels:  z.string().optional(), // comma-separated
  service: z.string().optional(),
  from:    z.string().optional(),
  to:      z.string().optional(),
  search:  z.string().optional(),
  cursor:  z.string().optional(),
  limit:   z.coerce.number().min(1).max(1000).optional(),
});

const statsQuerySchema = z.object({
  service: z.string().optional(),
  from:    z.string().optional(),
  to:      z.string().optional(),
});

const exportQuerySchema = z.object({
  levels:  z.string().optional(),
  service: z.string().optional(),
  from:    z.string().optional(),
  to:      z.string().optional(),
  search:  z.string().optional(),
  format:  z.enum(["json", "csv"]).optional().default("json"),
  limit:   z.coerce.number().min(1).max(50_000).optional().default(10_000),
});

function parseLevels(raw?: string) {
  if (!raw) return undefined;
  return raw
    .split(",")
    .map((l) => l.trim())
    .filter((l) => LogLevelEnum.safeParse(l).success) as Array<
    "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL"
  >;
}

export async function logsRoutes(fastify: FastifyInstance) {
  fastify.get("/api/logs", async (request, reply) => {
    const query = logsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ error: "Invalid query", message: query.error.message });
    }

    const { levels, service, from, to, search, cursor, limit } = query.data;
    const result = await queryLogs({
      levels: parseLevels(levels),
      service, from, to, search, cursor, limit,
    });
    return reply.send(result);
  });

  fastify.get("/api/logs/export", async (request, reply) => {
    const query = exportQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ error: "Invalid query", message: query.error.message });
    }

    const { levels, service, from, to, search, format, limit } = query.data;
    const logs = await exportLogs(
      { levels: parseLevels(levels), service, from, to, search },
      limit,
    );

    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

    if (format === "csv") {
      reply
        .header("Content-Type", "text/csv")
        .header("Content-Disposition", `attachment; filename="logs-${ts}.csv"`);
      return reply.send(toCsv(logs));
    }

    reply
      .header("Content-Type", "application/json")
      .header("Content-Disposition", `attachment; filename="logs-${ts}.json"`);
    return reply.send(logs);
  });

  fastify.get("/api/stats/summary", async (request, reply) => {
    const query = statsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ error: "Invalid query", message: query.error.message });
    }
    const stats = await getStats(query.data);
    return reply.send(stats);
  });

  fastify.get("/api/services", async (_request, reply) => {
    return reply.send(await getServices());
  });
}
