import { useMemo } from "react";
import { useKnowledgeEntries, useKnowledgeCategories } from "@/modules/knowledge/hooks/useKnowledge";
import { useEmbeddingStats } from "@/modules/knowledge/hooks/useKnowledgeAdmin";
import {
  useKnowledgeFileStats,
  useKnowledgeSourcesOverview,
  useKnowledgeSyncLogs,
  useKnowledgeDocumentsOverTime,
} from "@/modules/knowledge/hooks/useKnowledgeDashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  BarChart3,
  FileText,
  Eye,
  Clock,
  Sparkles,
  TrendingUp,
  FolderTree,
  Calendar,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

const documentsChartConfig: ChartConfig = {
  count: { label: "Documents", color: "hsl(var(--primary))" },
};

const syncChartConfig: ChartConfig = {
  count: { label: "Syncs", color: "hsl(var(--chart-2))" },
};

const SOURCE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export function KnowledgeAnalyticsSection() {
  const { data: entries = [], isLoading: entriesLoading } = useKnowledgeEntries({});
  const { data: categories = [] } = useKnowledgeCategories();
  const { data: embeddingStats, isLoading: statsLoading } = useEmbeddingStats();
  const { data: fileData, isLoading: filesLoading } = useKnowledgeFileStats();
  const { data: sourceData } = useKnowledgeSourcesOverview();
  const { data: syncData } = useKnowledgeSyncLogs();

  const chartData = useKnowledgeDocumentsOverTime(
    entries.map((e) => e.created_at),
    (fileData?.files ?? []).map((f) => f.created_at)
  );

  const analytics = useMemo(() => {
    const mostViewed = [...entries]
      .filter((e) => e.status === "published" && e.view_count)
      .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
      .slice(0, 10);

    const recentlyUpdated = [...entries]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 10);

    const categoryDist = categories
      .map((cat) => ({
        category: cat,
        count: entries.filter((e) => e.category_id === cat.id).length,
      }))
      .filter((c) => c.count > 0);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const fresh = entries.filter((e) => new Date(e.updated_at) > thirtyDaysAgo).length;
    const moderate = entries.filter(
      (e) =>
        new Date(e.updated_at) > sixtyDaysAgo && new Date(e.updated_at) <= thirtyDaysAgo
    ).length;
    const stale = entries.filter((e) => new Date(e.updated_at) <= sixtyDaysAgo).length;

    const published = entries.filter((e) => e.status === "published").length;
    const draft = entries.filter((e) => e.status === "draft").length;
    const totalViews = entries.reduce((sum, e) => sum + (e.view_count || 0), 0);
    const avgReadingTime =
      entries.reduce(
        (sum, e) => sum + Math.ceil((e.content?.split(/\s+/).length || 0) / 200),
        0
      ) / (entries.length || 1);

    return {
      mostViewed,
      recentlyUpdated,
      categoryDist,
      freshness: { fresh, moderate, stale },
      published,
      draft,
      totalViews,
      avgReadingTime: Math.round(avgReadingTime),
    };
  }, [entries, categories]);

  const isLoading = entriesLoading || statsLoading || filesLoading;
  const fileStats = fileData?.stats;
  const sourceDistribution = sourceData?.distribution ?? [];
  const syncActivity = syncData?.syncActivity ?? [];

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
        <h2 className="text-xl font-semibold">Knowledge Analytics</h2>
        <p className="text-sm text-muted-foreground">Document counts, growth trends, and embedding coverage</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Total Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{entries.length + (fileStats?.total ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {entries.length} articles, {fileStats?.total ?? 0} files
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              Active / Synced
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.published + (fileStats?.active ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {fileStats?.synced ?? 0} synced files
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              Failed Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{fileStats?.failed ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {fileStats?.pending ?? 0} pending processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              Total Views
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalViews.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all articles</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Documents Over Time</CardTitle>
            <CardDescription>New documents in the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.combined.every((d) => d.count === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-8">No document activity yet</p>
            ) : (
              <ChartContainer config={documentsChartConfig} className="h-[220px] w-full">
                <LineChart data={chartData.combined}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => v.slice(5)}
                    fontSize={11}
                  />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="count" stroke="var(--color-count)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Source Distribution</CardTitle>
            <CardDescription>Connected sources by type</CardDescription>
          </CardHeader>
          <CardContent>
            {sourceDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No sources configured</p>
            ) : (
              <ChartContainer config={{ count: { label: "Sources", color: "hsl(var(--primary))" } }} className="h-[220px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie
                    data={sourceDistribution}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {sourceDistribution.map((_, i) => (
                      <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync Activity</CardTitle>
          <CardDescription>Sync operations per day (last 30 days)</CardDescription>
        </CardHeader>
        <CardContent>
          {syncActivity.every((d) => d.count === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-8">No sync activity recorded</p>
          ) : (
            <ChartContainer config={syncChartConfig} className="h-[180px] w-full">
              <BarChart data={syncActivity}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {embeddingStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Embedding Coverage
            </CardTitle>
            <CardDescription>Status of semantic search indexing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{embeddingStats.completed}</div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">{embeddingStats.pending}</div>
                <div className="text-sm text-muted-foreground">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{embeddingStats.processing}</div>
                <div className="text-sm text-muted-foreground">Processing</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{embeddingStats.failed}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">{embeddingStats.totalChunks.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Chunks</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Coverage</span>
                <span className="font-semibold">
                  {embeddingStats.total > 0
                    ? Math.round((embeddingStats.completed / embeddingStats.total) * 100)
                    : 0}
                  %
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${
                      embeddingStats.total > 0
                        ? (embeddingStats.completed / embeddingStats.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Content Freshness
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <div className="text-2xl font-bold text-green-600">{analytics.freshness.fresh}</div>
              <div className="text-sm text-muted-foreground mt-1">Updated in last 30 days</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-2xl font-bold text-yellow-600">{analytics.freshness.moderate}</div>
              <div className="text-sm text-muted-foreground mt-1">Updated 30–60 days ago</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-2xl font-bold text-red-600">{analytics.freshness.stale}</div>
              <div className="text-sm text-muted-foreground mt-1">Updated 60+ days ago</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Most Viewed Articles
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.mostViewed.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No view data yet</p>
            ) : (
              <div className="space-y-3">
                {analytics.mostViewed.map((entry, index) => (
                  <div key={entry.id} className="flex items-start gap-3 rounded-lg border p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{entry.title}</div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        {entry.view_count} views
                        {entry.knowledge_categories && (
                          <Badge variant="outline" className="text-xs">
                            {entry.knowledge_categories.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Recently Updated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.recentlyUpdated.slice(0, 10).map((entry) => (
                <div key={entry.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{entry.title}</div>
                    <div className="text-sm text-muted-foreground mt-1">{formatDate(entry.updated_at)}</div>
                  </div>
                  {entry.knowledge_categories && (
                    <Badge variant="outline" className="text-xs shrink-0">
                      {entry.knowledge_categories.name}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Category Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.categoryDist.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No categories with content</p>
          ) : (
            <div className="space-y-4">
              {analytics.categoryDist
                .sort((a, b) => b.count - a.count)
                .map((item) => (
                  <div key={item.category.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-2">
                        <FolderTree className="h-3 w-3" />
                        {item.category.name}
                      </span>
                      <span className="text-muted-foreground">{item.count} articles</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{
                          width: `${
                            (item.count /
                              Math.max(...analytics.categoryDist.map((c) => c.count))) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
