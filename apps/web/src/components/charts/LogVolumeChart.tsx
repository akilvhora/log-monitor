import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { useTimeline } from "@/hooks/useLogs";
import { Loader2 } from "lucide-react";

const COLORS = {
  ERROR: "#f87171",
  FATAL: "#fca5a5",
  WARN:  "#fbbf24",
  INFO:  "#60a5fa",
  DEBUG: "#64748b",
};

interface Props {
  granularity?: "minute" | "hour" | "day";
}

export function LogVolumeChart({ granularity = "hour" }: Props) {
  const { data, isLoading } = useTimeline(granularity);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground gap-2 text-xs">
        <Loader2 size={14} className="animate-spin" /> Loading chart...
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-48 text-muted-foreground text-xs">No data</div>;
  }

  const fmt = granularity === "day" ? "MMM d" : granularity === "hour" ? "MMM d HH:mm" : "HH:mm";

  const chartData = data
    .filter((b) => !!b.time)
    .map((b) => ({
      ...b,
      label: format(parseISO(b.time), fmt),
    }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 17%)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{ background: "hsl(222 84% 6%)", border: "1px solid hsl(217 32% 17%)", borderRadius: 6, fontSize: 12 }}
          labelStyle={{ color: "hsl(210 40% 98%)" }}
          cursor={{ fill: "hsl(217 32% 17%)" }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "hsl(215 20% 55%)" }} />
        {(["FATAL", "ERROR", "WARN", "INFO", "DEBUG"] as const).map((level) => (
          <Bar key={level} dataKey={level} stackId="a" fill={COLORS[level]} radius={level === "DEBUG" ? [2, 2, 0, 0] : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
