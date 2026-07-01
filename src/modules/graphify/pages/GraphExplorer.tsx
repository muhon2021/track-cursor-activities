import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { GitBranch, Loader2, Network, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GraphifySearchInput } from '../components/GraphifySearchInput'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GraphExplorerCanvas } from '../components/GraphExplorerCanvas'
import { useGraphExplorer } from '../hooks/useGraphExplorer'
import { GRAPH_ENTITY_TYPES, GRAPH_RELATIONSHIP_TYPES } from '../constants'
import type { GraphEntityNodeData } from '../lib/graphExplorerLayout'

export default function GraphExplorer() {
  const [searchParams] = useSearchParams()
  const [input, setInput] = useState(searchParams.get('q') ?? '')
  const {
    nodes,
    edges,
    selectedId,
    selectedNode,
    setSelectedId,
    loading,
    filters,
    updateFilters,
    loadFromQuery,
    loadFromEntity,
    expandSelected,
    clearGraph,
    fitViewKey,
  } = useGraphExplorer()

  const entityParam = searchParams.get('entity')
  const qParam = searchParams.get('q') ?? ''

  useEffect(() => {
    if (entityParam) {
      void loadFromEntity(entityParam)
    } else if (qParam.length > 1) {
      void loadFromQuery(qParam)
    }
    // Initial URL seed only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityParam, qParam])

  const handleSearch = (term?: string) => {
    const q = (term ?? input).trim()
    setInput(q)
    void loadFromQuery(q)
  }

  const selectedData = selectedNode?.data as GraphEntityNodeData | undefined

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="border-b bg-background px-4 py-3 space-y-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Graph Explorer
            </h1>
            <p className="text-sm text-muted-foreground">
              Pan, zoom, and expand entity neighborhoods
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/graphify/search">Search</Link>
            </Button>
            {nodes.length > 0 ? (
              <Button variant="outline" size="sm" onClick={clearGraph}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px] max-w-md">
            <Label htmlFor="explorer-search" className="sr-only">
              Search
            </Label>
            <div className="flex gap-2">
              <GraphifySearchInput
                className="flex-1"
                inputId="explorer-search"
                placeholder="Search to seed the graph..."
                value={input}
                onChange={setInput}
                onSubmit={(term) => handleSearch(term)}
                disabled={loading}
              />
              <Button onClick={() => handleSearch()} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="w-[100px]">
            <Label className="text-xs text-muted-foreground">Depth</Label>
            <Select
              value={String(filters.depth)}
              onValueChange={(v) => updateFilters({ depth: Number(v) })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 hop</SelectItem>
                <SelectItem value="2">2 hops</SelectItem>
                <SelectItem value="3">3 hops</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-[160px]">
            <Label className="text-xs text-muted-foreground">Entity type</Label>
            <Select
              value={filters.entityTypes[0] ?? 'all'}
              onValueChange={(v) =>
                updateFilters({ entityTypes: v === 'all' ? [] : [v] })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {GRAPH_ENTITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[180px]">
            <Label className="text-xs text-muted-foreground">Relationship</Label>
            <Select
              value={filters.relationshipTypes[0] ?? 'all'}
              onValueChange={(v) =>
                updateFilters({ relationshipTypes: v === 'all' ? [] : [v] })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All relationships</SelectItem>
                {GRAPH_RELATIONSHIP_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative bg-muted/20">
          {nodes.length === 0 && !loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
              <Network className="h-12 w-12 mb-3 opacity-40" />
              <p className="font-medium">No graph loaded</p>
              <p className="text-sm mt-1 max-w-sm">
                Search for an entity or open{' '}
                <Link to="/graphify/entity" className="text-primary hover:underline">
                  an entity
                </Link>{' '}
                and choose &quot;View in explorer&quot;.
              </p>
            </div>
          ) : null}
          {loading && nodes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : null}
          <GraphExplorerCanvas
            nodes={nodes}
            edges={edges}
            onNodeSelect={setSelectedId}
            fitViewKey={fitViewKey}
          />
        </div>

        {selectedData ? (
          <Card className="w-72 shrink-0 rounded-none border-l border-t-0 border-b-0 border-r-0 overflow-y-auto">
            <CardHeader className="pb-2">
              <CardTitle className="text-base leading-tight">{selectedData.label}</CardTitle>
              <Badge variant="secondary">{selectedData.entityType}</Badge>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {selectedData.sourceTable ? (
                <p className="text-muted-foreground">Source: {selectedData.sourceTable}</p>
              ) : null}
              <p className="text-muted-foreground">
                {edges.filter((e) => e.source === selectedId || e.target === selectedId).length}{' '}
                visible connections
              </p>
              <div className="flex flex-col gap-2">
                <Button size="sm" onClick={() => void expandSelected()} disabled={loading}>
                  Expand neighbors
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/graphify/entity/${selectedId}`}>Entity details</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/graphify/explorer?entity=${selectedId}`}>Re-center graph</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
