/**
 * Execute MCP Tool Edge Function - Enhanced for Tool Orchestration
 *
 * Supports:
 * - Dynamic tool discovery and execution
 * - Parameter validation against JSON Schema
 * - Integration with agent_execution_steps for multi-step workflows
 * - Error handling and automatic retries
 * - Tool chaining and parallel execution tracking
 * - Internal Control Tower tools + external MCP servers
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- MCP Streamable HTTP client (inlined for single-file dashboard deploy) ---

interface MCPSession {
  sessionId?: string;
  protocolVersion: string;
}

const DEFAULT_PROTOCOL_VERSION = "2024-11-05";

function buildAuthHeaders(
  authConfig: Record<string, unknown> = {},
  authType = "none"
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (authConfig.authorization_header) {
    headers["Authorization"] = String(authConfig.authorization_header);
  } else if (authType === "api_key" && authConfig.api_key) {
    headers["X-API-Key"] = String(authConfig.api_key);
  } else if (authType === "bearer" && authConfig.bearer_token) {
    headers["Authorization"] = `Bearer ${authConfig.bearer_token}`;
  } else if (authType === "basic" && authConfig.username) {
    const credentials = btoa(`${authConfig.username}:${authConfig.password || ""}`);
    headers["Authorization"] = `Basic ${credentials}`;
  }

  return headers;
}

function parseSseJsonRpc(text: string): unknown {
  const dataLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);

  if (dataLines.length === 0) {
    throw new Error("Empty SSE response from MCP server");
  }

  const lastPayload = dataLines[dataLines.length - 1];
  const parsed = JSON.parse(lastPayload);

  if (parsed.error) {
    throw new Error(parsed.error.message || "MCP request failed");
  }

  return parsed.result;
}

async function sendMCPRequest(
  serverUrl: string,
  method: string,
  params: Record<string, unknown> = {},
  authConfig: Record<string, unknown> = {},
  authType = "none",
  session: MCPSession = { protocolVersion: DEFAULT_PROTOCOL_VERSION }
): Promise<{ result: unknown; session: MCPSession }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...buildAuthHeaders(authConfig, authType),
  };

  if (session.sessionId) {
    headers["Mcp-Session-Id"] = session.sessionId;
    headers["MCP-Protocol-Version"] = session.protocolVersion;
  }

  const requestBody = {
    jsonrpc: "2.0",
    id: Date.now(),
    method,
    params,
  };

  const response = await fetch(serverUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `HTTP ${response.status}: ${response.statusText}${errorBody ? ` - ${errorBody.slice(0, 200)}` : ""}`
    );
  }

  const nextSession: MCPSession = {
    protocolVersion: session.protocolVersion,
    sessionId: response.headers.get("Mcp-Session-Id") || session.sessionId,
  };

  const contentType = response.headers.get("Content-Type") || "";
  let result: unknown;

  if (contentType.includes("text/event-stream")) {
    result = parseSseJsonRpc(await response.text());
  } else {
    const json = await response.json();
    if (json?.error) {
      throw new Error(json.error.message || "MCP request failed");
    }
    result = json.result;
  }

  return { result, session: nextSession };
}

async function initializeMCPSession(
  serverUrl: string,
  authConfig: Record<string, unknown> = {},
  authType = "none"
): Promise<{ session: MCPSession; initResult: unknown }> {
  const session: MCPSession = { protocolVersion: DEFAULT_PROTOCOL_VERSION };

  const { result: initResult, session: initializedSession } = await sendMCPRequest(
    serverUrl,
    "initialize",
    {
      protocolVersion: DEFAULT_PROTOCOL_VERSION,
      capabilities: {
        roots: { listChanged: true },
        sampling: {},
      },
      clientInfo: {
        name: "SJ Control Tower",
        version: "1.0.0",
      },
    },
    authConfig,
    authType,
    session
  );

  await sendMCPRequest(
    serverUrl,
    "notifications/initialized",
    {},
    authConfig,
    authType,
    initializedSession
  );

  return { session: initializedSession, initResult };
}

// --- End MCP client ---

const MCP_HTTP_CONFIG_KEY = "x-http-config";

function schemaForValidation(schema: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...schema };
  delete copy[MCP_HTTP_CONFIG_KEY];
  return copy;
}

interface RestHttpConfig {
  method: string;
  path: string;
  headers?: Record<string, string>;
}

async function executeRestTool(
  server: { server_url: string; auth_type?: string; auth_config?: Record<string, unknown> },
  toolSchema: Record<string, unknown>,
  parameters: Record<string, unknown>
): Promise<unknown> {
  const httpConfig = toolSchema[MCP_HTTP_CONFIG_KEY] as RestHttpConfig | undefined;
  if (!httpConfig?.path) {
    throw new Error("REST tool is missing endpoint configuration");
  }

  const authConfig = (server.auth_config as Record<string, unknown>) ?? {};
  const authType = server.auth_type ?? "none";

  let url = httpConfig.path;
  if (!url.startsWith("http")) {
    const baseUrl = server.server_url.replace(/\/$/, "");
    const path = httpConfig.path.startsWith("/") ? httpConfig.path : `/${httpConfig.path}`;
    url = `${baseUrl}${path}`;
  }

  const method = (httpConfig.method || "POST").toUpperCase();
  const headers: Record<string, string> = {
  ...buildAuthHeaders(authConfig, authType),
    ...(httpConfig.headers || {}),
  };

  if (!headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }

  const fetchOptions: RequestInit = { method, headers };

  if (["POST", "PUT", "PATCH"].includes(method)) {
    fetchOptions.body = JSON.stringify(parameters);
  } else if (method === "GET" && Object.keys(parameters).length > 0) {
    const query = new URLSearchParams(
      Object.entries(parameters).map(([k, v]) => [k, String(v)])
    ).toString();
    url = `${url}${url.includes("?") ? "&" : "?"}${query}`;
  }

  const response = await fetch(url, fetchOptions);
  const text = await response.text();

  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { text };
  }

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${typeof parsed === "object" ? JSON.stringify(parsed) : text}`
    );
  }

  return parsed;
}

interface MCPToolCallResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
  }>;
  isError?: boolean;
}

interface ToolExecutionRequest {
  // Support both old format (tool_name + server_id) and new format (tool_id)
  tool_id?: string;
  tool_name?: string;
  server_id?: string;
  // Parameters
  tool_input?: Record<string, any>;
  input_parameters?: Record<string, any>;
  // Context
  agent_id?: string;
  plan_id?: string;
  step_id?: string;
  conversation_id?: string;
  message_id?: string;
  user_id?: string;
  execution_context?: Record<string, any>;
}

/**
 * Validate tool input parameters against JSON Schema
 */
function validateToolInput(
  input: Record<string, any>,
  schema: Record<string, any>
): string | null {
  const { properties, required } = schema;

  if (!properties) {
    return null; // No validation needed
  }

  // Check required fields
  if (required && Array.isArray(required)) {
    for (const field of required) {
      if (!(field in input)) {
        return `Missing required field: ${field}`;
      }
    }
  }

  // Basic type checking
  for (const [key, value] of Object.entries(input)) {
    const propSchema = properties[key];
    if (!propSchema) {
      continue; // Allow extra fields
    }

    const expectedType = propSchema.type;
    const actualType = typeof value;

    if (expectedType === 'string' && actualType !== 'string') {
      return `Field '${key}' must be a string`;
    }
    if (expectedType === 'number' && actualType !== 'number') {
      return `Field '${key}' must be a number`;
    }
    if (expectedType === 'boolean' && actualType !== 'boolean') {
      return `Field '${key}' must be a boolean`;
    }
    if (expectedType === 'object' && (actualType !== 'object' || Array.isArray(value))) {
      return `Field '${key}' must be an object`;
    }
    if (expectedType === 'array' && !Array.isArray(value)) {
      return `Field '${key}' must be an array`;
    }

    // Validate enum values
    if (propSchema.enum && !propSchema.enum.includes(value)) {
      return `Field '${key}' must be one of: ${propSchema.enum.join(', ')}`;
    }
  }

  return null;
}

/**
 * Execute internal Control Tower tools
 * These call existing Control Tower APIs
 */
async function executeInternalTool(
  toolName: string,
  parameters: Record<string, any>,
  supabaseClient: any,
  userId: string
): Promise<any> {
  // TODO: Integrate with actual Control Tower APIs
  // For now returning mock responses

  switch (toolName) {
    case 'create_task':
      return {
        success: true,
        task_id: crypto.randomUUID(),
        message: `Task "${parameters.title}" created successfully`,
      };

    case 'search_tasks':
      return {
        success: true,
        tasks: [],
        count: 0,
        message: 'Search completed',
      };

    case 'update_task':
      return {
        success: true,
        message: 'Task updated successfully',
      };

    case 'schedule_meeting':
      return {
        success: true,
        meeting_id: crypto.randomUUID(),
        meeting_url: 'https://zoom.us/j/123456789',
        message: `Meeting "${parameters.title}" scheduled`,
      };

    case 'get_meeting_transcript':
      return {
        success: true,
        transcript: 'Meeting transcript not available yet',
        summary: 'No summary available',
        message: 'Transcript retrieved',
      };

    case 'search_knowledge':
      return {
        success: true,
        results: [],
        count: 0,
        message: 'Knowledge search completed',
      };

    case 'create_knowledge_article':
      return {
        success: true,
        article_id: crypto.randomUUID(),
        message: `Article "${parameters.title}" created`,
      };

    case 'create_deal':
      return {
        success: true,
        deal_id: crypto.randomUUID(),
        message: `Deal "${parameters.title}" created`,
      };

    case 'search_contacts':
      return {
        success: true,
        contacts: [],
        count: 0,
        message: 'Contact search completed',
      };

    case 'create_project':
      return {
        success: true,
        project_id: crypto.randomUUID(),
        message: `Project "${parameters.name}" created`,
      };

    case 'get_project_status':
      return {
        success: true,
        status: 'on_track',
        health_score: 85,
        message: 'Project status retrieved',
      };

    default:
      throw new Error(`Unknown internal tool: ${toolName}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const requestData: ToolExecutionRequest = await req.json()

    // Support both old format (tool_name + server_id) and new format (tool_id)
    const parameters = requestData.input_parameters || requestData.tool_input || {}

    let toolId = requestData.tool_id
    let serverId = requestData.server_id
    let toolName = requestData.tool_name
    let toolSchema: any = null
    let server: any = null

    // If tool_id is provided, fetch tool and server details
    if (toolId) {
      const { data: tool, error: toolError } = await supabaseClient
        .from('mcp_tools')
        .select('*, server:mcp_servers(*)')
        .eq('id', toolId)
        .single()

      if (toolError || !tool) {
        return new Response(
          JSON.stringify({ error: 'Tool not found or not accessible' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
      }

      toolName = tool.name
      toolSchema = tool.input_schema
      server = tool.server
      serverId = tool.server_id
    } else if (serverId && toolName) {
      // Old format: fetch server and optionally tool schema
      const { data: serverData, error: serverError } = await supabaseClient
        .from('mcp_servers')
        .select('*')
        .eq('id', serverId)
        .single()

      if (serverError || !serverData) {
        return new Response(
          JSON.stringify({ error: 'MCP server not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
      }

      server = serverData

      // Try to fetch tool schema for validation
      const { data: toolData } = await supabaseClient
        .from('mcp_tools')
        .select('id, input_schema')
        .eq('server_id', serverId)
        .eq('name', toolName)
        .single()

      if (toolData) {
        toolId = toolData.id
        toolSchema = toolData.input_schema
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Either tool_id or (server_id + tool_name) required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!requestData.user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check if server is enabled
    if (server.is_enabled === false) {
      return new Response(
        JSON.stringify({ error: 'MCP server is not active' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    if (!toolId && serverId && toolName) {
      return new Response(
        JSON.stringify({ error: `Tool '${toolName}' not found on this server` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Validate input parameters against schema
    if (toolSchema) {
      const validationError = validateToolInput(parameters, schemaForValidation(toolSchema))
      if (validationError) {
        return new Response(
          JSON.stringify({ error: `Invalid input: ${validationError}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
    }

    // Create execution record (support both old and new table structures)
    const executionInsert: Record<string, unknown> = {
      server_id: serverId,
      tool_id: toolId,
      agent_id: requestData.agent_id || null,
      user_id: requestData.user_id,
      status: 'running',
      started_at: new Date().toISOString(),
      input_parameters: parameters,
      execution_context: requestData.execution_context || {},
    }

    // Old format fields (for backward compatibility)
    if (requestData.conversation_id) {
      executionInsert.conversation_id = requestData.conversation_id
    }
    if (requestData.message_id) {
      executionInsert.message_id = requestData.message_id
    }
    if (toolName) {
      executionInsert.tool_name = toolName
      executionInsert.tool_input = parameters
    }

    const { data: execution, error: insertError } = await supabaseClient
      .from('mcp_tool_executions')
      .insert(executionInsert)
      .select()
      .single()

    if (insertError) {
      console.error('Failed to create execution record:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to create execution record' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const startTime = Date.now()

    try {
      let result: any

      // Check if this is an internal Control Tower tool
      if (server.server_url.startsWith('internal://')) {
        result = await executeInternalTool(
          toolName!,
          parameters,
          supabaseClient,
          requestData.user_id
        )
      } else if (server.transport_type === 'rest') {
        if (!toolSchema) {
          throw new Error('REST tool configuration not found')
        }
        result = await executeRestTool(server, toolSchema as Record<string, unknown>, parameters)
      } else {
        const authConfig = (server.auth_config as Record<string, unknown>) ?? {}
        const authType = server.auth_type ?? 'none'
        const { session } = await initializeMCPSession(server.server_url, authConfig, authType)

        const { result: mcpResult } = await sendMCPRequest(
          server.server_url,
          'tools/call',
          {
            name: toolName,
            arguments: parameters,
          },
          authConfig,
          authType,
          session
        ) as { result: MCPToolCallResponse }

        const toolCallResult = mcpResult as MCPToolCallResponse

        // Process the result
        if (toolCallResult.content && Array.isArray(toolCallResult.content)) {
          const textContent = toolCallResult.content
            .filter(c => c.type === 'text' && c.text)
            .map(c => c.text)
            .join('\n')

          result = {
            raw: toolCallResult,
            text: textContent || null,
            hasError: toolCallResult.isError || false,
          }
        } else {
          result = toolCallResult
        }
      }

      const executionTime = Date.now() - startTime

      // Update execution record with success (support both field names)
      const updateFields: any = {
        status: 'success',
        completed_at: new Date().toISOString(),
      }

      if (toolId) {
        updateFields.output_result = result
        updateFields.execution_time_ms = executionTime
      } else {
        updateFields.tool_output = result
        updateFields.duration_ms = executionTime
      }

      await supabaseClient
        .from('mcp_tool_executions')
        .update(updateFields)
        .eq('id', execution.id)

      // If this is part of a multi-step execution, update the step
      if (requestData.step_id) {
        await supabaseClient
          .from('agent_execution_steps')
          .update({
            status: 'completed',
            result: result,
            output_for_next_step: JSON.stringify(result).slice(0, 1000),
            completed_at: new Date().toISOString(),
            execution_time_ms: executionTime,
          })
          .eq('id', requestData.step_id)
      }

      return new Response(
        JSON.stringify({
          success: true,
          execution_id: execution.id,
          output: result,
          execution_time_ms: executionTime,
          status: 'success',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )

    } catch (toolError: unknown) {
      const executionTime = Date.now() - startTime
      const errorMessage = toolError instanceof Error ? toolError.message : 'Tool execution failed'

      // Update execution record with failure
      const updateFields: any = {
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      }

      if (toolId) {
        updateFields.error_code = 'TOOL_EXECUTION_ERROR'
        updateFields.execution_time_ms = executionTime
      } else {
        updateFields.duration_ms = executionTime
      }

      await supabaseClient
        .from('mcp_tool_executions')
        .update(updateFields)
        .eq('id', execution.id)

      // If this is part of a multi-step execution, check for retries
      if (requestData.step_id) {
        const { data: step } = await supabaseClient
          .from('agent_execution_steps')
          .select('retry_count, max_retries')
          .eq('id', requestData.step_id)
          .single()

        if (step && step.retry_count < step.max_retries) {
          // Mark for retry
          await supabaseClient
            .from('agent_execution_steps')
            .update({
              status: 'pending',
              retry_count: step.retry_count + 1,
              error_message: errorMessage,
            })
            .eq('id', requestData.step_id)
        } else {
          // Max retries exhausted
          await supabaseClient
            .from('agent_execution_steps')
            .update({
              status: 'failed',
              error_message: errorMessage,
              error_code: 'MAX_RETRIES_EXCEEDED',
              completed_at: new Date().toISOString(),
            })
            .eq('id', requestData.step_id)
        }
      }

      return new Response(
        JSON.stringify({
          success: false,
          execution_id: execution.id,
          error: errorMessage,
          execution_time_ms: executionTime,
          status: 'failed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

  } catch (error: unknown) {
    console.error('Execute MCP tool error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
