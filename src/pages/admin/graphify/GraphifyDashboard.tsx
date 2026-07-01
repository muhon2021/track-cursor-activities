import { Link } from 'react-router-dom'
import { Network, Settings, RefreshCw, CheckCircle2, Circle, ExternalLink, HeartPulse } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useAppConfig } from '@/hooks/useAppConfig'
import {
  useGraphifyStats,
  useGraphifyBackfill,
  useGraphifyConfig,
  useUpdateGraphifyConfig,
  useGraphifyCoverage,
} from '@/modules/graphify/hooks'
import { cn } from '@/lib/utils'

function StepRow({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
      ) : (
        <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      <span className={done ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </div>
  )
}

const GRADE_STYLES = {
  excellent: 'text-green-600',
  good: 'text-blue-600',
  fair: 'text-amber-600',
  poor: 'text-red-600',
} as const

export default function GraphifyDashboard() {
  const { data: appConfig } = useAppConfig()
  const { data, isLoading, isError } = useGraphifyStats()
  const { data: coverage, isLoading: coverageLoading } = useGraphifyCoverage()
  const { data: graphifyConfig } = useGraphifyConfig()
  const backfill = useGraphifyBackfill()
  const updateConfig = useUpdateGraphifyConfig()

  const stats = data?.stats
  const featureEnabled = appConfig?.features?.enableGraphify === true
  const configEnabled = graphifyConfig?.enabled === true
  const hasEntities = (stats?.entity_count ?? 0) > 0
  const schemaReady = !isError && data != null
  const phase0Complete = schemaReady && featureEnabled && configEnabled && hasEntities

  const enableGraphifyConfig = () => {
    if (!graphifyConfig?.id) return
    updateConfig.mutate({ id: graphifyConfig.id, enabled: true })
  }

  return (
    <div className="container py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Network className="h-6 w-6" />
            Graphify
          </h1>
          <p className="text-muted-foreground">Knowledge graph health and sync</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/graphify/coverage">
              <HeartPulse className="h-4 w-4 mr-2" />
              Coverage
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/graphify/analytics">Analytics</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/graphify/config">
              <Settings className="h-4 w-4 mr-2" />
              Configuration
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/graphify/sync">Sync history</Link>
          </Button>
          <Button onClick={() => backfill.mutate()} disabled={backfill.isPending || !schemaReady}>
            <RefreshCw className={`h-4 w-4 mr-2 ${backfill.isPending ? 'animate-spin' : ''}`} />
            Run backfill
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <HeartPulse className="h-4 w-4" />
              Health score
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {coverageLoading ? (
              <span className="text-3xl font-bold">—</span>
            ) : (
              <>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold">{coverage?.health_score ?? '—'}</span>
                  {coverage?.health_grade ? (
                    <span
                      className={cn(
                        'text-sm font-medium capitalize pb-0.5',
                        GRADE_STYLES[coverage.health_grade]
                      )}
                    >
                      {coverage.health_grade}
                    </span>
                  ) : null}
                </div>
                {coverage ? <Progress value={coverage.health_score} className="h-1.5" /> : null}
                <Button asChild variant="link" className="h-auto p-0 text-xs">
                  <Link to="/admin/graphify/coverage">View coverage report</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Entities</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {isLoading ? '—' : stats?.entity_count ?? 0}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Relationships</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {isLoading ? '—' : stats?.relationship_count ?? 0}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Orphan nodes</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {isLoading ? '—' : stats?.orphan_count ?? 0}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Phase 0 setup</CardTitle>
            <Badge variant={phase0Complete ? 'default' : 'secondary'}>
              {phase0Complete ? 'Complete' : 'Incomplete'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <StepRow done={schemaReady} label="Database schema applied (graph_entities reachable)" />
          <StepRow done={featureEnabled} label="Feature flag features.enableGraphify enabled" />
          <StepRow done={configEnabled} label="Graphify config enabled for this tenant" />
          <StepRow done={hasEntities} label="Backfill completed (entities in graph)" />
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/settings/advanced">
                <ExternalLink className="h-3 w-3 mr-1" />
                Advanced settings
              </Link>
            </Button>
            {!configEnabled && graphifyConfig?.id ? (
              <Button variant="outline" size="sm" onClick={enableGraphifyConfig} disabled={updateConfig.isPending}>
                Enable Graphify config
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link to="/graphify/search">Open graph search</Link>
            </Button>
          </div>
          {!schemaReady ? (
            <p className="text-xs text-muted-foreground pt-1">
              If schema is missing, run <code className="text-xs">node scripts/phase0-graphify-setup.mjs</code> or paste{' '}
              <code className="text-xs">supabase/migrations/RUN_IF_graphify_MISSING.sql</code> into the Supabase SQL Editor.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Graphify is {data?.config?.enabled ? 'enabled' : 'disabled'} for this organization.
          Hybrid retrieval activates when both the platform feature flag and Graphify config are on.
        </CardContent>
      </Card>
    </div>
  )
}
