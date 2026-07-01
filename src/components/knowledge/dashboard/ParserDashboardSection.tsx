import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileSearch,
  RefreshCw,
  AlertTriangle,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useParserDashboard, type ParsedDocRow } from "@/hooks/useParserDashboard";
import { OcrQualitySection } from "@/components/knowledge/dashboard/OcrQualitySection";

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    completed: { label: "Completed", variant: "default" },
    failed: { label: "Failed", variant: "destructive" },
    pending: { label: "Pending", variant: "secondary" },
    processing: { label: "Processing", variant: "outline" },
  };
  const cfg = map[status] ?? { label: status, variant: "secondary" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function mimeShortName(mime: string | null): string {
  if (!mime) return "Unknown";
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
    "text/csv": "CSV",
    "text/html": "HTML",
    "text/markdown": "Markdown",
    "text/plain": "TXT",
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "image/webp": "WebP",
    "audio/mpeg": "MP3",
    "audio/wav": "WAV",
    "audio/m4a": "M4A",
    "message/rfc822": "Email",
  };
  return map[mime] ?? mime.split("/")[1]?.toUpperCase() ?? "Unknown";
}

export function ParserDashboardSection() {
  const {
    summary,
    summaryLoading,
    failures,
    failuresLoading,
    allDocs,
    allDocsLoading,
    mimeBreakdown,
    reprocessOne,
    reprocessAllFailed,
    isReprocessing,
    refresh,
  } = useParserDashboard();

  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredDocs =
    statusFilter === "all"
      ? allDocs
      : allDocs.filter((d) => d.parse_status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSearch className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Parser Dashboard</h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            disabled={summaryLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${summaryLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => reprocessAllFailed()}
            disabled={isReprocessing || (summary?.failed ?? 0) === 0}
          >
            {isReprocessing ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-1" />
            )}
            Retry All Failed
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryLoading ? "—" : summary?.total ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {summaryLoading ? "—" : summary?.completed ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5 text-red-500" />
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {summaryLoading ? "—" : summary?.failed ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-yellow-500" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {summaryLoading ? "—" : summary?.pending ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Parse Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryLoading ? "—" : formatDuration(summary?.avgParseTimeMs ?? null)}
            </div>
          </CardContent>
        </Card>
      </div>

      <OcrQualitySection />

      {/* Format Breakdown + Failure Log side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Format Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Format Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {mimeBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents parsed yet.</p>
            ) : (
              <div className="space-y-2">
                {mimeBreakdown.map((item) => (
                  <div key={item.mime_type} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{mimeShortName(item.mime_type)}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 bg-primary/20 rounded-full w-24 overflow-hidden">
                        <div
                          className="h-2 bg-primary rounded-full"
                          style={{
                            width: `${Math.min(100, (item.count / (summary?.total || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-8 text-right">
                        {item.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Failures */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Recent Failures
            </CardTitle>
          </CardHeader>
          <CardContent>
            {failuresLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : failures.length === 0 ? (
              <p className="text-sm text-muted-foreground">No failures. 🎉</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {failures.slice(0, 10).map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-start justify-between gap-2 border rounded p-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{doc.file_name ?? doc.source_id}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {(doc.parse_errors as { message?: string } | null)?.message ?? "Unknown error"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 h-7 px-2"
                      onClick={() => reprocessOne(doc.id)}
                      disabled={isReprocessing}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All Documents Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">All Parsed Documents</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {allDocsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No documents found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pages</TableHead>
                    <TableHead>Tables</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Processed</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocs.slice(0, 100).map((doc: ParsedDocRow) => (
                    <TableRow key={doc.id}>
                      <TableCell className="max-w-[200px]">
                        <p className="truncate text-sm font-medium">
                          {doc.file_name ?? doc.source_id}
                        </p>
                        <p className="text-xs text-muted-foreground">{doc.source_type}</p>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">{mimeShortName(doc.mime_type)}</span>
                      </TableCell>
                      <TableCell>{statusBadge(doc.parse_status)}</TableCell>
                      <TableCell className="text-sm">{doc.page_count}</TableCell>
                      <TableCell className="text-sm">{doc.table_count}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1 rounded">{doc.parse_version}</code>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(doc.processed_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => reprocessOne(doc.id)}
                          disabled={isReprocessing}
                          title="Reprocess"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
