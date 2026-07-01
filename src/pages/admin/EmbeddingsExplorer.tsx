/**
 * Embedding Pipeline Dashboard – Monitor and manage vector embeddings for semantic search.
 * Matches admin Semantic Search → Embeddings layout with real data from embedding_queue and embeddings.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Database,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Video,
  Play,
  RotateCw,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";

const PAGE_SIZE = 20;
const EMBEDDING_ENTITY_TYPE_MAP: Record<string, string> = {
  meeting: "meeting_transcript",
  file: "knowledge_file",
  entry: "knowledge_entry",
  user_file: "user_knowledge_file",
};
const SOURCE_LABELS: Record<string, string> = {
  meeting: "Meeting",
  meeting_transcript: "Meeting",
  file: "Doc",
  knowledge_file: "Doc",
  entry: "Entry",
  knowledge_entry: "Entry",
  user_file: "User file",
  user_knowledge_file: "User file",
};

interface EmbeddingQueueRow {
  id: string;
  entity_type: string;
  entity_id: string;
  status: string | null;
  attempts: number | null;
  max_attempts: number | null;
  error_message: string | null;
  created_at: string | null;
  completed_at: string | null;
}

interface EmbeddingSourceRow {
  id: string;
  entity_type: string;
  entity_id: string;
  status: string;
  name: string;
  context: string;
  chunks: number;
  date: string | null;
  queueId: string | null;
  /** For meetings, link to meeting detail */
  meetingId?: string | null;
}

interface PipelineStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
  totalChunks: number;
}

function usePipelineStats() {
  return useQuery({
    queryKey: ["admin-embedding-pipeline-stats"],
    queryFn: async (): Promise<PipelineStats> => {
      const [queueRes, chunksRes] = await Promise.all([
        supabase.from("embedding_queue").select("status"),
        supabase.from("embeddings").select("id", { count: "exact", head: true }),
      ]);
      const queueItems = queueRes.data ?? [];
      const totalChunks = chunksRes.count ?? 0;
      const pending = queueItems.filter((q) => q.status === "pending").length;
      const processing = queueItems.filter((q) => q.status === "processing").length;
      const completed = queueItems.filter((q) => q.status === "completed").length;
      const failed = queueItems.filter((q) => q.status === "failed").length;
      const total = queueItems.length;
      return {
        pending,
        processing,
        completed,
        failed,
        total,
        totalChunks,
      };
    },
  });
}

function useEmbeddingList(
  statusFilter: string,
  sourceFilter: string,
  search: string,
  page: number
) {
  return useQuery({
    queryKey: [
      "admin-embedding-list",
      statusFilter,
      sourceFilter,
      search,
      page,
    ],
    queryFn: async (): Promise<{
      rows: EmbeddingSourceRow[];
      total: number;
    }> => {
      // 1) All queue rows
      const { data: queueRows, error: queueErr } = await supabase
        .from("embedding_queue")
        .select("id, entity_type, entity_id, status, created_at, completed_at")
        .order("created_at", { ascending: false });

      if (queueErr) throw queueErr;
      const queue = (queueRows ?? []) as EmbeddingQueueRow[];

      // 2) Chunk counts and distinct sources from embeddings (for fallback when queue is empty)
      const { data: embData } = await supabase
        .from("embeddings")
        .select("entity_type, entity_id, created_at");

      const chunkMap = new Map<string, number>();
      const embLatest = new Map<string, string>();
      (embData ?? []).forEach((r: { entity_type: string; entity_id: string; created_at?: string }) => {
        const key = `${r.entity_type}:${r.entity_id}`;
        chunkMap.set(key, (chunkMap.get(key) ?? 0) + 1);
        const existing = embLatest.get(key);
        if (!existing || (r.created_at && r.created_at > existing)) {
          embLatest.set(key, r.created_at ?? "");
        }
      });

      // Build list of (entity_type, entity_id) from queue; if queue empty, use embeddings distinct
      const queueKey = (et: string, eid: string) => `${et}:${eid}`;
      const queueKeys = new Set(queue.map((q) => {
        const embType = EMBEDDING_ENTITY_TYPE_MAP[q.entity_type] ?? q.entity_type;
        return `${embType}:${q.entity_id}`;
      }));
      const fromEmb: { entity_type: string; entity_id: string }[] = [];
      embLatest.forEach((_, key) => {
        if (queueKeys.has(key)) return;
        const [entity_type, entity_id] = key.split(":");
        if (entity_type && entity_id) fromEmb.push({ entity_type, entity_id });
      });

      // 3) Resolve names: batch by entity_type (queue + fallback from embeddings)
      const meetingIds = [
        ...new Set([
          ...queue.filter((q) => q.entity_type === "meeting").map((q) => q.entity_id),
          ...fromEmb.filter((e) => e.entity_type === "meeting_transcript").map((e) => e.entity_id),
        ]),
      ];
      const fileIds = [
        ...new Set([
          ...queue.filter((q) => q.entity_type === "file").map((q) => q.entity_id),
          ...fromEmb.filter((e) => e.entity_type === "knowledge_file").map((e) => e.entity_id),
        ]),
      ];
      const entryIds = [
        ...new Set([
          ...queue.filter((q) => q.entity_type === "entry").map((q) => q.entity_id),
          ...fromEmb.filter((e) => e.entity_type === "knowledge_entry").map((e) => e.entity_id),
        ]),
      ];

      const [zoomFilesRes, knowledgeFilesRes, entriesRes] = await Promise.all([
        meetingIds.length > 0
          ? supabase
              .from("zoom_files")
              .select("id, file_name, meeting_id")
              .in("id", meetingIds)
          : { data: [] },
        fileIds.length > 0
          ? supabase
              .from("knowledge_files")
              .select("id, title, file_name, category_id")
              .in("id", fileIds)
          : { data: [] },
        entryIds.length > 0
          ? supabase
              .from("knowledge_entries")
              .select("id, title, category_id")
              .in("id", entryIds)
          : { data: [] },
      ]);

      const meetingTitles = new Map<string, string>();
      const meetingIdByFileId = new Map<string, string>();
      if (meetingIds.length > 0 && zoomFilesRes.data?.length) {
        const zf = zoomFilesRes.data as { id: string; file_name: string; meeting_id: string }[];
        const mIds = [...new Set(zf.map((z) => z.meeting_id).filter(Boolean))];
        zf.forEach((z) => meetingIdByFileId.set(z.id, z.meeting_id));
        if (mIds.length > 0) {
          const { data: meetingsData } = await supabase
            .from("meetings")
            .select("id, title")
            .in("id", mIds);
          const meetingsList = (meetingsData ?? []) as { id: string; title: string }[];
          const meetingTitleById = new Map(meetingsList.map((m) => [m.id, m.title]));
          zf.forEach((z) => {
            meetingTitles.set(
              z.id,
              meetingTitleById.get(z.meeting_id) || z.file_name || "Meeting"
            );
          });
        } else {
          zf.forEach((z) => meetingTitles.set(z.id, z.file_name || "Meeting"));
        }
      }

      const knowledgeFilesList = (knowledgeFilesRes.data ?? []) as {
        id: string;
        title?: string;
        file_name?: string;
      }[];
      const entriesList = (entriesRes.data ?? []) as { id: string; title: string }[];
      const fileNames = new Map(
        knowledgeFilesList.map((f) => [f.id, f.title || f.file_name || "Document"])
      );
      const entryTitles = new Map(entriesList.map((e) => [e.id, e.title]));

      const resolveNameAndContext = (
        entityType: string,
        entityId: string
      ): { name: string; context: string; meetingId?: string } => {
        if (entityType === "meeting" || entityType === "meeting_transcript") {
          return {
            name: meetingTitles.get(entityId) ?? "Meeting",
            context: "—",
            meetingId: meetingIdByFileId.get(entityId),
          };
        }
        if (entityType === "file" || entityType === "knowledge_file") {
          return { name: fileNames.get(entityId) ?? "Document", context: "—" };
        }
        if (entityType === "entry" || entityType === "knowledge_entry") {
          return { name: entryTitles.get(entityId) ?? "Entry", context: "—" };
        }
        return { name: "User file", context: "—" };
      };

      // 4) Build rows from queue
      const rows: EmbeddingSourceRow[] = queue.map((q) => {
        const embType = EMBEDDING_ENTITY_TYPE_MAP[q.entity_type] ?? q.entity_type;
        const chunkKey = `${embType}:${q.entity_id}`;
        const chunks = chunkMap.get(chunkKey) ?? 0;
        const { name, context, meetingId } = resolveNameAndContext(q.entity_type, q.entity_id);
        const date = q.completed_at ?? q.created_at;
        return {
          id: q.id,
          entity_type: q.entity_type,
          entity_id: q.entity_id,
          status: q.status ?? "pending",
          name,
          context,
          chunks,
          date,
          queueId: q.id,
          meetingId: meetingId ?? null,
        };
      });

      // 4b) Add rows from embeddings that are not in queue (completed only)
      const displayEntityType = (et: string) =>
        et === "meeting_transcript" ? "meeting" : et === "knowledge_file" ? "file" : et === "knowledge_entry" ? "entry" : et;
      fromEmb.forEach((e) => {
        const chunkKey = `${e.entity_type}:${e.entity_id}`;
        const chunks = chunkMap.get(chunkKey) ?? 0;
        const { name, context, meetingId } = resolveNameAndContext(e.entity_type, e.entity_id);
        const date = embLatest.get(chunkKey) ?? null;
        rows.push({
          id: `emb-${chunkKey}`,
          entity_type: displayEntityType(e.entity_type),
          entity_id: e.entity_id,
          status: "completed",
          name,
          context,
          chunks,
          date,
          queueId: null,
          meetingId: meetingId ?? null,
        });
      });

      // Sort by date desc
      rows.sort((a, b) => {
        const da = a.date ?? "";
        const db = b.date ?? "";
        return db.localeCompare(da);
      });

      // 5) Apply source filter
      let filtered = rows;
      if (sourceFilter && sourceFilter !== "all") {
        filtered = filtered.filter((r) => r.entity_type === sourceFilter);
      }
      // 6) Apply status filter
      if (statusFilter && statusFilter !== "all") {
        filtered = filtered.filter((r) => r.status === statusFilter);
      }
      // 7) Search
      if (search.trim()) {
        const lower = search.trim().toLowerCase();
        filtered = filtered.filter(
          (r) =>
            r.name.toLowerCase().includes(lower) ||
            r.context.toLowerCase().includes(lower)
        );
      }

      const total = filtered.length;
      const start = (page - 1) * PAGE_SIZE;
      const paginated = filtered.slice(start, start + PAGE_SIZE);

      const mergedCounts = {
        all: rows.length,
        pending: rows.filter((r) => r.status === "pending").length,
        processing: rows.filter((r) => r.status === "processing").length,
        completed: rows.filter((r) => r.status === "completed").length,
        failed: rows.filter((r) => r.status === "failed").length,
      };

      return { rows: paginated, total } as { rows: EmbeddingSourceRow[]; total: number; mergedCounts?: typeof mergedCounts };
    },
  });
}

export default function EmbeddingsExplorer() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pipelineActive, setPipelineActive] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [projectBreakdownOpen, setProjectBreakdownOpen] = useState(true);

  const { data: stats, isLoading: statsLoading } = usePipelineStats();
  const { data: listData, isLoading: listLoading } = useEmbeddingList(
    statusFilter,
    sourceFilter,
    search,
    page
  );

  const totalPages = listData
    ? Math.max(1, Math.ceil(listData.total / PAGE_SIZE))
    : 1;
  const counts = (listData as any)?.mergedCounts ?? (stats
    ? {
        all: stats.total,
        pending: stats.pending,
        processing: stats.processing,
        completed: stats.completed,
        failed: stats.failed,
      }
    : null);

  const processMeetings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("auto-embed-meetings");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-embedding-pipeline-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-embedding-list"] });
      toast({ title: "Process Meetings", description: "Meeting embedding job started." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const processKnowledgeFiles = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("auto-embed-knowledge-files");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-embedding-pipeline-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-embedding-list"] });
      toast({ title: "Process Knowledge Files", description: "File embedding job started." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const retryFailed = useMutation({
    mutationFn: async () => {
      const { data: failed } = await supabase
        .from("embedding_queue")
        .select("id")
        .eq("status", "failed");
      if (!failed?.length) return;
      await supabase
        .from("embedding_queue")
        .update({ status: "pending", error_message: null, attempts: 0 })
        .in("id", failed.map((r) => r.id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-embedding-pipeline-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-embedding-list"] });
      toast({ title: "Retry Failed", description: "Failed items reset to pending." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const rematchProjects = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("discover-meeting-relationships");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-embedding-list"] });
      toast({ title: "Re-match Projects", description: "Meeting relationship discovery started." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-embedding-pipeline-stats"] });
    queryClient.invalidateQueries({ queryKey: ["admin-embedding-list"] });
  };

  const statusBadge = (status: string) => {
    const config: Record<
      string,
      { variant: "default" | "secondary" | "destructive" | "outline"; label: string; className?: string }
    > = {
      pending: { variant: "outline", label: "Pending", className: "bg-amber-50 text-amber-800 border-amber-200" },
      processing: { variant: "default", label: "Processing", className: "bg-info/10 text-info border-0" },
      completed: { variant: "secondary", label: "Completed", className: "bg-success/10 text-success border-success/30" },
      failed: { variant: "destructive", label: "Failed", className: "bg-destructive/10 text-destructive border-destructive/30" },
    };
    const c = config[status] ?? { variant: "outline", label: status };
    return (
      <Badge variant={c.variant} className={c.className ?? ""}>
        {c.label}
      </Badge>
    );
  };

  const sourceIcon = (entityType: string) => {
    if (entityType === "meeting") return <Video className="h-4 w-4 text-info" />;
    return <FileText className="h-4 w-4 text-violet-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Header: title, subtitle, pipeline toggle, actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-7 w-7 text-muted-foreground" />
            Embedding Pipeline Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage vector embeddings for semantic search
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="pipeline-active"
              checked={pipelineActive}
              onCheckedChange={setPipelineActive}
            />
            <label
              htmlFor="pipeline-active"
              className={`text-sm font-medium ${pipelineActive ? "text-success" : "text-muted-foreground"}`}
            >
              Pipeline Active
            </label>
          </div>
          <Button size="sm" onClick={() => processMeetings.mutate()} disabled={processMeetings.isPending}>
            {processMeetings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            <span className="ml-2">Process Meetings</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => processKnowledgeFiles.mutate()}
            disabled={processKnowledgeFiles.isPending}
          >
            <FileText className="h-4 w-4" />
            <span className="ml-2">Process Knowledge Files</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => retryFailed.mutate()}
            disabled={retryFailed.isPending}
          >
            <RotateCw className="h-4 w-4" />
            <span className="ml-2">Retry Failed</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => rematchProjects.mutate()}
            disabled={rematchProjects.isPending}
          >
            <RotateCw className="h-4 w-4" />
            <span className="ml-2">Re-match Projects</span>
          </Button>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
            <span className="ml-2">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {statsLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-amber-100 p-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Awaiting processing</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-info/10 p-2">
                  <Loader2 className="h-5 w-5 text-info animate-spin" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.processing}</p>
                  <p className="text-xs text-muted-foreground">Currently running</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-success/10 p-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.totalChunks.toLocaleString()} total chunks
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-destructive/10 p-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.failed}</p>
                  <p className="text-xs text-muted-foreground">Need attention</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Embeddings table section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Embeddings</CardTitle>
          <CardDescription>All sources</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="file">Doc</SelectItem>
                  <SelectItem value="entry">Entry</SelectItem>
                  <SelectItem value="user_file">User file</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-[200px]"
              />
            </div>
          </div>

          {/* Status tabs */}
          {counts && (
            <div className="flex flex-wrap gap-1 border-b pb-2">
              {[
                { key: "all", label: "All", count: counts.all },
                { key: "pending", label: "Pending", count: counts.pending },
                { key: "processing", label: "Processing", count: counts.processing },
                { key: "completed", label: "Completed", count: counts.completed },
                { key: "failed", label: "Failed", count: counts.failed },
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setStatusFilter(key); setPage(1); }}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    statusFilter === key
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
          )}

          {listLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !listData?.rows.length ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Database className="h-10 w-10" />
              <p className="text-sm">No embeddings match the current filters.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Context</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Chunks</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listData.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {sourceIcon(row.entity_type)}
                          <span className="text-sm text-muted-foreground">
                            {SOURCE_LABELS[row.entity_type] ?? row.entity_type}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium max-w-[220px] truncate" title={row.name}>
                        {row.name}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground" title={row.context}>
                        {row.context}
                      </TableCell>
                      <TableCell>{statusBadge(row.status)}</TableCell>
                      <TableCell>{row.chunks > 0 ? row.chunks : "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {row.date ? formatDate(row.date, "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        {row.status === "failed" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => retryFailed.mutate()}
                            className="h-8"
                          >
                            <RotateCw className="h-4 w-4 mr-1" />
                            Retry
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" className="h-8" asChild>
                            <a
                              href={
                                row.entity_type === "meeting" && row.meetingId
                                  ? `/meetings/${row.meetingId}`
                                  : row.entity_type === "file"
                                    ? `/knowledge/files/${row.entity_id}`
                                    : "#"
                              }
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {listData.total > PAGE_SIZE && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({listData.total} total)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      Previous
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const p = page <= 3 ? i + 1 : Math.max(1, page - 2 + i);
                      if (p > totalPages) return null;
                      return (
                        <Button
                          key={p}
                          variant={page === p ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </Button>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Project Breakdown (collapsible) */}
      <Card className="bg-muted/30">
        <button
          type="button"
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 rounded-lg transition-colors"
          onClick={() => setProjectBreakdownOpen(!projectBreakdownOpen)}
        >
          <div className="flex items-center gap-2">
            {projectBreakdownOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-semibold">Project Breakdown</span>
          </div>
          <span className="text-sm text-muted-foreground">Embedding status by project</span>
        </button>
        {projectBreakdownOpen && (
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground">Embedding status by project</p>
            <p className="text-sm text-muted-foreground mt-2">
              Project-level aggregation can be added when meeting–project assignments are available.
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
