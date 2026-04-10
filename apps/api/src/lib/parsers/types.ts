export type LogFormat = "json" | "ndjson" | "csv" | "text";

export interface RawRow {
  [key: string]: unknown;
}

export interface ParseResult {
  format: LogFormat;
  headers: string[];
  rows: RawRow[];
  sampleRows: RawRow[];
}

export interface ColumnMapping {
  level: string;
  message: string;
  timestamp?: string;
  service?: string;
  host?: string;
  environment?: string;
  traceId?: string;
  spanId?: string;
}

export interface NormalizedRow {
  level: string;
  message: string;
  timestamp: Date;
  service: string;
  host?: string;
  environment: string;
  traceId?: string;
  spanId?: string;
  metadata?: Record<string, unknown>;
}

export interface RowError {
  row: number;
  message: string;
  level?: "error" | "warn";
}
