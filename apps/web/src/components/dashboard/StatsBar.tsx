import { useStats } from "@/hooks/useLogs";
import type { LogLevel } from "@log-monitor/shared";
import { Loader2 } from "lucide-react";

const LEVEL_COLORS: Record<LogLevel, string> = {
  DEBUG: "text-slate-400",
  INFO: "text-blue-400",
  WARN: "text-yellow-400",
  ERROR: "text-red-400",
  FATAL: "text-red-200",
};

const LEVELS: LogLevel[] = ["FATAL", "ERROR", "WARN", "INFO", "DEBUG"];

export function StatsBar() {
  const { data: stats, isLoading } = useStats();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/30 text-xs text-muted-foreground">
        <Loader2 size={12} className="animate-spin" />
        Loading stats...
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="flex items-center gap-4 px-3 py-1.5 border-b border-border bg-muted/30 text-xs">
      <span className="text-muted-foreground">
        Total: <span className="text-foreground font-semibold">{stats.total.toLocaleString()}</span>
      </span>
      {LEVELS.map((level) => {
        const count = stats.byLevel[level] ?? 0;
        if (count === 0) return null;
        return (
          <span key={level} className={LEVEL_COLORS[level]}>
            {level}: <span className="font-semibold">{count.toLocaleString()}</span>
          </span>
        );
      })}
    </div>
  );
}
