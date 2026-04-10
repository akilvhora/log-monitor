import type { ParseResult, RawRow, RowError } from "./types.js";

export function parseNDJSON(content: string): { result: ParseResult; errors: RowError[] } {
  const lines = content.split(/\r?\n/);
  const rows: RawRow[] = [];
  const errors: RowError[] = [];
  const keySet = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Skip empty lines and comment lines
    if (!line || line.startsWith("#")) continue;

    try {
      const obj = JSON.parse(line) as RawRow;
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        rows.push(obj);
        for (const key of Object.keys(obj)) keySet.add(key);
      }
    } catch {
      if (errors.length < 100) {
        errors.push({ row: i + 1, message: `Invalid JSON on line ${i + 1}`, level: "error" });
      }
    }
  }

  if (rows.length === 0) {
    throw new Error("No valid JSON objects found in NDJSON content");
  }

  return {
    result: {
      format: "ndjson",
      headers: [...keySet],
      rows,
      sampleRows: rows.slice(0, 10),
    },
    errors,
  };
}
