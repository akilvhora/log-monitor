export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  traceId?: string | null;
  spanId?: string | null;
  host?: string | null;
  environment: string;
  createdAt: string;
}

export interface LogFilter {
  levels?: LogLevel[];
  service?: string;
  from?: string;
  to?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface LogStats {
  total: number;
  byLevel: Record<LogLevel, number>;
}
