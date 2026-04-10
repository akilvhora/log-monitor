// Client-side level normalization (mirrors the backend normalize.ts)
const LEVEL_MAP: Record<string, string> = {
  trace: "DEBUG", verbose: "DEBUG", "5": "DEBUG", "600": "DEBUG",
  debug: "DEBUG", d: "DEBUG", "7": "DEBUG", "10": "DEBUG",
  info: "INFO", i: "INFO", "6": "INFO", "20": "INFO", information: "INFO", notice: "INFO",
  warn: "WARN", w: "WARN", "4": "WARN", "30": "WARN", warning: "WARN",
  error: "ERROR", e: "ERROR", "3": "ERROR", "40": "ERROR", err: "ERROR",
  fatal: "FATAL", f: "FATAL", "2": "FATAL", "50": "FATAL", "60": "FATAL",
  critical: "FATAL", crit: "FATAL", emerg: "FATAL", alert: "FATAL",
};

function bunyanNumeric(n: number): string | null {
  if (n <= 10) return "DEBUG";
  if (n <= 20) return "INFO";
  if (n <= 30) return "WARN";
  if (n <= 40) return "ERROR";
  if (n <= 60) return "FATAL";
  return null;
}

export function normalizeLevel(raw: unknown): string | null {
  if (raw == null) return null;
  const str = String(raw).trim().toLowerCase();
  const num = Number(str);
  if (!isNaN(num) && isFinite(num)) {
    const byRange = bunyanNumeric(num);
    if (byRange) return byRange;
  }
  return LEVEL_MAP[str] ?? null;
}
