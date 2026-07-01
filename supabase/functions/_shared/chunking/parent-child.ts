import type { ChunkResult } from './types.ts'
import { chunkFixed } from './fixed.ts'

export function chunkParentChild(
  text: string,
  opts: { chunkSize: number; overlap: number; strategyConfig: Record<string, unknown> }
): ChunkResult[] {
  const parentId = crypto.randomUUID()
  const parentPreview = text.slice(0, Math.min(500, text.length))
  const childChunks = chunkFixed(text, { chunkSize: opts.chunkSize, overlap: opts.overlap })

  return childChunks.map((chunk, i) => ({
    ...chunk,
    chunk_index: i,
    metadata: {
      parent_chunk_id: parentId,
      parent_preview: parentPreview,
      is_child: true,
      ...(chunk.metadata ?? {}),
    },
  }))
}
