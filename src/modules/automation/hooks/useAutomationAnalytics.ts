import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { supabase } from "@/integrations/supabase/client";
import { API } from "@/shared/config/api";
import { queryKeys, invalidateKeys, cacheConfig } from "@/lib/cache";
import { toast } from "sonner";
import { useAutomationExecutions } from "./useAutomationExecutions";
import type { AutomationWebhook } from "../types";

export function useAutomationAnalytics() {
  const { data: executions = [], isLoading } = useAutomationExecutions();

  const total = executions.length;
  const completed = executions.filter((e) => e.status === "completed").length;
  const failed = executions.filter((e) => e.status === "failed").length;
  const running = executions.filter((e) => e.status === "running" || e.status === "pending").length;

  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const failureRate = total > 0 ? Math.round((failed / total) * 100) : 0;

  const durations = executions
    .filter((e) => e.started_at && e.completed_at)
    .map((e) => new Date(e.completed_at!).getTime() - new Date(e.started_at!).getTime());
  const avgDurationMs = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const byDay = new Map<string, number>();
  for (const e of executions) {
    const day = (e.started_at ?? e.completed_at ?? "").slice(0, 10);
    if (day) byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const dailyExecutions = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, count]) => ({ date, count }));

  const errorCounts = new Map<string, number>();
  for (const e of executions.filter((x) => x.error_message)) {
    const msg = e.error_message!.slice(0, 80);
    errorCounts.set(msg, (errorCounts.get(msg) ?? 0) + 1);
  }
  const topErrors = [...errorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([error, count]) => ({ error, count }));

  return {
    isLoading,
    metrics: {
      total,
      active: running,
      successRate,
      failureRate,
      avgDurationMs,
      completed,
      failed,
    },
    dailyExecutions,
    topErrors,
  };
}

export function useAutomationWebhooks() {
  return useQuery({
    queryKey: queryKeys.automation.webhooks,
    queryFn: async () => {
      const res = await invokeEdgeFunction<{ data: AutomationWebhook[] }>(
        API.AUTOMATION.MANAGE,
        { action: "list_webhooks" }
      );
      return res.data ?? [];
    },
    staleTime: cacheConfig.staleTime.medium,
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; workflow_id: string; path_slug?: string }) =>
      invokeEdgeFunction(API.AUTOMATION.MANAGE, {
        action: "create_webhook",
        workflow: payload,
      }),
    onSuccess: () => {
      invalidateKeys.automation(queryClient);
      toast.success("Webhook created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      invokeEdgeFunction(API.AUTOMATION.MANAGE, { action: "delete_webhook", id }),
    onSuccess: () => {
      invalidateKeys.automation(queryClient);
      toast.success("Webhook deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRespondApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      approvalId,
      status,
      comment,
    }: {
      approvalId: string;
      status: "approved" | "rejected";
      comment?: string;
    }) =>
      invokeEdgeFunction(API.AUTOMATION.MANAGE, {
        action: "respond_approval",
        approval_id: approvalId,
        approval_status: status,
        comment,
      }),
    onSuccess: () => {
      invalidateKeys.automation(queryClient);
      toast.success("Approval recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAutomationApprovals() {
  return useQuery({
    queryKey: queryKeys.automation.approvals,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_approvals")
        .select("*, automation_executions(workflow_id, automation_workflows(name))")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: cacheConfig.staleTime.short,
  });
}
