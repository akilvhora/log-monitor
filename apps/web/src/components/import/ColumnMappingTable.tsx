import type { ColumnMappingInput } from "@log-monitor/shared";

const FIELDS: { key: keyof ColumnMappingInput; label: string; required: boolean }[] = [
  { key: "level",       label: "Level",       required: true },
  { key: "message",     label: "Message",     required: true },
  { key: "timestamp",   label: "Timestamp",   required: false },
  { key: "service",     label: "Service",     required: false },
  { key: "host",        label: "Host",        required: false },
  { key: "environment", label: "Environment", required: false },
  { key: "traceId",     label: "Trace ID",    required: false },
  { key: "spanId",      label: "Span ID",     required: false },
];

interface Props {
  headers: string[];
  mapping: Partial<ColumnMappingInput>;
  onChange: (mapping: Partial<ColumnMappingInput>) => void;
  isTextFormat?: boolean;
}

export function ColumnMappingTable({ headers, mapping, onChange, isTextFormat }: Props) {
  const mappedCount = Object.values(mapping).filter(Boolean).length;
  const unmappedCount = headers.length - mappedCount;

  function setField(key: keyof ColumnMappingInput, value: string) {
    onChange({ ...mapping, [key]: value || undefined });
  }

  return (
    <div className="space-y-3">
      {isTextFormat && (
        <p className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md">
          Plain text format — columns were extracted automatically. You can adjust the mapping below.
        </p>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted border-b border-border">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-1/3">Log Monitor Field</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Source Column</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {FIELDS.map(({ key, label, required }) => (
              <tr key={key} className="bg-card hover:bg-muted/30">
                <td className="px-3 py-2">
                  <span className="font-medium text-foreground">{label}</span>
                  {required && <span className="text-destructive ml-1">*</span>}
                </td>
                <td className="px-3 py-2">
                  <select
                    value={mapping[key] ?? ""}
                    onChange={(e) => setField(key, e.target.value)}
                    disabled={isTextFormat && ["level","message","timestamp","service","host"].includes(key)}
                    className="w-full bg-muted border border-border rounded px-2 py-1 text-foreground disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">— skip —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        {unmappedCount > 0
          ? `${unmappedCount} unmapped column${unmappedCount !== 1 ? "s" : ""} will be stored in metadata.`
          : "All columns are mapped."}
      </p>
    </div>
  );
}
