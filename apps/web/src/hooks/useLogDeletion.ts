import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteAllLogs, deleteJobLogs } from "../lib/api";

export function useDeleteAllLogs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteAllLogs(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

export function useDeleteJobLogs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => deleteJobLogs(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["importJobs"] });
      queryClient.invalidateQueries({ queryKey: ["logs"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}
