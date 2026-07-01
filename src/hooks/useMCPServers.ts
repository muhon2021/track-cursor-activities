import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { API } from "@/shared/config/api";
import { slugify } from "@/lib/slug";
import { cacheConfig } from "@/lib/cache";
import type { Database } from "@/integrations/supabase/types";
import { restToolToMCPTool, type RestMCPTool } from "@/lib/mcp-rest-tools";
export type TransportType = "stdio" | "http" | "websocket" | "sse" | "rest";
export type AuthType = "none" | "api_key" | "bearer" | "oauth" | "basic";

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPCapabilities {
  tools: boolean;
  resources: boolean;
  prompts: boolean;
  sampling?: boolean;
}

export interface MCPServer {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  server_url: string;
  transport_type: TransportType;
  auth_type: AuthType;
  auth_config: Record<string, unknown>;
  available_tools: MCPTool[];
  available_resources: unknown[];
  available_prompts: unknown[];
  capabilities: MCPCapabilities;
  user_id: string | null;
  is_global: boolean;
  is_active: boolean;
  is_verified: boolean;
  last_verified_at: string | null;
  error_message: string | null;
  usage_count: number;
  last_used_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MCPToolExecution {
  id: string;
  server_id: string;
  agent_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  user_id: string;
  tool_name: string;
  tool_input: unknown;
  tool_output: unknown;
  status: "pending" | "executing" | "completed" | "failed" | "timeout";
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AgentMCPServer {
  id: string;
  agent_id: string;
  server_id: string;
  enabled_tools: string[];
  tool_config: Record<string, unknown>;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
  mcp_servers?: MCPServer;
}

export interface CreateMCPServerData {
  name: string;
  description?: string;
  icon?: string;
  server_url: string;
  transport_type: TransportType;
  auth_type?: AuthType;
  auth_config?: Record<string, unknown>;
  available_tools?: MCPTool[];
  rest_tools?: RestMCPTool[];
  capabilities?: Partial<MCPCapabilities>;
}

export interface UpdateMCPServerData extends Partial<CreateMCPServerData> {
  is_active?: boolean;
}

type MCPServerRow = Database["public"]["Tables"]["mcp_servers"]["Row"];
type MCPToolRow = Database["public"]["Tables"]["mcp_tools"]["Row"];

type MCPServerWithTools = MCPServerRow & {
  mcp_tools: MCPToolRow[] | null;
};

const MCP_QUERY_KEYS = {
  all: ["mcp-servers"] as const,
  user: ["mcp-servers-user"] as const,
  global: ["mcp-servers-global"] as const,
  detail: (id: string) => ["mcp-server", id] as const,
};

function mapToolRow(row: MCPToolRow): MCPTool {
  const schema = row.input_schema as MCPTool["inputSchema"];
  return {
    name: row.name,
    description: row.description ?? "",
    inputSchema: schema,
  };
}

function mapServerRow(row: MCPServerWithTools): MCPServer {
  const tools = (row.mcp_tools ?? []).map(mapToolRow);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon_url,
    server_url: row.server_url,
    transport_type: row.transport_type as TransportType,
    auth_type: row.auth_type as AuthType,
    auth_config: (row.auth_config as Record<string, unknown>) ?? {},
    available_tools: tools,
    available_resources: [],
    available_prompts: [],
    capabilities: {
      tools: row.supports_tools ?? true,
      resources: row.supports_resources ?? false,
      prompts: row.supports_prompts ?? false,
      sampling: row.supports_sampling ?? false,
    },
    user_id: row.created_by,
    is_global: row.is_global ?? false,
    is_active: row.is_enabled ?? true,
    is_verified: row.is_verified ?? false,
    last_verified_at: row.last_verified_at,
    error_message: row.verification_error,
    usage_count: row.total_tool_calls ?? 0,
    last_used_at: row.last_used_at,
    metadata: {},
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  };
}

async function fetchMCPServers(filter?: "user" | "global") {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;

  let query = supabase
    .from("mcp_servers")
    .select("*, mcp_tools(*)")
    .order("created_at", { ascending: false });

  if (filter === "user" && userId) {
    query = query.eq("created_by", userId).eq("is_global", false);
  } else if (filter === "global") {
    query = query.eq("is_global", true);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data as MCPServerWithTools[]).map(mapServerRow);
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "mcp-server";
  let slug = base;
  let attempt = 0;

  while (attempt < 20) {
    const { data } = await supabase
      .from("mcp_servers")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!data) return slug;
    attempt += 1;
    slug = `${base}-${attempt}`;
  }

  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

async function syncServerTools(serverId: string, tools: MCPTool[]) {
  const { error: deleteError } = await supabase
    .from("mcp_tools")
    .delete()
    .eq("server_id", serverId);

  if (deleteError) throw deleteError;

  if (tools.length === 0) return;

  const rows = tools.map((tool) => ({
    server_id: serverId,
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
    is_enabled: true,
  }));

  const { error: insertError } = await supabase.from("mcp_tools").insert(rows);
  if (insertError) throw insertError;
}

function resolveToolsFromPayload(data: CreateMCPServerData | UpdateMCPServerData): MCPTool[] {
  if (data.rest_tools?.length) {
    return data.rest_tools.map(restToolToMCPTool);
  }
  return data.available_tools ?? [];
}

async function markRestServerVerified(serverId: string, toolCount: number) {
  if (toolCount === 0) return;

  await supabase
    .from("mcp_servers")
    .update({
      is_verified: true,
      verification_status: "success",
      verification_error: null,
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", serverId);
}

function invalidateMCPQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: MCP_QUERY_KEYS.all });
  queryClient.invalidateQueries({ queryKey: MCP_QUERY_KEYS.user });
  queryClient.invalidateQueries({ queryKey: MCP_QUERY_KEYS.global });
}

const mcpQueryOptions = {
  staleTime: cacheConfig.staleTime.medium,
  placeholderData: keepPreviousData,
} as const;

export function useMCPServers() {
  return useQuery({
    queryKey: MCP_QUERY_KEYS.all,
    queryFn: () => fetchMCPServers(),
    ...mcpQueryOptions,
  });
}

export function useUserMCPServers() {
  return useQuery({
    queryKey: MCP_QUERY_KEYS.user,
    queryFn: () => fetchMCPServers("user"),
    ...mcpQueryOptions,
  });
}

export function useGlobalMCPServers() {
  return useQuery({
    queryKey: MCP_QUERY_KEYS.global,
    queryFn: () => fetchMCPServers("global"),
    ...mcpQueryOptions,
  });
}
export function useMCPServer(id: string | null) {
  return useQuery({
    queryKey: MCP_QUERY_KEYS.detail(id ?? ""),
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("mcp_servers")
        .select("*, mcp_tools(*)")
        .eq("id", id)
        .single();

      if (error) throw error;
      return mapServerRow(data as MCPServerWithTools);
    },
    enabled: !!id,
  });
}

export function useCreateMCPServer() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateMCPServerData) => {
      if (!user) throw new Error("You must be signed in to add an MCP server");

      const slug = await generateUniqueSlug(data.name);

      const { data: created, error } = await supabase
        .from("mcp_servers")
        .insert({
          name: data.name,
          slug,
          description: data.description ?? null,
          icon_url: data.icon ?? null,
          server_url: data.server_url,
          transport_type: data.transport_type,
          auth_type: data.auth_type ?? "none",
          auth_config: data.auth_config ?? {},
          created_by: user.id,
          is_global: false,
          is_enabled: true,
          supports_tools: data.capabilities?.tools ?? true,
          supports_resources: data.capabilities?.resources ?? false,
          supports_prompts: data.capabilities?.prompts ?? false,
          supports_sampling: data.capabilities?.sampling ?? false,
        })
        .select("*, mcp_tools(*)")
        .single();

      if (error) throw error;

      const tools = resolveToolsFromPayload(data);
      if (tools.length > 0) {
        await syncServerTools(created.id, tools);
      }
      if (data.transport_type === "rest") {
        await markRestServerVerified(created.id, tools.length);
      }

      const { data: refreshed, error: refreshError } = await supabase
        .from("mcp_servers")
        .select("*, mcp_tools(*)")
        .eq("id", created.id)
        .single();

      if (refreshError) throw refreshError;
      return mapServerRow(refreshed as MCPServerWithTools);
    },
    onSuccess: (server) => {
      invalidateMCPQueries(queryClient);
      toast.success(`MCP server "${server.name}" created`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create MCP server");
      console.error("Error creating MCP server:", error);
    },
  });
}

export function useUpdateMCPServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateMCPServerData }) => {
      const updatePayload: Database["public"]["Tables"]["mcp_servers"]["Update"] = {
        updated_at: new Date().toISOString(),
      };

      if (data.name !== undefined) updatePayload.name = data.name;
      if (data.description !== undefined) updatePayload.description = data.description;
      if (data.icon !== undefined) updatePayload.icon_url = data.icon;
      if (data.server_url !== undefined) updatePayload.server_url = data.server_url;
      if (data.transport_type !== undefined) updatePayload.transport_type = data.transport_type;
      if (data.auth_type !== undefined) updatePayload.auth_type = data.auth_type;
      if (data.auth_config !== undefined) updatePayload.auth_config = data.auth_config;
      if (data.is_active !== undefined) updatePayload.is_enabled = data.is_active;

      const { data: updated, error } = await supabase
        .from("mcp_servers")
        .update(updatePayload)
        .eq("id", id)
        .select("*, mcp_tools(*)")
        .single();

      if (error) throw error;

      const tools = resolveToolsFromPayload(data);
      if (data.rest_tools !== undefined || data.available_tools !== undefined) {
        await syncServerTools(id, tools);
      }
      if (data.transport_type === "rest" || updated.transport_type === "rest") {
        await markRestServerVerified(id, tools.length);
      }

      const { data: refreshed, error: refreshError } = await supabase
        .from("mcp_servers")
        .select("*, mcp_tools(*)")
        .eq("id", id)
        .single();

      if (refreshError) throw refreshError;
      return mapServerRow(refreshed as MCPServerWithTools);
    },
    onSuccess: () => {
      invalidateMCPQueries(queryClient);
      toast.success("MCP server updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update MCP server");
      console.error("Error updating MCP server:", error);
    },
  });
}

export function useDeleteMCPServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mcp_servers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateMCPQueries(queryClient);
      toast.success("MCP server deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete MCP server");
      console.error("Error deleting MCP server:", error);
    },
  });
}

export function useVerifyMCPServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await invokeEdgeFunction<{
        verified: boolean;
        tools?: MCPTool[];
        error?: string;
      }>(API.MCP.VERIFY_SERVER, { server_id: id });

      if (!result.verified) {
        throw new Error(result.error || "Connection verification failed");
      }

      return result;
    },
    onSuccess: (result) => {
      invalidateMCPQueries(queryClient);
      const toolCount = result.tools?.length ?? 0;
      toast.success(`Connection verified (${toolCount} tool${toolCount === 1 ? "" : "s"} discovered)`);
    },
    onError: (error: Error) => {
      invalidateMCPQueries(queryClient);
      toast.error(error.message || "Failed to verify MCP server");
      console.error("Error verifying MCP server:", error);
    },
  });
}

export function useAgentMCPServers(_agentId: string | null) {
  return useQuery({
    queryKey: ["agent-mcp-servers-disabled"],
    queryFn: async () => [] as AgentMCPServer[],
    enabled: false,
  });
}

export function useAgentMCPTools(_agentId: string | null) {
  return useQuery({
    queryKey: ["agent-mcp-tools-disabled"],
    queryFn: async () => [] as Array<{ server_id: string; server_name: string; tool: MCPTool }>,
    enabled: false,
  });
}

export function useConnectMCPToAgent() {
  return useMutation({
    mutationFn: async (_params: { agentId: string; serverId: string; enabledTools?: string[] }) => {
      throw new Error("MCP agent connections not yet enabled");
    },
  });
}

export function useDisconnectMCPFromAgent() {
  return useMutation({
    mutationFn: async (_params: { agentId: string; serverId: string }) => {
      throw new Error("MCP agent connections not yet enabled");
    },
  });
}

export function useExecuteMCPTool() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      serverId: string;
      toolName: string;
      toolInput: Record<string, unknown>;
      agentId?: string;
      conversationId?: string;
      messageId?: string;
    }) => {
      if (!user) throw new Error("You must be signed in to execute MCP tools");

      return invokeEdgeFunction(API.MCP.EXECUTE_TOOL, {
        server_id: params.serverId,
        tool_name: params.toolName,
        tool_input: params.toolInput,
        user_id: user.id,
        agent_id: params.agentId,
        conversation_id: params.conversationId,
        message_id: params.messageId,
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to execute MCP tool");
      console.error("Error executing MCP tool:", error);
    },
  });
}

export function useMCPToolExecutions(_serverId: string | null, _limit = 50) {
  return useQuery({
    queryKey: ["mcp-tool-executions-disabled"],
    queryFn: async () => [] as MCPToolExecution[],
    enabled: false,
  });
}
