/**
 * Control Tower MCP Gateway
 *
 * Streamable HTTP MCP endpoint for REST-configured servers (Cursor, VS Code).
 * Requires ?server_id=<uuid> on the URL.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, mcp-protocol-version, mcp-session-id, accept, last-event-id",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, MCP-Protocol-Version",
};

const DEFAULT_PROTOCOL_VERSION = "2024-11-05";
const MCP_HTTP_CONFIG_KEY = "x-http-config";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — survives short-lived Supabase JWT in mcp.json

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

interface McpSessionPayload {
  uid: string;
  sid: string;
  exp: number;
}

interface RestHttpConfig {
  method: string;
  path: string;
  headers?: Record<string, string>;
}

interface GatewayContext {
  userId: string;
  serverId: string;
  supabase: SupabaseClient;
}

function getSessionHeader(req: Request): string | null {
  return req.headers.get("mcp-session-id") || req.headers.get("Mcp-Session-Id");
}

function extractBearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

function sessionSecret(): string {
  return (
    Deno.env.get("MCP_GATEWAY_SESSION_SECRET") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_JWT_SECRET") ??
    ""
  );
}

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function signMcpSession(userId: string, serverId: string): Promise<string> {
  const secret = sessionSecret();
  if (!secret) throw new Error("MCP gateway session secret not configured");

  const payload: McpSessionPayload = {
    uid: userId,
    sid: serverId,
    exp: Date.now() + SESSION_TTL_MS,
  };

  const payloadB64 = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${toBase64Url(new Uint8Array(sig))}`;
}

async function verifyMcpSession(
  token: string,
  expectedServerId: string
): Promise<McpSessionPayload | null> {
  const secret = sessionSecret();
  if (!secret) return null;

  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return null;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(sigB64),
      new TextEncoder().encode(payloadB64)
    );
    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payloadB64))
    ) as McpSessionPayload;

    if (!payload.uid || !payload.sid || !payload.exp) return null;
    if (payload.sid !== expectedServerId) return null;
    if (Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

function jsonRpcResult(
  id: string | number | null | undefined,
  result: unknown,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, result }), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...extraHeaders,
    },
  });
}

function jsonRpcError(
  id: string | number | null | undefined,
  code: number,
  message: string,
  httpStatus = 200
): Response {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: httpStatus }
  );
}

function stripHttpConfig(schema: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...schema };
  delete copy[MCP_HTTP_CONFIG_KEY];
  return copy;
}

function buildUpstreamAuthHeaders(
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
    ...buildUpstreamAuthHeaders(authConfig, authType),
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

async function resolveGatewayContext(
  req: Request,
  serverId: string
): Promise<{ ctx: GatewayContext; sessionId: string | null; isNewSession: boolean } | Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  const sessionHeader = getSessionHeader(req);
  if (sessionHeader) {
    const session = await verifyMcpSession(sessionHeader, serverId);
    if (!session) {
      return new Response(JSON.stringify({ error: "Invalid or expired MCP session" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return {
      ctx: {
        userId: session.uid,
        serverId,
        supabase: createClient(supabaseUrl, serviceKey),
      },
      sessionId: sessionHeader,
      isNewSession: false,
    };
  }

  const jwt = extractBearerToken(req);
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Missing Authorization Bearer token or Mcp-Session-Id" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: userData, error: userError } = await supabaseUser.auth.getUser(jwt);
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "Invalid or expired access token — copy fresh JSON from Control Tower MCP dialog" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: server, error: serverError } = await supabaseUser
    .from("mcp_servers")
    .select("id")
    .eq("id", serverId)
    .single();

  if (serverError || !server) {
    return new Response(JSON.stringify({ error: "MCP server not found or access denied" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const newSessionId = await signMcpSession(userData.user.id, serverId);

  return {
    ctx: {
      userId: userData.user.id,
      serverId,
      supabase: createClient(supabaseUrl, serviceKey),
    },
    sessionId: newSessionId,
    isNewSession: true,
  };
}

async function loadServer(ctx: GatewayContext) {
  const { data: server, error } = await ctx.supabase
    .from("mcp_servers")
    .select("*")
    .eq("id", ctx.serverId)
    .single();

  if (error || !server) return null;
  if (server.is_enabled === false) return null;
  if (server.transport_type !== "rest") return null;
  return server;
}

function handleSseStream(sessionId: string): Response {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(": connected\n\n"));

      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(interval);
        }
      }, 25_000);

      const timeout = setTimeout(() => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // already closed
        }
      }, 55_000);
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Mcp-Session-Id": sessionId,
    },
  });
}

async function handleJsonRpc(
  req: Request,
  ctx: GatewayContext,
  sessionId: string | null,
  isNewSession: boolean
): Promise<Response> {
  const server = await loadServer(ctx);
  if (!server) {
    return new Response(
      JSON.stringify({ error: "MCP server not found, disabled, or not REST transport" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const body = (await req.json()) as JsonRpcRequest;
  const { method, params = {}, id } = body;

  if (!method) {
    return jsonRpcError(id, -32600, "Invalid Request: missing method");
  }

  const sessionHeaders: Record<string, string> = {};
  if (isNewSession && sessionId) {
    sessionHeaders["Mcp-Session-Id"] = sessionId;
  } else if (sessionId) {
    sessionHeaders["Mcp-Session-Id"] = sessionId;
  }

  const protocolVersion =
    req.headers.get("mcp-protocol-version") ||
    req.headers.get("MCP-Protocol-Version") ||
    DEFAULT_PROTOCOL_VERSION;
  sessionHeaders["MCP-Protocol-Version"] = protocolVersion;

  switch (method) {
    case "initialize": {
      const clientVersion = (params.protocolVersion as string) || DEFAULT_PROTOCOL_VERSION;
      return jsonRpcResult(
        id,
        {
          protocolVersion: clientVersion,
          capabilities: {
            tools: { listChanged: false },
          },
          serverInfo: {
            name: `Control Tower: ${server.name}`,
            version: "1.0.0",
          },
        },
        sessionHeaders
      );
    }

    case "notifications/initialized":
      return new Response(null, { status: 202, headers: { ...corsHeaders, ...sessionHeaders } });

    case "ping":
      return jsonRpcResult(id, {}, sessionHeaders);

    case "tools/list": {
      const { data: tools, error: toolsError } = await ctx.supabase
        .from("mcp_tools")
        .select("name, description, input_schema")
        .eq("server_id", ctx.serverId)
        .eq("is_enabled", true)
        .order("name");

      if (toolsError) {
        return jsonRpcError(id, -32603, `Failed to list tools: ${toolsError.message}`);
      }

      const mcpTools = (tools ?? []).map((tool) => ({
        name: tool.name,
        description: tool.description || tool.name,
        inputSchema: stripHttpConfig((tool.input_schema as Record<string, unknown>) ?? {
          type: "object",
          properties: {},
        }),
      }));

      return jsonRpcResult(id, { tools: mcpTools }, sessionHeaders);
    }

    case "tools/call": {
      const toolName = params.name as string;
      const arguments_ = (params.arguments as Record<string, unknown>) ?? {};

      if (!toolName) {
        return jsonRpcError(id, -32602, "Missing tool name");
      }

      const { data: tool, error: toolError } = await ctx.supabase
        .from("mcp_tools")
        .select("name, input_schema")
        .eq("server_id", ctx.serverId)
        .eq("name", toolName)
        .eq("is_enabled", true)
        .single();

      if (toolError || !tool) {
        return jsonRpcResult(
          id,
          {
            content: [{ type: "text", text: `Tool not found: ${toolName}` }],
            isError: true,
          },
          sessionHeaders
        );
      }

      try {
        const result = await executeRestTool(
          server,
          tool.input_schema as Record<string, unknown>,
          arguments_
        );

        const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);

        return jsonRpcResult(
          id,
          {
            content: [{ type: "text", text }],
            isError: false,
          },
          sessionHeaders
        );
      } catch (toolErr: unknown) {
        const message = toolErr instanceof Error ? toolErr.message : "Tool execution failed";
        return jsonRpcResult(
          id,
          {
            content: [{ type: "text", text: message }],
            isError: true,
          },
          sessionHeaders
        );
      }
    }

    default:
      if (method.startsWith("notifications/")) {
        return new Response(null, { status: 202, headers: { ...corsHeaders, ...sessionHeaders } });
      }
      return jsonRpcError(id, -32601, `Method not found: ${method}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const requestUrl = new URL(req.url);
    const serverId = requestUrl.searchParams.get("server_id");

    if (!serverId) {
      return new Response(
        JSON.stringify({ error: "Missing server_id query parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sessionHeader = getSessionHeader(req);

    if (req.method === "GET") {
      if (!sessionHeader) {
        return new Response(JSON.stringify({ error: "Missing Mcp-Session-Id header" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const session = await verifyMcpSession(sessionHeader, serverId);
      if (!session) {
        return new Response(JSON.stringify({ error: "Invalid or expired MCP session" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return handleSseStream(sessionHeader);
    }

    if (req.method === "DELETE") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resolved = await resolveGatewayContext(req, serverId);
    if (resolved instanceof Response) return resolved;

    const { ctx, sessionId, isNewSession } = resolved;

    if (!sessionHeader && !isNewSession) {
      let peek: JsonRpcRequest = {};
      try {
        peek = await req.clone().json();
      } catch {
        return jsonRpcError(null, -32600, "Invalid JSON-RPC body", 400);
      }
      if (peek.method && peek.method !== "initialize") {
        return jsonRpcError(
          peek.id ?? null,
          -32000,
          "Missing Mcp-Session-Id — re-initialize or copy fresh config from Control Tower",
          400
        );
      }
    }

    return await handleJsonRpc(req, ctx, sessionId, isNewSession);
  } catch (error: unknown) {
    console.error("control-tower-mcp error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
