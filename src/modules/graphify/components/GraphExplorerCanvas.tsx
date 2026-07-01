import { useCallback, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { GraphEntityNodeData } from '../lib/graphExplorerLayout'
import { graphExplorerNodeTypes } from './GraphEntityNode'

interface GraphExplorerCanvasProps {
  nodes: Node<GraphEntityNodeData>[]
  edges: Edge[]
  onNodeSelect: (entityId: string | null) => void
  fitViewKey?: string
}

function GraphExplorerCanvasInner({
  nodes,
  edges,
  onNodeSelect,
  fitViewKey,
}: GraphExplorerCanvasProps) {
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(nodes)
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(edges)
  const { fitView } = useReactFlow()
  const lastFitKey = useRef<string | undefined>()

  useEffect(() => {
    setFlowNodes(nodes)
  }, [nodes, setFlowNodes])

  useEffect(() => {
    setFlowEdges(edges)
  }, [edges, setFlowEdges])

  useEffect(() => {
    if (fitViewKey && fitViewKey !== lastFitKey.current && nodes.length > 0) {
      lastFitKey.current = fitViewKey
      requestAnimationFrame(() => fitView({ padding: 0.2, duration: 300 }))
    }
  }, [fitViewKey, nodes.length, fitView])

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      onNodeSelect(node.id)
    },
    [onNodeSelect]
  )

  const onPaneClick = useCallback(() => {
    onNodeSelect(null)
  }, [onNodeSelect])

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      nodeTypes={graphExplorerNodeTypes}
      fitView
      minZoom={0.15}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={16} />
      <Controls showInteractive={false} />
      <MiniMap
        nodeColor={(n) => {
          const d = n.data as GraphEntityNodeData
          return d?.entityType ? '#64748b' : '#cbd5e1'
        }}
        maskColor="rgba(0,0,0,0.08)"
      />
    </ReactFlow>
  )
}

export function GraphExplorerCanvas(props: GraphExplorerCanvasProps) {
  return (
    <ReactFlowProvider>
      <GraphExplorerCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
