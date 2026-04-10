export type ImportFormat = "json" | "ndjson" | "csv" | "text";
export type ImportStatus = "pending" | "processing" | "done" | "failed";

export interface ImportJobRecord {
  id: string;
  fileName: string;
  fileSize: number;
  format: ImportFormat;
  status: ImportStatus;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errorRows: number;
  parseErrors: Array<{ row: number; message: string; level?: "error" | "warn" }> | null;
  columnMapping: Record<string, string> | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  hasLinkedLogs: boolean;
}

export interface DeleteLogsResponse {
  deleted: number;
}

export interface ColumnMappingInput {
  level: string;
  message: string;
  timestamp?: string;
  service?: string;
  host?: string;
  environment?: string;
  traceId?: string;
  spanId?: string;
}

export interface UploadResponse {
  uploadId: string;
  format: ImportFormat;
  headers: string[];
  sampleRows: Array<Record<string, unknown>>;
  suggestedMapping: Partial<ColumnMappingInput>;
  totalRows: number;
}

export interface CommitImportInput {
  uploadId: string;
  fileName: string;
  fileSize: number;
  columnMapping: ColumnMappingInput;
}

export interface CommitImportResponse {
  jobId: string;
}
