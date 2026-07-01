import type { ChunkResult } from './types.ts'

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function chunkSentenceWindow(
  text: string,
  opts: { chunkSize: number; sentencesBefore: number; sentencesAfter: number }
): ChunkResult[] {
  const sentences = splitSentences(text)
  if (sentences.length === 0) {
    return [{ content: text.trim(), chunk_index: 0 }]
  }

  const chunks: ChunkResult[] = []
  const window = opts.sentencesBefore + opts.sentencesAfter + 1

  for (let i = 0; i < sentences.length; i += Math.max(1, opts.sentencesAfter + 1)) {
    const start = Math.max(0, i - opts.sentencesBefore)
    const end = Math.min(sentences.length, i + opts.sentencesAfter + 1)
    const content = sentences.slice(start, end).join(' ').trim()
    if (!content) continue

    if (content.length > opts.chunkSize) {
      let subStart = 0
      while (subStart < content.length) {
        chunks.push({
          content: content.slice(subStart, subStart + opts.chunkSize),
          chunk_index: chunks.length,
        })
        subStart += opts.chunkSize
      }
    } else {
      chunks.push({ content, chunk_index: chunks.length })
    }
  }

  return chunks.length > 0 ? chunks : [{ content: text.trim(), chunk_index: 0 }]
}
