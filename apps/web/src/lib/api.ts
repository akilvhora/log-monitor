import type {
  LogEntry, LogFilter, LogStats, PaginatedResponse,
  AuthUser, UserRecord, CreateUserInput, UpdateUserInput,
  ImportJobRecord, UploadResponse, CommitImportInput, CommitImportResponse,
  DeleteLogsResponse,
} from "@log-monitor/shared";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

// ---------------------------------------------------------------------------
// Silent refresh — one in-flight refresh at a time
// ---------------------------------------------------------------------------
let refreshPromise: Promise<boolean> | null = null;

async function silentRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

// ---------------------------------------------------------------------------
// Base request — handles 401 → refresh → retry
// ---------------------------------------------------------------------------
async function request<T>(
  method: string,
  path: string,
  options?: {
    params?: Record<string, string | undefined>;
    body?: unknown;
    skipRefresh?: boolean;
  },
): Promise<T> {
  const url = new URL(BASE_URL + path, window.location.origin);
  if (options?.params) {
    for (const [k, v] of Object.entries(options.params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    method,
    credentials: "include",
    headers: options?.body ? { "Content-Type": "application/json" } : undefined,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && !options?.skipRefresh) {
    const refreshed = await silentRefresh();
    if (refreshed) {
      return request<T>(method, path, { ...options, skipRefresh: true });
    }
    window.dispatchEvent(new CustomEvent("auth:expired"));
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const text = await res.text();
    try {
      const json = JSON.parse(text) as { message: string };
      throw new Error(json.message ?? `API error ${res.status}`);
    } catch (e) {
      if (e instanceof Error && !e.message.startsWith("{")) throw e;
      throw new Error(`API error ${res.status}: ${text}`);
    }
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function get<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  return request<T>("GET", path, { params });
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("POST", path, { body });
}

function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("PUT", path, { body });
}

function del<T>(path: string): Promise<T> {
  return request<T>("DELETE", path);
}

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = await res.text();
    try { throw new Error((JSON.parse(text) as { message: string }).message); }
    catch (e) { if (e instanceof Error && e.message !== text) throw e; throw new Error(`Login failed: ${text}`); }
  }
  return res.json() as Promise<AuthUser>;
}

export async function logout(): Promise<void> {
  await fetch(`${BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
}

export function fetchCurrentUser(): Promise<AuthUser> {
  return request<AuthUser>("GET", "/api/auth/me", { skipRefresh: false });
}

export function fetchUsers(): Promise<UserRecord[]> {
  return get<UserRecord[]>("/api/auth/users");
}

export function createUser(data: CreateUserInput): Promise<UserRecord> {
  return post<UserRecord>("/api/auth/users", data);
}

export function updateUser(id: string, data: UpdateUserInput): Promise<UserRecord> {
  return put<UserRecord>(`/api/auth/users/${id}`, data);
}

export function deleteUser(id: string): Promise<void> {
  return del<void>(`/api/auth/users/${id}`);
}

// ---------------------------------------------------------------------------
// Logs API
// ---------------------------------------------------------------------------

export function fetchLogs(filter: LogFilter): Promise<PaginatedResponse<LogEntry>> {
  return get<PaginatedResponse<LogEntry>>("/api/logs", {
    levels:  filter.levels?.join(","),
    service: filter.service,
    from:    filter.from,
    to:      filter.to,
    search:  filter.search,
    cursor:  filter.cursor,
    limit:   filter.limit?.toString(),
  });
}

export function fetchStats(filter?: Pick<LogFilter, "service" | "from" | "to">): Promise<LogStats> {
  return get<LogStats>("/api/stats/summary", {
    service: filter?.service,
    from:    filter?.from,
    to:      filter?.to,
  });
}

export function fetchServices(): Promise<string[]> {
  return get<string[]>("/api/services");
}

export interface TimelineBucket {
  time: string;
  DEBUG: number; INFO: number; WARN: number; ERROR: number; FATAL: number; total: number;
}

export function fetchTimeline(opts?: {
  from?: string; to?: string; service?: string; granularity?: "minute" | "hour" | "day";
}): Promise<TimelineBucket[]> {
  return get<TimelineBucket[]>("/api/stats/timeline", {
    from: opts?.from, to: opts?.to, service: opts?.service, granularity: opts?.granularity,
  });
}

export interface HeatmapResponse {
  services: string[];
  buckets: string[];
  cells: { service: string; bucket: string; count: number }[];
}

export function fetchHeatmap(opts?: {
  from?: string; to?: string; granularity?: "minute" | "hour" | "day";
}): Promise<HeatmapResponse> {
  return get<HeatmapResponse>("/api/stats/heatmap", {
    from: opts?.from, to: opts?.to, granularity: opts?.granularity,
  });
}

export interface AppSettings {
  retentionDays: number;
  totalLogs: number;
  oldestLog: string | null;
  version: string;
}

export function fetchSettings(): Promise<AppSettings> {
  return get<AppSettings>("/api/settings");
}

export function buildExportUrl(
  format: "csv" | "json",
  filter: Pick<LogFilter, "levels" | "service" | "from" | "to" | "search">,
): string {
  const url = new URL(BASE_URL + "/api/logs/export", window.location.origin);
  url.searchParams.set("format", format);
  if (filter.levels?.length)  url.searchParams.set("levels", filter.levels.join(","));
  if (filter.service)         url.searchParams.set("service", filter.service);
  if (filter.from)            url.searchParams.set("from", filter.from);
  if (filter.to)              url.searchParams.set("to", filter.to);
  if (filter.search)          url.searchParams.set("search", filter.search);
  return url.toString();
}

// ---------------------------------------------------------------------------
// AI API
// ---------------------------------------------------------------------------

export interface AISummaryHistory {
  id: string; createdAt: string; response: string;
  logCount: number; fromTime: string; toTime: string; services: string[]; model: string;
}

export interface ErrorGroup {
  name: string; count: number; pattern: string; examples: string[]; suggestedFix: string;
}

export async function streamAISummary(
  filter: Pick<LogFilter, "levels" | "service" | "from" | "to" | "search">,
  callbacks: {
    onToken: (token: string) => void;
    onDone: (data: { id?: string; logCount: number; services: string[] }) => void;
    onError: (message: string) => void;
  },
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/ai/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        levels: filter.levels?.join(","),
        service: filter.service || undefined,
        from: filter.from || undefined,
        to: filter.to || undefined,
        search: filter.search || undefined,
      }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name !== "AbortError") callbacks.onError(String(err));
    return;
  }

  if (!res.ok) {
    const text = await res.text();
    try { callbacks.onError((JSON.parse(text) as { message: string }).message); }
    catch { callbacks.onError(`API error ${res.status}: ${text}`); }
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        let eventType = ""; let data = "";
        for (const line of part.split("\n")) {
          if (line.startsWith("event: ")) eventType = line.slice(7).trim();
          else if (line.startsWith("data: ")) data = line.slice(6).trim();
        }
        if (!eventType || !data) continue;
        try {
          const parsed = JSON.parse(data) as Record<string, unknown>;
          if (eventType === "token") callbacks.onToken(parsed.text as string);
          else if (eventType === "done") callbacks.onDone(parsed as Parameters<typeof callbacks.onDone>[0]);
          else if (eventType === "error") callbacks.onError(parsed.message as string);
        } catch { /* ignore */ }
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") callbacks.onError(String(err));
  }
}

export async function fetchGroupErrors(
  filter: Pick<LogFilter, "levels" | "service" | "from" | "to" | "search">,
): Promise<{ groups: ErrorGroup[] }> {
  const res = await fetch(`${BASE_URL}/api/ai/group-errors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      levels: filter.levels?.join(","),
      service: filter.service || undefined,
      from: filter.from || undefined,
      to: filter.to || undefined,
      search: filter.search || undefined,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    try { throw new Error((JSON.parse(text) as { message: string }).message); }
    catch { throw new Error(`API error ${res.status}: ${text}`); }
  }
  return res.json() as Promise<{ groups: ErrorGroup[] }>;
}

export function fetchAISummaries(): Promise<AISummaryHistory[]> {
  return get<AISummaryHistory[]>("/api/ai/summaries");
}

// ---------------------------------------------------------------------------
// Import API
// ---------------------------------------------------------------------------

export async function uploadLogFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}/api/import/upload`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (res.status === 401) {
    const refreshed = await silentRefresh();
    if (refreshed) return uploadLogFile(file);
    window.dispatchEvent(new CustomEvent("auth:expired"));
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const text = await res.text();
    try { throw new Error((JSON.parse(text) as { message: string }).message); }
    catch (e) { if (e instanceof Error && e.message !== text) throw e; throw new Error(`Upload failed: ${text}`); }
  }

  return res.json() as Promise<UploadResponse>;
}

export function commitImport(data: CommitImportInput): Promise<CommitImportResponse> {
  return post<CommitImportResponse>("/api/import/commit", data);
}

export function fetchImportJobs(): Promise<ImportJobRecord[]> {
  return get<ImportJobRecord[]>("/api/import/jobs");
}

export function fetchImportJob(jobId: string): Promise<ImportJobRecord> {
  return get<ImportJobRecord>(`/api/import/jobs/${jobId}`);
}

export function deleteAllLogs(): Promise<DeleteLogsResponse> {
  return del<DeleteLogsResponse>("/api/logs/all");
}

export function deleteJobLogs(jobId: string): Promise<DeleteLogsResponse> {
  return del<DeleteLogsResponse>(`/api/import/jobs/${jobId}/logs`);
}
