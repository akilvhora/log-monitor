import type { LogLevel } from "@log-monitor/shared";
import { cn } from "@/lib/utils";

const LEVEL_STYLES: Record<LogLevel, string> = {
  DEBUG: "bg-slate-800 text-slate-400 border-slate-700",
  INFO: "bg-blue-950 text-blue-400 border-blue-800",
  WARN: "bg-yellow-950 text-yellow-400 border-yellow-800",
  ERROR: "bg-red-950 text-red-400 border-red-800",
  FATAL: "bg-red-900 text-red-200 border-red-600",
};

interface Props {
  level: LogLevel;
  className?: string;
}

export function LogLevelBadge({ level, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold border tracking-wider",
        LEVEL_STYLES[level],
        className
      )}
    >
      {level}
    </span>
  );
}
