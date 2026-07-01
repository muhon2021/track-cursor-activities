/**
 * Agent conversation hooks - conversation threading with agent_conversations / agent_messages
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/cache";
import { API } from "@/shared/config/api";
import { toast } from "sonner";

// Type-bridge: tables exist in DB but not yet in generated types
const db = supabase as any;

// Types
export interface AgentConversation {
  id: string;
  agent_id: string;
  user_id: string;
  title: string | null;
  summary: string | null;
  is_archived: boolean;
  is_pinned: boolean;
  message_count: number;
  last_message_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  ai_agents?: {
    id: string;
    name: string;
    slug: string;
    avatar: string | null;
    description: string | null;
    welcome_message?: string | null;
    conversation_starters?: string[] | null;
    memory_enabled?: boolean;
  };
}

export interface AgentMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  model_used: string | null;
  provider_used: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  latency_ms: number | null;
  tool_calls: unknown | null;
  tool_results: unknown | null;
  citations: unknown[];
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateConversationData {
  agent_id: string;
  title?: string;
}

export interface SendMessageData {
  conversation_id: string;
  content: string;
  agent_id: string;
  model_id?: string;
  memory_enabled?: boolean;
}

export function useAgentConversations(agentId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.ai.conversations(agentId ?? ""),
    queryFn: async (): Promise<AgentConversation[]> => {
      if (!agentId || !user?.id) return [];
      const { data, error } = await db
        .from("agent_conversations")
        .select(
          "id, agent_id, user_id, title, summary, is_archived, is_pinned, message_count, last_message_at, metadata, created_at, updated_at, ai_agents(id, name, slug, avatar, description, welcome_message, conversation_starters, memory_enabled)"
        )
        .eq("agent_id", agentId)
        .eq("user_id", user.id)
        .eq("is_archived", false)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as AgentConversation[];
    },
    enabled: !!agentId && !!user?.id,
  });
}

export function useAgentConversation(conversationId: string | null) {
  return useQuery({
    queryKey: queryKeys.ai.conversation(conversationId ?? ""),
    queryFn: async (): Promise<AgentConversation | null> => {
      if (!conversationId) return null;
      const { data, error } = await db
        .from("agent_conversations")
        .select(
          "id, agent_id, user_id, title, summary, is_archived, is_pinned, message_count, last_message_at, metadata, created_at, updated_at, ai_agents(id, name, slug, avatar, description, welcome_message, conversation_starters, memory_enabled)"
        )
        .eq("id", conversationId)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }
      return data as AgentConversation;
    },
    enabled: !!conversationId,
  });
}

export function useAgentMessages(conversationId: string | null) {
  return useQuery({
    queryKey: queryKeys.ai.messages(conversationId ?? ""),
    queryFn: async (): Promise<AgentMessage[]> => {
      if (!conversationId) return [];
      const { data, error } = await db
        .from("agent_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as AgentMessage[];
    },
    enabled: !!conversationId,
  });
}

export function useAgentMessagesInfinite(conversationId: string | null, _pageSize = 50) {
  const query = useAgentMessages(conversationId);
  return {
    data: query.data,
    isLoading: query.isLoading,
    fetchNextPage: () => {},
    hasNextPage: false,
    isFetchingNextPage: false,
  };
}

export function useCreateConversation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: CreateConversationData
    ): Promise<AgentConversation | null> => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data: row, error } = await db
        .from("agent_conversations")
        .insert({
          agent_id: data.agent_id,
          user_id: user.id,
          title: data.title ?? null,
        })
        .select("id, agent_id, user_id, title, summary, is_archived, is_pinned, message_count, last_message_at, metadata, created_at, updated_at")
        .single();

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.conversations(data.agent_id) });
      return row as AgentConversation;
    },
  });
}

export function useSendMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SendMessageData) => {
      const { conversation_id, agent_id, content, model_id, memory_enabled } = params;
      if (!user?.id) throw new Error("Not authenticated");

      // 1. Insert user message
      const { error: insertUserError } = await db.from("agent_messages").insert({
        conversation_id,
        role: "user",
        content,
      });
      if (insertUserError) throw insertUserError;

      queryClient.invalidateQueries({ queryKey: queryKeys.ai.messages(conversation_id) });

      // 2. Retrieve relevant memories (best-effort, never blocks chat)
      let memoryContext = "";
      if (memory_enabled) {
        try {
          const { data: memData } = await supabase.functions.invoke("retrieve-agent-memories", {
            body: { agent_id, user_id: user.id, query: content, limit: 5, similarity_threshold: 0.7 },
          });
          if (memData?.memories?.length > 0) {
            memoryContext =
              "RELEVANT MEMORIES FROM PAST CONVERSATIONS:\n" +
              (memData.memories as { memory_category?: string; content: string }[])
                .map((m) => `- [${m.memory_category ?? "memory"}] ${m.content}`)
                .join("\n");
          }
        } catch {
          // silent — memory retrieval is best-effort
        }
      }

      // 3. Call agent-conversation-chat
      const { data: chatData, error: chatError } = await supabase.functions.invoke(
        API.AI.AGENT_CONVERSATION,
        {
          body: {
            conversation_id,
            agent_id,
            message: content,
            user_id: user.id,
            model_id: model_id ?? undefined,
            memory_context: memoryContext,
          },
        }
      );

      if (chatError) throw chatError;
      const result = chatData as {
        response?: string;
        model_used?: string;
        provider_used?: string;
        tokens_input?: number;
        tokens_output?: number;
        latency_ms?: number;
        error?: string;
        metadata?: {
          mcp_enabled?: boolean;
          mcp_path_used?: boolean;
          mcp_tools_available?: number;
          mcp_tools_called?: string[];
          mcp_tool_error?: string | null;
          mcp_server_ids?: string[];
        };
      };
      if (result?.error) throw new Error(typeof result.error === "string" ? result.error : "Chat failed");

      const mcpMeta = result.metadata;
      if (mcpMeta?.mcp_enabled && !mcpMeta.mcp_path_used) {
        const reason =
          mcpMeta.mcp_tool_error ||
          (mcpMeta.mcp_tools_available === 0
            ? "No enabled tools on attached MCP servers"
            : "MCP tools were not invoked — check OpenAI API key in Supabase secrets");
        console.warn("Agent MCP not used:", reason, mcpMeta);
      }

      // 4. Insert assistant message
      const { error: insertAssistantError } = await db.from("agent_messages").insert({
        conversation_id,
        role: "assistant",
        content: result.response ?? "",
        model_used: result.model_used ?? null,
        provider_used: result.provider_used ?? null,
        tokens_input: result.tokens_input ?? null,
        tokens_output: result.tokens_output ?? null,
        latency_ms: result.latency_ms ?? null,
        metadata: mcpMeta ?? {},
      });
      if (insertAssistantError) throw insertAssistantError;

      // 5. Extract memories after each reply (fire-and-forget, never blocks chat)
      if (memory_enabled) {
        supabase.functions
          .invoke("extract-agent-memories", {
            body: { agent_id, user_id: user.id, conversation_id, auto_extract: true },
          })
          .catch(() => {});
      }

      // Sync conversation stats from actual message count (sidebar shows correct count)
      try {
        await db.rpc("refresh_conversation_stats", { p_conversation_id: conversation_id });
      } catch {
        // RPC may not exist yet; triggers may have updated stats
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.ai.messages(conversation_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.conversation(conversation_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.conversations(agent_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.agentCatalog });

      if (mcpMeta?.mcp_tool_error) {
        toast.warning("MCP tool issue", {
          description: mcpMeta.mcp_tool_error.slice(0, 200),
        });
      } else if (mcpMeta?.mcp_enabled && (mcpMeta.mcp_tools_called?.length ?? 0) === 0) {
        toast.warning("MCP tools were not called", {
          description: "Re-save the agent with ActiveCollab checked under MCP Servers, then redeploy agent-conversation-chat.",
        });
      }

      return { ...result, metadata: mcpMeta };
    },
  });
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      data: Partial<Pick<AgentConversation, "title" | "is_archived" | "is_pinned">>;
    }) => {
      const { data: row, error } = await db
        .from("agent_conversations")
        .update(params.data)
        .eq("id", params.id)
        .select()
        .single();
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.conversation(params.id) });
      return row;
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; agentId: string }) => {
      const { error } = await db.from("agent_conversations").delete().eq("id", params.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.conversations(params.agentId) });
    },
  });
}

export function useArchiveConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; agentId: string }) => {
      const { error } = await db
        .from("agent_conversations")
        .update({ is_archived: true })
        .eq("id", params.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.conversations(params.agentId) });
    },
  });
}

export function useTogglePinConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; agentId: string; isPinned: boolean }) => {
      const { error } = await db
        .from("agent_conversations")
        .update({ is_pinned: params.isPinned })
        .eq("id", params.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.conversations(params.agentId) });
    },
  });
}

export function useArchivedConversations(agentId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.ai.conversations(agentId ?? ""), "archived"],
    queryFn: async (): Promise<AgentConversation[]> => {
      if (!agentId || !user?.id) return [];
      const { data, error } = await db
        .from("agent_conversations")
        .select(
          "id, agent_id, user_id, title, summary, is_archived, is_pinned, message_count, last_message_at, metadata, created_at, updated_at, ai_agents(id, name, slug, avatar, description, memory_enabled)"
        )
        .eq("agent_id", agentId)
        .eq("user_id", user.id)
        .eq("is_archived", true)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as AgentConversation[];
    },
    enabled: !!agentId && !!user?.id,
  });
}

export function useRestoreConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; agentId: string }) => {
      const { error } = await db
        .from("agent_conversations")
        .update({ is_archived: false })
        .eq("id", params.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.conversations(params.agentId) });
    },
  });
}
