import {
  CheckCircle2,
  Code,
  Globe,
  Loader2,
  Search,
  Wrench,
  XCircle,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ToolCallStatus = "pending" | "running" | "completed" | "failed";

export interface ToolCallItem {
  id: string;
  name: string;
  status: ToolCallStatus;
  input?: unknown;
  output?: unknown;
  error?: string;
}

interface ToolCallBlockProps {
  tools: ToolCallItem[];
  className?: string;
}

function toolIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("code")) return <Code className="h-3.5 w-3.5" />;
  if (lower.includes("web") || lower.includes("search")) return <Globe className="h-3.5 w-3.5" />;
  if (lower.includes("file") || lower.includes("knowledge")) return <Search className="h-3.5 w-3.5" />;
  if (lower.includes("mcp")) return <Wrench className="h-3.5 w-3.5" />;
  return <Zap className="h-3.5 w-3.5" />;
}

function StatusIcon({ status }: { status: ToolCallStatus }) {
  if (status === "pending" || status === "running") {
    return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  }
  if (status === "completed") {
    return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  }
  return <XCircle className="h-4 w-4 text-destructive" />;
}

function statusLabel(status: ToolCallStatus) {
  switch (status) {
    case "pending":
      return "Queued";
    case "running":
      return "Running";
    case "completed":
      return "Done";
    case "failed":
      return "Failed";
  }
}

export function ToolCallBlock({ tools, className }: ToolCallBlockProps) {
  if (!tools.length) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {tools.map((tool) => (
        <div
          key={tool.id}
          className={cn(
            "rounded-lg border px-3 py-2 text-xs transition-colors",
            (tool.status === "pending" || tool.status === "running") &&
              "border-primary/30 bg-primary/5 animate-pulse",
            tool.status === "completed" && "border-green-500/30 bg-green-500/5",
            tool.status === "failed" && "border-destructive/30 bg-destructive/5"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {toolIcon(tool.name)}
              <span className="font-medium truncate">{tool.name}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] h-5",
                  tool.status === "running" && "border-primary text-primary"
                )}
              >
                {statusLabel(tool.status)}
              </Badge>
              <StatusIcon status={tool.status} />
            </div>
          </div>

          {tool.input != null ? (
            <pre className="mt-2 max-h-24 overflow-auto rounded bg-background/60 p-2 text-[10px] text-muted-foreground">
              {typeof tool.input === "string"
                ? tool.input
                : JSON.stringify(tool.input, null, 2)}
            </pre>
          ) : null}

          {tool.output != null && tool.status === "completed" ? (
            <pre className="mt-2 max-h-24 overflow-auto rounded bg-background/60 p-2 text-[10px] text-muted-foreground">
              {typeof tool.output === "string"
                ? tool.output
                : JSON.stringify(tool.output, null, 2)}
            </pre>
          ) : null}

          {tool.error ? (
            <p className="mt-1 text-[10px] text-destructive">{tool.error}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function parseToolCallsFromMessage(
  toolCalls: unknown,
  toolResults: unknown,
  metadata?: Record<string, unknown>
): ToolCallItem[] {
  const items: ToolCallItem[] = [];

  if (Array.isArray(toolCalls)) {
    for (let i = 0; i < toolCalls.length; i++) {
      const tc = toolCalls[i] as Record<string, unknown>;
      const name =
        (typeof tc.name === "string" && tc.name) ||
        (typeof tc.tool_name === "string" && tc.tool_name) ||
        `tool_${i + 1}`;
      const id = (typeof tc.id === "string" && tc.id) || `tc-${i}`;
      const statusRaw = typeof tc.status === "string" ? tc.status : "completed";
      const status: ToolCallStatus =
        statusRaw === "failed"
          ? "failed"
          : statusRaw === "running" || statusRaw === "executing"
            ? "running"
            : statusRaw === "pending"
              ? "pending"
              : "completed";

      let output: unknown;
      if (Array.isArray(toolResults) && toolResults[i] != null) {
        output = toolResults[i];
      }

      items.push({
        id,
        name,
        status,
        input: tc.input ?? tc.arguments ?? tc.tool_input,
        output,
        error: typeof tc.error === "string" ? tc.error : undefined,
      });
    }
  }

  const mcpCalled = metadata?.mcp_tools_called;
  if (items.length === 0 && Array.isArray(mcpCalled)) {
    for (let i = 0; i < mcpCalled.length; i++) {
      const name = String(mcpCalled[i]);
      const failed = metadata?.mcp_tool_error;
      items.push({
        id: `mcp-${i}`,
        name,
        status: failed ? "failed" : "completed",
        error: typeof failed === "string" ? failed : undefined,
      });
    }
  }

  return items;
}

export function buildLiveToolCalls(
  names: string[],
  status: ToolCallStatus = "running"
): ToolCallItem[] {
  return names.map((name, i) => ({
    id: `live-${i}`,
    name,
    status,
  }));
}
