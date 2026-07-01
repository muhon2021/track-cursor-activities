import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Badge } from '@/components/ui/badge'
import { entityColor } from '../constants'
import type { GraphEntityNodeData } from '../lib/graphExplorerLayout'

function GraphEntityNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as GraphEntityNodeData
  const color = entityColor(nodeData.entityType)

  return (
    <div
      className={`rounded-lg border-2 bg-card px-3 py-2 shadow-sm min-w-[140px] max-w-[180px] transition-shadow ${
        selected ? 'ring-2 ring-primary shadow-md' : ''
      }`}
      style={{ borderColor: color }}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground !w-2 !h-2" />
      <p className="text-xs font-medium truncate" title={nodeData.label}>
        {nodeData.label}
      </p>
      <Badge
        variant="secondary"
        className="mt-1 text-[10px] px-1 py-0 h-4"
        style={{ backgroundColor: `${color}22`, color }}
      >
        {nodeData.entityType}
      </Badge>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground !w-2 !h-2" />
    </div>
  )
}

export const GraphEntityNode = memo(GraphEntityNodeComponent)

export const graphExplorerNodeTypes = {
  graphEntity: GraphEntityNode,
}
