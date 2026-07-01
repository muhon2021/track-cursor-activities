import { useMemo } from "react";
import { useKnowledgeEntries } from "@/modules/knowledge/hooks/useKnowledge";
import {
  useKnowledgeFileStats,
  useKnowledgeSearchInsights,
  useCommonKnowledgeCount,
} from "@/modules/knowledge/hooks/useKnowledgeDashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Search, Eye, FileText, Database, TrendingUp, Clock } from "lucide-react";
import { formatBytes, formatDateTime } from "@/lib/utils";

export function UsageInsightsSection() {
  const { data: entries = [], isLoading: entriesLoading } = useKnowledgeEntries({});
  const { data: fileData, isLoading: filesLoading } = useKnowledgeFileStats();
  const { data: searchData, isLoading: searchLoading } = useKnowledgeSearchInsights();
  const { data: commonCount = 0, isLoading: commonLoading } = useCommonKnowledgeCount();

  const mostViewed = useMemo(
    () =>
      [...entries]
        .filter((e) => e.view_count && e.view_count > 0)
        .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
        .slice(0, 10),
    [entries]
  );

  const recentFiles = useMemo(
    () =>
      [...(fileData?.files ?? [])]
        .sort(
          (a, b) =>
            new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime()
        )
        .slice(0, 10),
    [fileData?.files]
  );

  const isLoading = entriesLoading || filesLoading || searchLoading || commonLoading;

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Common Questions &amp; Usage Insights</h2>
        <p className="text-sm text-muted-foreground">Search patterns and content engagement metrics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              Total Searches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{searchData?.totalSearches ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Avg. Search Latency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{searchData?.avgLatencyMs ?? 0}ms</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              Article Views
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {entries.reduce((s, e) => s + (e.view_count || 0), 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              Common Knowledge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{commonCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Shared entries (read-only)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Top Search Queries
            </CardTitle>
            <CardDescription>Most frequently searched terms</CardDescription>
          </CardHeader>
          <CardContent>
            {(searchData?.topQueries ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No search data yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Query</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Avg Latency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchData?.topQueries.map((q) => (
                    <TableRow key={q.query}>
                      <TableCell className="font-medium max-w-[200px] truncate">{q.query}</TableCell>
                      <TableCell className="text-right">{q.count}</TableCell>
                      <TableCell className="text-right">{q.avgLatencyMs}ms</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Most Used Knowledge Articles
            </CardTitle>
            <CardDescription>Ranked by view count</CardDescription>
          </CardHeader>
          <CardContent>
            {mostViewed.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No usage data yet</p>
            ) : (
              <div className="space-y-2">
                {mostViewed.map((entry, i) => (
                  <div key={entry.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <span className="text-sm font-semibold text-muted-foreground w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{entry.title}</div>
                      <div className="text-xs text-muted-foreground">{entry.view_count} views</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Frequently Accessed Documents
          </CardTitle>
          <CardDescription>Recently updated knowledge files</CardDescription>
        </CardHeader>
        <CardContent>
          {recentFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No files found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentFiles.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {file.title || file.file_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{file.processing_status ?? "pending"}</Badge>
                    </TableCell>
                    <TableCell>{file.file_size ? formatBytes(file.file_size) : "—"}</TableCell>
                    <TableCell>
                      {file.updated_at ? formatDateTime(file.updated_at) : "—"}
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
