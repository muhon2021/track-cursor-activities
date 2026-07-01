import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const MCP_HTTP_CONFIG_KEY = "x-http-config";

export interface AgentMcpToolDef {
  tool_id: string;
  server_id: string;
  tool_name: string;
  function_name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface McpChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export function stripHttpConfig(schema: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...schema };
  delete copy[MCP_HTTP_CONFIG_KEY];
  if (!copy.type) copy.type = "object";
  if (!copy.properties) copy.properties = {};
  return copy;
}

export function makeFunctionName(serverName: string, toolName: string): string {
  const raw = `${serverName}_${toolName}`
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return (raw || "mcp_tool").slice(0, 64);
}

export async function loadAgentMcpToolDefs(
  supabase: SupabaseClient,
  serverIds: string[]
): Promise<AgentMcpToolDef[]> {
  if (!serverIds.length) return [];

  const { data: tools, error } = await supabase
    .from("mcp_tools")
    .select("id, server_id, name, description, input_schema")
    .in("server_id", serverIds)
    .eq("is_enabled", true)
    .order("name");

  if (error || !tools?.length) {
    if (error) console.warn("loadAgentMcpToolDefs:", error.message);
    return [];
  }

  const { data: servers } = await supabase
    .from("mcp_servers")
    .select("id, name")
    .in("id", serverIds);

  const serverNames = new Map(
    (servers ?? []).map((s: { id: string; name: string }) => [s.id, s.name])
  );

  const usedNames = new Set<string>();
  const defs: AgentMcpToolDef[] = [];

  for (const tool of tools) {
    const serverName = serverNames.get(tool.server_id) ?? "server";
    let functionName = makeFunctionName(serverName, tool.name);
    let suffix = 2;
    while (usedNames.has(functionName)) {
      functionName = `${makeFunctionName(serverName, tool.name).slice(0, 58)}_${suffix}`;
      suffix++;
    }
    usedNames.add(functionName);

    const schema = (tool.input_schema as Record<string, unknown>) ?? {};

    defs.push({
      tool_id: tool.id,
      server_id: tool.server_id,
      tool_name: tool.name,
      function_name: functionName,
      description: tool.description || tool.name,
      parameters: stripHttpConfig(schema),
    });
  }

  return defs;
}

export async function executeMcpToolViaEdgeFunction(
  supabaseUrl: string,
  serviceKey: string,
  params: {
    tool_id: string;
    input_parameters: Record<string, unknown>;
    user_id: string;
    agent_id?: string;
    conversation_id?: string;
  }
): Promise<string> {
  const response = await fetch(`${supabaseUrl}/functions/v1/execute-mcp-tool`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tool_id: params.tool_id,
      input_parameters: params.input_parameters,
      user_id: params.user_id,
      agent_id: params.agent_id,
      conversation_id: params.conversation_id,
    }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.error || `MCP tool execution failed (${response.status})`);
  }

  if (body.success === false) {
    throw new Error(body.error || "MCP tool execution failed");
  }

  const output = body.output ?? body;
  return typeof output === "string" ? output : JSON.stringify(output, null, 2);
}

export async function chatWithMcpToolsOpenAI(
  apiKey: string,
  model: string,
  messages: McpChatMessage[],
  toolDefs: AgentMcpToolDef[],
  executeTool: (toolId: string, args: Record<string, unknown>) => Promise<string>,
  options?: { max_tokens?: number; temperature?: number; max_rounds?: number }
): Promise<{ content: string; input_tokens: number; output_tokens: number; model: string }> {
  const openaiTools = toolDefs.map((t) => ({
    type: "function" as const,
    function: {
      name: t.function_name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const workingMessages = [...messages];
  let inputTokens = 0;
  let outputTokens = 0;
  const maxRounds = options?.max_rounds ?? 5;

  for (let round = 0; round < maxRounds; round++) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: workingMessages,
        tools: openaiTools,
        tool_choice: "auto",
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.max_tokens ?? 2000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error: ${errText}`);
    }

    const data = await response.json();
    inputTokens += data.usage?.prompt_tokens ?? 0;
    outputTokens += data.usage?.completion_tokens ?? 0;

    const assistantMessage = data.choices?.[0]?.message;
    if (!assistantMessage) {
      throw new Error("No response from AI model");
    }

    const toolCalls = assistantMessage.tool_calls;
    if (!toolCalls?.length) {
      return {
        content: assistantMessage.content || "",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        model: data.model || model,
      };
    }

    workingMessages.push(assistantMessage);

    for (const toolCall of toolCalls) {
      const fnName = toolCall.function?.name;
      const def = toolDefs.find((d) => d.function_name === fnName);
      let toolResult: string;

      try {
        const args = JSON.parse(toolCall.function?.arguments || "{}");
        if (!def) {
          toolResult = `Error: Unknown tool ${fnName}`;
        } else {
          toolResult = await executeTool(def.tool_id, args);
        }
      } catch (err: unknown) {
        toolResult = `Error: ${err instanceof Error ? err.message : "Tool execution failed"}`;
      }

      workingMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: toolResult,
      });
    }
  }

  return {
    content: "I reached the maximum number of tool calls for this request. Please try a simpler question.",
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    model,
  };
}
