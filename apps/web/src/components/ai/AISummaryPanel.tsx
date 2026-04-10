import { useRef, useState, useCallback } from "react";
import { Sparkles, Layers, Loader2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useFilterStore } from "../../stores/filterStore";
import { useServices } from "../../hooks/useLogs";
import {
  streamAISummary,
  fetchGroupErrors,
  fetchAISummaries,
  type ErrorGroup,
  type AISummaryHistory,
} from "../../lib/api";
import type { LogLevel } from "@log-monitor/shared";
import { useQuery } from "@tanstack/react-query";
import { LogLevelBadge } from "../logs/LogLevelBadge";

// ---------------------------------------------------------------------------
// Tiny markdown renderer — handles the output format Claude returns
// ---------------------------------------------------------------------------
function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-sm font-semibold text-foreground mt-4 mb-1">
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-xs font-semibold text-foreground mt-3 mb-1">
          {line.slice(4)}
        </h3>,
      );
    } else if (/^[-*] /.test(line)) {
      elements.push(
        <li key={i} className="ml-3 text-xs text-muted-foreground list-disc list-inside leading-relaxed">
          <InlineMarkdown text={line.slice(2)} />
        </li>,
      );
    } else if (/^\d+\. /.test(line)) {
      elements.push(
        <li key={i} className="ml-3 text-xs text-muted-foreground list-decimal list-inside leading-relaxed">
          <InlineMarkdown text={line.replace(/^\d+\. /, "")} />
        </li>,
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1" />);
    } else {
      elements.push(
        <p key={i} className="text-xs text-muted-foreground leading-relaxed">
          <InlineMarkdown text={line} />
        </p>,
      );
    }
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={idx} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code key={idx} className="font-mono text-primary bg-primary/10 px-0.5 rounded">{part.slice(1, -1)}</code>;
        }
        return <span key={idx}>{part}</span>;
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Filter mini-bar (independent from main filter store — uses it as default)
// ---------------------------------------------------------------------------
const LEVELS: LogLevel[] = ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"];

function FilterConfig({
  value,
  onChange,
}: {
  value: { levels: LogLevel[]; service: string; from: string; to: string; search: string };
  onChange: (v: typeof value) => void;
}) {
  const { data: services = [] } = useServices();

  const toggleLevel = (l: LogLevel) => {
    const next = value.levels.includes(l)
      ? value.levels.filter((x) => x !== l)
      : [...value.levels, l];
    onChange({ ...value, levels: next });
  };

  return (
    <div className="space-y-2">
      {/* Levels */}
      <div className="flex flex-wrap gap-1">
        {LEVELS.map((l) => (
          <button
            key={l}
            onClick={() => toggleLevel(l)}
            className={`px-2 py-0.5 rounded text-xs font-medium border transition-opacity ${
              value.levels.includes(l) || value.levels.length === 0 ? "opacity-100" : "opacity-30"
            }`}
            style={{ borderColor: "transparent" }}
          >
            <LogLevelBadge level={l} />
          </button>
        ))}
      </div>

      {/* Service + Search */}
      <div className="flex gap-2">
        <select
          value={value.service}
          onChange={(e) => onChange({ ...value, service: e.target.value })}
          className="flex-1 text-xs bg-muted border border-border rounded px-2 py-1 text-muted-foreground"
        >
          <option value="">All services</option>
          {services.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search…"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          className="flex-1 text-xs bg-muted border border-border rounded px-2 py-1 placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Date range */}
      <div className="flex gap-2">
        <input
          type="datetime-local"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="flex-1 text-xs bg-muted border border-border rounded px-2 py-1 text-muted-foreground"
        />
        <input
          type="datetime-local"
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          className="flex-1 text-xs bg-muted border border-border rounded px-2 py-1 text-muted-foreground"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error groups display
// ---------------------------------------------------------------------------
function ErrorGroupCard({ group }: { group: ErrorGroup }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-md p-3 space-y-1">
      <button
        className="w-full flex items-start justify-between gap-2 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <span className="text-xs font-semibold text-foreground">{group.name}</span>
          <span className="ml-2 text-xs text-muted-foreground">({group.count} logs)</span>
        </div>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div className="space-y-1 pt-1">
          <p className="text-xs text-muted-foreground">{group.pattern}</p>
          {group.examples.length > 0 && (
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-foreground">Examples:</p>
              {group.examples.slice(0, 3).map((ex, i) => (
                <p key={i} className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded truncate">
                  {ex}
                </p>
              ))}
            </div>
          )}
          <p className="text-xs text-primary font-medium pt-0.5">{group.suggestedFix}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// History item
// ---------------------------------------------------------------------------
function HistoryItem({
  item,
  selected,
  onSelect,
}: {
  item: AISummaryHistory;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-2 rounded-md text-xs border transition-colors ${
        selected
          ? "bg-primary/10 border-primary/30 text-foreground"
          : "bg-transparent border-transparent hover:bg-muted text-muted-foreground"
      }`}
    >
      <div className="font-medium truncate">
        {new Date(item.createdAt).toLocaleString()}
      </div>
      <div className="text-muted-foreground mt-0.5">
        {item.logCount} logs · {item.services.slice(0, 2).join(", ")}
        {item.services.length > 2 ? ` +${item.services.length - 2}` : ""}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------
type Tab = "summarize" | "group";

export function AISummaryPanel() {
  const store = useFilterStore();

  const [tab, setTab] = useState<Tab>("summarize");
  const [filterCfg, setFilterCfg] = useState({
    levels: store.levels,
    service: store.service,
    from: store.from,
    to: store.to,
    search: store.search,
  });

  // Summarize state
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamMeta, setStreamMeta] = useState<{ logCount: number; services: string[] } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Group errors state
  const [grouping, setGrouping] = useState(false);
  const [groups, setGroups] = useState<ErrorGroup[] | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);

  // History
  const { data: history = [] } = useQuery({
    queryKey: ["ai-summaries"],
    queryFn: fetchAISummaries,
    staleTime: 30_000,
  });
  const [selectedHistory, setSelectedHistory] = useState<AISummaryHistory | null>(null);

  const handleSummarize = useCallback(() => {
    if (streaming) {
      abortRef.current?.abort();
      return;
    }
    setStreaming(true);
    setStreamText("");
    setStreamError(null);
    setStreamMeta(null);
    setSelectedHistory(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    streamAISummary(
      filterCfg,
      {
        onToken: (t) => setStreamText((prev) => prev + t),
        onDone: (data) => {
          setStreamMeta({ logCount: data.logCount, services: data.services });
          setStreaming(false);
        },
        onError: (msg) => {
          setStreamError(msg);
          setStreaming(false);
        },
      },
      ctrl.signal,
    ).catch(() => setStreaming(false));
  }, [streaming, filterCfg]);

  const handleGroupErrors = useCallback(async () => {
    setGrouping(true);
    setGroups(null);
    setGroupError(null);
    try {
      const result = await fetchGroupErrors(filterCfg);
      setGroups(result.groups);
    } catch (err) {
      setGroupError(err instanceof Error ? err.message : String(err));
    } finally {
      setGrouping(false);
    }
  }, [filterCfg]);

  const displayText = selectedHistory?.response ?? streamText;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-border shrink-0">
        <button
          onClick={() => setTab("summarize")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            tab === "summarize"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles size={12} />
          Summarize
        </button>
        <button
          onClick={() => setTab("group")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            tab === "group"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers size={12} />
          Group Errors
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: config + history */}
        <div className="w-72 shrink-0 border-r border-border flex flex-col overflow-hidden">
          {/* Filter config */}
          <div className="p-3 border-b border-border space-y-3 shrink-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Filters</p>
            <FilterConfig value={filterCfg} onChange={setFilterCfg} />

            {tab === "summarize" && (
              <button
                onClick={handleSummarize}
                disabled={false}
                className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  streaming
                    ? "bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {streaming ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Stop
                  </>
                ) : (
                  <>
                    <Sparkles size={12} />
                    Summarize with AI
                  </>
                )}
              </button>
            )}

            {tab === "group" && (
              <button
                onClick={handleGroupErrors}
                disabled={grouping}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {grouping ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <Layers size={12} />
                    Group Errors
                  </>
                )}
              </button>
            )}
          </div>

          {/* History (only on summarize tab) */}
          {tab === "summarize" && history.length > 0 && (
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 py-1">
                History
              </p>
              {history.map((item) => (
                <HistoryItem
                  key={item.id}
                  item={item}
                  selected={selectedHistory?.id === item.id}
                  onSelect={() =>
                    setSelectedHistory((prev) => (prev?.id === item.id ? null : item))
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: result area */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "summarize" && (
            <>
              {/* Streaming indicator */}
              {streaming && !streamText && (
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Loader2 size={14} className="animate-spin" />
                  Fetching logs and streaming analysis…
                </div>
              )}

              {/* Error */}
              {streamError && (
                <div className="flex items-start gap-2 text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  {streamError}
                </div>
              )}

              {/* Result */}
              {displayText && (
                <div className="space-y-2">
                  {streamMeta && !selectedHistory && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground border-b border-border pb-2 mb-3">
                      <span>{streamMeta.logCount} logs analyzed</span>
                      <span>·</span>
                      <span>{streamMeta.services.join(", ")}</span>
                    </div>
                  )}
                  {selectedHistory && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground border-b border-border pb-2 mb-3">
                      <span>{selectedHistory.logCount} logs · {new Date(selectedHistory.createdAt).toLocaleString()}</span>
                    </div>
                  )}
                  <MarkdownText text={displayText} />
                  {streaming && (
                    <span className="inline-block w-1 h-3 bg-primary animate-pulse ml-0.5 align-middle" />
                  )}
                </div>
              )}

              {/* Empty state */}
              {!streaming && !streamText && !streamError && !selectedHistory && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted-foreground">
                  <Sparkles size={32} className="opacity-30" />
                  <p className="text-sm">Configure filters and click <strong className="text-foreground">Summarize with AI</strong></p>
                  <p className="text-xs max-w-xs">
                    Claude will analyze up to 200 log entries and provide a structured summary,
                    root cause analysis, and debugging steps.
                  </p>
                </div>
              )}
            </>
          )}

          {tab === "group" && (
            <>
              {groupError && (
                <div className="flex items-start gap-2 text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  {groupError}
                </div>
              )}

              {grouping && (
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Loader2 size={14} className="animate-spin" />
                  Clustering error logs…
                </div>
              )}

              {groups && groups.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-8">
                  No ERROR or FATAL logs found for the current filters.
                </div>
              )}

              {groups && groups.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-3">
                    {groups.length} error group{groups.length !== 1 ? "s" : ""} identified
                  </p>
                  {groups.map((g, i) => (
                    <ErrorGroupCard key={i} group={g} />
                  ))}
                </div>
              )}

              {!grouping && !groups && !groupError && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted-foreground">
                  <Layers size={32} className="opacity-30" />
                  <p className="text-sm">Click <strong className="text-foreground">Group Errors</strong> to cluster ERROR and FATAL logs</p>
                  <p className="text-xs max-w-xs">
                    Claude will semantically group similar errors and suggest a fix for each category.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
