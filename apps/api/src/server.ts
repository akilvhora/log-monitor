import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyWebSocket from "@fastify/websocket";
import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import { logsRoutes } from "./routes/logs.routes.js";
import { statsRoutes } from "./routes/stats.routes.js";
import { ingestRoutes } from "./routes/ingest.routes.js";
import { wsRoutes } from "./routes/ws.routes.js";
import { aiRoutes } from "./routes/ai.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { importRoutes } from "./routes/import.routes.js";
import { logsDeleteRoutes } from "./routes/logs.delete.routes.js";
import { authenticate } from "./middleware/authenticate.js";
import { ensureSuperAdmin } from "./services/auth.service.js";
import { prisma } from "./lib/prisma.js";
import { startRetentionJob } from "./jobs/retention.job.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);

const app = Fastify({ logger: { level: "info" } });

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
});

await app.register(fastifyCookie);
await app.register(fastifyWebSocket);
await app.register(fastifyMultipart, { limits: { fileSize: 50 * 1024 * 1024 } });

// Public routes — no auth required
await app.register(authRoutes);

// Ingest stays public but uses its own X-Api-Key auth
await app.register(ingestRoutes);

// Protected scope — all routes here require a valid access token
await app.register(async (scope) => {
  scope.addHook("preHandler", authenticate);
  await scope.register(logsRoutes);
  await scope.register(statsRoutes);
  await scope.register(aiRoutes);
  await scope.register(wsRoutes);
  await scope.register(importRoutes);
  await scope.register(logsDeleteRoutes);

  scope.get("/api/settings", async () => {
    const retentionDays = parseInt(process.env.LOG_RETENTION_DAYS ?? "30", 10);
    const totalLogs = await prisma.logEntry.count();
    const oldest = await prisma.logEntry.findFirst({
      orderBy: { timestamp: "asc" },
      select: { timestamp: true },
    });
    return {
      retentionDays,
      totalLogs,
      oldestLog: oldest?.timestamp.toISOString() ?? null,
      version: "1.0.0",
    };
  });
});

app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  reply.status(error.statusCode ?? 500).send({
    error: error.name,
    message: error.message,
    statusCode: error.statusCode ?? 500,
  });
});

try {
  await ensureSuperAdmin();
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`API server running at http://localhost:${PORT}`);
  startRetentionJob();
} catch (err) {
  app.log.error(err);
  await prisma.$disconnect();
  process.exit(1);
}
