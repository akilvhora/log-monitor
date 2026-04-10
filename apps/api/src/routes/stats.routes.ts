import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getTimeline, getHeatmap } from "../services/stats.service.js";

const timelineQuerySchema = z.object({
  from:        z.string().optional(),
  to:          z.string().optional(),
  service:     z.string().optional(),
  granularity: z.enum(["minute", "hour", "day"]).optional(),
});

const heatmapQuerySchema = z.object({
  from:        z.string().optional(),
  to:          z.string().optional(),
  granularity: z.enum(["minute", "hour", "day"]).optional(),
});

export async function statsRoutes(fastify: FastifyInstance) {
  fastify.get("/api/stats/timeline", async (request, reply) => {
    const q = timelineQuerySchema.safeParse(request.query);
    if (!q.success) {
      return reply.status(400).send({ error: "Invalid query", message: q.error.message });
    }
    return reply.send(await getTimeline(q.data));
  });

  fastify.get("/api/stats/heatmap", async (request, reply) => {
    const q = heatmapQuerySchema.safeParse(request.query);
    if (!q.success) {
      return reply.status(400).send({ error: "Invalid query", message: q.error.message });
    }
    return reply.send(await getHeatmap(q.data));
  });
}
