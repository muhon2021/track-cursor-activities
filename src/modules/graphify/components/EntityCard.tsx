import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { GraphEntityResult } from '@/lib/graphify'

interface EntityCardProps {
  entity: GraphEntityResult
  showScore?: boolean
}

export function EntityCard({ entity, showScore }: EntityCardProps) {
  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">
            <Link to={`/graphify/entity/${entity.id}`} className="hover:underline">
              {entity.display_name || entity.canonical_name}
            </Link>
          </CardTitle>
          <Badge variant="secondary">{entity.entity_type}</Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-1">
        {entity.source_table && (
          <p>Source: {entity.source_table}</p>
        )}
        {showScore && entity.match_score != null && (
          <p>Match: {(entity.match_score * 100).toFixed(0)}%</p>
        )}
      </CardContent>
    </Card>
  )
}
