/**
 * AI Agents Admin catalog — Phase C
 * Route: /admin/ai/agents
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Brain,
  DollarSign,
  History,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useCreateAgent,
  useToggleAgent,
  useDeleteAgent,
  useRunAgent,
  useAgentRuns,
  type AgentFormData,
  type AIAgent,
} from "@/hooks/useAIAgents";
import {
  useAgentCatalog,
  type AgentHealthStatus,
} from "@/hooks/useAgentAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/contexts/OrganizationContext";
import { formatCostMicro } from "@/hooks/useAgentAnalytics";
import {
  QuickStartWizard,
  AgentCategoryGuide,
  SystemPromptGuide,
  MemorySystemGuide,
} from "@/components/admin/AgentConfigurationGuide";
import {
  AgentToolConfig,
  getDefaultToolConfig,
  type ToolConfig,
} from "@/components/ai/AgentToolConfig";

type StatusFilter = "all" | AgentHealthStatus;

const HEALTH_CONFIG: Record<
  AgentHealthStatus,
  { label: string; className: string; icon: typeof Activity }
> = {
  active: {
    label: "Active",
    className: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
    icon: Activity,
  },
  degraded: {
    label: "Degraded",
    className: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30",
    icon: AlertTriangle,
  },
  inactive: {
    label: "Inactive",
    className: "bg-muted text-muted-foreground border-border",
    icon: Pause,
  },
};

function CatalogSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full mt-2" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-6 w-24" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function AIAgentsAdmin() {
  const navigate = useNavigate();
  const { features } = useOrganization();
  const graphifyAvailable = features.enableGraphify;
  const { data: catalog, isLoading, isError, error, refetch, isFetching } =
    useAgentCatalog();
  const createAgent = useCreateAgent();
  const toggleAgent = useToggleAgent();
  const deleteAgent = useDeleteAgent();
  const runAgent = useRunAgent();
  const { data: recentRuns } = useAgentRuns();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);
  const [runInput, setRunInput] = useState("");
  const [formData, setFormData] = useState<AgentFormData>({
    name: "",
    slug: "",
    description: "",
    category: "general",
    system_prompt: "",
    is_enabled: true,
    memory_enabled: false,
    rag_enabled: false,
    graphify_enabled: false,
    ...getDefaultToolConfig(),
  });

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const q = search.trim().toLowerCase();
    return catalog.filter(({ agent, health }) => {
      if (statusFilter !== "all" && health !== statusFilter) return false;
      if (!q) return true;
      return (
        agent.name.toLowerCase().includes(q) ||
        agent.slug.toLowerCase().includes(q) ||
        (agent.description ?? "").toLowerCase().includes(q) ||
        (agent.category ?? "").toLowerCase().includes(q)
      );
    });
  }, [catalog, search, statusFilter]);

  const counts = useMemo(() => {
    const base = { all: 0, active: 0, degraded: 0, inactive: 0 };
    for (const item of catalog ?? []) {
      base.all += 1;
      base[item.health] += 1;
    }
    return base;
  }, [catalog]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.system_prompt.trim()) return;
    await createAgent.mutateAsync(formData);
    setDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      description: "",
      category: "general",
      system_prompt: "",
      is_enabled: true,
      memory_enabled: false,
      rag_enabled: false,
      graphify_enabled: false,
      ...getDefaultToolConfig(),
    });
  };

  const handleToolConfigChange = (toolConfig: ToolConfig) => {
    setFormData((prev) => ({ ...prev, ...toolConfig }));
  };

  const openRunDialog = (agent: AIAgent) => {
    setSelectedAgent(agent);
    setRunInput("");
    setRunDialogOpen(true);
  };

  const handleRun = async () => {
    if (!selectedAgent || !runInput.trim()) return;
    try {
      await runAgent.mutateAsync({ agentId: selectedAgent.id, input: runInput });
      setRunInput("");
      setRunDialogOpen(false);
      setSelectedAgent(null);
    } catch {
      // handled by mutation
    }
  };

  const openDeleteDialog = (agentId: string) => {
    setDeletingAgentId(agentId);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingAgentId) return;
    try {
      await deleteAgent.mutateAsync(deletingAgentId);
      setDeleteDialogOpen(false);
      setDeletingAgentId(null);
      refetch();
    } catch {
      // handled by mutation
    }
  };

  const getStatusBadge = (status: string | null) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
      completed: { variant: "default", label: "Completed" },
      running: { variant: "secondary", label: "Running" },
      failed: { variant: "destructive", label: "Failed" },
      pending: { variant: "secondary", label: "Pending" },
    };
    const { variant, label } = config[status ?? "pending"] ?? config.pending;
    return <Badge variant={variant}>{label}</Badge>;
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold">Failed to load agents</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            {(error as Error)?.message ?? "An unexpected error occurred."}
          </p>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Agent Catalog</h1>
          <p className="text-muted-foreground">
            Monitor health, usage, and configuration across all agents
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/ai/cost-dashboard">
              <DollarSign className="h-4 w-4 mr-2" />
              Cost Dashboard
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/ai/run-audit-log">
              <Activity className="h-4 w-4 mr-2" />
              Run Audit Log
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setHistoryDialogOpen(true)}>
            <History className="h-4 w-4 mr-2" />
            Execution History
          </Button>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Agent
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create AI Agent</DialogTitle>
                <DialogDescription>
                  Configure your AI agent&apos;s behavior, tools, and MCP servers
                </DialogDescription>
              </DialogHeader>
              <QuickStartWizard />
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Agent Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
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
                  <Label htmlFor="system_prompt">System Prompt *</Label>
                  <Textarea
                    id="system_prompt"
                    value={formData.system_prompt}
                    onChange={(e) =>
                      setFormData({ ...formData, system_prompt: e.target.value })
                    }
                    rows={6}
                    required
                  />
                  <SystemPromptGuide />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label>Enable Agent</Label>
                    <p className="text-sm text-muted-foreground">Agent will be available for use</p>
                  </div>
                  <Switch
                    checked={formData.is_enabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_enabled: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <MemorySystemGuide />
                  <Switch
                    checked={formData.memory_enabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, memory_enabled: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label>Enable RAG</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow this agent to answer using synced context
                    </p>
                  </div>
                  <Switch
                    checked={!!formData.rag_enabled}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        rag_enabled: checked,
                        graphify_enabled: checked ? formData.graphify_enabled : false,
                      })
                    }
                  />
                </div>
                {graphifyAvailable ? (
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <Label>Enable Graphify</Label>
                      <p className="text-sm text-muted-foreground">
                        Graph-aware hybrid retrieval (requires RAG)
                      </p>
                    </div>
                    <Switch
                      checked={!!formData.graphify_enabled}
                      disabled={!formData.rag_enabled}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, graphify_enabled: checked })
                      }
                    />
                  </div>
                ) : null}
                <Separator />
                <AgentToolConfig
                  config={{
                    tool_code_interpreter: formData.tool_code_interpreter ?? false,
                    tool_file_search: formData.tool_file_search ?? true,
                    tool_web_search: formData.tool_web_search ?? false,
                    tool_image_generation: formData.tool_image_generation ?? false,
                    tool_mcp: formData.tool_mcp ?? false,
                    mcp_server_ids: formData.mcp_server_ids ?? [],
                    tools_config: formData.tools_config ?? [],
                  }}
                  onChange={handleToolConfigChange}
                  disabled={createAgent.isPending}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createAgent.isPending}>
                    {createAgent.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Create Agent
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents by name, slug, or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({counts.all})</SelectItem>
            <SelectItem value="active">Active ({counts.active})</SelectItem>
            <SelectItem value="degraded">Degraded ({counts.degraded})</SelectItem>
            <SelectItem value="inactive">Inactive ({counts.inactive})</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh catalog"
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </Button>
      </div>

      {isLoading ? (
        <CatalogSkeleton />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16">
            <Brain className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {search || statusFilter !== "all"
                ? "No agents match your filters."
                : "No agents configured yet."}
            </p>
            {!search && statusFilter === "all" ? (
              <Button variant="outline" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create your first agent
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ agent, stats, health }) => (
            <AgentCatalogCard
              key={agent.id}
              agent={agent}
              health={health}
              stats={stats}
              onToggle={() =>
                toggleAgent.mutate({ id: agent.id, is_enabled: !agent.is_enabled })
              }
              toggling={
                toggleAgent.isPending && toggleAgent.variables?.id === agent.id
              }
              onOpen={() => navigate(`/admin/ai/agents/${agent.id}`)}
              onChat={() => navigate(`/admin/ai/chat?agent=${agent.id}`)}
              onRun={() => openRunDialog(agent)}
              onDelete={() => openDeleteDialog(agent.id)}
            />
          ))}
        </div>
      )}

      <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Agent: {selectedAgent?.name}</DialogTitle>
            <DialogDescription>Provide input for the agent to process</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="run-input">Input</Label>
              <Textarea
                id="run-input"
                value={runInput}
                onChange={(e) => setRunInput(e.target.value)}
                placeholder="Enter your prompt or question..."
                rows={4}
                disabled={runAgent.isPending}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRunDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleRun}
                disabled={runAgent.isPending || !runInput.trim()}
              >
                {runAgent.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Execute
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Execution History</DialogTitle>
            <DialogDescription>Recent agent executions and their results</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[500px] pr-4">
            {!recentRuns || recentRuns.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <History className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No execution history yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentRuns.map((run) => (
                  <Card key={run.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">
                          {catalog?.find((c) => c.agent.id === run.agent_id)?.agent.name ??
                            "Unknown Agent"}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(run.status)}
                          {run.latency_ms ? (
                            <Badge variant="outline" className="text-xs">
                              {run.latency_ms}ms
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Input:</Label>
                        <p className="text-sm mt-1">{run.input}</p>
                      </div>
                      {run.output ? (
                        <div>
                          <Label className="text-xs text-muted-foreground">Output:</Label>
                          <div className="mt-1 text-sm prose prose-slate dark:prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {run.output}
                            </ReactMarkdown>
                          </div>
                        </div>
                      ) : null}
                      {run.error_message ? (
                        <p className="text-sm text-destructive">{run.error_message}</p>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This cannot be undone and will delete all execution history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteAgent.isPending}>
              {deleteAgent.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AgentCatalogCard({
  agent,
  health,
  stats,
  onToggle,
  toggling,
  onOpen,
  onChat,
  onRun,
  onDelete,
}: {
  agent: AIAgent;
  health: AgentHealthStatus;
  stats?: {
    totalRuns24h: number;
    failedRuns24h: number;
    avgLatencyMs: number | null;
    totalCostMicro: number;
    lastRunAt: string | null;
  };
  onToggle: () => void;
  toggling: boolean;
  onOpen: () => void;
  onChat: () => void;
  onRun: () => void;
  onDelete: () => void;
}) {
  const healthCfg = HEALTH_CONFIG[health];
  const HealthIcon = healthCfg.icon;

  return (
    <Card
      className={cn(
        "transition-shadow hover:shadow-md cursor-pointer",
        !agent.is_enabled && "opacity-75"
      )}
      onClick={onOpen}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 shrink-0 text-primary" />
              <span className="truncate">{agent.name}</span>
            </CardTitle>
            <CardDescription className="line-clamp-2 mt-1">
              {agent.description || "No description"}
            </CardDescription>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="shrink-0"
            disabled={toggling}
            title={agent.is_enabled ? "Disable agent" : "Enable agent"}
            aria-label={agent.is_enabled ? "Disable agent" : "Enable agent"}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            {toggling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : agent.is_enabled ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={cn("gap-1", healthCfg.className)}>
            <HealthIcon className="h-3 w-3" />
            {healthCfg.label}
          </Badge>
          {agent.category ? (
            <Badge variant="secondary">{agent.category}</Badge>
          ) : null}
          {agent.memory_enabled ? <Badge variant="outline">Memory</Badge> : null}
          {agent.rag_enabled ? <Badge variant="outline">RAG</Badge> : null}
          {agent.graphify_enabled ? <Badge variant="outline">Graphify</Badge> : null}
          {agent.tool_mcp && (agent.mcp_server_ids?.length ?? 0) > 0 ? (
            <Badge variant="outline">MCP ({agent.mcp_server_ids.length})</Badge>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border bg-muted/30 p-2">
            <p className="text-lg font-semibold">{stats?.totalRuns24h ?? 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Runs 24h
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2">
            <p className="text-lg font-semibold">
              {stats?.avgLatencyMs != null ? `${stats.avgLatencyMs}ms` : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Avg latency
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2">
            <p className="text-lg font-semibold text-xs leading-tight pt-1">
              {formatCostMicro(stats?.totalCostMicro ?? 0)}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Cost 24h
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {agent.is_enabled ? (
            <>
              <Button size="sm" variant="default" onClick={onChat}>
                <MessageSquare className="mr-2 h-3 w-3" />
                Chat
              </Button>
              <Button size="sm" variant="outline" onClick={onRun}>
                <Play className="mr-2 h-3 w-3" />
                Run
              </Button>
            </>
          ) : null}
          <Button size="sm" variant="outline" onClick={onOpen}>
            <Settings2 className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
