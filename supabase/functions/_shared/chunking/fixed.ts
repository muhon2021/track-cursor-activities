import type { ChunkResult } from './types.ts'

export function chunkFixed(
  text: string,
  opts: { chunkSize: number; overlap: number }
): ChunkResult[] {
  const { chunkSize, overlap } = opts
  const step = Math.max(1, chunkSize - overlap)
  const chunks: ChunkResult[] = []
  let start = 0
  let index = 0

  while (start < text.length) {
    const content = text.slice(start, start + chunkSize).trim()
    if (content.length > 0) {
      chunks.push({ content, chunk_index: index })
      index++
    }
    start += step
    if (start >= text.length) break
  }

  return chunks.length > 0 ? chunks : [{ content: text.trim(), chunk_index: 0 }]
}
