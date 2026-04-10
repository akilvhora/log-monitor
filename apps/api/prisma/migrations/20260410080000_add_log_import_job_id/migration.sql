-- Add importJobId to LogEntry for per-import deletion support
ALTER TABLE "LogEntry" ADD COLUMN "importJobId" TEXT;
CREATE INDEX "LogEntry_importJobId_idx" ON "LogEntry"("importJobId");
