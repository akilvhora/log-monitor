import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ingestLog } from "../services/ingest.service.js";

const VALID_LEVELS = ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"] as const;

const ingestBodySchema = z.object({
  level:       z.enum(VALID_LEVELS),
  service:     z.string().min(1).max(128),
  message:     z.string().min(1).max(4096),
  timestamp:   z.string().datetime().optional(),
  metadata:    z.record(z.unknown()).optional(),
  traceId:     z.string().max(128).optional(),
  spanId:      z.string().max(128).optional(),
  host:        z.string().max(128).optional(),
  environment: z.string().max(64).optional(),
});

export async function ingestRoutes(fastify: FastifyInstance) {
  fastify.post("/api/ingest", async (request, reply) => {
    // API key check
    const apiKey = request.headers["x-api-key"];
    const expectedKey = process.env.API_KEY_SECRET;
    if (!expectedKey || apiKey !== expectedKey) {
      return reply.status(401).send({ error: "Unauthorized", message: "Invalid or missing X-Api-Key header" });
    }

    const body = ingestBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Invalid body", message: body.error.message });
    }

    const entry = await ingestLog(body.data);
    return reply.status(201).send(entry);
  });
}
