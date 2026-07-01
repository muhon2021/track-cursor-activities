import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { API } from "@/shared/config/api";
import { queryKeys, invalidateKeys, cacheConfig } from "@/lib/cache";
import { toast } from "sonner";
import type { AutomationWorkflow, WorkflowDefinition } from "../types";

interface WorkflowFilters {
  search?: string;
  enabled?: boolean;
  trigger_type?: string;
}

export function useAutomationWorkflows(filters?: WorkflowFilters) {
  return useQuery({
    queryKey: queryKeys.automation.workflows(filters),
    queryFn: async () => {
      const res = await invokeEdgeFunction<{ data: AutomationWorkflow[] }>(
        API.AUTOMATION.MANAGE,
        { action: "list", filters }
      );
      return res.data ?? [];
    },
    staleTime: cacheConfig.staleTime.medium,
  });
}

export function useAutomationWorkflow(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.automation.workflow(id ?? ""),
    queryFn: async () => {
      const res = await invokeEdgeFunction<{ data: AutomationWorkflow }>(
        API.AUTOMATION.MANAGE,
        { action: "get", id }
      );
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workflow: Partial<AutomationWorkflow>) =>
      invokeEdgeFunction(API.AUTOMATION.MANAGE, {
        action: "create",
        workflow,
      }),
    onSuccess: () => {
      invalidateKeys.automation(queryClient);
      toast.success("Workflow created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, workflow }: { id: string; workflow: Partial<AutomationWorkflow> }) =>
      invokeEdgeFunction(API.AUTOMATION.MANAGE, {
        action: "update",
        id,
        workflow,
      }),
    onSuccess: () => {
      invalidateKeys.automation(queryClient);
      toast.success("Workflow saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      invokeEdgeFunction(API.AUTOMATION.MANAGE, { action: "delete", id }),
    onSuccess: () => {
      invalidateKeys.automation(queryClient);
      toast.success("Workflow deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCloneWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      invokeEdgeFunction(API.AUTOMATION.MANAGE, { action: "clone", id }),
    onSuccess: () => {
      invalidateKeys.automation(queryClient);
      toast.success("Workflow cloned");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      invokeEdgeFunction(API.AUTOMATION.MANAGE, {
        action: enabled ? "enable" : "disable",
        id,
      }),
    onSuccess: () => {
      invalidateKeys.automation(queryClient);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useExecuteWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: Record<string, unknown> }) =>
      invokeEdgeFunction(API.AUTOMATION.MANAGE, {
        action: "execute",
        id,
        workflow: { trigger_payload: payload ?? {} },
      }),
    onSuccess: () => {
      invalidateKeys.automation(queryClient);
      toast.success("Workflow execution started");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSaveWorkflowDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      name,
      description,
      trigger_type,
      definition,
      enabled,
    }: {
      id?: string;
      name: string;
      description?: string;
      trigger_type: string;
      definition: WorkflowDefinition;
      enabled?: boolean;
    }) => {
      if (id) {
        return invokeEdgeFunction(API.AUTOMATION.MANAGE, {
          action: "update",
          id,
          workflow: { name, description, trigger_type, definition, enabled },
        });
      }
      return invokeEdgeFunction(API.AUTOMATION.MANAGE, {
        action: "create",
        workflow: { name, description, trigger_type, definition, enabled: enabled ?? false },
      });
    },
    onSuccess: () => {
      invalidateKeys.automation(queryClient);
      toast.success("Draft saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
