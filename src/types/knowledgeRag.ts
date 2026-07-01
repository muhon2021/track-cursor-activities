export type ChunkStrategy = 'fixed' | 'sentence-window' | 'heading-aware' | 'parent-child'
export type RerankerProvider = 'cohere' | 'voyage' | 'bge' | 'custom'
export type KbPermission = 'view' | 'edit' | 'cite' | 'sync' | 'delete'
export type ReembedJobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed'

export interface KbSourceConfigRow {
  id: string
  source_id: string
  chunk_size: number
  chunk_overlap: number
  chunk_strategy: ChunkStrategy
  strategy_config: Record<string, unknown>
  reranker_provider: RerankerProvider | null
  reranker_threshold: number
  reranker_max_results: number
  reranker_enabled: boolean
  reranker_override_global: boolean
  created_at: string
  updated_at: string
}

export interface GlobalRerankerSettings {
  reranker_provider: RerankerProvider
  reranker_threshold: number
  reranker_max_results: number
  reranker_enabled: boolean
}

export interface ChunkPreviewResult {
  estimated_chunks: number
  estimated_cost: number
  preview: { chunk_index: number; content: string; metadata: Record<string, unknown> }[]
}

export interface RagPlaygroundResult {
  retrieved_chunks: {
    chunk_id: string
    content: string
    source: string
    similarity_score: number
    rerank_score?: number
  }[]
  reranked_results: { chunk_id: string; original_score: number; reranked_score?: number }[]
  answer?: string
  citations: { chunk_id: string; index: number }[]
  metrics: {
    retrieval_latency_ms: number
    rerank_latency_ms: number
    generation_latency_ms: number
    total_latency_ms: number
    total_cost: number
  }
  run_id?: string
}

export interface KbReembedJob {
  id: string
  source_id: string
  status: ReembedJobStatus
  total_documents: number
  processed_documents: number
  failed_documents: number
  error: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface KbSourcePermissionRow {
  id: string
  source_id: string
  app_role: 'admin' | 'moderator' | 'user' | null
  role_id: string | null
  pod_id: string | null
  department_id: string | null
  permissions: KbPermission[]
}

export interface AdminUserMemory {
  id: string
  agent_id: string
  user_id: string
  memory_type: string
  memory_category: string | null
  content: string
  importance_score: number | null
  confidence_score: number | null
  source: string | null
  created_at: string
  user_email: string | null
  department_name: string | null
}
