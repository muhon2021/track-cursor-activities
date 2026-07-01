import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Network, GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { dedupeSearchEntities } from '@/lib/graphify-utils'
import { GraphifySearchInput } from '../components/GraphifySearchInput'
import { EntityCard } from '../components/EntityCard'
import { GraphContextPreview } from '../components/GraphContextPreview'
import { useGraphSearch } from '../hooks'
import type { GraphEntityResult } from '@/lib/graphify'

export default function GraphSearch() {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const { data, isFetching } = useGraphSearch(query, query.length > 1)
  const entities = useMemo(
    () => dedupeSearchEntities(data?.entities ?? []),
    [data?.entities]
  )

  const runSearch = (term: string, _entity?: GraphEntityResult) => {
    const q = term.trim()
    setInput(q)
    setQuery(q)
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Network className="h-6 w-6" />
          Graphify Search
        </h1>
        <p className="text-muted-foreground mt-1">
          Discover entities and relationships across meetings, tasks, documents, and memories.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <GraphifySearchInput
          className="flex-1 min-w-[200px]"
          value={input}
          onChange={setInput}
          onSubmit={runSearch}
          disabled={isFetching}
        />
        <Button onClick={() => runSearch(input)} disabled={isFetching}>
          <Search className="h-4 w-4 mr-2" />
          Search
        </Button>
        <Button asChild variant="outline">
          <Link to={query ? `/graphify/explorer?q=${encodeURIComponent(query)}` : '/graphify/explorer'}>
            <GitBranch className="h-4 w-4 mr-2" />
            Explorer
          </Link>
        </Button>
      </div>

      {data?.context_nodes && data.context_nodes.length > 0 && (
        <GraphContextPreview contextNodes={data.context_nodes} />
      )}

      {query && !isFetching && entities.length === 0 && (
        <p className="text-muted-foreground">No entities found. Run a graph backfill from Admin → Graphify.</p>
      )}

      <div className="grid gap-3">
        {entities.map((entity) => (
          <EntityCard key={entity.id} entity={entity} showScore />
        ))}
      </div>
    </div>
  )
}
