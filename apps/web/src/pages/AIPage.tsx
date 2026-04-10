import { AISummaryPanel } from "../components/ai/AISummaryPanel";

export function AIPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <h1 className="text-sm font-semibold">AI Analysis</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Claude-powered log summarization and error clustering
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <AISummaryPanel />
      </div>
    </div>
  );
}
