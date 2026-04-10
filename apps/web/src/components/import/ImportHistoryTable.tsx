import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, Loader2, Clock, Trash2 } from "lucide-react";
import { useImportJobs } from "../../hooks/useImport";
import { useDeleteJobLogs } from "../../hooks/useLogDeletion";
import { useAuthStore } from "../../stores/authStore";
import { ConfirmDeleteDialog } from "../common/ConfirmDeleteDialog";
import type { ImportJobRecord } from "@log-monitor/shared";

const STATUS_ICON: Record<string, React.ReactNode> = {
  done:       <CheckCircle2 size={13} className="text-green-500" />,
  failed:     <XCircle size={13} className="text-destructive" />,
  processing: <Loader2 size={13} className="animate-spin text-primary" />,
  pending:    <Clock size={13} className="text-muted-foreground" />,
};

const FORMAT_BADGE: Record<string, string> = {
  json:  "bg-blue-500/15 text-blue-400",
  ndjson:"bg-purple-500/15 text-purple-400",
  csv:   "bg-green-500/15 text-green-400",
  text:  "bg-yellow-500/15 text-yellow-400",
};

function HistoryRow({ job, isAdmin }: { job: ImportJobRecord; isAdmin: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteJobLogs = useDeleteJobLogs();
  const errors = job.parseErrors ?? [];

  return (
    <>
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 bg-card">
          {STATUS_ICON[job.status] ?? null}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-foreground truncate max-w-[200px]">{job.fileName}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${FORMAT_BADGE[job.format] ?? "bg-muted text-muted-foreground"}`}>
                {job.format.toUpperCase()}
              </span>
              {job.hasLinkedLogs && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {job.importedRows.toLocaleString()} logs
                </span>
              )}
            </div>
            <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
              <span>{new Date(job.createdAt).toLocaleString()}</span>
              <span>✓ {job.importedRows.toLocaleString()}</span>
              {job.skippedRows > 0 && <span className="text-yellow-500">⊘ {job.skippedRows}</span>}
              {errors.length > 0 && <span className="text-orange-400">⚠ {errors.length}</span>}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {errors.length > 0 && (
              <button
                onClick={() => setExpanded((o) => !o)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {expanded ? "Hide" : "Errors"}
              </button>
            )}
            {isAdmin && job.hasLinkedLogs && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                title="Delete logs from this import"
                className="ml-1 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {expanded && errors.length > 0 && (
          <div className="border-t border-border bg-muted px-4 py-2 space-y-1 max-h-48 overflow-y-auto">
            {errors.map((e, i) => (
              <div key={i} className={`text-xs flex gap-2 ${e.level === "warn" ? "text-yellow-500" : "text-destructive"}`}>
                <span className="shrink-0">Row {e.row < 0 ? "—" : e.row}:</span>
                <span>{e.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDeleteDialog
        open={showDeleteConfirm}
        title={`Delete logs from "${job.fileName}"?`}
        description={`This will permanently delete ${job.importedRows.toLocaleString()} log entries imported from this file, and remove the import record. This cannot be undone.`}
        confirmLabel="Delete logs"
        loading={deleteJobLogs.isPending}
        onConfirm={() => {
          deleteJobLogs.mutate(job.id, { onSuccess: () => setShowDeleteConfirm(false) });
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}

export function ImportHistoryTable() {
  const { data: jobs = [], isLoading } = useImportJobs();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  if (isLoading) return null;
  if (jobs.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Import History</h3>
      {jobs.map((job) => <HistoryRow key={job.id} job={job} isAdmin={isAdmin} />)}
    </div>
  );
}
