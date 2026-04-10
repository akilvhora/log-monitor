import { prisma } from "../lib/prisma.js";

export type TimelineBucket = {
  time: string;
  DEBUG: number;
  INFO: number;
  WARN: number;
  ERROR: number;
  FATAL: number;
  total: number;
};

export type HeatmapResponse = {
  services: string[];
  buckets: string[];
  cells: { service: string; bucket: string; count: number }[];
};

type Granularity = "minute" | "hour" | "day";

export async function getTimeline(opts: {
  from?: string;
  to?: string;
  service?: string;
  granularity?: Granularity;
}): Promise<TimelineBucket[]> {
  const { from, to, service, granularity = "hour" } = opts;

  const conditions: string[] = [];
  const params: unknown[] = [granularity]; // $1 = granularity
  let idx = 2;

  if (from)    { conditions.push(`timestamp >= $${idx++}`); params.push(new Date(from)); }
  if (to)      { conditions.push(`timestamp <= $${idx++}`); params.push(new Date(to)); }
  if (service) { conditions.push(`service = $${idx++}`);    params.push(service); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await prisma.$queryRawUnsafe<
    Array<{ bucket: Date; level: string; count: number }>
  >(
    `SELECT date_trunc($1, timestamp) AS bucket, level, COUNT(*)::int AS count
     FROM "LogEntry"
     ${where}
     GROUP BY bucket, level
     ORDER BY bucket ASC`,
    ...params
  );

  const map = new Map<string, TimelineBucket>();
  for (const row of rows) {
    if (!row.bucket) continue;
    const key = row.bucket instanceof Date ? row.bucket.toISOString() : String(row.bucket);
    if (!map.has(key)) {
      map.set(key, { time: key, DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0, FATAL: 0, total: 0 });
    }
    const bucket = map.get(key)!;
    const level = row.level as keyof Omit<TimelineBucket, "time" | "total">;
    const count = Number(row.count);
    if (level in bucket) (bucket[level] as number) += count;
    bucket.total += count;
  }

  return Array.from(map.values());
}

export async function getHeatmap(opts: {
  from?: string;
  to?: string;
  granularity?: Granularity;
}): Promise<HeatmapResponse> {
  const { from, to, granularity = "hour" } = opts;

  const conditions: string[] = ["level IN ('ERROR', 'FATAL')"];
  const params: unknown[] = [granularity]; // $1 = granularity
  let idx = 2;

  if (from) { conditions.push(`timestamp >= $${idx++}`); params.push(new Date(from)); }
  if (to)   { conditions.push(`timestamp <= $${idx++}`); params.push(new Date(to)); }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const rows = await prisma.$queryRawUnsafe<
    Array<{ service: string; bucket: Date; count: number }>
  >(
    `SELECT service, date_trunc($1, timestamp) AS bucket, COUNT(*)::int AS count
     FROM "LogEntry"
     ${where}
     GROUP BY service, bucket
     ORDER BY service, bucket ASC`,
    ...params
  );

  const toKey = (b: Date | unknown) =>
    b instanceof Date ? b.toISOString() : String(b);

  const services = [...new Set(rows.map((r) => r.service))].sort();
  const buckets  = [...new Set(rows.map((r) => toKey(r.bucket)))].sort();
  const cells    = rows.map((r) => ({
    service: r.service,
    bucket:  toKey(r.bucket),
    count:   Number(r.count),
  }));

  return { services, buckets, cells };
}
