import { Radio, WifiOff } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { useLogStream } from "@/hooks/useLogStream";
import { cn } from "@/lib/utils";

export function LiveTailBanner() {
  const { liveTailEnabled, streamedLogs, toggleLiveTail, appendStreamedLog } = useUIStore();

  useLogStream(appendStreamedLog, liveTailEnabled);

  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-1.5 text-xs border-b border-border transition-colors",
      liveTailEnabled ? "bg-green-950/30" : "bg-muted/20"
    )}>
      <button
        onClick={toggleLiveTail}
        className={cn(
          "flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium transition-colors",
          liveTailEnabled
            ? "border-green-700 text-green-400 bg-green-950/50 hover:bg-green-900/50"
            : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
        )}
      >
        {liveTailEnabled ? (
          <><Radio size={11} className="animate-pulse" /> Live Tail ON</>
        ) : (
          <><WifiOff size={11} /> Live Tail OFF</>
        )}
      </button>

      {liveTailEnabled && (
        <span className="text-muted-foreground">
          {streamedLogs.length === 0
            ? "Waiting for new logs..."
            : <span className="text-green-400">{streamedLogs.length} new log{streamedLogs.length !== 1 ? "s" : ""} received</span>
          }
        </span>
      )}
    </div>
  );
}
