import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { uploadLogFile, commitImport, fetchImportJobs, fetchImportJob } from "../lib/api";
import type { CommitImportInput } from "@log-monitor/shared";

export function useUploadFile() {
  return useMutation({
    mutationFn: (file: File) => uploadLogFile(file),
  });
}

export function useCommitImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CommitImportInput) => commitImport(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["import", "jobs"] }),
  });
}

export function useImportJob(jobId: string | null) {
  return useQuery({
    queryKey: ["import", "job", jobId],
    queryFn: () => fetchImportJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "processing" || status === "pending" ? 1000 : false;
    },
  });
}

export function useImportJobs() {
  return useQuery({
    queryKey: ["import", "jobs"],
    queryFn: fetchImportJobs,
    staleTime: 10_000,
  });
}
