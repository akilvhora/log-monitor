import { useState } from "react";
import { Download } from "lucide-react";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { FilterBar } from "@/components/filters/FilterBar";
import { LogTable } from "@/components/logs/LogTable";
import { LiveTailBanner } from "@/components/logs/LiveTailBanner";
import { useFilterStore } from "@/stores/filterStore";
import { buildExportUrl } from "@/lib/api";

function ExportMenu() {
  const [open, setOpen] = useState(false);
  const { levels, service, from, to, search } = useFilterStore();
  const filter = { levels, service, from, to, search };

  function download(format: "csv" | "json") {
    const url = buildExportUrl(format, filter);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0, 10)}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2 py-1 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        title="Export logs"
      >
        <Download size={12} />
        Export
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded shadow-lg py-1 min-w-[130px]">
            <button
              onClick={() => download("csv")}
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-muted transition-colors"
            >
              Download CSV
            </button>
            <button
              onClick={() => download("json")}
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-muted transition-colors"
            >
              Download JSON
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function LogsPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <h1 className="text-sm font-semibold text-foreground">Logs</h1>
        <ExportMenu />
      </div>
      <StatsBar />
      <FilterBar />
      <LiveTailBanner />
      <LogTable />
    </div>
  );
}
