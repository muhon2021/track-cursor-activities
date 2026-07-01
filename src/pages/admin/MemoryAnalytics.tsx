import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, History } from "lucide-react";

interface QueueHistoryRow {
  id: string;
  batch_type: string;
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_items: number | null;
  processed_count: number | null;
  failed_count: number | null;
}

interface VectorSearchLog {
  id: string;
  user_id: string | null;
  query: string;
  result_count: number | null;
  top_score: number | null;
  duration_ms: number | null;
  created_at: string | null;
}

export default function MemoryAnalytics() {
  const {
    data: queueRuns = [],
    isLoading: loadingQueue,
    error: queueError,
  } = useQuery({
    queryKey: ["memory-queue-history"],
    queryFn: async (): Promise<QueueHistoryRow[]> => {
      const { data, error } = await supabase
        .from("processing_queue_history")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as QueueHistoryRow[];
    },
  });

  const {
    data: searchLogs = [],
    isLoading: loadingLogs,
    error: logsError,
  } = useQuery({
    queryKey: ["memory-search-logs"],
    queryFn: async (): Promise<VectorSearchLog[]> => {
      const { data, error } = await supabase
        .from("vector_search_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as VectorSearchLog[];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Memory Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            High-level view of embedding queue runs and semantic search activity.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Processing queue history
          </CardTitle>
          <CardDescription>Recent batch runs for embedding and processing jobs</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingQueue ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : queueError ? (
            <p className="text-sm text-destructive">
              Failed to load queue history: {queueError.message}
            </p>
          ) : queueRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No processing queue history found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queueRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="text-sm">
                      {run.batch_type || "unknown"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          run.status === "completed"
                            ? "default"
                            : run.status === "running"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {run.status || "unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {(run.processed_count ?? 0)}/{run.total_items ?? 0}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {run.started_at
                        ? new Date(run.started_at).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {run.completed_at
                        ? new Date(run.completed_at).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[260px]">
                      {(run.failed_count ?? 0) > 0 ? (
                        <span className="text-destructive">
                          {run.failed_count} failed
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Recent semantic searches
          </CardTitle>
          <CardDescription>Last 50 vector search queries and performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logsError ? (
            <p className="text-sm text-destructive">
              Failed to load search logs: {logsError.message}
            </p>
          ) : searchLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No vector search logs recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Query</TableHead>
                  <TableHead>Results</TableHead>
                  <TableHead>Top score</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="max-w-[320px]">
                      <span className="line-clamp-1 text-sm">{log.query}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.result_count ?? 0}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.top_score != null
                        ? `${(log.top_score * 100).toFixed(1)}%`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.duration_ms != null ? `${log.duration_ms}ms` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.created_at
                        ? new Date(log.created_at).toLocaleString()
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
