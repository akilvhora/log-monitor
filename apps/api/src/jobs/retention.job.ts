import { prisma } from "../lib/prisma.js";

export function startRetentionJob(): () => void {
  const retentionDays = parseInt(process.env.LOG_RETENTION_DAYS ?? "30", 10);

  async function runRetention() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const { count } = await prisma.logEntry.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    if (count > 0) {
      console.log(`[retention] Deleted ${count} log entries older than ${retentionDays} days`);
    }
  }

  // Run once at startup, then every hour
  runRetention().catch((err) => console.error("[retention] Error:", err));
  const interval = setInterval(
    () => runRetention().catch((err) => console.error("[retention] Error:", err)),
    60 * 60 * 1000,
  );

  return () => clearInterval(interval);
}
