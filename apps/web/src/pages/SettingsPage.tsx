import { useState } from "react";
import { useSettings } from "@/hooks/useLogs";
import { useFilterStore } from "@/stores/filterStore";
import { buildExportUrl } from "@/lib/api";
import { Loader2, Download, Database, Clock, Shield, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAuthStore } from "@/stores/authStore";
import { useDeleteAllLogs } from "@/hooks/useLogDeletion";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground font-medium">{value}</span>
    </div>
  );
}

function ExportButton({
  format,
  label,
  filter,
}: {
  format: "csv" | "json";
  label: string;
  filter: Parameters<typeof buildExportUrl>[1];
}) {
  function handleExport() {
    const url = buildExportUrl(format, filter);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0, 10)}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 px-3 py-2 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
    >
      <Download size={13} />
      {label}
    </button>
  );
}

export function SettingsPage() {
  const { data: settings, isLoading, isError } = useSettings();
  const { levels, service, from, to, search } = useFilterStore();
  const { user } = useAuthStore();
  const deleteAll = useDeleteAllLogs();
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const activeFilter = { levels, service, from, to, search };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-5 gap-5">
      <div>
        <h1 className="text-sm font-semibold">Settings</h1>
        <p className="text-xs text-muted-foreground">Application configuration and data management.</p>
      </div>

      {/* Database */}
      <Section title="Database">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" /> Loading...
          </div>
        ) : isError ? (
          <p className="text-xs text-destructive">Could not reach API server.</p>
        ) : settings ? (
          <>
            <Row label="Total log entries" value={settings.totalLogs.toLocaleString()} />
            <Row
              label="Oldest entry"
              value={
                settings.oldestLog
                  ? format(parseISO(settings.oldestLog), "MMM d, yyyy HH:mm")
                  : "—"
              }
            />
            <Row
              label="Retention period"
              value={`${settings.retentionDays} days`}
            />
            <Row label="App version" value={settings.version} />
          </>
        ) : null}
      </Section>

      {/* Export — all logs */}
      <Section title="Export all logs">
        <p className="text-xs text-muted-foreground mb-4">
          Download all logs as a file (up to 10,000 most recent entries).
        </p>
        <div className="flex flex-wrap gap-2">
          <ExportButton format="csv" label="Export as CSV" filter={{}} />
          <ExportButton format="json" label="Export as JSON" filter={{}} />
        </div>
      </Section>

      {/* Export — current filters */}
      <Section title="Export current view">
        <p className="text-xs text-muted-foreground mb-4">
          Downloads only logs matching filters currently active on the Logs page.
        </p>
        <div className="flex flex-wrap gap-2">
          <ExportButton format="csv" label="Export filtered CSV" filter={activeFilter} />
          <ExportButton format="json" label="Export filtered JSON" filter={activeFilter} />
        </div>
        {(levels.length > 0 || service || from || to || search) && (
          <div className="mt-3 flex flex-wrap gap-1">
            {levels.length > 0 && (
              <span className="px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground">
                Levels: {levels.join(", ")}
              </span>
            )}
            {service && (
              <span className="px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground">
                Service: {service}
              </span>
            )}
            {search && (
              <span className="px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground">
                Search: {search}
              </span>
            )}
          </div>
        )}
      </Section>

      {/* Danger Zone — ADMIN+ only */}
      {isAdmin && (
        <div className="bg-card border border-destructive/40 rounded-lg p-5">
          <h2 className="text-xs font-semibold text-destructive uppercase tracking-wider mb-4">
            Danger Zone
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Delete all logs</p>
              <p className="text-xs text-muted-foreground">
                Permanently removes every log entry from the database. This cannot be undone.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteAll(true)}
              className="flex items-center gap-2 px-3 py-2 text-xs rounded border border-destructive/60 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              <Trash2 size={12} />
              Delete all logs
            </button>
          </div>
        </div>
      )}

      {/* API info */}
      <Section title="API">
        <div className="flex items-start gap-2">
          <Shield size={13} className="text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Ingestion requires an <code className="bg-muted px-1 rounded">X-Api-Key</code> header
            matching the <code className="bg-muted px-1 rounded">API_KEY_SECRET</code> environment
            variable. Set this to a strong random value in production.
          </p>
        </div>
        <div className="mt-4 flex items-start gap-2">
          <Clock size={13} className="text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Log retention runs hourly and deletes entries older than{" "}
            <code className="bg-muted px-1 rounded">LOG_RETENTION_DAYS</code>{" "}
            (currently{" "}
            <strong className="text-foreground">{settings?.retentionDays ?? "…"} days</strong>).
          </p>
        </div>
        <div className="mt-4 flex items-start gap-2">
          <Database size={13} className="text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Change <code className="bg-muted px-1 rounded">DATABASE_URL</code> in your{" "}
            <code className="bg-muted px-1 rounded">.env</code> to point at PostgreSQL.
            Run <code className="bg-muted px-1 rounded">npx prisma migrate deploy</code> after
            each schema change.
          </p>
        </div>
      </Section>

      <ConfirmDeleteDialog
        open={showDeleteAll}
        title="Delete all logs?"
        description={`This will permanently delete all ${settings?.totalLogs.toLocaleString() ?? ""} log entries. This action cannot be undone.`}
        confirmLabel="Delete all logs"
        loading={deleteAll.isPending}
        onConfirm={() => {
          deleteAll.mutate(undefined, { onSuccess: () => setShowDeleteAll(false) });
        }}
        onCancel={() => setShowDeleteAll(false)}
      />
    </div>
  );
}
