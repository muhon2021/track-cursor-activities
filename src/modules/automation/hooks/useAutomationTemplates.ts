import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { API } from "@/shared/config/api";
import { queryKeys, invalidateKeys, cacheConfig } from "@/lib/cache";
import { toast } from "sonner";
import type { AutomationTemplate } from "../types";

export function useAutomationTemplates() {
  return useQuery({
    queryKey: queryKeys.automation.templates,
    queryFn: async () => {
      const res = await invokeEdgeFunction<{ data: AutomationTemplate[] }>(
        API.AUTOMATION.MANAGE,
        { action: "list_templates" }
      );
      return res.data ?? [];
    },
    staleTime: cacheConfig.staleTime.long,
  });
}

export function useCloneTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) =>
      invokeEdgeFunction(API.AUTOMATION.MANAGE, {
        action: "clone_template",
        template_id: templateId,
      }),
    onSuccess: () => {
      invalidateKeys.automation(queryClient);
      toast.success("Template cloned to new workflow");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
