import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useNotificationLogs } from "../../hooks/useNotificationAdmin";
import { downloadCSV } from "@/lib/csv";

const STATUSES = ["", "pending", "delivered", "read", "failed", "expired"];
const CHANNELS = ["", "in_app", "email", "slack", "teams", "sms", "webhook", "push"];

export default function NotificationLogsPage() {
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useNotificationLogs({
    status: status || undefined,
    channel: channel || undefined,
    page,
  });

  const handleExport = () => {
    const rows = data?.items ?? [];
    if (!rows.length) return;
    const headers = ["id", "user_id", "event_key", "channel", "status", "sent_at", "error_message"];
    const csv = [
      headers.join(","),
      ...rows.map((log) =>
        headers
          .map((h) => {
            const val = String((log as unknown as Record<string, unknown>)[h] ?? "");
            return `"${val.replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ].join("\n");
    downloadCSV(csv, "notification-logs");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Delivery Logs</h1>
          <p className="text-muted-foreground">Track notification delivery status and failures</p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className="h-9 rounded-md border px-3 text-sm"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(0); }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s || "All statuses"}</option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border px-3 text-sm"
          value={channel}
          onChange={(e) => { setChannel(e.target.value); setPage(0); }}
        >
          {CHANNELS.map((c) => (
            <option key={c} value={c}>{c || "All channels"}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Logs ({data?.total ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {(data?.items ?? []).map((log) => (
                <div
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{log.event_key ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.channel} · {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        log.status === "failed"
                          ? "destructive"
                          : log.status === "delivered"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {log.status}
                    </Badge>
                    {log.error_message && (
                      <span className="text-xs text-destructive max-w-[200px] truncate">
                        {log.error_message}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {!data?.items?.length && (
                <p className="text-center text-muted-foreground py-8">No logs found</p>
              )}
            </div>
          )}

          {(data?.totalPages ?? 1) > 1 && (
            <div className="flex items-center justify-between mt-4">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">Page {page + 1} of {data?.totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= (data?.totalPages ?? 1) - 1}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
