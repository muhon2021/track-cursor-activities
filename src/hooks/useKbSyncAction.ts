import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/cache";
import { toast } from "sonner";

export interface SyncActionItem {
  entity_type: "knowledge_file" | "unified_document";
  entity_id: string;
}

export function useKbSyncAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, items }: { action: "retry" | "requeue"; items: SyncActionItem[] }) => {
      const { data, error } = await supabase.functions.invoke("kb-sync-action", {
        body: { action, items },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.dashboardFiles });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.dashboardSyncLogs });
      toast.success(`${vars.items.length} document(s) ${vars.action === "retry" ? "retried" : "requeued"}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
