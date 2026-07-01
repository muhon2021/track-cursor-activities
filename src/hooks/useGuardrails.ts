/**
 * Guardrails Management Hooks
 *
 * React hooks for managing agent guardrails and safety controls.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Guardrail {
  id: string;
  name: string;
  description: string | null;
  guardrail_type: string;
  rules: Record<string, any>;
  severity: string;
  is_active: boolean;
  is_system: boolean;
  created_by: string | null;
  created_at: string;
}

export interface GuardrailViolation {
  id: string;
  guardrail_id: string;
  agent_id: string;
  user_id: string | null;
  violation_details: Record<string, any>;
  action_taken: string;
  input_content: string | null;
  output_content: string | null;
  severity: string;
  created_at: string;
}

export interface CostLimit {
  id: string;
  agent_id: string;
  limit_type: string;
  max_cost: number;
  current_spend: number;
  reset_at: string | null;
  alert_threshold: number;
  alert_sent: boolean;
  is_active: boolean;
}

export interface ToolRestriction {
  id: string;
  tool_name: string;
  restriction_type: string;
  max_calls_per_hour: number | null;
  max_calls_per_day: number | null;
  requires_approval: boolean;
  is_active: boolean;
}

/**
 * Fetch all guardrails
 */
export function useGuardrails() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["guardrails"],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("agent_guardrails" as never)
        .select("*" as never)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Guardrail[];
    },
    enabled: !!user,
  });
}

/**
 * Fetch guardrails for a specific agent
 */
export function useAgentGuardrails(agentId: string) {
  return useQuery({
    queryKey: ["agent-guardrails", agentId],
    queryFn: async () => {
      if (!agentId) return [];

      const { data, error } = await supabase.rpc(
        "get_agent_guardrails" as never,
        { p_agent_id: agentId } as never
      );

      if (error) throw error;
      return data || [];
    },
    enabled: !!agentId,
  });
}

/**
 * Create a new guardrail
 */
export function useCreateGuardrail() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      description?: string;
      guardrail_type: string;
      rules: Record<string, any>;
      severity: string;
    }) => {
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("agent_guardrails" as never)
        .insert({
          ...params,
          created_by: user.id,
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guardrails"] });
      toast.success("Guardrail created successfully");
    },
    onError: (error: unknown) => {
      console.error("Create guardrail error:", error);
      toast.error((error as Error).message || "Failed to create guardrail");
    },
  });
}

/**
 * Update a guardrail
 */
export function useUpdateGuardrail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      name?: string;
      description?: string;
      rules?: Record<string, any>;
      severity?: string;
      is_active?: boolean;
    }) => {
      const { id, ...updates } = params;

      const { data, error } = await supabase
        .from("agent_guardrails" as never)
        .update(updates as never)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guardrails"] });
      toast.success("Guardrail updated successfully");
    },
    onError: (error: unknown) => {
      console.error("Update guardrail error:", error);
      toast.error((error as Error).message || "Failed to update guardrail");
    },
  });
}

/**
 * Delete a guardrail
 */
export function useDeleteGuardrail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (guardrailId: string) => {
      const { error } = await supabase
        .from("agent_guardrails" as never)
        .delete()
        .eq("id", guardrailId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guardrails"] });
      toast.success("Guardrail deleted successfully");
    },
    onError: (error: unknown) => {
      console.error("Delete guardrail error:", error);
      toast.error((error as Error).message || "Failed to delete guardrail");
    },
  });
}

/**
 * Assign guardrail to agent
 */
export function useAssignGuardrail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      agent_id: string;
      guardrail_id: string;
      override_rules?: Record<string, any>;
    }) => {
      const { data, error } = await supabase
        .from("agent_guardrail_assignments" as never)
        .insert(params as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["agent-guardrails", variables.agent_id] });
      toast.success("Guardrail assigned successfully");
    },
    onError: (error: unknown) => {
      console.error("Assign guardrail error:", error);
      toast.error((error as Error).message || "Failed to assign guardrail");
    },
  });
}

/**
 * Fetch guardrail violations
 */
export function useGuardrailViolations(agentId?: string, limit = 50) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["guardrail-violations", agentId],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("guardrail_violations" as never)
        .select(`
          *,
          guardrail:agent_guardrails(name, guardrail_type),
          agent:ai_agents(name)
        ` as never)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (agentId) {
        query = query.eq("agent_id", agentId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user,
  });
}

/**
 * Fetch cost limits for agent
 */
export function useAgentCostLimits(agentId: string) {
  return useQuery({
    queryKey: ["cost-limits", agentId],
    queryFn: async () => {
      if (!agentId) return [];

      const { data, error } = await supabase
        .from("agent_cost_limits" as never)
        .select("*" as never)
        .eq("agent_id", agentId)
        .eq("is_active", true);

      if (error) throw error;
      return (data || []) as CostLimit[];
    },
    enabled: !!agentId,
  });
}

/**
 * Set cost limit for agent
 */
export function useSetCostLimit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      agent_id: string;
      limit_type: string;
      max_cost: number;
      alert_threshold?: number;
    }) => {
      // Calculate reset_at based on limit_type
      const resetAt = new Date();
      switch (params.limit_type) {
        case "hourly":
          resetAt.setHours(resetAt.getHours() + 1);
          break;
        case "daily":
          resetAt.setDate(resetAt.getDate() + 1);
          break;
        case "weekly":
          resetAt.setDate(resetAt.getDate() + 7);
          break;
        case "monthly":
          resetAt.setMonth(resetAt.getMonth() + 1);
          break;
      }

      const { data, error } = await supabase
        .from("agent_cost_limits" as never)
        .upsert({
          ...params,
          reset_at: params.limit_type !== "per_execution" ? resetAt.toISOString() : null,
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cost-limits", variables.agent_id] });
      toast.success("Cost limit set successfully");
    },
    onError: (error: unknown) => {
      console.error("Set cost limit error:", error);
      toast.error((error as Error).message || "Failed to set cost limit");
    },
  });
}

/**
 * Fetch tool restrictions
 */
export function useToolRestrictions() {
  return useQuery({
    queryKey: ["tool-restrictions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tool_usage_restrictions" as never)
        .select("*" as never)
        .eq("is_active", true)
        .order("tool_name");

      if (error) throw error;
      return (data || []) as ToolRestriction[];
    },
  });
}

/**
 * Add tool restriction
 */
export function useAddToolRestriction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      tool_name: string;
      restriction_type: string;
      max_calls_per_hour?: number;
      max_calls_per_day?: number;
      requires_approval?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("tool_usage_restrictions" as never)
        .insert(params as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tool-restrictions"] });
      toast.success("Tool restriction added successfully");
    },
    onError: (error: unknown) => {
      console.error("Add tool restriction error:", error);
      toast.error((error as Error).message || "Failed to add tool restriction");
    },
  });
}

/**
 * Validate content against guardrails
 */
export function useValidateGuardrails() {
  return useMutation({
    mutationFn: async (params: {
      agent_id: string;
      content: string;
      validation_type: "input" | "output" | "both";
      tool_name?: string;
      estimated_cost?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke("validate-guardrails", {
        body: params,
      });

      if (error) throw error;
      return data;
    },
    onError: (error: unknown) => {
      console.error("Validate guardrails error:", error);
      toast.error((error as Error).message || "Failed to validate guardrails");
    },
  });
}

/**
 * Enforce guardrails on content
 */
export function useEnforceGuardrails() {
  return useMutation({
    mutationFn: async (params: {
      agent_id: string;
      content: string;
      enforcement_type: "input" | "output" | "both";
      tool_name?: string;
      estimated_cost?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke("enforce-guardrails", {
        body: params,
      });

      if (error) throw error;
      return data;
    },
    onError: (error: unknown) => {
      console.error("Enforce guardrails error:", error);
      toast.error((error as Error).message || "Failed to enforce guardrails");
    },
  });
}

/**
 * Get violation statistics
 */
export function useViolationStats(agentId?: string, days = 7) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["violation-stats", agentId, days],
    queryFn: async () => {
      if (!user) return null;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let query = supabase
        .from("guardrail_violations" as never)
        .select("guardrail_id, severity, action_taken, created_at" as never)
        .gte("created_at", startDate.toISOString());

      if (agentId) {
        query = query.eq("agent_id", agentId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Calculate statistics
      const stats = {
        total: data?.length || 0,
        blocked: data?.filter((v: any) => v.action_taken === "blocked").length || 0,
        warned: data?.filter((v: any) => v.action_taken === "warned").length || 0,
        by_severity: {
          block: data?.filter((v: any) => v.severity === "block").length || 0,
          warning: data?.filter((v: any) => v.severity === "warning").length || 0,
        },
      };

      return stats;
    },
    enabled: !!user,
  });
}
