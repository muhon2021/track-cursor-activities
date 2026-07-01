/**
 * Approval System Hooks (HITL)
 *
 * React hooks for Human-in-the-Loop approval workflows.
 * Enables users to approve/reject critical agent actions.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ApprovalRequest {
  id: string;
  workflow_id: string | null;
  agent_id: string;
  user_id: string;
  request_type: string;
  action_description: string;
  tool_name: string | null;
  tool_parameters: any;
  estimated_cost: number | null;
  risk_level: string;
  agent_reasoning: string | null;
  confidence_score: number | null;
  status: string;
  approved_by: string | null;
  approval_note: string | null;
  requested_at: string;
  expires_at: string | null;
  responded_at: string | null;
}

export interface ApprovalWorkflow {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_conditions: any;
  approver_type: string;
  approver_config: any;
  require_reason: boolean;
  timeout_minutes: number | null;
  auto_approve_threshold: number | null;
  is_enabled: boolean;
}

/**
 * Request approval for an agent action
 */
export function useRequestApproval() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      agent_id: string;
      action_description: string;
      request_type: string;
      tool_name?: string;
      tool_parameters?: Record<string, any>;
      estimated_cost?: number;
      risk_level?: 'low' | 'medium' | 'high' | 'critical';
      agent_reasoning?: string;
      confidence_score?: number;
      timeout_minutes?: number;
    }) => {
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase.functions.invoke("request-approval", {
        body: {
          ...params,
          user_id: user.id,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.requires_approval) {
        toast.info("Approval requested. Waiting for review.", {
          description: `Request ID: ${data.approval_request_id.slice(0, 8)}...`,
        });
      } else {
        toast.success("Action approved automatically");
      }
    },
    onError: (error: unknown) => {
      console.error("Request approval error:", error);
      toast.error((error as Error).message || "Failed to request approval");
    },
  });
}

/**
 * Respond to an approval request (approve/reject)
 */
export function useRespondToApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      approval_request_id: string;
      approved: boolean;
      approval_note?: string;
      execute_immediately?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke("respond-to-approval", {
        body: params,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["approval-requests"] });
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });

      if (variables.approved) {
        toast.success("Request approved", {
          description: data.execution_result ? "Action executed" : "Agent can proceed",
        });
      } else {
        toast.info("Request rejected");
      }
    },
    onError: (error: unknown) => {
      console.error("Respond to approval error:", error);
      toast.error((error as Error).message || "Failed to respond to approval");
    },
  });
}

/**
 * Fetch pending approval requests for current user
 */
export function usePendingApprovals() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["pending-approvals"],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase.rpc(
        "get_pending_approvals_for_user" as never,
        { p_user_id: user.id } as never
      );

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 10000, // Poll every 10 seconds for new approvals
  });
}

/**
 * Fetch all approval requests (with filters)
 */
export function useApprovalRequests(filters?: {
  status?: string;
  agent_id?: string;
  user_id?: string;
}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["approval-requests", filters],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("approval_requests" as never)
        .select(`
          *,
          agent:ai_agents(*),
          workflow:approval_workflows(*)
        ` as never)
        .order("requested_at", { ascending: false })
        .limit(100);

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      if (filters?.agent_id) {
        query = query.eq("agent_id", filters.agent_id);
      }

      if (filters?.user_id) {
        query = query.eq("user_id", filters.user_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as ApprovalRequest[];
    },
    enabled: !!user,
  });
}

/**
 * Fetch approval workflows
 */
export function useApprovalWorkflows() {
  return useQuery({
    queryKey: ["approval-workflows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approval_workflows" as never)
        .select("*" as never)
        .eq("is_enabled", true)
        .order("name");

      if (error) throw error;
      return (data || []) as ApprovalWorkflow[];
    },
  });
}

/**
 * Create approval workflow
 */
export function useCreateApprovalWorkflow() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      description?: string;
      trigger_type: string;
      trigger_conditions: Record<string, any>;
      approver_type: string;
      approver_config?: Record<string, any>;
      require_reason?: boolean;
      timeout_minutes?: number;
      auto_approve_threshold?: number;
    }) => {
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("approval_workflows" as never)
        .insert({
          ...params,
          created_by: user.id,
          is_enabled: true,
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approval-workflows"] });
      toast.success("Approval workflow created");
    },
    onError: (error: unknown) => {
      console.error("Create workflow error:", error);
      toast.error((error as Error).message || "Failed to create workflow");
    },
  });
}

/**
 * Delegate approval authority
 */
export function useDelegateApproval() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      delegate_id: string;
      workflow_id?: string;
      agent_id?: string;
      max_cost_limit?: number;
      allowed_risk_levels?: string[];
      valid_until?: string;
    }) => {
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("approval_delegations" as never)
        .insert({
          delegator_id: user.id,
          delegate_id: params.delegate_id,
          workflow_id: params.workflow_id || null,
          agent_id: params.agent_id || null,
          max_cost_limit: params.max_cost_limit || null,
          allowed_risk_levels: params.allowed_risk_levels || null,
          valid_until: params.valid_until || null,
          is_active: true,
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approval-delegations"] });
      toast.success("Approval authority delegated");
    },
    onError: (error: unknown) => {
      console.error("Delegate approval error:", error);
      toast.error((error as Error).message || "Failed to delegate approval");
    },
  });
}

/**
 * Fetch approval delegations
 */
export function useApprovalDelegations() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["approval-delegations"],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("approval_delegations" as never)
        .select(`
          *,
          delegator:profiles!delegator_id(*),
          delegate:profiles!delegate_id(*),
          workflow:approval_workflows(*),
          agent:ai_agents(*)
        ` as never)
        .or(`delegator_id.eq.${user.id},delegate_id.eq.${user.id}`)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}
