import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGraphifySyncJobs } from '@/modules/graphify/hooks'
import { formatDistanceToNow } from 'date-fns'

export default function GraphifySyncStatus() {
  const { data: jobs, isLoading } = useGraphifySyncJobs()

  return (
    <div className="container py-8 space-y-6">
      <h1 className="text-2xl font-bold">Graphify Sync Jobs</h1>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}

      <div className="space-y-3">
        {(jobs ?? []).map((job) => (
          <Card key={job.id}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base capitalize">{job.job_type}</CardTitle>
              <Badge variant={job.status === 'completed' ? 'default' : job.status === 'failed' ? 'destructive' : 'secondary'}>
                {job.status}
              </Badge>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p>Entities: {job.entities_synced ?? 0} · Relationships: {job.relationships_synced ?? 0}</p>
              {job.error_message && <p className="text-destructive">{job.error_message}</p>}
              <p>
                {job.created_at
                  ? formatDistanceToNow(new Date(job.created_at), { addSuffix: true })
                  : ''}
              </p>
            </CardContent>
          </Card>
        ))}
        {!isLoading && (jobs ?? []).length === 0 && (
          <p className="text-muted-foreground">No sync jobs yet. Run a backfill from the Graphify dashboard.</p>
        )}
      </div>
    </div>
  )
}
