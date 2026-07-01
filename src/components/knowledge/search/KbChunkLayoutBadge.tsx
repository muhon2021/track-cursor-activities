import { Badge } from '@/components/ui/badge'
import type { ChunkLayoutType } from '@/types/knowledgeV2'

const LAYOUT_LABELS: Record<ChunkLayoutType, string> = {
  table: 'Table',
  code: 'Code',
  list: 'List',
  heading: 'Heading',
  paragraph: 'Text',
  image: 'Image',
}

interface KbChunkLayoutBadgeProps {
  layoutType?: ChunkLayoutType | string | null
}

export function KbChunkLayoutBadge({ layoutType }: KbChunkLayoutBadgeProps) {
  if (!layoutType) return null

  const normalized = layoutType.toLowerCase() as ChunkLayoutType
  const label = LAYOUT_LABELS[normalized]
  if (!label) return null

  return (
    <Badge variant="secondary" className="text-[10px] font-mono">
      [{label}]
    </Badge>
  )
}

export function resolveChunkLayoutType(metadata?: Record<string, unknown>): ChunkLayoutType | null {
  const raw = metadata?.chunk_layout_type ?? metadata?.layout_type
  if (typeof raw !== 'string') return null
  return raw.toLowerCase() as ChunkLayoutType
}
