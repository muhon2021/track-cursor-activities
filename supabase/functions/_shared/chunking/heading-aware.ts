import type { ChunkResult } from './types.ts'

export function chunkHeadingAware(
  text: string,
  opts: { chunkSize: number; overlap: number }
): ChunkResult[] {
  const sections: { heading: string; level: number; body: string }[] = []
  const lines = text.split('\n')
  let currentHeading = ''
  let currentLevel = 0
  let bodyLines: string[] = []

  const flush = () => {
    const body = bodyLines.join('\n').trim()
    if (currentHeading || body) {
      sections.push({ heading: currentHeading, level: currentLevel, body })
    }
    bodyLines = []
  }

  for (const line of lines) {
    const match = line.match(/^(#{1,3})\s+(.+)$/)
    if (match) {
      flush()
      currentHeading = match[2].trim()
      currentLevel = match[1].length
    } else {
      bodyLines.push(line)
    }
  }
  flush()

  const chunks: ChunkResult[] = []
  for (const section of sections) {
    const prefix = section.heading ? `${'#'.repeat(section.level || 1)} ${section.heading}\n\n` : ''
    const full = (prefix + section.body).trim()
    if (!full) continue

    if (full.length <= opts.chunkSize) {
      chunks.push({
        content: full,
        chunk_index: chunks.length,
        metadata: { heading: section.heading || null },
      })
    } else {
      let start = 0
      while (start < full.length) {
        chunks.push({
          content: full.slice(start, start + opts.chunkSize),
          chunk_index: chunks.length,
          metadata: { heading: section.heading || null },
        })
        start += Math.max(1, opts.chunkSize - opts.overlap)
      }
    }
  }

  return chunks.length > 0 ? chunks : [{ content: text.trim(), chunk_index: 0 }]
}
