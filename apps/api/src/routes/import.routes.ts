import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  parseFile,
  suggestMapping,
  storeUploadSession,
  consumeUploadSession,
  runImport,
} from "../services/import.service.js";
import type { ColumnMapping } from "../lib/parsers/types.js";

const FILE_SIZE_LIMIT = 50 * 1024 * 1024; // 50 MB

const ColumnMappingSchema = z.object({
  level:       z.string().min(1),
  message:     z.string().min(1),
  timestamp:   z.string().optional(),
  service:     z.string().optional(),
  host:        z.string().optional(),
  environment: z.string().optional(),
  traceId:     z.string().optional(),
  spanId:      z.string().optional(),
});

const CommitSchema = z.object({
  uploadId:      z.string().uuid(),
  fileName:      z.string(),
  fileSize:      z.number(),
  columnMapping: ColumnMappingSchema,
});

function requireImportAccess(user: { role: string; pageAccess: string[] }) {
  if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
  return user.pageAccess.includes("import");
}

export const importRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/import/upload — receive file, parse, store session
  app.post("/api/import/upload", async (request, reply) => {
    if (!requireImportAccess(request.user as { role: string; pageAccess: string[] })) {
      return reply.status(403).send({ error: "Forbidden", message: "No import permission", statusCode: 403 });
    }

    const data = await (request as unknown as { file: () => Promise<{ filename: string; file: AsyncIterable<Buffer>; mimetype: string }> }).file();
    if (!data) {
      return reply.status(400).send({ error: "BadRequest", message: "No file uploaded", statusCode: 400 });
    }

    // Read buffer with size limit
    const chunks: Buffer[] = [];
    let totalSize = 0;

    for await (const chunk of data.file) {
      totalSize += chunk.length;
      if (totalSize > FILE_SIZE_LIMIT) {
        return reply.status(413).send({ error: "FileTooLarge", message: "File exceeds 50 MB limit", statusCode: 413 });
      }
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    const content = buffer.toString("utf-8");
    const fileName = data.filename || "unknown";
    const fileNameStem = fileName.replace(/\.[^.]+$/, "");

    let result: Awaited<ReturnType<typeof parseFile>>;
    try {
      result = parseFile(content, fileNameStem);
    } catch (err) {
      return reply.status(400).send({
        error: "ParseError",
        message: (err as Error).message,
        statusCode: 400,
      });
    }

    const { result: parsed, errors } = result;
    const suggestedMapping = suggestMapping(parsed.headers);

    // For text format, pre-fill the mapping since columns are implicit
    if (parsed.format === "text") {
      if (!suggestedMapping.level)     suggestedMapping.level     = "level";
      if (!suggestedMapping.message)   suggestedMapping.message   = "message";
      if (!suggestedMapping.timestamp) suggestedMapping.timestamp = "timestamp";
      if (!suggestedMapping.service)   suggestedMapping.service   = "service";
      if (!suggestedMapping.host)      suggestedMapping.host      = "host";
    }

    const uploadId = storeUploadSession({
      rows:        parsed.rows,
      format:      parsed.format,
      headers:     parsed.headers,
      parseErrors: errors,
    });

    return reply.send({
      uploadId,
      format:          parsed.format,
      headers:         parsed.headers,
      sampleRows:      parsed.sampleRows,
      suggestedMapping,
      totalRows:       parsed.rows.length,
    });
  });

  // POST /api/import/commit — start background import
  app.post("/api/import/commit", async (request, reply) => {
    if (!requireImportAccess(request.user as { role: string; pageAccess: string[] })) {
      return reply.status(403).send({ error: "Forbidden", message: "No import permission", statusCode: 403 });
    }

    const parsed = CommitSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "ValidationError", message: parsed.error.message, statusCode: 400 });
    }

    const { uploadId, fileName, fileSize, columnMapping } = parsed.data;

    const session = consumeUploadSession(uploadId);
    if (!session) {
      return reply.status(404).send({
        error: "SessionExpired",
        message: "Upload session not found or expired. Please re-upload the file.",
        statusCode: 404,
      });
    }

    const job = await prisma.importJob.create({
      data: {
        userId:       (request.user as { sub: string }).sub,
        fileName,
        fileSize,
        format:       session.format,
        status:       "pending",
        totalRows:    session.rows.length,
        columnMapping: columnMapping as Record<string, string>,
      },
    });

    const fileNameStem = fileName.replace(/\.[^.]+$/, "");

    // Fire and forget — runs in background
    setImmediate(() => {
      runImport(job.id, session.rows, columnMapping as ColumnMapping, fileNameStem, session.parseErrors).catch(
        (err: Error) => console.error("[import] runImport failed:", err.message),
      );
    });

    return reply.status(202).send({ jobId: job.id });
  });

  // GET /api/import/jobs — history for current user
  app.get("/api/import/jobs", async (request, reply) => {
    const userId = (request.user as { sub: string }).sub;
    const jobs = await prisma.importJob.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Determine which jobs have linked log entries (importJobId populated)
    const jobIds = jobs.map((j) => j.id);
    const linked = await prisma.logEntry.groupBy({
      by: ["importJobId"],
      where: { importJobId: { in: jobIds } },
      _count: { _all: true },
    });
    const linkedSet = new Set(linked.map((r) => r.importJobId).filter(Boolean));

    return reply.send(jobs.map((j) => serializeJob(j, linkedSet.has(j.id))));
  });

  // GET /api/import/jobs/:jobId — single job (for polling)
  app.get("/api/import/jobs/:jobId", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const userId = (request.user as { sub: string }).sub;

    const job = await prisma.importJob.findFirst({ where: { id: jobId, userId } });
    if (!job) {
      return reply.status(404).send({ error: "NotFound", message: "Job not found", statusCode: 404 });
    }
    return reply.send(serializeJob(job));
  });
};

function serializeJob(
  job: {
    id: string; userId: string; fileName: string; fileSize: number; format: string;
    status: string; totalRows: number; importedRows: number; skippedRows: number;
    errorRows: number; parseErrors: unknown; columnMapping: unknown;
    startedAt: Date | null; completedAt: Date | null; createdAt: Date;
  },
  hasLinkedLogs = false,
) {
  return {
    id:            job.id,
    fileName:      job.fileName,
    fileSize:      job.fileSize,
    format:        job.format,
    status:        job.status,
    totalRows:     job.totalRows,
    importedRows:  job.importedRows,
    skippedRows:   job.skippedRows,
    errorRows:     job.errorRows,
    parseErrors:   job.parseErrors ?? null,
    columnMapping: job.columnMapping ?? null,
    startedAt:     job.startedAt?.toISOString() ?? null,
    completedAt:   job.completedAt?.toISOString() ?? null,
    createdAt:     job.createdAt.toISOString(),
    hasLinkedLogs,
  };
}
