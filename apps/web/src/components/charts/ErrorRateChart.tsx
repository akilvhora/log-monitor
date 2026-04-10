import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import { useTimeline } from "@/hooks/useLogs";
import { Loader2 } from "lucide-react";

interface Props {
  granularity?: "minute" | "hour" | "day";
}

export function ErrorRateChart({ granularity = "hour" }: Props) {
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
    .map((b) => {
      const errorCount = (b.ERROR ?? 0) + (b.FATAL ?? 0);
      const rate = b.total > 0 ? Math.round((errorCount / b.total) * 100) : 0;
      return { label: format(parseISO(b.time), fmt), rate, errorCount, total: b.total };
    });

  const avgRate = chartData.length > 0
    ? Math.round(chartData.reduce((s, d) => s + d.rate, 0) / chartData.length)
    : 0;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
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
          unit="%"
          domain={[0, 100]}
        />
        <Tooltip
          contentStyle={{ background: "hsl(222 84% 6%)", border: "1px solid hsl(217 32% 17%)", borderRadius: 6, fontSize: 12 }}
          labelStyle={{ color: "hsl(210 40% 98%)" }}
          formatter={(value, name) => [`${value}%`, name === "rate" ? "Error rate" : String(name)]}
          cursor={{ stroke: "hsl(217 32% 17%)" }}
        />
        <ReferenceLine y={avgRate} stroke="hsl(215 20% 40%)" strokeDasharray="4 2" label={{ value: `avg ${avgRate}%`, position: "right", fontSize: 10, fill: "hsl(215 20% 55%)" }} />
        <Line
          type="monotone"
          dataKey="rate"
          stroke="#f87171"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#f87171" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
