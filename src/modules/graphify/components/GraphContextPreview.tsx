interface GraphContextPreviewProps {
  contextNodes?: Array<{
    entity_id: string
    entity_type: string
    display_name: string
    depth: number
  }>
}

export function GraphContextPreview({ contextNodes }: GraphContextPreviewProps) {
  if (!contextNodes?.length) return null

  return (
    <div className="rounded-md border bg-muted/30 p-4 text-sm">
      <p className="font-medium mb-2">Graph context ({contextNodes.length} nodes)</p>
      <ul className="space-y-1 text-muted-foreground">
        {contextNodes.slice(0, 12).map((n) => (
          <li key={n.entity_id}>
            {'  '.repeat(n.depth)}
            {n.entity_type}: {n.display_name}
          </li>
        ))}
      </ul>
    </div>
  )
}
