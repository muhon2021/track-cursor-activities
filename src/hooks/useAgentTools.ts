/**
 * Agent Tool Orchestration Hooks
 *
 * React hooks for managing MCP tool execution, tool selection,
 * and tool orchestration within multi-step agent workflows.
 * 
 * NOTE: These hooks require the mcp_tools, mcp_tool_executions, 
 * agent_execution_plans, agent_execution_steps, and agent_reasoning_traces 
 * tables to be created via migration. Until then, they return empty data.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { invalidateKeys } from "@/lib/cache";

export interface MCPTool {
  id: string;
  server_id: string;
  name: string;
  description: string | null;
  input_schema: Record<string, unknown>;
  is_enabled: boolean;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  avg_execution_time_ms: number | null;
  last_executed_at: string | null;
  discovered_at: string;
  updated_at: string;
}

export interface MCPToolExecution {
  id: string;
  tool_id: string;
  server_id: string;
  agent_id: string | null;
  user_id: string;
  input_parameters: Record<string, unknown>;
  output_result: Record<string, unknown> | null;
  status: string;
  error_message: string | null;
  error_code: string | null;
  started_at: string;
  completed_at: string | null;
  execution_time_ms: number | null;
  execution_context: Record<string, unknown> | null;
}

export interface ExecuteToolParams {
  tool_id: string;
  input_parameters: Record<string, unknown>;
  agent_id?: string;
  plan_id?: string;
  step_id?: string;
  execution_context?: Record<string, unknown>;
}

/**
 * Fetch available MCP tools for an agent
 * Returns empty array until mcp_tools table is created
 */
export function useAgentTools(agentId?: string) {
  return useQuery({
    queryKey: ["agent-tools", agentId],
    queryFn: async (): Promise<MCPTool[]> => {
      try {
        const { data, error } = await supabase
          .from("mcp_tools" as never)
          .select("*")
          .eq("is_enabled", true)
          .order("name");

        if (error) {
          console.warn("mcp_tools table not available:", error.message);
          return [];
        }

        return (data || []) as MCPTool[];
      } catch {
        return [];
      }
    },
    enabled: !!agentId,
  });
}

/**
 * Execute an MCP tool
 */
export function useExecuteTool() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ExecuteToolParams) => {
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase.functions.invoke("execute-mcp-tool", {
        body: {
          tool_id: params.tool_id,
          input_parameters: params.input_parameters,
          agent_id: params.agent_id,
          plan_id: params.plan_id,
          step_id: params.step_id,
          user_id: user.id,
          execution_context: params.execution_context || {},
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      invalidateKeys.ai(queryClient);
      if (data?.success) {
        toast.success("Tool executed successfully");
      }
    },
    onError: (error: unknown) => {
      console.error("Tool execution error:", error);
      toast.error((error as Error).message || "Failed to execute tool");
    },
  });
}

/**
 * Fetch tool execution history
 * Returns empty array until mcp_tool_executions table is created
 */
export function useToolExecutions(filters?: {
  tool_id?: string;
  agent_id?: string;
  status?: string;
  limit?: number;
}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["tool-executions", filters],
    queryFn: async (): Promise<MCPToolExecution[]> => {
      if (!user) return [];

      try {
        const { data, error } = await supabase
          .from("mcp_tool_executions" as never)
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(filters?.limit || 50);

        if (error) {
          console.warn("mcp_tool_executions table not available:", error.message);
          return [];
        }

        return (data || []) as MCPToolExecution[];
      } catch {
        return [];
      }
    },
    enabled: !!user,
  });
}

/**
 * Fetch agent execution plans (multi-step workflows)
 * Returns empty array until agent_execution_plans table is created
 */
export function useAgentExecutionPlans(agentId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["execution-plans", agentId],
    queryFn: async () => {
      if (!user) return [];

      try {
        const { data, error } = await supabase
          .from("agent_execution_plans" as never)
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) {
          console.warn("agent_execution_plans table not available:", error.message);
          return [];
        }

        return data || [];
      } catch {
        return [];
      }
    },
    enabled: !!user,
  });
}

/**
 * Fetch execution steps for a plan
 * Returns empty array until agent_execution_steps table is created
 */
export function useExecutionSteps(planId: string) {
  return useQuery({
    queryKey: ["execution-steps", planId],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("agent_execution_steps" as never)
          .select("*")
          .eq("plan_id", planId)
          .order("step_number");

        if (error) {
          console.warn("agent_execution_steps table not available:", error.message);
          return [];
        }

        return data || [];
      } catch {
        return [];
      }
    },
    enabled: !!planId,
  });
}

/**
 * Fetch reasoning traces for a plan
 * Returns empty array until agent_reasoning_traces table is created
 */
export function useReasoningTraces(planId: string) {
  return useQuery({
    queryKey: ["reasoning-traces", planId],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("agent_reasoning_traces" as never)
          .select("*")
          .eq("plan_id", planId)
          .order("created_at");

        if (error) {
          console.warn("agent_reasoning_traces table not available:", error.message);
          return [];
        }

        return data || [];
      } catch {
        return [];
      }
    },
    enabled: !!planId,
  });
}

/**
 * Get tool recommendations based on user intent
 * Returns empty array until mcp_tools table is created
 */
export function useRecommendTools(intent: string, agentId?: string) {
  return useQuery({
    queryKey: ["recommend-tools", intent, agentId],
    queryFn: async () => {
      try {
        const { data: tools, error } = await supabase
          .from("mcp_tools" as never)
          .select("*")
          .eq("is_enabled", true);

        if (error) {
          console.warn("mcp_tools table not available:", error.message);
          return [];
        }

        // Simple keyword matching for now
        // In production, this would use semantic search with embeddings
        const keywords = intent.toLowerCase().split(/\s+/);
        const scoredTools = (tools || []).map((tool: Record<string, unknown>) => {
          const description = (String(tool.description || "")).toLowerCase();
          const name = String(tool.name || "").toLowerCase();

          let score = 0;
          keywords.forEach((keyword) => {
            if (name.includes(keyword)) score += 3;
            if (description.includes(keyword)) score += 1;
          });

          return { ...tool, relevance_score: score };
        });

        return scoredTools
          .filter((t) => t.relevance_score > 0)
          .sort((a, b) => b.relevance_score - a.relevance_score)
          .slice(0, 5);
      } catch {
        return [];
      }
    },
    enabled: !!intent && intent.length > 3,
  });
}
