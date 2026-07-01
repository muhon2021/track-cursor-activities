import { useState } from "react";
import { useKnowledgeSyncLogs, useKnowledgeFileStats } from "@/modules/knowledge/hooks/useKnowledgeDashboard";
import { useKbSyncAction } from "@/hooks/useKbSyncAction";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  TrendingUp,
  Activity,
  RotateCw,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

function HealthBadge({ status, label }: { status: string; label: string }) {
  const variants: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
    healthy: "default",
    warning: "secondary",
    failed: "destructive",
  };
  const icon =
    status === "healthy" ? (
      <CheckCircle2 className="h-4 w-4 text-green-500" />
    ) : status === "warning" ? (
      <AlertCircle className="h-4 w-4 text-yellow-500" />
    ) : (
      <AlertCircle className="h-4 w-4 text-red-500" />
    );
  return (
    <Badge variant={variants[status] ?? "outline"} className="flex items-center gap-1 w-fit">
      {icon}
      {label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const variant =
    status === "completed"
      ? "default"
      : status === "failed"
        ? "destructive"
        : status === "running" || status === "processing" || status === "pending"
          ? "secondary"
          : "outline";
  return <Badge variant={variant}>{status ?? "unknown"}</Badge>;
}

export function SyncStatusSection() {
  const { data, isLoading } = useKnowledgeSyncLogs();
  const { data: fileData, isLoading: filesLoading } = useKnowledgeFileStats();
  const syncAction = useKbSyncAction();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const logs = data?.logs ?? [];
  const health = data?.health;
  const failedLogs = logs.filter((l) => l.status === "failed");
  const files = fileData?.files ?? [];

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const runAction = (action: "retry" | "requeue", ids?: string[]) => {
    const targetIds = ids ?? Array.from(selected);
    if (targetIds.length === 0) return;
    syncAction.mutate({
      action,
      items: targetIds.map((id) => ({ entity_type: "knowledge_file" as const, entity_id: id })),
    });
    setSelected(new Set());
  };

  if (isLoading || filesLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Sync Status</h2>
          <p className="text-sm text-muted-foreground">Sync health, document status, and retry actions</p>
        </div>
        {health && <HealthBadge status={health.status} label={health.label} />}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Last Sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold">
              {health?.lastSyncAt ? formatDateTime(health.lastSyncAt) : "Never"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health?.successRate ?? 0}%</div>
            <Progress value={health?.successRate ?? 0} className="mt-2 h-1" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              Failed Syncs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{health?.failedCount ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              Pending / Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health?.pendingCount ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Total Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Last 50 records</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Document Sync</CardTitle>
            <CardDescription>Per-document retry and requeue</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={selected.size === 0 || syncAction.isPending} onClick={() => runAction("retry")}>
              Retry Selected
            </Button>
            <Button size="sm" variant="outline" disabled={selected.size === 0 || syncAction.isPending} onClick={() => runAction("requeue")}>
              Requeue Selected
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Document</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.slice(0, 25).map((f) => (
                <TableRow key={f.id}>
                  <TableCell>
                    <Checkbox checked={selected.has(f.id)} onCheckedChange={(c) => toggle(f.id, !!c)} />
                  </TableCell>
                  <TableCell>{f.title || f.file_name}</TableCell>
                  <TableCell><StatusBadge status={f.processing_status} /></TableCell>
                  <TableCell>{f.updated_at ? formatDateTime(f.updated_at) : "—"}</TableCell>
                  <TableCell className="space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => runAction("retry", [f.id])} disabled={syncAction.isPending}>
                      <RotateCw className="h-3 w-3 mr-1" /> Retry
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => runAction("requeue", [f.id])} disabled={syncAction.isPending}>
                      Requeue
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Sync History</CardTitle>
          <CardDescription>Integration sync job logs</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No sync logs available</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Removed</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const duration =
                    log.completed_at && log.started_at
                      ? Math.round(
                          (new Date(log.completed_at).getTime() -
                            new Date(log.started_at).getTime()) /
                            1000
                        )
                      : null;
                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline">{log.sync_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={log.status} />
                      </TableCell>
                      <TableCell>{log.documents_added ?? 0}</TableCell>
                      <TableCell>{log.documents_removed ?? 0}</TableCell>
                      <TableCell>
                        {log.started_at ? formatDateTime(log.started_at) : "—"}
                      </TableCell>
                      <TableCell>{duration !== null ? `${duration}s` : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {failedLogs.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Failed Syncs Requiring Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {failedLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{log.sync_type} sync</div>
                    <div className="text-xs text-muted-foreground">
                      {log.started_at ? formatDateTime(log.started_at) : "—"}
                    </div>
                    {log.error_message && (
                      <div className="text-sm text-destructive mt-1">{log.error_message}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
