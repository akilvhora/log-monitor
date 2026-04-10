import { normalizeLevel } from "./normalizeLevel";
import { LogLevelBadge } from "../logs/LogLevelBadge";
import type { ColumnMappingInput } from "@log-monitor/shared";

interface Props {
  sampleRows: Array<Record<string, unknown>>;
  mapping: Partial<ColumnMappingInput>;
}

export function ImportPreviewTable({ sampleRows, mapping }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Showing first {sampleRows.length} rows. Rows highlighted in red will be skipped (invalid level or empty message).
      </p>
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted border-b border-border">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">#</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Level</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Service</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-64">Message</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sampleRows.map((row, i) => {
              const rawLevel = mapping.level ? String(row[mapping.level] ?? "") : "";
              const normalizedLevel = normalizeLevel(rawLevel);
              const message = mapping.message ? String(row[mapping.message] ?? "").trim() : "";
              const service = mapping.service ? String(row[mapping.service] ?? "") : "—";
              const timestamp = mapping.timestamp ? String(row[mapping.timestamp] ?? "") : "—";
              const isInvalid = !normalizedLevel || !message;

              return (
                <tr
                  key={i}
                  className={isInvalid ? "bg-destructive/10" : "bg-card hover:bg-muted/30"}
                >
                  <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2">
                    {normalizedLevel
                      ? <LogLevelBadge level={normalizedLevel as never} />
                      : <span className="text-destructive">"{rawLevel}" — skipped</span>
                    }
                  </td>
                  <td className="px-3 py-2 text-muted-foreground truncate max-w-[100px]">{service}</td>
                  <td className="px-3 py-2 text-foreground max-w-[260px]">
                    {message
                      ? <span className="truncate block">{message}</span>
                      : <span className="text-destructive">empty — skipped</span>
                    }
                  </td>
                  <td className="px-3 py-2 text-muted-foreground font-mono truncate max-w-[160px]">{timestamp}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
