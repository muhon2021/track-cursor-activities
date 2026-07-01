import type { Edge, Node } from '@xyflow/react'
import type { GraphTraversalNode } from '@/lib/graphify'
import type { GraphNeighbor } from '@/lib/graphify'
import { entityColor } from '../constants'

export interface GraphEntityNodeData {
  label: string
  entityType: string
  entityId: string
  depth: number
  sourceTable?: string | null
}

const NODE_WIDTH = 160
const NODE_HEIGHT = 56

function polarPosition(cx: number, cy: number, radius: number, index: number, total: number) {
  const angle = total <= 1 ? 0 : (2 * Math.PI * index) / total - Math.PI / 2
  return {
    x: cx + radius * Math.cos(angle) - NODE_WIDTH / 2,
    y: cy + radius * Math.sin(angle) - NODE_HEIGHT / 2,
  }
}

export function layoutTraversalNodes(
  nodes: GraphTraversalNode[],
  existingPositions?: Map<string, { x: number; y: number }>
): Node<GraphEntityNodeData>[] {
  const byDepth = new Map<number, GraphTraversalNode[]>()
  for (const node of nodes) {
    const list = byDepth.get(node.depth) ?? []
    list.push(node)
    byDepth.set(node.depth, list)
  }

  const flowNodes: Node<GraphEntityNodeData>[] = []

  for (const [depth, group] of [...byDepth.entries()].sort(([a], [b]) => a - b)) {
    const radius = depth === 0 ? 0 : 100 + depth * 90
    group.forEach((node, index) => {
      const kept = existingPositions?.get(node.entity_id)
      const position =
        kept ??
        (depth === 0 && group.length > 1
          ? polarPosition(0, 0, 60, index, group.length)
          : polarPosition(0, 0, radius, index, group.length))

      flowNodes.push({
        id: node.entity_id,
        type: 'graphEntity',
        position,
        data: {
          label: node.display_name,
          entityType: node.entity_type,
          entityId: node.entity_id,
          depth: node.depth,
          sourceTable: node.source_table,
        },
      })
    })
  }

  return flowNodes
}

export function edgesFromTraversal(nodes: GraphTraversalNode[]): Edge[] {
  const edges: Edge[] = []
  const seen = new Set<string>()

  for (const node of nodes) {
    if (!node.path || node.path.length < 2) continue
    const parentId = node.path[node.path.length - 2]
    const childId = node.entity_id
    const key = `${parentId}->${childId}`
    if (seen.has(key)) continue
    seen.add(key)
    edges.push({
      id: key,
      source: parentId,
      target: childId,
      type: 'smoothstep',
      animated: false,
      label: '',
      style: { stroke: '#94a3b8' },
    })
  }

  return edges
}

export function mergeNeighborExpansion(
  centerId: string,
  centerPosition: { x: number; y: number },
  neighbors: GraphNeighbor[],
  existingNodeIds: Set<string>
): { nodes: Node<GraphEntityNodeData>[]; edges: Edge[] } {
  const nodes: Node<GraphEntityNodeData>[] = []
  const edges: Edge[] = []

  neighbors.forEach((n, index) => {
    const isOut = n.direction === 'out'
    const source = isOut ? centerId : n.neighbor_id
    const target = isOut ? n.neighbor_id : centerId
    const edgeKey = `${source}->${target}:${n.relationship_type}`
    edges.push({
      id: edgeKey,
      source,
      target,
      type: 'smoothstep',
      label: n.relationship_type,
      style: { stroke: entityColor(n.neighbor_type), strokeWidth: 1.5 },
    })

    if (!existingNodeIds.has(n.neighbor_id)) {
      const pos = polarPosition(
        centerPosition.x + NODE_WIDTH / 2,
        centerPosition.y + NODE_HEIGHT / 2,
        140,
        index,
        neighbors.length
      )
      nodes.push({
        id: n.neighbor_id,
        type: 'graphEntity',
        position: pos,
        data: {
          label: n.neighbor_name,
          entityType: n.neighbor_type,
          entityId: n.neighbor_id,
          depth: -1,
        },
      })
    }
  })

  return { nodes, edges }
}
