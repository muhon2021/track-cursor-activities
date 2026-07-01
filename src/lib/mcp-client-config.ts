import { slugify } from "@/lib/slug";
import { env } from "@/shared/config/env";
import type { MCPServer } from "@/hooks/useMCPServers";

export type McpClientTarget = "cursor" | "claude" | "vscode" | "control-tower";

export interface McpClientConfigResult {
  target: McpClientTarget;
  label: string;
  filePath: string;
  compatible: boolean;
  notice?: string;
  json: string;
}

function serverKey(name: string): string {
  const slug = slugify(name) || "mcp-server";
  return slug.replace(/-/g, "_");
}

function buildAuthHeaders(server: MCPServer): Record<string, string> {
  const auth = server.auth_config ?? {};

  if (server.auth_type === "bearer" && auth.bearer_token) {
    return { Authorization: `Bearer ${String(auth.bearer_token)}` };
  }

  if (server.auth_type === "api_key" && auth.api_key) {
    return { "X-API-Key": String(auth.api_key) };
  }

  if (server.auth_type === "basic") {
    if (auth.authorization_header) {
      const value = String(auth.authorization_header);
      return {
        Authorization: value.startsWith("Basic ") ? value : `Basic ${value}`,
      };
    }
    if (auth.username) {
      const credentials = btoa(`${auth.username}:${auth.password ?? ""}`);
      return { Authorization: `Basic ${credentials}` };
    }
  }

  return {};
}

function cursorHttpConfig(server: MCPServer): Record<string, unknown> {
  const key = serverKey(server.name);
  const entry: Record<string, unknown> = {
    url: server.server_url,
  };

  const headers = buildAuthHeaders(server);
  if (Object.keys(headers).length > 0) {
    entry.headers = headers;
  }

  return { mcpServers: { [key]: entry } };
}

/** Cursor MCP config for REST servers via the Control Tower MCP gateway. */
function cursorRestGatewayConfig(
  server: MCPServer,
  accessToken?: string | null
): Record<string, unknown> {
  const key = serverKey(server.name);
  const gatewayUrl = `${env.supabase.url}/functions/v1/control-tower-mcp?server_id=${server.id}`;

  return {
    mcpServers: {
      [key]: {
        url: gatewayUrl,
        headers: {
          apikey: env.supabase.anonKey,
          Authorization: accessToken
            ? `Bearer ${accessToken}`
            : "Bearer YOUR_SUPABASE_ACCESS_TOKEN",
        },
      },
    },
  };
}

function claudeDesktopConfig(server: MCPServer): Record<string, unknown> {
  const key = serverKey(server.name);
  const entry: Record<string, unknown> = {
    command: "npx",
    args: ["-y", "mcp-remote", server.server_url],
  };

  const headers = buildAuthHeaders(server);
  if (Object.keys(headers).length > 0) {
    entry.env = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [`MCP_HEADER_${k.toUpperCase().replace(/-/g, "_")}`, v])
    );
  }

  return { mcpServers: { [key]: entry } };
}

function controlTowerConfig(server: MCPServer): Record<string, unknown> {
  const firstTool = server.available_tools[0]?.name ?? "your_tool_name";

  return {
    description: "Use this server from Control Tower (REST tools are not native Cursor MCP).",
    server_id: server.id,
    server_name: server.name,
    transport: server.transport_type,
    execute_endpoint: `${env.supabase.url}/functions/v1/execute-mcp-tool`,
    example_request: {
      server_id: server.id,
      tool_name: firstTool,
      user_id: "YOUR_USER_ID",
      tool_input: {
        example_field: "value",
      },
    },
    tools: server.available_tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
    })),
  };
}

function isMcpProtocolServer(server: MCPServer): boolean {
  if (server.server_url.startsWith("internal://")) return false;
  return server.transport_type === "http" || server.transport_type === "sse";
}

export interface McpClientConfigOptions {
  /** Current Supabase session access token — embedded in Cursor gateway config when available. */
  accessToken?: string | null;
}

export function generateMcpClientConfigs(
  server: MCPServer,
  options: McpClientConfigOptions = {}
): McpClientConfigResult[] {
  const { accessToken } = options;
  const configs: McpClientConfigResult[] = [];

  if (server.transport_type === "rest" || server.server_url.startsWith("internal://")) {
    if (server.transport_type === "rest") {
      const tokenNotice = accessToken
        ? "Your session token is included for the first connection. After connect, the gateway issues a 7-day MCP session — you usually do not need to refresh hourly. If Cursor shows Error, open this dialog while logged in and copy fresh JSON, then toggle the MCP server off/on."
        : "Replace YOUR_SUPABASE_ACCESS_TOKEN with your session token from Control Tower (log in, open browser DevTools → Application → localStorage → supabase auth token).";

      configs.push({
        target: "cursor",
        label: "Cursor",
        filePath: String.raw`%USERPROFILE%\.cursor\mcp.json`,
        compatible: true,
        notice: `Paste into Cursor → Settings → MCP. Deploy the control-tower-mcp edge function first. ${tokenNotice}`,
        json: JSON.stringify(cursorRestGatewayConfig(server, accessToken), null, 2),
      });

      configs.push({
        target: "vscode",
        label: "VS Code (GitHub Copilot)",
        filePath: ".vscode/mcp.json (workspace) or user settings",
        compatible: true,
        notice: "Same MCP gateway URL as Cursor. Deploy control-tower-mcp edge function first.",
        json: JSON.stringify(cursorRestGatewayConfig(server, accessToken), null, 2),
      });
    }

    configs.push({
      target: "control-tower",
      label: "Control Tower API",
      filePath: "Control Tower app / execute-mcp-tool",
      compatible: true,
      notice:
        server.transport_type === "rest"
          ? "Direct API access from Control Tower agents or custom scripts."
          : "Built-in Control Tower tools are only available inside this application.",
      json: JSON.stringify(controlTowerConfig(server), null, 2),
    });

    return configs;
  }

  if (server.transport_type === "stdio" || server.transport_type === "websocket") {
    configs.push({
      target: "cursor",
      label: "Cursor",
      filePath: String.raw`%USERPROFILE%\.cursor\mcp.json`,
      compatible: false,
      notice: `${server.transport_type.toUpperCase()} servers require a local command setup. Use your MCP server's own install docs.`,
      json: JSON.stringify(
        {
          mcpServers: {
            [serverKey(server.name)]: {
              command: "your-mcp-command",
              args: ["--transport", server.transport_type],
            },
          },
        },
        null,
        2
      ),
    });
    return configs;
  }

  if (isMcpProtocolServer(server)) {
    configs.push({
      target: "cursor",
      label: "Cursor",
      filePath: String.raw`%USERPROFILE%\.cursor\mcp.json`,
      compatible: true,
      notice: "Paste into Cursor → Settings → MCP, or merge into your mcp.json file. Restart Cursor after saving.",
      json: JSON.stringify(cursorHttpConfig(server), null, 2),
    });

    configs.push({
      target: "claude",
      label: "Claude Desktop",
      filePath: String.raw`%APPDATA%\Claude\claude_desktop_config.json`,
      compatible: true,
      notice: "For HTTP MCP servers, Claude Desktop may require mcp-remote. Verify against your Claude version docs.",
      json: JSON.stringify(claudeDesktopConfig(server), null, 2),
    });

    configs.push({
      target: "vscode",
      label: "VS Code (GitHub Copilot)",
      filePath: ".vscode/mcp.json (workspace) or user settings",
      compatible: true,
      notice: "VS Code Copilot agent mode uses the same mcpServers JSON shape as Cursor.",
      json: JSON.stringify(cursorHttpConfig(server), null, 2),
    });
  }

  return configs;
}

export function getPrimaryMcpConfig(
  server: MCPServer,
  options: McpClientConfigOptions = {}
): McpClientConfigResult {
  const configs = generateMcpClientConfigs(server, options);
  return configs.find((c) => c.compatible) ?? configs[0];
}
