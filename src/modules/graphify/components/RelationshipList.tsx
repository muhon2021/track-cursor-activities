import { Badge } from '@/components/ui/badge'
import { Link } from 'react-router-dom'
import type { GraphNeighbor } from '@/lib/graphify'

interface RelationshipListProps {
  neighbors: GraphNeighbor[]
}

export function RelationshipList({ neighbors }: RelationshipListProps) {
  if (neighbors.length === 0) {
    return <p className="text-sm text-muted-foreground">No connected entities.</p>
  }

  return (
    <ul className="space-y-2">
      {neighbors.map((n) => (
        <li
          key={n.relationship_id}
          className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm"
        >
          <Badge variant="outline">{n.relationship_type}</Badge>
          <span className="text-muted-foreground">{n.direction === 'in' ? '←' : '→'}</span>
          <Link to={`/graphify/entity/${n.neighbor_id}`} className="font-medium hover:underline">
            {n.neighbor_name}
          </Link>
          <Badge variant="secondary">{n.neighbor_type}</Badge>
          <span className="text-muted-foreground ml-auto">
            weight {(n.weight ?? 0).toFixed(2)}
          </span>
        </li>
      ))}
    </ul>
  )
}
