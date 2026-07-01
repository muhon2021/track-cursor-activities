import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowLeft, BarChart3, Network, RefreshCw, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useGraphifyAnalytics } from '@/modules/graphify/hooks'

export default function GraphifyAnalytics() {
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const { data, isLoading, isError, refetch, isFetching } = useGraphifyAnalytics(days)

  const growthChart = useMemo(
    () =>
      (data?.entity_growth ?? []).map((d) => ({
        ...d,
        label: format(new Date(d.date), 'MMM d'),
      })),
    [data?.entity_growth]
  )

  const typeChart = useMemo(
    () => (data?.entities_by_type ?? []).slice(0, 8),
    [data?.entities_by_type]
  )

  const queryChart = useMemo(
    () =>
      (data?.query_volume ?? []).map((d) => ({
        ...d,
        label: format(new Date(d.date), 'MMM d'),
      })),
    [data?.query_volume]
  )

  const summary = data?.summary

  return (
    <div className="container py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link to="/admin/graphify">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Graphify dashboard
            </Link>
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Graphify Analytics
          </h1>
          <p className="text-muted-foreground">Entity growth, query volume, and token savings</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v) as 7 | 30 | 90)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {isError ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Failed to load analytics. Ensure you are an admin and Graphify is enabled.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Graph queries"
              value={summary?.query_count}
              loading={isLoading}
              subtitle={`${summary?.context_queries ?? 0} hybrid RAG`}
            />
            <MetricCard
              title="Avg latency"
              value={summary?.avg_latency_ms != null ? `${summary.avg_latency_ms} ms` : undefined}
              loading={isLoading}
            />
            <MetricCard
              title="Tokens saved"
              value={summary?.total_tokens_saved?.toLocaleString()}
              loading={isLoading}
              icon={<Zap className="h-4 w-4 text-amber-500" />}
            />
            <MetricCard
              title="Orphan nodes"
              value={summary?.orphan_count}
              loading={isLoading}
              subtitle="No relationships"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Entity growth</CardTitle>
                <CardDescription>New entities per day (last {days} days)</CardDescription>
              </CardHeader>
              <CardContent className="h-[260px]">
                {isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : growthChart.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={growthChart}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="count"
                        name="New entities"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Query volume</CardTitle>
                <CardDescription>Graph API calls per day</CardDescription>
              </CardHeader>
              <CardContent className="h-[260px]">
                {isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : queryChart.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={queryChart}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" name="Queries" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Entities by type</CardTitle>
              </CardHeader>
              <CardContent className="h-[260px]">
                {isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : typeChart.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={typeChart} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="entity_type"
                        width={90}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top topics</CardTitle>
                <CardDescription>By relationship count</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : (data?.top_topics?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No topics yet. Enable entity extraction on ingest.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Topic</TableHead>
                        <TableHead className="text-right">Links</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.top_topics.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>
                            <Link
                              to={`/graphify/entity/${t.id}`}
                              className="hover:underline flex items-center gap-1"
                            >
                              <Network className="h-3 w-3 text-muted-foreground" />
                              {t.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right">{t.mention_count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {(data?.orphan_samples?.length ?? 0) > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Orphan samples</CardTitle>
                <CardDescription>
                  Entities with no relationships ({summary?.orphan_count ?? 0} total)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.orphan_samples.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>
                          <Link to={`/graphify/entity/${o.id}`} className="hover:underline">
                            {o.display_name}
                          </Link>
                        </TableCell>
                        <TableCell>{o.entity_type}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  )
}

function MetricCard({
  title,
  value,
  loading,
  subtitle,
  icon,
}: {
  title: string
  value?: string | number
  loading?: boolean
  subtitle?: string
  icon?: ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value ?? '—'}</div>
            {subtitle ? <p className="text-xs text-muted-foreground mt-1">{subtitle}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyChart() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
      No data for this period
    </div>
  )
}
