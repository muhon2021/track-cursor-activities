import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

interface MCPTool {  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface MCPInitializeResponse {
  protocolVersion: string;
  capabilities: {
    tools?: boolean | { listChanged?: boolean };
    resources?: boolean | { subscribe?: boolean; listChanged?: boolean };
    prompts?: boolean | { listChanged?: boolean };
    sampling?: boolean;
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

interface MCPToolsListResponse {
  tools: MCPTool[];
}

async function syncDiscoveredTools(
  supabaseClient: ReturnType<typeof createClient>,
  serverId: string,
  tools: MCPTool[]
) {
  for (const tool of tools) {
    const { error } = await supabaseClient
      .from('mcp_tools')
      .upsert(
        {
          server_id: serverId,
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
          is_enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'server_id,name' }
      )

    if (error) {
      console.error(`Failed to upsert tool ${tool.name}:`, error)
    }
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

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { server_id } = requestBody;

    if (!server_id) {
      return new Response(
        JSON.stringify({ error: 'server_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const { data: server, error: serverError } = await supabaseClient
      .from('mcp_servers')
      .select('*')
      .eq('id', server_id)
      .single()

    if (serverError || !server) {
      throw new Error('MCP server not found')
    }

    const { server_url, transport_type, auth_type, auth_config } = server

    if (transport_type === 'rest') {
      const { data: dbTools, error: toolsError } = await supabaseClient
        .from('mcp_tools')
        .select('name, description, input_schema')
        .eq('server_id', server_id)

      if (toolsError) {
        throw new Error('Failed to load REST tools')
      }

      const tools: MCPTool[] = (dbTools || []).map((row) => ({
        name: row.name,
        description: row.description || '',
        inputSchema: row.input_schema as MCPTool['inputSchema'],
      }))

      if (tools.length === 0) {
        await supabaseClient
          .from('mcp_servers')
          .update({
            is_verified: false,
            verification_status: 'failed',
            verification_error: 'No REST tools configured',
            updated_at: new Date().toISOString(),
          })
          .eq('id', server_id)

        return new Response(
          JSON.stringify({ verified: false, tools: [], error: 'Add at least one REST tool before verifying' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      await supabaseClient
        .from('mcp_servers')
        .update({
          is_verified: true,
          verification_status: 'success',
          last_verified_at: new Date().toISOString(),
          verification_error: null,
          supports_tools: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', server_id)

      return new Response(
        JSON.stringify({
          verified: true,
          tools,
          capabilities: { tools: true, resources: false, prompts: false, sampling: false },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (transport_type !== 'http' && transport_type !== 'sse') {
      await supabaseClient
        .from('mcp_servers')
        .update({
          is_verified: false,
          verification_status: 'failed',
          verification_error: `Transport type '${transport_type}' requires local verification`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', server_id)

      return new Response(
        JSON.stringify({
          verified: false,
          tools: [],
          error: `Transport type '${transport_type}' cannot be verified remotely`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    let tools: MCPTool[] = []
    let capabilities = {
      tools: true,
      resources: false,
      prompts: false,
      sampling: false,
    }

    try {
      const authConfig = (auth_config as Record<string, unknown>) ?? {}
      const { session, initResult } = await initializeMCPSession(
        server_url,
        authConfig,
        auth_type ?? 'none'
      )

      const initResponse = initResult as MCPInitializeResponse

      if (initResponse?.capabilities) {
        capabilities = {
          tools: !!initResponse.capabilities.tools,
          resources: !!initResponse.capabilities.resources,
          prompts: !!initResponse.capabilities.prompts,
          sampling: !!initResponse.capabilities.sampling,
        }
      }

      if (capabilities.tools) {
        const { result: toolsResult } = await sendMCPRequest(
          server_url,
          'tools/list',
          {},
          authConfig,
          auth_type ?? 'none',
          session
        )

        tools = (toolsResult as MCPToolsListResponse)?.tools || []
      }

      await syncDiscoveredTools(supabaseClient, server_id, tools)

      await supabaseClient
        .from('mcp_servers')
        .update({
          is_verified: true,
          verification_status: 'success',
          last_verified_at: new Date().toISOString(),
          verification_error: null,
          supports_tools: capabilities.tools,
          supports_resources: capabilities.resources,
          supports_prompts: capabilities.prompts,
          supports_sampling: capabilities.sampling,
          updated_at: new Date().toISOString(),
        })
        .eq('id', server_id)

      return new Response(
        JSON.stringify({
          verified: true,
          tools,
          capabilities,
          serverInfo: initResponse?.serverInfo,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )

    } catch (mcpError: unknown) {
      const errorMessage = mcpError instanceof Error ? mcpError.message : 'Connection failed'

      await supabaseClient
        .from('mcp_servers')
        .update({
          is_verified: false,
          verification_status: 'failed',
          last_verified_at: new Date().toISOString(),
          verification_error: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', server_id)

      return new Response(
        JSON.stringify({
          verified: false,
          tools: [],
          error: errorMessage,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

  } catch (error: unknown) {
    console.error('Verify MCP server error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
