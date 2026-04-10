import { useFilterStore } from "@/stores/filterStore";
import { useServices } from "@/hooks/useLogs";
import type { LogLevel } from "@log-monitor/shared";
import { Search, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

const ALL_LEVELS: LogLevel[] = ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"];

const LEVEL_STYLES: Record<LogLevel, string> = {
  DEBUG: "border-slate-700 text-slate-400 data-[active=true]:bg-slate-800",
  INFO: "border-blue-800 text-blue-400 data-[active=true]:bg-blue-950",
  WARN: "border-yellow-800 text-yellow-400 data-[active=true]:bg-yellow-950",
  ERROR: "border-red-800 text-red-400 data-[active=true]:bg-red-950",
  FATAL: "border-red-600 text-red-200 data-[active=true]:bg-red-900",
};

export function FilterBar() {
  const { levels, service, from, to, search, setLevels, setService, setFrom, setTo, setSearch, reset } =
    useFilterStore();
  const { data: services } = useServices();
  const [searchInput, setSearchInput] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput, setSearch]);

  function toggleLevel(level: LogLevel) {
    if (levels.includes(level)) {
      setLevels(levels.filter((l) => l !== level));
    } else {
      setLevels([...levels, level]);
    }
  }

  const hasFilters = levels.length > 0 || service || from || to || search;

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border bg-card">
      {/* Level toggles */}
      <div className="flex items-center gap-1">
        {ALL_LEVELS.map((level) => (
          <button
            key={level}
            data-active={levels.includes(level)}
            onClick={() => toggleLevel(level)}
            className={cn(
              "px-2 py-0.5 rounded text-xs font-semibold border transition-colors",
              LEVEL_STYLES[level],
              !levels.includes(level) && "opacity-50"
            )}
          >
            {level}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Service filter */}
      <select
        value={service}
        onChange={(e) => setService(e.target.value)}
        className="bg-muted border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">All services</option>
        {services?.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {/* Date range */}
      <input
        type="datetime-local"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="bg-muted border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <span className="text-muted-foreground text-xs">to</span>
      <input
        type="datetime-local"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="bg-muted border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />

      <div className="w-px h-5 bg-border" />

      {/* Search */}
      <div className="relative">
        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search messages..."
          className="bg-muted border border-border rounded pl-6 pr-2 py-1 text-xs text-foreground w-52 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
        />
        {searchInput && (
          <button
            onClick={() => setSearchInput("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X size={10} />
          </button>
        )}
      </div>

      {/* Reset */}
      {hasFilters && (
        <button
          onClick={() => {
            reset();
            setSearchInput("");
          }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
        >
          <RotateCcw size={11} />
          Reset
        </button>
      )}
    </div>
  );
}
