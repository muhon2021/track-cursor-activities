import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/cache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Database, FileText, Layers, Search, AlertTriangle, Clock } from "lucide-react";

export function KnowledgeHealthSection() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.knowledge.health,
    queryFn: async () => {
      const [
        sourcesRes,
        filesRes,
        entriesRes,
        unifiedRes,
        embeddingsRes,
        searchLogsRes,
        failedFilesRes,
        evalRunsRes,
      ] = await Promise.all([
        supabase.from("knowledge_sources").select("id", { count: "exact", head: true }),
        supabase.from("knowledge_files").select("id", { count: "exact", head: true }),
        supabase.from("knowledge_entries").select("id", { count: "exact", head: true }),
        supabase.from("unified_documents").select("id", { count: "exact", head: true }),
        supabase.from("embeddings").select("id", { count: "exact", head: true }),
        supabase.from("vector_search_logs").select("duration_ms, result_count").order("created_at", { ascending: false }).limit(200),
        supabase.from("knowledge_files").select("id", { count: "exact", head: true }).eq("processing_status", "failed"),
        supabase.from("kb_eval_runs").select("retrieval_latency_ms, rerank_latency_ms").order("created_at", { ascending: false }).limit(100),
      ]);

      const searchLogs = searchLogsRes.data ?? [];
      const successful = searchLogs.filter((l) => (l.result_count ?? 0) > 0).length;
      const searchSuccessRate = searchLogs.length > 0 ? (successful / searchLogs.length) * 100 : 0;
      const avgRetrieval =
        searchLogs.length > 0
          ? searchLogs.reduce((s, l) => s + (l.duration_ms ?? 0), 0) / searchLogs.length
          : 0;

      const evalRuns = evalRunsRes.data ?? [];
      const avgRerank =
        evalRuns.length > 0
          ? evalRuns.reduce((s, r) => s + (r.rerank_latency_ms ?? 0), 0) / evalRuns.length
          : 0;

      const totalFiles = filesRes.count ?? 0;
      const failedFiles = failedFilesRes.count ?? 0;

      return {
        totalSources: sourcesRes.count ?? 0,
        totalDocuments: totalFiles + (entriesRes.count ?? 0) + (unifiedRes.count ?? 0),
        totalChunks: embeddingsRes.count ?? 0,
        embeddingCount: embeddingsRes.count ?? 0,
        searchSuccessRate: Math.round(searchSuccessRate * 10) / 10,
        failedSyncRate: totalFiles > 0 ? Math.round((failedFiles / totalFiles) * 1000) / 10 : 0,
        avgRetrievalTime: Math.round(avgRetrieval),
        avgRerankTime: Math.round(avgRerank),
      };
    },
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const metrics = [
    { label: "Total Sources", value: data?.totalSources, icon: Database },
    { label: "Total Documents", value: data?.totalDocuments, icon: FileText },
    { label: "Total Chunks", value: data?.totalChunks, icon: Layers },
    { label: "Embeddings", value: data?.embeddingCount, icon: Layers },
    { label: "Search Success Rate", value: `${data?.searchSuccessRate}%`, icon: Search },
    { label: "Failed Sync Rate", value: `${data?.failedSyncRate}%`, icon: AlertTriangle },
    { label: "Avg Retrieval Time", value: `${data?.avgRetrievalTime}ms`, icon: Clock },
    { label: "Avg Rerank Time", value: `${data?.avgRerankTime}ms`, icon: Clock },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Knowledge Health</h2>
        <p className="text-sm text-muted-foreground">Operational metrics for the RAG pipeline</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <m.icon className="h-4 w-4 text-muted-foreground" />
                {m.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{m.value ?? 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
