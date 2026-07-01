import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import {
  ArrowLeft,
  AlertTriangle,
  HeartPulse,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  useGraphifyCoverage,
  useGraphifySuggestionActions,
  type GraphifyCoverageData,
} from '@/modules/graphify/hooks'
import { cn } from '@/lib/utils'

const GRADE_STYLES: Record<GraphifyCoverageData['health_grade'], string> = {
  excellent: 'text-green-600',
  good: 'text-blue-600',
  fair: 'text-amber-600',
  poor: 'text-red-600',
}

const PRIORITY_VARIANT: Record<string, 'destructive' | 'default' | 'secondary'> = {
  high: 'destructive',
  medium: 'default',
  low: 'secondary',
}

export default function GraphifyCoverage() {
  const { data, isLoading, isError, refetch, isFetching } = useGraphifyCoverage()
  const { runSuggestion, isActionRunning } = useGraphifySuggestionActions()

  return (
    <div className="container py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link to="/admin/graphify">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HeartPulse className="h-6 w-6" />
            Graph Coverage & Health
          </h1>
          <p className="text-muted-foreground">
            Orphan detection, sparse topics, and recommended sync actions
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn('h-4 w-4 mr-2', isFetching && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {isError ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Failed to load coverage report. Admin access required.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Graph Health Score</CardTitle>
                <CardDescription>0–100 composite score</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-3">
                  <span className="text-5xl font-bold">{data.health_score}</span>
                  <span
                    className={cn(
                      'text-lg font-medium capitalize pb-1',
                      GRADE_STYLES[data.health_grade]
                    )}
                  >
                    {data.health_grade}
                  </span>
                </div>
                <Progress value={data.health_score} className="h-2" />
                {data.last_sync_at ? (
                  <p className="text-xs text-muted-foreground">
                    Last sync{' '}
                    {formatDistanceToNow(new Date(data.last_sync_at), { addSuffix: true })}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">No completed sync jobs yet</p>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Score breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.health_factors.map((f) => (
                  <div key={f.factor} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{f.factor}</span>
                      <span className="text-muted-foreground">
                        {f.score}/{f.max}
                      </span>
                    </div>
                    <Progress value={(f.score / f.max) * 100} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">{f.detail}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <GapCard label="Orphan nodes" value={data.orphan_count} />
            <GapCard label="Sparse topics" value={data.sparse_topic_count} />
            <GapCard label="Meetings w/o embed" value={data.coverage_gaps.unembedded_meetings} />
            <GapCard
              label="KB embed queue"
              value={
                data.coverage_gaps.pending_knowledge_entries +
                data.coverage_gaps.failed_knowledge_entries
              }
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Recommended actions
              </CardTitle>
              <CardDescription>One-click fixes based on current graph state</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No actions needed — graph looks healthy.</p>
              ) : (
                data.suggestions.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{s.title}</span>
                        <Badge variant={PRIORITY_VARIANT[s.priority]}>{s.priority}</Badge>
                        {s.count != null ? (
                          <Badge variant="outline">{s.count}</Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">{s.description}</p>
                    </div>
                    {s.action === 'review_orphans' ? (
                      <Button asChild size="sm" variant="outline">
                        <a href="#orphans">View orphans</a>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => void runSuggestion(s.action)}
                        disabled={isActionRunning(s.action)}
                      >
                        {isActionRunning(s.action) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Run'
                        )}
                      </Button>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {data.orphans.length > 0 ? (
            <Card id="orphans">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Orphan entities
                </CardTitle>
                <CardDescription>
                  {data.orphan_count} total — showing up to {data.orphans.length}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.orphans.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">{o.display_name}</TableCell>
                        <TableCell>{o.entity_type}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {o.source_table ?? '—'}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button asChild variant="link" size="sm" className="h-auto p-0">
                            <Link to={`/graphify/entity/${o.id}`}>Details</Link>
                          </Button>
                          <Button asChild variant="link" size="sm" className="h-auto p-0">
                            <Link to={`/graphify/explorer?entity=${o.id}`}>Explorer</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}

          {data.sparse_topics.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sparse topics</CardTitle>
                <CardDescription>Topics with 0–1 relationships</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Topic</TableHead>
                      <TableHead className="text-right">Links</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.sparse_topics.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <Link to={`/graphify/entity/${t.id}`} className="hover:underline">
                            {t.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">{t.mention_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function GapCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-bold">{value}</CardContent>
    </Card>
  )
}
