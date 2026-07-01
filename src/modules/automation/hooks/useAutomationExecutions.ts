import { useQuery } from "@tanstack/react-query";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { API } from "@/shared/config/api";
import { queryKeys, cacheConfig } from "@/lib/cache";
import type { AutomationExecution } from "../types";

export function useAutomationExecutions() {
  return useQuery({
    queryKey: queryKeys.automation.executions(),
    queryFn: async () => {
      const res = await invokeEdgeFunction<{ data: AutomationExecution[] }>(
        API.AUTOMATION.MANAGE,
        { action: "list_executions" }
      );
      return res.data ?? [];
    },
    staleTime: cacheConfig.staleTime.short,
  });
}

export function useAutomationExecution(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.automation.execution(id ?? ""),
    queryFn: async () => {
      const res = await invokeEdgeFunction<{ data: AutomationExecution & { automation_execution_logs?: unknown[] } }>(
        API.AUTOMATION.MANAGE,
        { action: "get_execution", id }
      );
      return res.data;
    },
    enabled: !!id,
  });
}
