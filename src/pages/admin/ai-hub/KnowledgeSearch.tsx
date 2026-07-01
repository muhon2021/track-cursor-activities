/**
 * Knowledge Search – unified page merging Semantic Search and Embedding Pipeline.
 * Route: /admin/ai-hub/knowledge-search
 */
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs as InnerTabs, TabsContent as InnerTabsContent, TabsList as InnerTabsList, TabsTrigger as InnerTabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Loader2,
  FileText,
  ClipboardList,
  Users,
  Briefcase,
  Calendar,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Video,
  Play,
  RotateCw,
  Eye,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";
import { useAdminSemanticSearch } from "@/hooks/useAdminSemanticSearch";
import { useProjects } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { truncateText } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import {
  useEmbeddingPipelineSetting,
  useEmbeddingPipelineStats,
  useEmbeddingPipelineList,
  useEmbeddingPipelineRetryFailed,
  invalidateEmbeddingPipelineQueries,
  type PipelineStatus,
  type SourceType,
} from "@/hooks/useEmbeddingPipeline";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

// ─── Semantic Search Tab ──────────────────────────────────────────────────────

const ENTITY_TYPES = [
  { id: "meeting_transcript", label: "Meeting Transcripts", icon: FileText },
  { id: "task", label: "Tasks", icon: ClipboardList },
  { id: "client", label: "Contacts", icon: Users },
  { id: "project", label: "Projects", icon: Briefcase },
  { id: "meeting", label: "Meetings", icon: Calendar },
] as const;

const RESULT_LIMITS = [5, 10, 20, 50] as const;
const EXAMPLE_QUERIES = [
  "Find all discussions about budget planning",
  "Show me project status updates from last month",
  "Search for action items related to technical debt",
  "Find meeting transcripts discussing API integration",
  "Show client feedback about the mobile app redesign",
];

function SearchTab() {
  const [query, setQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [similarityThreshold, setSimilarityThreshold] = useState(0.7);
  const [limit, setLimit] = useState(10);
  const [projectName, setProjectName] = useState("");
  const [projectManager, setProjectManager] = useState("");
  const [clientName, setClientName] = useState("");

  const { data: projects = [] } = useProjects({});
  const { data: clientsData } = useClients({ pageSize: 500 });
  const clients = clientsData ?? [];
  const { search, results, isSearching, isSuccess } = useAdminSemanticSearch();
  const hasMeetingTranscriptSelected = selectedTypes.has("meeting_transcript");

  const handleSearch = () => {
    if (!query.trim()) return;
    const entityTypes = selectedTypes.size > 0 ? Array.from(selectedTypes) : undefined;
    search({
      query: query.trim(),
      limit: limit as 5 | 10 | 20 | 50,
      similarity_threshold: similarityThreshold,
      entity_types: entityTypes,
      project_name: hasMeetingTranscriptSelected ? projectName || undefined : undefined,
      project_manager: hasMeetingTranscriptSelected ? projectManager || undefined : undefined,
      client_name: hasMeetingTranscriptSelected ? clientName || undefined : undefined,
    });
  };

  const toggleEntityType = (id: string, checked: boolean) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Search Query</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Search for meetings, projects, tasks..." value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="flex-1" />
            <Button onClick={handleSearch} disabled={isSearching || !query.trim()} className="shrink-0">
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Search</span>
            </Button>
          </div>

          <InnerTabs defaultValue="filters" className="w-full">
            <InnerTabsList className="grid w-full max-w-[240px] grid-cols-2">
              <InnerTabsTrigger value="filters">Filters</InnerTabsTrigger>
              <InnerTabsTrigger value="advanced">Advanced</InnerTabsTrigger>
            </InnerTabsList>
            <InnerTabsContent value="filters" className="mt-4 space-y-4">
              <div>
                <Label className="text-sm font-medium">Entity Types</Label>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {ENTITY_TYPES.map(({ id, label, icon: Icon }) => (
                    <div key={id} className="flex items-center space-x-2 rounded-md border p-3">
                      <Checkbox id={id} checked={selectedTypes.has(id)} onCheckedChange={(checked) => toggleEntityType(id, !!checked)} />
                      <Label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm font-normal"><Icon className="h-4 w-4 text-muted-foreground" />{label}</Label>
                    </div>
                  ))}
                </div>
              </div>
              {hasMeetingTranscriptSelected && (
                <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                  <Label className="text-sm font-medium">Meeting transcript filters (optional)</Label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Project</Label>
                      <Select value={projectName || "__all__"} onValueChange={(v) => setProjectName(v === "__all__" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="All projects" /></SelectTrigger>
                        <SelectContent><SelectItem value="__all__">All projects</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Project manager</Label>
                      <Input placeholder="Filter by manager name" value={projectManager} onChange={(e) => setProjectManager(e.target.value)} className="h-10" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Client</Label>
                      <Select value={clientName || "__all__"} onValueChange={(v) => setClientName(v === "__all__" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="All clients" /></SelectTrigger>
                        <SelectContent><SelectItem value="__all__">All clients</SelectItem>{clients.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </InnerTabsContent>
            <InnerTabsContent value="advanced" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Similarity threshold: {(similarityThreshold * 100).toFixed(0)}%</Label>
                <Slider min={0.5} max={0.95} step={0.05} value={[similarityThreshold]} onValueChange={([v]) => setSimilarityThreshold(v ?? 0.7)} className="w-full max-w-xs" />
                <p className="text-xs text-muted-foreground">Higher values return only closer matches.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Result limit</Label>
                <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>{RESULT_LIMITS.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </InnerTabsContent>
          </InnerTabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Example Queries</CardTitle></CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
            {EXAMPLE_QUERIES.map((q) => (
              <li key={q}><button type="button" onClick={() => setQuery(q)} className="text-left hover:text-foreground hover:underline">&quot;{q}&quot;</button></li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {isSearching && <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}

      {isSuccess && !isSearching && (
        <Card>
          <CardHeader><CardTitle>{results.length} Result{results.length !== 1 ? "s" : ""}</CardTitle></CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matches found. Try a lower similarity threshold or different filters.</p>
            ) : (
              <div className="space-y-3">
                {results.map((row, idx) => (
                  <div key={row.id ?? idx} className="rounded-lg border p-4 text-sm">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium capitalize text-muted-foreground">{row.entity_type?.replace(/_/g, " ")}</span>
                      <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{(row.similarity * 100).toFixed(0)}% match</span>
                    </div>
                    {(row.project_name ?? row.project_manager ?? row.client_name) && (
                      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {row.project_name && <span>Project: {row.project_name}</span>}
                        {row.project_manager && <span>Manager: {row.project_manager}</span>}
                        {row.client_name && <span>Client: {row.client_name}</span>}
                      </div>
                    )}
                    <p className="text-foreground">{truncateText(row.content ?? "", 400)}</p>
                    {row.metadata?.title && <p className="mt-1 text-xs text-muted-foreground">{String(row.metadata.title)}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Embeddings Tab ───────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

function EmbeddingsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<PipelineStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<SourceType | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [projectBreakdownOpen, setProjectBreakdownOpen] = useState(true);

  const { enabled: pipelineEnabled, isLoading: settingLoading, setEnabled: setPipelineEnabled, isUpdating: settingUpdating } = useEmbeddingPipelineSetting();
  const { data: stats, isLoading: statsLoading } = useEmbeddingPipelineStats();
  const { data: listData, isLoading: listLoading } = useEmbeddingPipelineList(statusFilter, sourceFilter, search, page, PAGE_SIZE);
  const retryFailed = useEmbeddingPipelineRetryFailed();
  const totalPages = listData ? Math.max(1, Math.ceil(listData.total / PAGE_SIZE)) : 1;

  const processMeetings = async () => {
    try {
      const { error } = await supabase.functions.invoke("auto-embed-meetings", { body: { batch_size: 20, retry_failed: false } });
      if (error) throw error;
      invalidateEmbeddingPipelineQueries(queryClient);
      toast({ title: "Process Meetings", description: "Meeting embedding job started." });
    } catch (e) { toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to start", variant: "destructive" }); }
  };

  const processKnowledgeFiles = async () => {
    try {
      const { error } = await supabase.functions.invoke("auto-embed-knowledge-files", { body: { batch_size: 20, retry_failed: false } });
      if (error) throw error;
      invalidateEmbeddingPipelineQueries(queryClient);
      toast({ title: "Process Knowledge Files", description: "Knowledge file embedding job started." });
    } catch (e) { toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to start", variant: "destructive" }); }
  };

  const handleRetryFailed = async () => {
    try {
      await retryFailed.mutateAsync(undefined);
      toast({ title: "Retry Failed", description: "Failed items reset to pending." });
      processMeetings();
    } catch (e) { toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" }); }
  };

  const rematchProjects = async () => {
    try {
      const { error } = await supabase.functions.invoke("discover-meeting-relationships", { body: { force_rematch: true } });
      if (error) throw error;
      invalidateEmbeddingPipelineQueries(queryClient);
      toast({ title: "Re-match Projects", description: "Meeting relationship discovery started." });
    } catch (e) { toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" }); }
  };

  const statusBadge = (status: PipelineStatus) => {
    const config: Record<PipelineStatus, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; className?: string }> = {
      pending: { variant: "outline", label: "Pending", className: "bg-amber-50 text-amber-800 border-amber-200" },
      processing: { variant: "default", label: "Processing", className: "bg-info/10 text-info border-0" },
      completed: { variant: "secondary", label: "Completed", className: "bg-success/10 text-success border-success/30" },
      failed: { variant: "destructive", label: "Failed", className: "bg-destructive/10 text-destructive border-destructive/30" },
    };
    const c = config[status];
    return <Badge variant={c.variant} className={c.className ?? ""}>{c.label}</Badge>;
  };

  const sourceIcon = (sourceType: SourceType) =>
    sourceType === "meeting" ? <Video className="h-4 w-4 text-info" /> : <FileText className="h-4 w-4 text-violet-600" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2"><Database className="h-6 w-6 text-muted-foreground" />Embedding Pipeline</h2>
          <p className="text-muted-foreground mt-1">Monitor and manage vector embeddings for semantic search</p>
        </div>
        <Card className="w-full lg:w-auto shrink-0">
          <CardContent className="pt-4 pb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <Switch id="pipeline-enabled" checked={pipelineEnabled} onCheckedChange={(v) => setPipelineEnabled(v).catch(() => {})} disabled={settingLoading || settingUpdating} />
              <label htmlFor="pipeline-enabled" className={`text-sm font-medium whitespace-nowrap ${pipelineEnabled ? "text-success" : "text-muted-foreground"}`}>Pipeline Active</label>
            </div>
            <Button size="sm" onClick={processMeetings} disabled={!pipelineEnabled}><Play className="h-4 w-4 mr-2" />Process Meetings</Button>
            <Button size="sm" variant="outline" onClick={processKnowledgeFiles} disabled={!pipelineEnabled}><FileText className="h-4 w-4 mr-2" />Process Knowledge Files</Button>
            <Button size="sm" variant="outline" onClick={handleRetryFailed} disabled={retryFailed.isPending || !pipelineEnabled}>{retryFailed.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCw className="h-4 w-4 mr-2" />}Retry Failed</Button>
            <Button size="sm" variant="outline" onClick={rematchProjects}><RotateCw className="h-4 w-4 mr-2" />Re-match Projects</Button>
            <Button variant="outline" size="sm" onClick={() => invalidateEmbeddingPipelineQueries(queryClient)}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
          </CardContent>
        </Card>
      </div>

      {statsLoading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> : stats && (
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { key: "pending" as const, label: "Pending", sub: "Awaiting processing", icon: Clock, iconBg: "bg-amber-100", iconColor: "text-amber-600", valueColor: "text-amber-600" },
            { key: "processing" as const, label: "Processing", sub: "Currently running", icon: Loader2, iconBg: "bg-info/10", iconColor: "text-info", valueColor: "text-info" },
            { key: "completed" as const, label: "Completed", sub: `${stats.totalChunks.toLocaleString()} total chunks`, icon: CheckCircle2, iconBg: "bg-success/10", iconColor: "text-success", valueColor: "text-success" },
            { key: "failed" as const, label: "Failed", sub: "Need attention", icon: AlertCircle, iconBg: "bg-destructive/10", iconColor: "text-destructive", valueColor: "text-destructive" },
          ].map(({ key, label, sub, icon: Icon, iconBg, iconColor, valueColor }) => (
            <Card key={key} className={`cursor-pointer transition-all ${statusFilter === key ? "ring-2 ring-ring bg-info/10 dark:bg-blue-950/20" : "hover:bg-muted/50"}`} onClick={() => { setStatusFilter(key); setPage(1); }}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-foreground">{label}</h3>
                  <div className={`rounded-full p-2 shrink-0 ${iconBg}`}><Icon className={`h-5 w-5 ${iconColor} ${key === "processing" ? "animate-spin" : ""}`} /></div>
                </div>
                <p className={`text-2xl font-bold mt-3 ${valueColor}`}>{stats[key]}</p>
                <p className="text-xs text-muted-foreground mt-1">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle>Embeddings</CardTitle><CardDescription>{statusFilter === "all" ? "All sources" : `All sources • ${statusFilter}`}</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v as SourceType | "all"); setPage(1); }}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Source type" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Sources</SelectItem><SelectItem value="meeting">Meetings</SelectItem><SelectItem value="knowledge">Knowledge</SelectItem></SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-full max-w-[220px]" />
              </div>
            </div>
          </div>

          {stats && (
            <div className="flex flex-wrap gap-1 border-b pb-3">
              {([{ key: "all", label: "All", count: stats.total }, { key: "pending", label: "Pending", count: stats.pending }, { key: "processing", label: "Processing", count: stats.processing }, { key: "completed", label: "Completed", count: stats.completed }, { key: "failed", label: "Failed", count: stats.failed }] as const).map(({ key, label, count }) => (
                <button key={key} type="button" onClick={() => { setStatusFilter(key); setPage(1); }} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${statusFilter === key ? "bg-info text-primary-foreground shadow-sm" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}>{label} ({count})</button>
              ))}
            </div>
          )}

          {listLoading ? <div className="flex h-32 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> : !listData?.rows.length ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground"><Database className="h-10 w-10" /><p className="text-sm">No embeddings match the current filters.</p></div>
          ) : (
            <>
              <Table>
                <TableHeader><TableRow><TableHead>Source</TableHead><TableHead>Name</TableHead><TableHead>Context</TableHead><TableHead>Status</TableHead><TableHead>Chunks</TableHead><TableHead>Date</TableHead>{statusFilter === "failed" && <TableHead>Error</TableHead>}<TableHead className="w-[100px]">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {listData.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell><div className="flex items-center gap-2">{sourceIcon(row.sourceType)}<span className="text-sm text-muted-foreground">{row.sourceType === "meeting" ? "Meeting" : "Doc"}</span></div></TableCell>
                      <TableCell className="font-medium max-w-[220px] truncate" title={row.name}>{row.name}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground" title={row.context}>{row.context}</TableCell>
                      <TableCell>{statusBadge(row.status)}</TableCell>
                      <TableCell>{row.chunks > 0 ? row.chunks : "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{row.date ? formatDate(row.date, "MMM d, yyyy") : "—"}</TableCell>
                      {statusFilter === "failed" && <TableCell className="max-w-[200px] truncate text-xs text-destructive" title={row.error ?? ""}>{row.error ?? "—"}</TableCell>}
                      <TableCell>{row.status === "failed" ? (<Button variant="ghost" size="sm" className="h-8" onClick={handleRetryFailed}><RotateCw className="h-4 w-4 mr-1" />Retry</Button>) : (<Button variant="ghost" size="sm" className="h-8" asChild>{row.meetingId ? (<a href={`/meetings/${row.meetingId}`}><Eye className="h-4 w-4 mr-1" />View</a>) : (<a href={`/admin/knowledge/files#${row.sourceId}`}><Eye className="h-4 w-4 mr-1" />View</a>)}</Button>)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {listData.total > PAGE_SIZE && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">Page {page} of {totalPages} ({listData.total} total)</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Previous</Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => { const p = page <= 3 ? i + 1 : Math.max(1, page - 2 + i); if (p > totalPages) return null; return <Button key={p} variant={page === p ? "default" : "outline"} size="sm" onClick={() => setPage(p)}>{p}</Button>; })}
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <button type="button" className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 rounded-lg transition-colors" onClick={() => setProjectBreakdownOpen(!projectBreakdownOpen)}>
          <div className="flex items-center gap-2">{projectBreakdownOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}<span className="font-semibold">Project Breakdown</span></div>
          <span className="text-sm text-muted-foreground">Embedding status by project (meetings only)</span>
        </button>
        {projectBreakdownOpen && <CardContent className="pt-0"><p className="text-sm text-muted-foreground">Per-project meeting count, embedded count, and last embedding date can be added when meeting–project assignment is available from the source table.</p></CardContent>}
      </Card>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function KnowledgeSearch() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Knowledge Search</h1>
        <p className="text-muted-foreground">
          AI-powered semantic search and embedding pipeline management
        </p>
      </div>

      <Tabs defaultValue="search">
        <TabsList>
          <TabsTrigger value="search">Semantic Search</TabsTrigger>
          <TabsTrigger value="embeddings">Embeddings</TabsTrigger>
        </TabsList>
        <TabsContent value="search" className="mt-6">
          <SearchTab />
        </TabsContent>
        <TabsContent value="embeddings" className="mt-6">
          <EmbeddingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
