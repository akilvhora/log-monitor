import type { ParseResult, RawRow } from "./types.js";

export function parseJSON(content: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error(`Invalid JSON: ${(err as Error).message}`);
  }

  let rows: RawRow[];

  if (Array.isArray(parsed)) {
    rows = parsed as RawRow[];
  } else if (parsed !== null && typeof parsed === "object") {
    // Try to unwrap { "logs": [...] } style wrapper
    const entries = Object.entries(parsed as Record<string, unknown>);
    const arrayEntry = entries
      .filter(([, v]) => Array.isArray(v))
      .sort((a, b) => (b[1] as unknown[]).length - (a[1] as unknown[]).length)[0];

    if (arrayEntry) {
      rows = arrayEntry[1] as RawRow[];
    } else {
      rows = [parsed as RawRow];
    }
  } else {
    throw new Error("JSON content must be an object or array");
  }

  // Collect all unique keys
  const keySet = new Set<string>();
  for (const row of rows) {
    if (row && typeof row === "object") {
      for (const key of Object.keys(row)) keySet.add(key);
    }
  }
  const headers = [...keySet];

  return {
    format: "json",
    headers,
    rows,
    sampleRows: rows.slice(0, 10),
  };
}
