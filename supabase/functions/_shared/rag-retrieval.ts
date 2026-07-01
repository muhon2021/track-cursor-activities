import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateEmbedding } from './ai-provider-routing.ts'
import { rerankDocuments, type RerankResult } from './reranker.ts'
import { resolveRerankerConfig } from './kb-source-config.ts'

export interface RetrievalMatch {
  id: string
  entity_type: string
  entity_id: string
  content: string
  metadata: unknown
  user_id: string | null
  similarity: number
  rerank_score?: number
  unified_document_id?: string | null
  project_name?: string | null
  project_manager?: string | null
  client_name?: string | null
}

export interface RetrievalOptions {
  query: string
  match_threshold?: number
  match_count?: number
  entity_type?: string | null
  user_id?: string | null
  source_id?: string | null
  project_name?: string | null
  project_manager?: string | null
  client_name?: string | null
  skip_rerank?: boolean
  model_id?: string
  /** When set with features.enableGraphify, delegates to performGraphAwareRetrieval */
  graphify?: {
    enabled?: boolean
    tenant_id?: string
    depth?: number
    seed_entity_types?: string[] | null
    max_nodes?: number
  }
}

export interface RetrievalResponse {
  results: RetrievalMatch[]
  retrieval_latency_ms: number
  rerank_latency_ms: number
  rerank_cost: number
  reranked: boolean
}

export async function performRetrieval(
  supabase: SupabaseClient,
  options: RetrievalOptions
): Promise<RetrievalResponse> {
  const retrievalStart = Date.now()
  const match_threshold = options.match_threshold ?? 0.5
  const match_count = options.match_count ?? 10
  const candidateCount = match_count * 3

  const embeddingResult = await generateEmbedding(supabase, options.query, options.model_id)
  const embedding = embeddingResult.embedding

  const hasAdminFilters =
    (options.project_name != null && String(options.project_name).trim() !== '') ||
    (options.project_manager != null && String(options.project_manager).trim() !== '') ||
    (options.client_name != null && String(options.client_name).trim() !== '')

  let rawResults: RetrievalMatch[]

  if (hasAdminFilters) {
    const { data, error } = await supabase.rpc('match_embeddings_admin', {
      query_embedding: embedding,
      match_threshold,
      match_count: candidateCount,
      filter_entity_type: options.entity_type || null,
      filter_user_id: options.user_id || null,
      filter_project_name: options.project_name?.trim() || null,
      filter_project_manager: options.project_manager?.trim() || null,
      filter_client_name: options.client_name?.trim() || null,
    })
    if (error) throw error
    rawResults = (data ?? []) as RetrievalMatch[]
  } else {
    const { data, error } = await supabase.rpc('match_embeddings', {
      query_embedding: embedding,
      match_threshold,
      match_count: candidateCount,
      filter_entity_type: options.entity_type || null,
      filter_user_id: options.user_id || null,
    })
    if (error) throw error
    rawResults = ((data ?? []) as RetrievalMatch[]).map((r) => ({
      ...r,
      project_name: null,
      project_manager: null,
      client_name: null,
    }))
  }

  const retrieval_latency_ms = Date.now() - retrievalStart
  let rerank_latency_ms = 0
  let rerank_cost = 0
  let reranked = false
  let results: RetrievalMatch[] = rawResults.slice(0, match_count)

  if (!options.skip_rerank && rawResults.length > 0) {
    const rerankConfig = await resolveRerankerConfig(supabase, options.source_id)
    if (rerankConfig.enabled) {
      const rerankResponse = await rerankDocuments(
        rawResults.map((r) => ({
          id: r.id,
          content: r.content,
          similarity: r.similarity,
          metadata: (r.metadata as Record<string, unknown>) ?? {},
        })),
        {
          provider: rerankConfig.provider,
          threshold: rerankConfig.threshold,
          maxResults: rerankConfig.max_results,
          query: options.query,
        }
      )
      rerank_latency_ms = rerankResponse.latency_ms
      rerank_cost = rerankResponse.cost
      reranked = true
      results = rerankResponse.results.map((rr: RerankResult) => {
        const original = rawResults.find((r) => r.id === rr.id)!
        return { ...original, similarity: rr.similarity, rerank_score: rr.rerank_score }
      })
    }
  }

  if (!reranked) {
    results = rawResults.slice(0, match_count)
  }

  return {
    results,
    retrieval_latency_ms,
    rerank_latency_ms,
    rerank_cost,
    reranked,
  }
}

export async function logVectorSearch(
  supabase: SupabaseClient,
  params: {
    user_id?: string | null
    query: string
    result_count: number
    top_score?: number
    duration_ms: number
    search_type?: string
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  await supabase.from('vector_search_logs').insert({
    user_id: params.user_id ?? null,
    query: params.query,
    result_count: params.result_count,
    top_score: params.top_score ?? null,
    duration_ms: params.duration_ms,
    search_type: params.search_type ?? 'semantic',
    metadata: params.metadata ?? {},
  })
}
