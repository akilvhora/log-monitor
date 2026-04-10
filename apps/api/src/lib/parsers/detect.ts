import type { LogFormat } from "./types.js";

export function detectFormat(sample: string): LogFormat {
  const trimmed = sample.trimStart();
  if (!trimmed) return "text";

  const firstChar = trimmed[0];

  // JSON array
  if (firstChar === "[") return "json";

  // JSON object — check if second non-empty line also starts with {
  if (firstChar === "{") {
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length > 1 && lines[1].trimStart().startsWith("{")) return "ndjson";
    return "json";
  }

  // Lines that start with a date/timestamp pattern are log lines, never CSV rows.
  // Matches: "17/06/09 " (Spark YY/MM/DD), "2023-01-01 " (ISO), "03-17 16:" (Android MM-DD)
  const LOG_TIMESTAMP_START = /^\d{2,4}[-/]\d{2}([-/]\d{2})?[\sT]/;

  // CSV heuristic — first line has 2+ commas and consistent column count.
  // Skip entirely when the first line looks like a log timestamp (commas in log messages
  // like "signal handlers for [TERM, HUP, INT]" would otherwise trigger false CSV detection).
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length >= 2 && !LOG_TIMESTAMP_START.test(lines[0])) {
    const commaCount = (lines[0].match(/,/g) ?? []).length;
    if (commaCount >= 2) {
      const counts = lines.slice(0, 3).map((l) => (l.match(/,/g) ?? []).length);
      const consistent = counts.every((c) => Math.abs(c - commaCount) <= 1);
      if (consistent) return "csv";
    }
  }

  return "text";
}
