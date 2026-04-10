import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useImportJob } from "../../hooks/useImport";
import type { ImportJobRecord } from "@log-monitor/shared";

interface Props {
  jobId: string;
  onComplete: (job: ImportJobRecord) => void;
}

export function ImportProgressBar({ jobId, onComplete }: Props) {
  const { data: job } = useImportJob(jobId);

  if (!job) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 size={16} className="animate-spin" />
        Starting import…
      </div>
    );
  }

  if ((job.status === "done" || job.status === "failed") && job) {
    // Notify parent on next tick to avoid state updates during render
    setTimeout(() => onComplete(job), 0);
  }

  const total = job.totalRows || 1;
  const pct = Math.round((job.importedRows / total) * 100);

  return (
    <div className="space-y-4">
      {/* Status header */}
      <div className="flex items-center gap-2">
        {job.status === "done" ? (
          <CheckCircle2 size={18} className="text-green-500" />
        ) : job.status === "failed" ? (
          <XCircle size={18} className="text-destructive" />
        ) : (
          <Loader2 size={18} className="animate-spin text-primary" />
        )}
        <span className="text-sm font-medium text-foreground">
          {job.status === "done" ? "Import complete" : job.status === "failed" ? "Import failed" : "Importing…"}
        </span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              job.status === "failed" ? "bg-destructive" : "bg-primary"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{job.importedRows.toLocaleString()} / {job.totalRows.toLocaleString()} rows</span>
          <span>{pct}%</span>
        </div>
      </div>

      {/* Stats */}
      {(job.status === "done" || job.status === "failed") && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2 text-center">
            <div className="text-lg font-semibold text-green-500">{job.importedRows.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Imported</div>
          </div>
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-center">
            <div className="text-lg font-semibold text-yellow-500">{job.skippedRows.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Skipped</div>
          </div>
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-center">
            <div className="text-lg font-semibold text-blue-500">{job.errorRows.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Warnings</div>
          </div>
        </div>
      )}
    </div>
  );
}
