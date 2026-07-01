import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, GitBranch, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RelationshipList } from '../components/RelationshipList'
import { useGraphEntitySummary } from '../hooks'

export default function EntityDetail() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error } = useGraphEntitySummary(id)

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data?.entity) {
    return (
      <div className="container py-8">
        <p className="text-destructive">Entity not found or access denied.</p>
        <Button asChild variant="link" className="px-0 mt-2">
          <Link to="/graphify/search">Back to search</Link>
        </Button>
      </div>
    )
  }

  const { entity, neighbors, neighbor_count } = data

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/graphify/search">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to search
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to={`/graphify/explorer?entity=${entity.id}`}>
            <GitBranch className="h-4 w-4 mr-2" />
            View in explorer
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle>{entity.display_name || entity.canonical_name}</CardTitle>
            <Badge>{entity.entity_type}</Badge>
          </div>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          {entity.source_table && <p>Source table: {entity.source_table}</p>}
          {entity.source_id && <p>Source ID: {entity.source_id}</p>}
          {entity.confidence != null && <p>Confidence: {Number(entity.confidence).toFixed(2)}</p>}
          <p>Connections: {neighbor_count}</p>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-3">Relationships</h2>
        <RelationshipList neighbors={neighbors ?? []} />
      </div>
    </div>
  )
}
