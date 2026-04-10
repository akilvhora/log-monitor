import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { useHeatmap } from "@/hooks/useLogs";

interface Props {
  granularity?: "minute" | "hour" | "day";
}

export function ServiceErrorHeatmap({ granularity = "hour" }: Props) {
  const { data, isLoading } = useHeatmap(granularity);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground gap-2 text-xs">
        <Loader2 size={14} className="animate-spin" /> Loading heatmap...
      </div>
    );
  }

  if (!data || data.services.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-xs">
        No errors in this time range
      </div>
    );
  }

  // Cap to last 24 buckets so the grid fits horizontally
  const displayBuckets = data.buckets.slice(-24);
  const timeFmt = granularity === "day" ? "MMM d" : granularity === "hour" ? "HH:mm" : "HH:mm";

  const cellMap = new Map<string, number>();
  for (const c of data.cells) {
    cellMap.set(`${c.service}|${c.bucket}`, c.count);
  }

  const maxCount = Math.max(...data.cells.map((c) => c.count), 1);

  const cellColor = (count: number): string => {
    if (count === 0) return "transparent";
    const opacity = 0.1 + (count / maxCount) * 0.85;
    return `rgba(248, 113, 113, ${opacity.toFixed(2)})`;
  };

  const cols = displayBuckets.length;

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-px"
        style={{ gridTemplateColumns: `minmax(100px,auto) repeat(${cols}, minmax(18px,1fr))` }}
      >
        {/* Header row */}
        <div className="text-xs text-muted-foreground pb-1" />
        {displayBuckets.map((b) => (
          <div
            key={b}
            className="text-xs text-muted-foreground text-center leading-none pb-1 truncate"
          >
            {format(parseISO(b), timeFmt)}
          </div>
        ))}

        {/* Service rows */}
        {data.services.map((service) => (
          <>
            <div
              key={`${service}-label`}
              className="text-xs text-foreground truncate pr-2 flex items-center"
              title={service}
            >
              {service}
            </div>
            {displayBuckets.map((b) => {
              const count = cellMap.get(`${service}|${b}`) ?? 0;
              return (
                <div
                  key={`${service}|${b}`}
                  title={count > 0 ? `${service} — ${count} error${count !== 1 ? "s" : ""}` : undefined}
                  className="h-5 rounded-sm border border-border/30"
                  style={{ background: cellColor(count) }}
                />
              );
            })}
          </>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2 justify-end">
        <span className="text-xs text-muted-foreground">Errors: low</span>
        {[0.1, 0.3, 0.55, 0.8, 1].map((o) => (
          <div
            key={o}
            className="w-3 h-3 rounded-sm"
            style={{ background: `rgba(248,113,113,${o})` }}
          />
        ))}
        <span className="text-xs text-muted-foreground">high</span>
      </div>
    </div>
  );
}
