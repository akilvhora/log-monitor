import type { FastifyPluginAsync } from "fastify";
import { requireRole } from "../middleware/authenticate.js";
import { prisma } from "../lib/prisma.js";

export const logsDeleteRoutes: FastifyPluginAsync = async (app) => {
  // DELETE /api/logs/all — ADMIN+ only, wipes every LogEntry row
  app.delete(
    "/api/logs/all",
    { preHandler: [requireRole(["ADMIN", "SUPER_ADMIN"])] },
    async (_request, reply) => {
      const { count } = await prisma.logEntry.deleteMany({});
      return reply.send({ deleted: count });
    },
  );

  // DELETE /api/import/jobs/:jobId/logs — ADMIN+ only
  // Deletes all LogEntry rows tagged with this job, then removes the job record
  app.delete(
    "/api/import/jobs/:jobId/logs",
    { preHandler: [requireRole(["ADMIN", "SUPER_ADMIN"])] },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };

      const job = await prisma.importJob.findUnique({ where: { id: jobId } });
      if (!job) {
        return reply.status(404).send({
          error: "NotFound",
          message: "Import job not found",
          statusCode: 404,
        });
      }

      const { count } = await prisma.logEntry.deleteMany({
        where: { importJobId: jobId },
      });

      await prisma.importJob.delete({ where: { id: jobId } });

      return reply.send({ deleted: count });
    },
  );
};
