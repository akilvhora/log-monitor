import { useEffect, useRef, useCallback } from "react";
import type { LogEntry } from "@log-monitor/shared";

const WS_URL = (() => {
  const base = import.meta.env.VITE_WS_URL as string | undefined;
  if (base) return base;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//localhost:3001`;
})();

export function useLogStream(onEntry: (entry: LogEntry) => void, enabled: boolean) {
  const wsRef = useRef<WebSocket | null>(null);
  const onEntryRef = useRef(onEntry);
  onEntryRef.current = onEntry;

  const connect = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    const ws = new WebSocket(`${WS_URL}/live`);

    ws.onmessage = (e) => {
      try {
        const entry = JSON.parse(e.data) as LogEntry;
        onEntryRef.current(entry);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => ws.close();
    ws.onclose = () => {
      // Reconnect after 3s if still enabled
      if (wsRef.current === ws) {
        setTimeout(() => { if (wsRef.current === ws) connect(); }, 3000);
      }
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    if (!enabled) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }
    connect();
    return () => {
      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
    };
  }, [enabled, connect]);
}
