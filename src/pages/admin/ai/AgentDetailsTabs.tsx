/**
 * Agent detail tabs — Phase C
 * Route: /admin/ai/agents/:agentId
 */
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft,
  Brain,
  History,
  Loader2,
  RefreshCw,
  Save,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  useAIAgent,
  useUpdateAgent,
  type AgentFormData,
} from "@/hooks/useAIAgents";
import {
  useAgentPromptVersions,
  useCreatePromptVersion,
  useAgentLearningEvents,
  useAgentMemoriesAdmin,
  useAgentRunAuditLog,
} from "@/hooks/useAgentAdmin";
import { AgentRunAuditTable } from "@/components/admin/AgentRunAuditTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  AgentCategoryGuide,
  SystemPromptGuide,
  MemorySystemGuide,
  MultiAgentCollaborationInfo,
  HITLApprovalInfo,
} from "@/components/admin/AgentConfigurationGuide";
import {
  AgentToolConfig,
  type ToolConfig,
} from "@/components/ai/AgentToolConfig";

export default function AgentDetailsTabs() {
  const { agentId = "" } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { features } = useOrganization();
  const graphifyAvailable = features.enableGraphify;
  const { data: agent, isLoading, isError, error, refetch } = useAIAgent(agentId);
  const updateAgent = useUpdateAgent();

  const [config, setConfig] = useState<Partial<AgentFormData>>({});
  const [memoryUserFilter, setMemoryUserFilter] = useState<string>("all");
  const [newPromptNote, setNewPromptNote] = useState("");

  const {
    data: promptVersions,
    isLoading: versionsLoading,
    isError: versionsError,
    refetch: refetchVersions,
  } = useAgentPromptVersions(agentId);

  const {
    data: auditRows,
    isLoading: auditLoading,
    isError: auditError,
    refetch: refetchAudit,
  } = useAgentRunAuditLog({ agentId, limit: 50 });

  const {
    data: learningEvents,
    isLoading: learningLoading,
    isError: learningError,
    refetch: refetchLearning,
  } = useAgentLearningEvents(agentId);

  const {
    data: memories,
    isLoading: memoriesLoading,
    isError: memoriesError,
    refetch: refetchMemories,
  } = useAgentMemoriesAdmin(
    agentId,
    memoryUserFilter === "all" ? undefined : memoryUserFilter
  );

  const createVersion = useCreatePromptVersion();

  const effectiveConfig: AgentFormData | null = agent
    ? {
        name: config.name ?? agent.name,
        slug: config.slug ?? agent.slug,
        description: config.description ?? agent.description ?? "",
        category: config.category ?? agent.category ?? "general",
        system_prompt: config.system_prompt ?? agent.system_prompt,
        is_enabled: config.is_enabled ?? agent.is_enabled,
        memory_enabled: config.memory_enabled ?? agent.memory_enabled,
        rag_enabled: config.rag_enabled ?? agent.rag_enabled,
        graphify_enabled: config.graphify_enabled ?? agent.graphify_enabled ?? false,
        tool_code_interpreter:
          config.tool_code_interpreter ?? agent.tool_code_interpreter ?? false,
        tool_file_search: config.tool_file_search ?? agent.tool_file_search ?? true,
        tool_web_search: config.tool_web_search ?? agent.tool_web_search ?? false,
        tool_image_generation:
          config.tool_image_generation ?? agent.tool_image_generation ?? false,
        tool_mcp: config.tool_mcp ?? agent.tool_mcp ?? false,
        mcp_server_ids: config.mcp_server_ids ?? agent.mcp_server_ids ?? [],
        tools_config: config.tools_config ?? (agent.tools_config as unknown[]) ?? [],
      }
    : null;

  const handleToolConfigChange = (toolConfig: ToolConfig) => {
    setConfig((prev) => ({
      ...prev,
      ...toolConfig,
    }));
  };

  const memoryUsers = Array.from(
    new Map(
      (memories ?? []).map((m) => [
        m.user_id,
        m.profiles?.email ?? m.user_id.slice(0, 8),
      ])
    ).entries()
  );

  const saveConfiguration = async () => {
    if (!agent || !effectiveConfig) return;
    try {
      await updateAgent.mutateAsync({ id: agent.id, data: effectiveConfig });
      toast.success("Agent configuration saved");
      setConfig({});
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  };

  const savePromptVersion = async () => {
    if (!agent || !user?.id || !effectiveConfig?.system_prompt.trim()) return;
    try {
      await createVersion.mutateAsync({
        agent_id: agent.id,
        system_prompt: effectiveConfig.system_prompt,
        change_summary: newPromptNote || "Updated system prompt",
        created_by: user.id,
      });
      setNewPromptNote("");
      toast.success("Prompt version saved");
      refetchVersions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save version");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError || !agent) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-sm text-muted-foreground">
          {(error as Error)?.message ?? "Agent not found"}
        </p>
        <Button variant="outline" asChild>
          <Link to="/admin/ai/agents">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to catalog
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-2" asChild>
            <Link to="/admin/ai/agents">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Agent catalog
            </Link>
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            {agent.name}
          </h1>
          <p className="text-sm text-muted-foreground font-mono">{agent.slug}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={agent.is_enabled ? "default" : "secondary"}>
            {agent.is_enabled ? "Enabled" : "Disabled"}
          </Badge>
          {agent.memory_enabled ? <Badge variant="outline">Memory</Badge> : null}
          {agent.rag_enabled ? <Badge variant="outline">RAG</Badge> : null}
          {agent.graphify_enabled ? <Badge variant="outline">Graphify</Badge> : null}
          {agent.tool_mcp && (agent.mcp_server_ids?.length ?? 0) > 0 ? (
            <Badge variant="outline">MCP ({agent.mcp_server_ids.length})</Badge>
          ) : null}
          {agent.is_enabled ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/admin/ai/chat?agent=${agent.id}`)}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="configuration" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="prompts">Prompt Versions</TabsTrigger>
          <TabsTrigger value="audit">Run Audit Log</TabsTrigger>
          <TabsTrigger value="learning">Learning Events</TabsTrigger>
          <TabsTrigger value="memory">Per-User Memory</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration">
          <Card>
            <CardHeader>
              <CardTitle>Agent configuration</CardTitle>
              <CardDescription>
                Core settings for {agent.name}. Changes apply immediately on save.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={effectiveConfig?.name ?? ""}
                    onChange={(e) => setConfig((c) => ({ ...c, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input
                    value={effectiveConfig?.slug ?? ""}
                    onChange={(e) => setConfig((c) => ({ ...c, slug: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    URL-safe identifier used in /agents/{effectiveConfig?.slug || "…"}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={effectiveConfig?.description ?? ""}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, description: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={effectiveConfig?.category ?? "general"}
                  onValueChange={(value) => setConfig((c) => ({ ...c, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="communication">Communication</SelectItem>
                    <SelectItem value="analysis">Analysis</SelectItem>
                    <SelectItem value="task_management">Task Management</SelectItem>
                  </SelectContent>
                </Select>
                <AgentCategoryGuide />
              </div>
              <div className="space-y-2">
                <Label>System prompt</Label>
                <Textarea
                  value={effectiveConfig?.system_prompt ?? ""}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, system_prompt: e.target.value }))
                  }
                  rows={10}
                />
                <SystemPromptGuide />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label>Enable Agent</Label>
                  <p className="text-sm text-muted-foreground">
                    Agent will be available for chat and runs
                  </p>
                </div>
                <Switch
                  checked={effectiveConfig?.is_enabled}
                  onCheckedChange={(checked) =>
                    setConfig((c) => ({ ...c, is_enabled: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <MemorySystemGuide />
                <Switch
                  checked={effectiveConfig?.memory_enabled}
                  onCheckedChange={(checked) =>
                    setConfig((c) => ({ ...c, memory_enabled: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label>Enable RAG</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow this agent to answer using synced task and knowledge context
                  </p>
                </div>
                <Switch
                  checked={!!effectiveConfig?.rag_enabled}
                  onCheckedChange={(checked) =>
                    setConfig((c) => ({
                      ...c,
                      rag_enabled: checked,
                      graphify_enabled: checked ? c.graphify_enabled : false,
                    }))
                  }
                />
              </div>

              {graphifyAvailable ? (
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label>Enable Graphify</Label>
                    <p className="text-sm text-muted-foreground">
                      Hybrid graph + vector retrieval for richer context (requires RAG)
                    </p>
                  </div>
                  <Switch
                    checked={!!effectiveConfig?.graphify_enabled}
                    disabled={!effectiveConfig?.rag_enabled}
                    onCheckedChange={(checked) =>
                      setConfig((c) => ({ ...c, graphify_enabled: checked }))
                    }
                  />
                </div>
              ) : null}

              <Separator />

              <AgentToolConfig
                config={{
                  tool_code_interpreter: effectiveConfig?.tool_code_interpreter ?? false,
                  tool_file_search: effectiveConfig?.tool_file_search ?? true,
                  tool_web_search: effectiveConfig?.tool_web_search ?? false,
                  tool_image_generation: effectiveConfig?.tool_image_generation ?? false,
                  tool_mcp: effectiveConfig?.tool_mcp ?? false,
                  mcp_server_ids: effectiveConfig?.mcp_server_ids ?? [],
                  tools_config: effectiveConfig?.tools_config ?? [],
                }}
                onChange={handleToolConfigChange}
                disabled={updateAgent.isPending}
              />

              <Separator />

              <div className="space-y-4">
                <MultiAgentCollaborationInfo />
                <HITLApprovalInfo />
              </div>

              <div className="flex gap-2">
                <Button onClick={saveConfiguration} disabled={updateAgent.isPending}>
                  {updateAgent.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prompts">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Prompt versions</CardTitle>
                <CardDescription>
                  Version history for this agent&apos;s system prompt
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchVersions()}
                disabled={versionsLoading}
              >
                <RefreshCw className={cn("h-4 w-4", versionsLoading && "animate-spin")} />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Change summary for new version…"
                  value={newPromptNote}
                  onChange={(e) => setNewPromptNote(e.target.value)}
                />
                <Button
                  onClick={savePromptVersion}
                  disabled={createVersion.isPending}
                  className="shrink-0"
                >
                  Save as new version
                </Button>
              </div>

              {versionsError ? (
                <ErrorPanel message="Failed to load prompt versions" onRetry={refetchVersions} />
              ) : versionsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !promptVersions?.length ? (
                <EmptyPanel message="No prompt versions yet. Save the configuration to create v1." />
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {promptVersions.map((v) => (
                      <div
                        key={v.id}
                        className="rounded-lg border p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">v{v.version_number}</Badge>
                            {v.is_active ? (
                              <Badge>Active</Badge>
                            ) : null}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(v.created_at), "MMM d, yyyy HH:mm")}
                          </span>
                        </div>
                        {v.change_summary ? (
                          <p className="text-sm text-muted-foreground">{v.change_summary}</p>
                        ) : null}
                        <pre className="text-xs bg-muted/50 rounded p-3 whitespace-pre-wrap max-h-32 overflow-auto">
                          {v.system_prompt}
                        </pre>
                        <p className="text-[10px] text-muted-foreground">
                          By {v.profiles?.email ?? "Unknown"}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Run audit log
                </CardTitle>
                <CardDescription>
                  Tool calls and execution events for this agent
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/admin/ai/run-audit-log?agent=${agentId}`}>Full log</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {auditError ? (
                <ErrorPanel message="Failed to load audit log" onRetry={refetchAudit} />
              ) : auditLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <AgentRunAuditTable rows={auditRows ?? []} showAgentColumn={false} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="learning">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Learning events</CardTitle>
                <CardDescription>User feedback and learning signals</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchLearning()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {learningError ? (
                <ErrorPanel message="Failed to load learning events" onRetry={refetchLearning} />
              ) : learningLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !learningEvents?.length ? (
                <EmptyPanel message="No learning events recorded for this agent." />
              ) : (
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Feedback</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {learningEvents.map((ev) => (
                        <TableRow key={ev.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {ev.created_at
                              ? format(new Date(ev.created_at), "MMM d, HH:mm")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {ev.event_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{ev.feedback_type ?? "—"}</TableCell>
                          <TableCell className="text-xs">
                            {ev.profiles?.email ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm max-w-xs truncate">
                            {ev.event_description}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memory">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle>Per-user memory inspector</CardTitle>
                <CardDescription>
                  Stored memories retrieved during conversations
                </CardDescription>
              </div>
              <Select value={memoryUserFilter} onValueChange={setMemoryUserFilter}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Filter by user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  {memoryUsers.map(([id, email]) => (
                    <SelectItem key={id} value={id}>
                      {email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {memoriesError ? (
                <ErrorPanel message="Failed to load memories" onRetry={refetchMemories} />
              ) : memoriesLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !memories?.length ? (
                <EmptyPanel message="No memories stored for this agent yet." />
              ) : (
                <ScrollArea className="h-[420px]">
                  <div className="space-y-3 pr-4">
                    {memories.map((mem) => (
                      <div key={mem.id} className="rounded-lg border p-4 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 justify-between">
                          <div className="flex flex-wrap gap-2">
                            {mem.memory_category ? (
                              <Badge variant="secondary">{mem.memory_category}</Badge>
                            ) : null}
                            <Badge variant="outline">{mem.memory_type}</Badge>
                            {mem.is_active === false ? (
                              <Badge variant="destructive">Inactive</Badge>
                            ) : null}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {mem.profiles?.email}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed">{mem.content}</p>
                        {mem.summary ? (
                          <p className="text-xs text-muted-foreground">{mem.summary}</p>
                        ) : null}
                        <div className="flex gap-4 text-[10px] text-muted-foreground">
                          <span>Accessed {mem.access_count ?? 0}×</span>
                          {mem.importance_score != null ? (
                            <span>Importance {Math.round(mem.importance_score * 100)}%</span>
                          ) : null}
                          {mem.created_at ? (
                            <span>
                              Created {format(new Date(mem.created_at), "MMM d, yyyy")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Retry
      </Button>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
