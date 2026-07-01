import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Code,
  Search,
  Globe,
  Image,
  Plug,
  Info,
  Sparkles,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useMCPServers } from "@/hooks/useMCPServers";

export interface ToolConfig {
  tool_code_interpreter: boolean;
  tool_file_search: boolean;
  tool_web_search: boolean;
  tool_image_generation: boolean;
  tool_mcp: boolean;
  mcp_server_ids: string[];
  tools_config: unknown[];
}

interface AgentToolConfigProps {
  config: ToolConfig;
  onChange: (config: ToolConfig) => void;
  disabled?: boolean;
}

interface ToolOption {
  key: keyof Pick<ToolConfig, 'tool_code_interpreter' | 'tool_file_search' | 'tool_web_search' | 'tool_image_generation' | 'tool_mcp'>;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  requiresProvider?: string;
}

const TOOL_OPTIONS: ToolOption[] = [
  {
    key: "tool_file_search",
    label: "File Search",
    description: "Search through knowledge base files using semantic search",
    icon: Search,
    badge: "RAG",
    badgeVariant: "secondary",
  },
  {
    key: "tool_web_search",
    label: "Web Search",
    description: "Search the web for real-time information",
    icon: Globe,
    badge: "Perplexity",
    badgeVariant: "outline",
    requiresProvider: "perplexity",
  },
  {
    key: "tool_code_interpreter",
    label: "Code Interpreter",
    description: "Execute code snippets and analyze results",
    icon: Code,
    badge: "Beta",
    badgeVariant: "default",
  },
  {
    key: "tool_image_generation",
    label: "Image Generation",
    description: "Generate images using DALL-E or similar models",
    icon: Image,
    badge: "DALL-E",
    badgeVariant: "outline",
    requiresProvider: "openai",
  },
  {
    key: "tool_mcp",
    label: "MCP Servers",
    description: "Connect to external Model Context Protocol servers",
    icon: Plug,
    badge: "Advanced",
    badgeVariant: "secondary",
  },
];

export function AgentToolConfig({
  config,
  onChange,
  disabled = false,
}: AgentToolConfigProps) {
  const handleToggle = (key: ToolOption["key"], enabled: boolean) => {
    onChange({
      ...config,
      [key]: enabled,
    });
  };

  const enabledCount = TOOL_OPTIONS.filter((opt) => config[opt.key]).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Tools & Capabilities
            </CardTitle>
            <CardDescription>
              Enable tools to extend this agent's capabilities
            </CardDescription>
          </div>
          {enabledCount > 0 && (
            <Badge variant="secondary">
              {enabledCount} tool{enabledCount !== 1 ? "s" : ""} enabled
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <TooltipProvider>
          {TOOL_OPTIONS.map((tool) => {
            const Icon = tool.icon;
            const isEnabled = config[tool.key];

            return (
              <div
                key={tool.key}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  isEnabled
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-md ${
                      isEnabled ? "bg-primary/10 text-primary" : "bg-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={tool.key}
                        className="font-medium cursor-pointer"
                      >
                        {tool.label}
                      </Label>
                      {tool.badge && (
                        <Badge variant={tool.badgeVariant} className="text-xs">
                          {tool.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tool.description}
                    </p>
                    {tool.requiresProvider && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Requires {tool.requiresProvider} provider
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Info className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <p>{tool.description}</p>
                      {tool.requiresProvider && (
                        <p className="text-amber-500 mt-1">
                          Note: This tool requires the {tool.requiresProvider}{" "}
                          provider to be configured.
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                  <Switch
                    id={tool.key}
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleToggle(tool.key, checked)}
                    disabled={disabled}
                  />
                </div>
              </div>
            );
          })}
        </TooltipProvider>

        {config.tool_mcp && (
          <McpServerPicker
            selectedIds={config.mcp_server_ids}
            disabled={disabled}
            onChange={(ids) =>
              onChange({
                ...config,
                mcp_server_ids: ids,
                tool_mcp: ids.length > 0 ? true : config.tool_mcp,
              })
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

// Default config factory
export function getDefaultToolConfig(): ToolConfig {
  return {
    tool_code_interpreter: false,
    tool_file_search: true, // Enable by default for RAG
    tool_web_search: false,
    tool_image_generation: false,
    tool_mcp: false,
    mcp_server_ids: [],
    tools_config: [],
  };
}

function McpServerPicker({
  selectedIds,
  onChange,
  disabled,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const { data: servers, isLoading } = useMCPServers();

  const activeServers = (servers ?? []).filter((s) => s.is_active);

  const toggleServer = (serverId: string, checked: boolean) => {
    const nextIds = checked
      ? [...selectedIds, serverId]
      : selectedIds.filter((id) => id !== serverId);
    onChange(nextIds);
  };

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-dashed p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Attached MCP servers</p>
          <p className="text-xs text-muted-foreground">
            Select which MCP servers this agent can call during chat and runs.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/mcp-servers">
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            Manage
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading MCP servers...
        </div>
      ) : activeServers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No MCP servers yet. Create one (e.g. ActiveCollab) on the MCP Servers page first.
        </p>
      ) : (
        <div className="space-y-2">
          {activeServers.map((server) => {
            const checked = selectedIds.includes(server.id);
            const toolCount = server.available_tools?.length ?? 0;

            return (
              <label
                key={server.id}
                className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                  checked ? "border-primary/50 bg-primary/5" : "border-border"
                } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(value) => toggleServer(server.id, value === true)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {server.icon ? `${server.icon} ` : ""}
                      {server.name}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {server.transport_type}
                    </Badge>
                    {server.is_verified && (
                      <Badge variant="secondary" className="text-xs">
                        Verified
                      </Badge>
                    )}
                  </div>
                  {server.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {server.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {toolCount} tool{toolCount === 1 ? "" : "s"} available
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {selectedIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedIds.length} server{selectedIds.length === 1 ? "" : "s"} attached. The agent
          will automatically use these tools when answering relevant questions.
        </p>
      )}
    </div>
  );
}
