export interface ChunkResult {
  content: string
  chunk_index: number
  metadata?: Record<string, unknown>
}

export interface ChunkingConfig {
  chunk_size?: number
  chunk_overlap?: number
  chunk_strategy?: string
  strategy_config?: Record<string, unknown>
}

export type ChunkStrategy = 'fixed' | 'sentence-window' | 'heading-aware' | 'parent-child'
