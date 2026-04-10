import { create } from "zustand";
import type { LogLevel } from "@log-monitor/shared";

interface FilterState {
  levels: LogLevel[];
  service: string;
  from: string;
  to: string;
  search: string;
  setLevels: (levels: LogLevel[]) => void;
  setService: (service: string) => void;
  setFrom: (from: string) => void;
  setTo: (to: string) => void;
  setSearch: (search: string) => void;
  reset: () => void;
}

const DEFAULT: Pick<FilterState, "levels" | "service" | "from" | "to" | "search"> = {
  levels: [],
  service: "",
  from: "",
  to: "",
  search: "",
};

export const useFilterStore = create<FilterState>((set) => ({
  ...DEFAULT,
  setLevels: (levels) => set({ levels }),
  setService: (service) => set({ service }),
  setFrom: (from) => set({ from }),
  setTo: (to) => set({ to }),
  setSearch: (search) => set({ search }),
  reset: () => set(DEFAULT),
}));
