import { useStats } from "@/hooks/useLogs";
import { LogLevelBadge } from "@/components/logs/LogLevelBadge";
import { LogVolumeChart } from "@/components/charts/LogVolumeChart";
import { ErrorRateChart } from "@/components/charts/ErrorRateChart";
import { LevelDistributionChart } from "@/components/charts/LevelDistributionChart";
import { ServiceErrorHeatmap } from "@/components/charts/ServiceErrorHeatmap";
import type { LogLevel } from "@log-monitor/shared";
import { useNavigate } from "react-router-dom";
import { useFilterStore } from "@/stores/filterStore";
import { useState } from "react";

const LEVELS: LogLevel[] = ["FATAL", "ERROR", "WARN", "INFO", "DEBUG"];

type Granularity = "minute" | "hour" | "day";

function StatCard({ level, count, onClick }: { level: LogLevel; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-card border border-border rounded-lg p-4 text-left hover:border-primary/50 transition-colors w-full"
    >
      <LogLevelBadge level={level} />
      <div className="mt-3 text-2xl font-bold text-foreground">{count.toLocaleString()}</div>
      <div className="text-xs text-muted-foreground mt-1">log entries</div>
    </button>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function DashboardPage() {
  const { data: stats, isLoading } = useStats();
  const navigate = useNavigate();
  const { setLevels } = useFilterStore();
  const [granularity, setGranularity] = useState<Granularity>("hour");

  function drillDown(level: LogLevel) {
    setLevels([level]);
    navigate("/logs");
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-5 gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Click any stat card to drill into filtered logs.</p>
        </div>
        <select
          value={granularity}
          onChange={(e) => setGranularity(e.target.value as Granularity)}
          className="bg-muted border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="minute">Per minute</option>
          <option value="hour">Per hour</option>
          <option value="day">Per day</option>
        </select>
      </div>

      {/* Stat cards */}
      {isLoading ? (
        <p className="text-muted-foreground text-xs">Loading...</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="col-span-full sm:col-span-1 bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Total</div>
            <div className="text-3xl font-bold text-foreground mt-1">
              {stats?.total.toLocaleString() ?? "—"}
            </div>
          </div>
          {LEVELS.map((level) => (
            <StatCard
              key={level}
              level={level}
              count={stats?.byLevel[level] ?? 0}
              onClick={() => drillDown(level)}
            />
          ))}
        </div>
      )}

      {/* Volume + Error rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Log Volume">
          <LogVolumeChart granularity={granularity} />
        </ChartCard>
        <ChartCard title="Error Rate %">
          <ErrorRateChart granularity={granularity} />
        </ChartCard>
      </div>

      {/* Level distribution + Service error heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Level Distribution">
          <LevelDistributionChart />
        </ChartCard>
        <ChartCard title="Service Error Heatmap">
          <ServiceErrorHeatmap granularity={granularity} />
        </ChartCard>
      </div>
    </div>
  );
}
