import type { ParseResult, RawRow } from "./types.js";

/** RFC 4180-compliant CSV parser. Handles quoted fields, embedded commas, \r\n. */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          // Escaped quote
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        fields.push(field);
        field = "";
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }
  fields.push(field);
  return fields;
}

export function parseCSV(content: string): ParseResult {
  // Strip BOM
  const stripped = content.startsWith("\uFEFF") ? content.slice(1) : content;

  // Split into lines (handle both \r\n and \n)
  const lines = stripped.split(/\r?\n/);

  if (lines.length < 2) {
    throw new Error("CSV must have at least a header row and one data row");
  }

  // Parse header
  const headers = parseCSVLine(lines[0]).map((h) => h.trim());

  const rows: RawRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: RawRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] !== undefined ? values[j] : null;
    }
    rows.push(row);
  }

  if (rows.length === 0) {
    throw new Error("CSV contains no data rows");
  }

  return {
    format: "csv",
    headers,
    rows,
    sampleRows: rows.slice(0, 10),
  };
}
