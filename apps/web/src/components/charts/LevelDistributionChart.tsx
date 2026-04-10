import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Loader2 } from "lucide-react";
import { useStats } from "@/hooks/useLogs";
import type { LogLevel } from "@log-monitor/shared";

const LEVELS: LogLevel[] = ["FATAL", "ERROR", "WARN", "INFO", "DEBUG"];

const COLORS: Record<LogLevel, string> = {
  FATAL: "#fca5a5",
  ERROR: "#f87171",
  WARN:  "#fbbf24",
  INFO:  "#60a5fa",
  DEBUG: "#64748b",
};

export function LevelDistributionChart() {
  const { data: stats, isLoading } = useStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground gap-2 text-xs">
        <Loader2 size={14} className="animate-spin" /> Loading chart...
      </div>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-xs">
        No data
      </div>
    );
  }

  const chartData = LEVELS
    .filter((l) => (stats.byLevel[l] ?? 0) > 0)
    .map((l) => ({ name: l, value: stats.byLevel[l] ?? 0 }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={COLORS[entry.name as LogLevel]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "hsl(222 84% 6%)",
            border: "1px solid hsl(217 32% 17%)",
            borderRadius: 6,
            fontSize: 12,
          }}
          labelStyle={{ color: "hsl(210 40% 98%)" }}
          formatter={(value) => [Number(value).toLocaleString(), ""]}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "hsl(215 20% 55%)" }}
          formatter={(value) => value}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
