import { useCallback, useMemo, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { toast } from 'sonner'

import { graphNeighbors, graphSearch, graphTraverse, type GraphTraversalNode } from '@/lib/graphify'
import { dedupeSearchEntities } from '@/lib/graphify-utils'
import {
  edgesFromTraversal,
  layoutTraversalNodes,
  mergeNeighborExpansion,
  type GraphEntityNodeData,
} from '../lib/graphExplorerLayout'

export interface ExplorerFilters {
  depth: number
  entityTypes: string[]
  relationshipTypes: string[]
}

const DEFAULT_FILTERS: ExplorerFilters = {
  depth: 2,
  entityTypes: [],
  relationshipTypes: [],
}

function filterTraversalNodes(
  nodes: GraphTraversalNode[],
  entityTypes: string[]
): GraphTraversalNode[] {
  if (!entityTypes.length) return nodes
  const allowed = new Set(entityTypes)
  return nodes.filter((n) => allowed.has(n.entity_type))
}

function mergeNodes(
  current: Node<GraphEntityNodeData>[],
  incoming: Node<GraphEntityNodeData>[]
): Node<GraphEntityNodeData>[] {
  const map = new Map(current.map((n) => [n.id, n]))
  for (const node of incoming) {
    if (!map.has(node.id)) map.set(node.id, node)
  }
  return [...map.values()]
}

function mergeEdges(current: Edge[], incoming: Edge[]): Edge[] {
  const map = new Map(current.map((e) => [e.id, e]))
  for (const edge of incoming) {
    if (!map.has(edge.id)) map.set(edge.id, edge)
  }
  return [...map.values()]
}

export function useGraphExplorer() {
  const [nodes, setNodes] = useState<Node<GraphEntityNodeData>[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<ExplorerFilters>(DEFAULT_FILTERS)
  const [fitViewKey, setFitViewKey] = useState<string | undefined>()

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId]
  )

  const applyTraversal = useCallback(
    (traversalNodes: GraphTraversalNode[], reset: boolean) => {
      const filtered = filterTraversalNodes(traversalNodes, filters.entityTypes)
      const existingPositions = reset
        ? undefined
        : new Map(nodes.map((n) => [n.id, n.position]))
      const flowNodes = layoutTraversalNodes(filtered, existingPositions)
      const flowEdges = edgesFromTraversal(filtered)

      if (reset) {
        setNodes(flowNodes)
        setEdges(flowEdges)
      } else {
        setNodes((prev) => mergeNodes(prev, flowNodes))
        setEdges((prev) => mergeEdges(prev, flowEdges))
      }
      setFitViewKey(`${Date.now()}-${filtered.length}`)
    },
    [filters.entityTypes, nodes]
  )

  const loadFromQuery = useCallback(
    async (query: string) => {
      if (!query.trim()) return
      setLoading(true)
      setSelectedId(null)
      try {
        const search = await graphSearch(query, {
          depth: filters.depth,
          entity_types: filters.entityTypes.length ? filters.entityTypes : undefined,
          limit: 10,
        })
        const deduped = dedupeSearchEntities(search.entities ?? [])
        const seedIds = deduped.slice(0, 3).map((e) => e.id)
        if (seedIds.length === 0) {
          toast.message('No entities found for that query')
          setNodes([])
          setEdges([])
          return
        }
        const result = await graphTraverse(seedIds, {
          depth: filters.depth,
          relationship_types: filters.relationshipTypes.length ? filters.relationshipTypes : undefined,
          entity_types: filters.entityTypes.length ? filters.entityTypes : undefined,
        })
        applyTraversal(result.nodes ?? [], true)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load graph')
      } finally {
        setLoading(false)
      }
    },
    [applyTraversal, filters]
  )

  const loadFromEntity = useCallback(
    async (entityId: string) => {
      if (!entityId) return
      setLoading(true)
      setSelectedId(entityId)
      try {
        const result = await graphTraverse([entityId], {
          depth: filters.depth,
          relationship_types: filters.relationshipTypes.length ? filters.relationshipTypes : undefined,
          entity_types: filters.entityTypes.length ? filters.entityTypes : undefined,
        })
        applyTraversal(result.nodes ?? [], true)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load entity graph')
      } finally {
        setLoading(false)
      }
    },
    [applyTraversal, filters]
  )

  const expandSelected = useCallback(async () => {
    if (!selectedId) return
    const center = nodes.find((n) => n.id === selectedId)
    if (!center) return

    setLoading(true)
    try {
      const { neighbors } = await graphNeighbors(selectedId, {
        limit: 25,
      })
      const existingIds = new Set(nodes.map((n) => n.id))
      const { nodes: newNodes, edges: newEdges } = mergeNeighborExpansion(
        selectedId,
        center.position,
        neighbors,
        existingIds
      )
      setNodes((prev) => mergeNodes(prev, newNodes))
      setEdges((prev) => mergeEdges(prev, newEdges))
      toast.success(`Added ${newNodes.length} neighbor${newNodes.length === 1 ? '' : 's'}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to expand neighbors')
    } finally {
      setLoading(false)
    }
  }, [nodes, selectedId])

  const clearGraph = useCallback(() => {
    setNodes([])
    setEdges([])
    setSelectedId(null)
    setFitViewKey(undefined)
  }, [])

  const updateFilters = useCallback((patch: Partial<ExplorerFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
  }, [])

  return {
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
  }
}
