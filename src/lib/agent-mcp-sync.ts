import { supabase } from "@/integrations/supabase/client";

/**
 * Keep agent_mcp_servers junction table in sync with ai_agents.mcp_server_ids.
 * The array column is the source of truth for runtime execution.
 */
export async function syncAgentMcpServers(
  agentId: string,
  serverIds: string[],
  mcpEnabled: boolean
): Promise<void> {
  if (!mcpEnabled || serverIds.length === 0) {
    const { error } = await supabase
      .from("agent_mcp_servers" as never)
      .delete()
      .eq("agent_id", agentId);

    if (error) {
      console.warn("Could not clear agent MCP connections:", error.message);
    }
    return;
  }

  const { data: existing, error: fetchError } = await supabase
    .from("agent_mcp_servers" as never)
    .select("server_id")
    .eq("agent_id", agentId);

  if (fetchError) {
    console.warn("Could not load agent MCP connections:", fetchError.message);
    return;
  }

  const existingIds = new Set(
    ((existing as { server_id: string }[] | null) ?? []).map((row) => row.server_id)
  );
  const desiredIds = new Set(serverIds);

  const toRemove = [...existingIds].filter((id) => !desiredIds.has(id));
  const toAdd = serverIds.filter((id) => !existingIds.has(id));

  for (const serverId of toRemove) {
    const { error } = await supabase
      .from("agent_mcp_servers" as never)
      .delete()
      .eq("agent_id", agentId)
      .eq("server_id", serverId);

    if (error) {
      console.warn(`Could not remove MCP server ${serverId}:`, error.message);
    }
  }

  if (toAdd.length > 0) {
    const { error } = await supabase.from("agent_mcp_servers" as never).insert(
      toAdd.map((serverId) => ({
        agent_id: agentId,
        server_id: serverId,
        is_enabled: true,
        enabled_tools: [],
      }))
    );

    if (error) {
      console.warn("Could not attach MCP servers to agent:", error.message);
    }
  }
}
