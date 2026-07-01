import type { ChunkResult, ChunkingConfig, ChunkStrategy } from './types.ts'

export type { ChunkResult, ChunkingConfig, ChunkStrategy } from './types.ts'

export { chunkFixed } from './fixed.ts'
export { chunkSentenceWindow } from './sentence-window.ts'
export { chunkHeadingAware } from './heading-aware.ts'
export { chunkParentChild } from './parent-child.ts'

import { chunkFixed } from './fixed.ts'
import { chunkSentenceWindow } from './sentence-window.ts'
import { chunkHeadingAware } from './heading-aware.ts'
import { chunkParentChild } from './parent-child.ts'

export function chunkText(text: string, config: ChunkingConfig = {}): ChunkResult[] {
  const strategy = (config.chunk_strategy ?? 'fixed') as ChunkStrategy
  const chunkSize = config.chunk_size ?? 1000
  const overlap = config.chunk_overlap ?? 100
  const strategyConfig = config.strategy_config ?? {}

  switch (strategy) {
    case 'sentence-window':
      return chunkSentenceWindow(text, {
        chunkSize,
        sentencesBefore: Number(strategyConfig.sentences_before ?? 2),
        sentencesAfter: Number(strategyConfig.sentences_after ?? 2),
      })
    case 'heading-aware':
      return chunkHeadingAware(text, { chunkSize, overlap })
    case 'parent-child':
      return chunkParentChild(text, { chunkSize, overlap, strategyConfig })
    case 'fixed':
    default:
      return chunkFixed(text, { chunkSize, overlap })
  }
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function estimateEmbeddingCost(
  chunkCount: number,
  avgChunkChars: number,
  costPer1kTokens = 0.00002
): number {
  const tokens = chunkCount * Math.ceil(avgChunkChars / 4)
  return (tokens / 1000) * costPer1kTokens
}
