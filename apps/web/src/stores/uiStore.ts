import { create } from "zustand";
import type { LogEntry } from "@log-monitor/shared";

interface UIState {
  selectedLog: LogEntry | null;
  isDrawerOpen: boolean;
  liveTailEnabled: boolean;
  streamedLogs: LogEntry[];
  openDrawer: (log: LogEntry) => void;
  closeDrawer: () => void;
  toggleLiveTail: () => void;
  appendStreamedLog: (entry: LogEntry) => void;
  clearStreamedLogs: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedLog: null,
  isDrawerOpen: false,
  liveTailEnabled: false,
  streamedLogs: [],
  openDrawer: (log) => set({ selectedLog: log, isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false, selectedLog: null }),
  toggleLiveTail: () => set((s) => ({ liveTailEnabled: !s.liveTailEnabled, streamedLogs: [] })),
  appendStreamedLog: (entry) =>
    set((s) => ({ streamedLogs: [entry, ...s.streamedLogs].slice(0, 200) })),
  clearStreamedLogs: () => set({ streamedLogs: [] }),
}));
