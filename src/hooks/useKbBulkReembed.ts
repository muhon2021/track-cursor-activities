import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/cache";
import { toast } from "sonner";
import type { KbReembedJob } from "@/types/knowledgeRag";

export function useKbReembedJob(jobId: string | null) {
  return useQuery({
    queryKey: queryKeys.knowledge.bulkReembed(jobId ?? ""),
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("kb-bulk-reembed", {
        body: { action: "status", job_id: jobId },
      });
      if (error) throw error;
      return data?.job as KbReembedJob;
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "running" || status === "pending" ? 2000 : false;
    },
  });
}

export function useStartKbReembed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sourceId: string) => {
      const { data, error } = await supabase.functions.invoke("kb-bulk-reembed", {
        body: { action: "start", source_id: sourceId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.job as KbReembedJob;
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.bulkReembed(job.id) });
      toast.success("Re-embed job started");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useKbReembedControl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, job_id }: { action: "pause" | "resume" | "cancel"; job_id: string }) => {
      const { data, error } = await supabase.functions.invoke("kb-bulk-reembed", {
        body: { action, job_id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.bulkReembed(vars.job_id) });
      toast.success(`Job ${vars.action}d`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
