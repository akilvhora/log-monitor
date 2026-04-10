import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useFilterStore } from "../stores/filterStore";
import {
  fetchLogs, fetchStats, fetchServices, fetchTimeline,
  fetchHeatmap, fetchSettings,
} from "../lib/api";

export function useLogs(limit = 100) {
  const { levels, service, from, to, search } = useFilterStore();
  const sortedLevels = [...levels].sort();

  return useQuery({
    queryKey: ["logs", { levels: sortedLevels, service, from, to, search, limit }],
    queryFn: () =>
      fetchLogs({
        levels: levels.length > 0 ? levels : undefined,
        service: service || undefined,
        from: from || undefined,
        to: to || undefined,
        search: search || undefined,
        limit,
      }),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useStats() {
  const { service, from, to } = useFilterStore();

  return useQuery({
    queryKey: ["stats", { service, from, to }],
    queryFn: () =>
      fetchStats({
        service: service || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
    refetchInterval: 30_000,
  });
}

export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: fetchServices,
    staleTime: 60_000,
  });
}

export function useTimeline(granularity: "minute" | "hour" | "day" = "hour") {
  const { service, from, to } = useFilterStore();

  return useQuery({
    queryKey: ["timeline", { service, from, to, granularity }],
    queryFn: () =>
      fetchTimeline({
        service: service || undefined,
        from: from || undefined,
        to: to || undefined,
        granularity,
      }),
    refetchInterval: 30_000,
  });
}

export function useHeatmap(granularity: "minute" | "hour" | "day" = "hour") {
  const { from, to } = useFilterStore();

  return useQuery({
    queryKey: ["heatmap", { from, to, granularity }],
    queryFn: () =>
      fetchHeatmap({
        from: from || undefined,
        to: to || undefined,
        granularity,
      }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    staleTime: 60_000,
  });
}
