/** REST-style MCP tools: HTTP endpoints stored in input_schema via x-http-config */

export const MCP_HTTP_CONFIG_KEY = "x-http-config";

export type RestHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface MCPToolHttpConfig {
  method: RestHttpMethod;
  path: string;
  headers?: Record<string, string>;
}

export interface MCPToolParameter {
  name: string;
  type: "string" | "number" | "integer" | "boolean";
  description?: string;
  required?: boolean;
}

export interface RestMCPTool {
  name: string;
  description: string;
  httpConfig: MCPToolHttpConfig;
  parameters: MCPToolParameter[];
}

export interface ParsedCurlCommand {
  baseUrl: string;
  path: string;
  method: RestHttpMethod;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  authorizationHeader?: string;
}

export function buildInputSchema(tool: RestMCPTool): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const param of tool.parameters) {
    if (!param.name.trim()) continue;
    properties[param.name] = {
      type: param.type,
      ...(param.description ? { description: param.description } : {}),
    };
    if (param.required) required.push(param.name);
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
    [MCP_HTTP_CONFIG_KEY]: tool.httpConfig,
  };
}

export function parseInputSchemaToRestTool(
  name: string,
  description: string,
  inputSchema: Record<string, unknown>
): RestMCPTool {
  const httpConfig = (inputSchema[MCP_HTTP_CONFIG_KEY] as MCPToolHttpConfig) ?? {
    method: "POST",
    path: "",
  };

  const properties = (inputSchema.properties as Record<string, Record<string, unknown>>) ?? {};
  const requiredFields = new Set(
    Array.isArray(inputSchema.required) ? (inputSchema.required as string[]) : []
  );

  const parameters: MCPToolParameter[] = Object.entries(properties).map(([paramName, schema]) => ({
    name: paramName,
    type: (schema.type as MCPToolParameter["type"]) || "string",
    description: typeof schema.description === "string" ? schema.description : undefined,
    required: requiredFields.has(paramName),
  }));

  return { name, description, httpConfig, parameters };
}

export function restToolToMCPTool(tool: RestMCPTool) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: buildInputSchema(tool) as {
      type: string;
      properties: Record<string, unknown>;
      required?: string[];
    },
  };
}

export function getHttpConfigFromSchema(
  schema: Record<string, unknown> | null | undefined
): MCPToolHttpConfig | null {
  if (!schema) return null;
  const config = schema[MCP_HTTP_CONFIG_KEY];
  if (!config || typeof config !== "object") return null;
  return config as MCPToolHttpConfig;
}

export function schemaForValidation(schema: Record<string, unknown>): Record<string, unknown> {
  const { [MCP_HTTP_CONFIG_KEY]: _http, ...rest } = schema;
  return rest;
}

/** Minimal curl parser for common --location POST patterns */
export function parseCurlCommand(curl: string): ParsedCurlCommand {
  const normalized = curl.replace(/\\\r?\n/g, " ").replace(/\s+/g, " ").trim();

  const urlMatch =
    normalized.match(/curl\s+(?:--location\s+)?['"]([^'"]+)['"]/i) ||
    normalized.match(/curl\s+(?:--location\s+)?(\S+)/i);

  if (!urlMatch?.[1]) {
    throw new Error("Could not find URL in curl command");
  }

  const fullUrl = urlMatch[1];
  const parsedUrl = new URL(fullUrl);
  const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
  const path = `${parsedUrl.pathname}${parsedUrl.search}`;

  let method: RestHttpMethod = "GET";
  const methodMatch = normalized.match(/-X\s+([A-Z]+)/i);
  if (methodMatch) {
    method = methodMatch[1].toUpperCase() as RestHttpMethod;
  } else if (normalized.includes("--data") || normalized.includes("-d ")) {
    method = "POST";
  }

  const headers: Record<string, string> = {};
  let authorizationHeader: string | undefined;

  const headerRegex = /--header\s+['"]([^:'"]+):\s*([^'"]+)['"]/gi;
  let headerMatch;
  while ((headerMatch = headerRegex.exec(normalized)) !== null) {
    const key = headerMatch[1].trim();
    const value = headerMatch[2].trim();
    if (key.toLowerCase() === "authorization") {
      authorizationHeader = value.startsWith("Basic ") || value.startsWith("Bearer ")
        ? value
        : `Basic ${value}`;
    } else if (key.toLowerCase() !== "content-type") {
      headers[key] = value;
    }
  }

  let body: Record<string, unknown> = {};
  const dataMatch =
    normalized.match(/--data-raw\s+['"](.+?)['"]\s*(?:--|$)/i) ||
    normalized.match(/--data\s+['"](.+?)['"]\s*(?:--|$)/i) ||
    normalized.match(/-d\s+['"](.+?)['"]\s*(?:--|$)/i);

  if (dataMatch?.[1]) {
    try {
      body = JSON.parse(dataMatch[1]);
    } catch {
      throw new Error("Could not parse JSON body from curl command");
    }
  }

  return {
    baseUrl,
    path,
    method,
    headers,
    body,
    authorizationHeader,
  };
}

export function curlToRestTool(curl: string, toolName?: string): {
  server: { baseUrl: string; authorizationHeader?: string };
  tool: RestMCPTool;
} {
  const parsed = parseCurlCommand(curl);
  const name =
    toolName ||
    parsed.path.split("/").filter(Boolean).pop()?.replace(/[^a-z0-9_-]/gi, "_") ||
    "api_call";

  const parameters: MCPToolParameter[] = Object.entries(parsed.body).map(([paramName, value]) => ({
    name: paramName,
    type: typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string",
    required: ["name", "project_id"].includes(paramName),
    description: undefined,
  }));

  return {
    server: {
      baseUrl: parsed.baseUrl,
      authorizationHeader: parsed.authorizationHeader,
    },
    tool: {
      name,
      description: `${parsed.method} ${parsed.path}`,
      httpConfig: {
        method: parsed.method,
        path: parsed.path,
        headers: Object.keys(parsed.headers).length ? parsed.headers : undefined,
      },
      parameters,
    },
  };
}

export const ACTIVECOLLAB_CREATE_TASK_TEMPLATE: RestMCPTool = {
  name: "ac_create_task",
  description: "Create a task in ActiveCollab",
  httpConfig: {
    method: "POST",
    path: "/api/v1/ac-create-task",
  },
  parameters: [
    { name: "project_id", type: "integer", required: true, description: "ActiveCollab project ID" },
    { name: "task_list_id", type: "string", description: "Task list ID (optional)" },
    { name: "name", type: "string", required: true, description: "Task title" },
    { name: "body", type: "string", description: "Task description" },
    { name: "assignee_id", type: "string", description: "Assignee user ID" },
    { name: "assignee_email", type: "string", description: "Assignee email address" },
    { name: "start_on", type: "string", description: "Start date (YYYY-MM-DD)" },
    { name: "due_on", type: "string", description: "Due date (YYYY-MM-DD)" },
    { name: "estimate", type: "number", description: "Estimated hours" },
  ],
};
