import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { syncAgentMcpServers } from "@/lib/agent-mcp-sync";

export interface AIAgent {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  system_prompt: string;
  data_sources: unknown;
  provider_config: unknown;
  required_role: string | null;
  is_enabled: boolean;
  memory_enabled: boolean;
  rag_enabled: boolean;
  graphify_enabled: boolean;
  metadata: unknown;
  created_at: string;
  updated_at: string;
  // Conversation-related fields (Phase 1)
  avatar: string | null;
  welcome_message: string | null;
  conversation_starters: string[] | null;
  is_default: boolean;
  usage_count: number;
  // Tool configuration fields (Phase 2)
  tool_code_interpreter: boolean;
  tool_file_search: boolean;
  tool_web_search: boolean;
  tool_image_generation: boolean;
  tool_mcp: boolean;
  mcp_server_ids: string[];
  tools_config: unknown[];
}

export interface AgentRun {
  id: string;
  agent_id: string;
  user_id: string;
  input: string | null;
  output: string | null;
  status: string | null;
  error_message: string | null;
  latency_ms: number | null;
  context: unknown;
  token_metrics: unknown;
  provider_used: string | null;
  model_used: string | null;
  metadata: unknown;
  created_at: string;
  updated_at: string;
}

export interface AgentFormData {
  name: string;
  slug?: string;
  description?: string;
  category: string;
  system_prompt: string;
  is_enabled: boolean;
  memory_enabled: boolean;
  // Conversation fields
  avatar?: string;
  welcome_message?: string;
  conversation_starters?: string[];
  // Tool configuration
  tool_code_interpreter?: boolean;
  tool_file_search?: boolean;
  tool_web_search?: boolean;
  tool_image_generation?: boolean;
  tool_mcp?: boolean;
  mcp_server_ids?: string[];
  tools_config?: unknown[];
  rag_enabled: boolean;
  graphify_enabled?: boolean;
}

// Fetch all agents
export function useAIAgents() {
  return useQuery({
    queryKey: queryKeys.ai.agents,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as AIAgent[];
    },
  });
}

// Fetch single agent
export function useAIAgent(id: string) {
  return useQuery({
    queryKey: queryKeys.ai.agent(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as unknown as AIAgent;
    },
    enabled: !!id,
  });
}

// Fetch agent runs
export function useAgentRuns(agentId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: agentId ? queryKeys.ai.runs(agentId) : ["ai", "runs"],
    queryFn: async () => {
      let query = supabase
        .from("ai_agent_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (agentId) {
        query = query.eq("agent_id", agentId);
      }

      if (user) {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as AgentRun[];
    },
    enabled: !!user,
  });
}

// Create agent
export function useCreateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AgentFormData) => {
      const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, "-");
      const mcpServerIds = data.mcp_server_ids || [];
      const mcpEnabled = mcpServerIds.length > 0 || (data.tool_mcp ?? false);

      const { data: agent, error } = await supabase
        .from("ai_agents")
        .insert({
          name: data.name,
          slug,
          description: data.description || null,
          category: data.category,
          system_prompt: data.system_prompt,
          is_enabled: data.is_enabled,
          memory_enabled: data.memory_enabled,
          rag_enabled: data.rag_enabled ?? false,
          graphify_enabled: data.graphify_enabled ?? false,
          // Conversation fields
          avatar: data.avatar || null,
          welcome_message: data.welcome_message || null,
          conversation_starters: data.conversation_starters || [],
          // Tool configuration (columns added via migration, not yet in generated types)
          tool_code_interpreter: data.tool_code_interpreter ?? false,
          tool_file_search: data.tool_file_search ?? true,
          tool_web_search: data.tool_web_search ?? false,
          tool_image_generation: data.tool_image_generation ?? false,
          tool_mcp: mcpEnabled,
          mcp_server_ids: mcpServerIds,
          tools_config: data.tools_config || [],
        } as never)
        .select()
        .single();

      if (error) throw error;

      await syncAgentMcpServers(
        agent.id,
        mcpServerIds,
        mcpEnabled
      );

      return agent as unknown as AIAgent;
    },
    onSuccess: () => {
      invalidateKeys.ai(queryClient);
      toast.success("Agent created successfully!");
    },
    onError: (error: unknown) => {
      console.error("Error creating agent:", error);
      toast.error((error as Error).message || "Failed to create agent");
    },
  });
}

// Update agent
export function useUpdateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AgentFormData> }) => {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      // Only include fields that are provided
      if (data.name !== undefined) {
        updateData.name = data.name;
        updateData.slug = data.slug || data.name.toLowerCase().replace(/\s+/g, "-");
      }
      if (data.description !== undefined) updateData.description = data.description || null;
      if (data.category !== undefined) updateData.category = data.category;
      if (data.system_prompt !== undefined) updateData.system_prompt = data.system_prompt;
      if (data.is_enabled !== undefined) updateData.is_enabled = data.is_enabled;
      if (data.memory_enabled !== undefined) updateData.memory_enabled = data.memory_enabled;
      if (data.rag_enabled !== undefined) updateData.rag_enabled = data.rag_enabled;
      if (data.graphify_enabled !== undefined) updateData.graphify_enabled = data.graphify_enabled;
      // Conversation fields
      if (data.avatar !== undefined) updateData.avatar = data.avatar || null;
      if (data.welcome_message !== undefined) updateData.welcome_message = data.welcome_message || null;
      if (data.conversation_starters !== undefined) updateData.conversation_starters = data.conversation_starters || [];
      // Tool configuration
      if (data.tool_code_interpreter !== undefined) updateData.tool_code_interpreter = data.tool_code_interpreter;
      if (data.tool_file_search !== undefined) updateData.tool_file_search = data.tool_file_search;
      if (data.tool_web_search !== undefined) updateData.tool_web_search = data.tool_web_search;
      if (data.tool_image_generation !== undefined) updateData.tool_image_generation = data.tool_image_generation;
      if (data.tool_mcp !== undefined) updateData.tool_mcp = data.tool_mcp;
      if (data.mcp_server_ids !== undefined) {
        updateData.mcp_server_ids = data.mcp_server_ids || [];
        if ((data.mcp_server_ids || []).length > 0) {
          updateData.tool_mcp = true;
        }
      }
      if (data.tools_config !== undefined) updateData.tools_config = data.tools_config || [];

      const { data: agent, error } = await supabase
        .from("ai_agents")
        .update(updateData as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      const mcpEnabled = data.tool_mcp ?? (agent as unknown as AIAgent).tool_mcp ?? false;
      const serverIds =
        data.mcp_server_ids ?? (agent as unknown as AIAgent).mcp_server_ids ?? [];
      await syncAgentMcpServers(agent.id, serverIds, mcpEnabled);

      return agent as unknown as AIAgent;
    },
    onError: (error: unknown) => {
      console.error("Error updating agent:", error);
      toast.error((error as Error).message || "Failed to update agent");
    },
  });
}

// Toggle agent enabled
export function useToggleAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase
        .from("ai_agents")
        .update({
          is_enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onMutate: async ({ id, is_enabled }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.ai.agents });
      await queryClient.cancelQueries({ queryKey: queryKeys.ai.agentCatalog });
      await queryClient.cancelQueries({ queryKey: queryKeys.ai.agent(id) });

      const previousAgents = queryClient.getQueryData<AIAgent[]>(queryKeys.ai.agents);
      const previousCatalog = queryClient.getQueryData<
        Array<{ agent: AIAgent; stats?: unknown; health: string }>
      >(queryKeys.ai.agentCatalog);
      const previousAgent = queryClient.getQueryData<AIAgent>(queryKeys.ai.agent(id));

      if (previousAgents) {
        queryClient.setQueryData(
          queryKeys.ai.agents,
          previousAgents.map((a) => (a.id === id ? { ...a, is_enabled } : a))
        );
      }

      if (previousCatalog) {
        queryClient.setQueryData(
          queryKeys.ai.agentCatalog,
          previousCatalog.map((item) => {
            if (item.agent.id !== id) return item;
            const agent = { ...item.agent, is_enabled };
            const health = is_enabled
              ? item.health === "inactive"
                ? "active"
                : item.health
              : "inactive";
            return { ...item, agent, health };
          })
        );
      }

      if (previousAgent) {
        queryClient.setQueryData(queryKeys.ai.agent(id), {
          ...previousAgent,
          is_enabled,
        });
      }

      return { previousAgents, previousCatalog, previousAgent };
    },
    onSuccess: (_, variables) => {
      toast.success(`Agent ${variables.is_enabled ? "enabled" : "disabled"}`);
    },
    onError: (error: unknown, variables, context) => {
      if (context?.previousAgents) {
        queryClient.setQueryData(queryKeys.ai.agents, context.previousAgents);
      }
      if (context?.previousCatalog) {
        queryClient.setQueryData(queryKeys.ai.agentCatalog, context.previousCatalog);
      }
      if (context?.previousAgent) {
        queryClient.setQueryData(
          queryKeys.ai.agent(variables.id),
          context.previousAgent
        );
      }
      console.error("Error toggling agent:", error);
      toast.error("Failed to update agent status");
    },
    onSettled: () => {
      invalidateKeys.ai(queryClient);
    },
  });
}

// Delete agent
export function useDeleteAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_agents").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.ai(queryClient);
      toast.success("Agent deleted successfully");
    },
    onError: (error: unknown) => {
      console.error("Error deleting agent:", error);
      toast.error("Failed to delete agent");
    },
  });
}

// Run/Execute agent
export function useRunAgent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agentId, input }: { agentId: string; input: string }) => {
      if (!user) throw new Error("User not authenticated");

      const startTime = Date.now();

      // Create pending run record
      const { data: run, error: insertError } = await supabase
        .from("ai_agent_runs")
        .insert({
          agent_id: agentId,
          user_id: user.id,
          input,
          status: "running",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      try {
        // Call AI function to execute agent
        const { data, error } = await supabase.functions.invoke("run-ai-agent", {
          body: {
            agent_id: agentId,
            input,
            user_id: user.id,
          },
        });

        const executionTime = Date.now() - startTime;

        if (error) throw error;

        // Update run with result (include provider/model from run-ai-agent)
        const { error: updateError } = await supabase
          .from("ai_agent_runs")
          .update({
            output: data.output,
            status: "completed",
            latency_ms: executionTime,
            token_metrics: data.token_usage ?? null,
            provider_used: "openai",
            model_used: "gpt-4o-mini",
            updated_at: new Date().toISOString(),
          })
          .eq("id", run.id);

        if (updateError) throw updateError;

        return { runId: run.id, output: data.output };
      } catch (error: unknown) {
        // Update run with error
        await supabase
          .from("ai_agent_runs")
          .update({
            status: "failed",
            error_message: (error as Error).message,
            latency_ms: Date.now() - startTime,
            updated_at: new Date().toISOString(),
          })
          .eq("id", run.id);

        throw error;
      }
    },
    onSuccess: () => {
      invalidateKeys.ai(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.agentCatalog });
      toast.success("Agent executed successfully!");
    },
    onError: (error: unknown) => {
      console.error("Error running agent:", error);
      toast.error((error as Error).message || "Failed to execute agent");
    },
  });
}
