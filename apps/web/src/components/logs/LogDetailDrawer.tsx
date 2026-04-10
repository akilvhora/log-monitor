import { X, Copy, Check } from "lucide-react";
import { useState } from "react";
import type { LogEntry } from "@log-monitor/shared";
import { LogLevelBadge } from "./LogLevelBadge";
import { useUIStore } from "@/stores/uiStore";
import { format } from "date-fns";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">{label}</div>
      <div className="text-foreground">{value}</div>
    </div>
  );
}

interface Props {
  log: LogEntry;
}

export function LogDetailDrawer({ log }: Props) {
  const { closeDrawer } = useUIStore();

  const metadata = log.metadata as Record<string, unknown> | null;
  const stackTrace = metadata?.stackTrace as string | undefined;
  const otherMeta = metadata
    ? Object.fromEntries(Object.entries(metadata).filter(([k]) => k !== "stackTrace"))
    : null;

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-card border-l border-border z-50 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <LogLevelBadge level={log.level} />
          <span className="text-muted-foreground text-xs">{log.id}</span>
        </div>
        <button onClick={closeDrawer} className="text-muted-foreground hover:text-foreground transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Message */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-muted-foreground text-xs uppercase tracking-wider">Message</span>
            <CopyButton text={log.message} />
          </div>
          <p className="text-foreground text-sm leading-relaxed break-words">{log.message}</p>
        </div>

        {/* Core fields */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Timestamp" value={format(new Date(log.timestamp), "PPpp")} />
          <Field label="Service" value={<span className="text-primary">{log.service}</span>} />
          <Field label="Environment" value={log.environment} />
          <Field label="Host" value={log.host} />
          <Field label="Trace ID" value={log.traceId} />
          <Field label="Span ID" value={log.spanId} />
        </div>

        {/* Stack trace */}
        {stackTrace && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-muted-foreground text-xs uppercase tracking-wider">Stack Trace</span>
              <CopyButton text={stackTrace} />
            </div>
            <pre className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded p-3 overflow-x-auto whitespace-pre-wrap break-words">
              {stackTrace}
            </pre>
          </div>
        )}

        {/* Other metadata */}
        {otherMeta && Object.keys(otherMeta).length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-muted-foreground text-xs uppercase tracking-wider">Metadata</span>
              <CopyButton text={JSON.stringify(otherMeta, null, 2)} />
            </div>
            <pre className="text-xs text-muted-foreground bg-muted rounded p-3 overflow-x-auto">
              {JSON.stringify(otherMeta, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
