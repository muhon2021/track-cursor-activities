/**
 * Graphify client API helpers
 */
import { invokeEdgeFunction } from '@/lib/edge-functions'

export interface GraphEntityResult {
  id: string
  entity_type: string
  canonical_name: string
  display_name: string
  source_table?: string | null
  source_id?: string | null
  metadata?: Record<string, unknown>
  confidence?: number
  match_score?: number
}

export interface GraphNeighbor {
  relationship_id: string
  relationship_type: string
  direction: string
  neighbor_id: string
  neighbor_type: string
  neighbor_name: string
  weight: number
  confidence: number
}

export interface GraphSearchResponse {
  entities: GraphEntityResult[]
  context_nodes?: Array<{
    entity_id: string
    entity_type: string
    display_name: string
    depth: number
  }>
  latency_ms?: number
}

export interface GraphifyConfigRow {
  id: string
  tenant_id: string
  enabled: boolean
  max_traversal_depth: number
  max_nodes_per_query: number
  entity_extraction_enabled: boolean
  auto_sync_fk_relationships: boolean
  context_merge_strategy: string
  token_budget: number
}

export async function graphSearch(
  query: string,
  filters?: { entity_types?: string[]; depth?: number; limit?: number; suggest?: boolean }
): Promise<GraphSearchResponse> {
  return invokeEdgeFunction('graphify-query', {
    mode: 'search',
    query,
    entity_types: filters?.entity_types,
    depth: filters?.depth,
    limit: filters?.limit ?? 20,
    suggest: filters?.suggest ?? false,
  })
}

export interface GraphTraversalNode {
  entity_id: string
  entity_type: string
  display_name: string
  source_table: string | null
  source_id: string | null
  depth: number
  path: string[]
}

export async function graphTraverse(
  entityIds: string[],
  opts?: {
    query?: string
    depth?: number
    relationship_types?: string[]
    entity_types?: string[]
    limit?: number
  }
): Promise<{ nodes: GraphTraversalNode[]; seed_ids: string[]; latency_ms?: number }> {
  return invokeEdgeFunction('graphify-query', {
    mode: 'traverse',
    entity_ids: entityIds.length > 0 ? entityIds : undefined,
    query: opts?.query,
    entity_types: opts?.entity_types,
    relationship_types: opts?.relationship_types,
    depth: opts?.depth,
    limit: opts?.limit,
  })
}

export async function graphNeighbors(
  entityId: string,
  opts?: { direction?: 'out' | 'in' | 'both'; limit?: number }
): Promise<{ neighbors: GraphNeighbor[] }> {
  return invokeEdgeFunction('graphify-query', {
    mode: 'neighbors',
    entity_id: entityId,
    direction: opts?.direction ?? 'both',
    limit: opts?.limit ?? 20,
  })
}

export async function graphEntitySummary(entityId: string): Promise<{
  entity: GraphEntityResult
  neighbors: GraphNeighbor[]
  neighbor_count: number
}> {
  return invokeEdgeFunction('graphify-query', {
    mode: 'summary',
    entity_id: entityId,
  })
}

export async function graphContext(query: string): Promise<GraphSearchResponse> {
  return graphSearch(query, { depth: 2, limit: 10 })
}

export async function graphPath(fromEntityId: string, toEntityId: string): Promise<{
  found: boolean
  path: string[]
}> {
  return invokeEdgeFunction('graphify-query', {
    mode: 'path',
    from_entity_id: fromEntityId,
    to_entity_id: toEntityId,
  })
}

export async function runGraphifyBackfill(): Promise<{ success: boolean; job_id: string }> {
  return invokeEdgeFunction('graphify-backfill', {})
}

export async function runGraphifyRelationshipSync(opts?: {
  links_only?: boolean
  phase?: 'all' | 'users' | 'crm' | 'meetings' | 'tasks'
}): Promise<{ success: boolean; job_id: string; relationships_synced?: number }> {
  return invokeEdgeFunction('graphify-sync-relationships', {
    links_only: opts?.links_only ?? true,
    phase: opts?.phase ?? 'all',
  })
}

/** Run relationship sync in phases (faster, avoids edge function timeouts) */
export async function runGraphifyRelationshipSyncPhased(): Promise<{
  success: boolean
  relationships_synced: number
}> {
  const phases = ['users', 'crm', 'meetings', 'tasks'] as const
  let total = 0
  for (const phase of phases) {
    const res = await runGraphifyRelationshipSync({ links_only: true, phase })
    total += res.relationships_synced ?? 0
  }
  return { success: true, relationships_synced: total }
}

export async function fetchGraphifyStats(): Promise<{
  stats: { entity_count: number; relationship_count: number; orphan_count: number }
  config: GraphifyConfigRow
}> {
  return invokeEdgeFunction('graphify-query', { mode: 'stats' })
}

export interface GraphifyAnalyticsData {
  period_days: number
  summary: {
    entity_count: number
    relationship_count: number
    orphan_count: number
    query_count: number
    avg_latency_ms: number
    total_tokens_saved: number
    context_queries: number
  }
  entity_growth: Array<{ date: string; count: number; cumulative: number }>
  entities_by_type: Array<{ entity_type: string; count: number }>
  top_topics: Array<{ id: string; name: string; mention_count: number }>
  query_volume: Array<{ date: string; count: number }>
  query_by_type: Array<{ query_type: string; count: number }>
  orphan_samples: Array<{ id: string; display_name: string; entity_type: string }>
}

export async function fetchGraphifyAnalytics(days = 30): Promise<GraphifyAnalyticsData> {
  const res = await invokeEdgeFunction<{ success: boolean; analytics: GraphifyAnalyticsData }>(
    'graphify-analytics',
    { days }
  )
  return res.analytics
}

export type CoverageSuggestionAction =
  | 'run_relationship_sync'
  | 'run_backfill'
  | 're_embed_meetings'
  | 're_embed_knowledge'
  | 'enable_entity_extraction'
  | 'review_orphans'

export interface GraphifyCoverageData {
  health_score: number
  health_grade: 'excellent' | 'good' | 'fair' | 'poor'
  health_factors: Array<{ factor: string; score: number; max: number; detail: string }>
  orphan_count: number
  orphans: Array<{
    id: string
    display_name: string
    entity_type: string
    source_table: string | null
  }>
  sparse_topic_count: number
  sparse_topics: Array<{ id: string; name: string; mention_count: number }>
  coverage_gaps: {
    unembedded_meetings: number
    pending_knowledge_entries: number
    failed_knowledge_entries: number
    entities_without_source: number
  }
  suggestions: Array<{
    id: string
    priority: 'high' | 'medium' | 'low'
    action: CoverageSuggestionAction
    title: string
    description: string
    count?: number
  }>
  last_sync_at: string | null
  entity_count: number
  relationship_count: number
}

export async function fetchGraphifyCoverage(): Promise<GraphifyCoverageData> {
  const res = await invokeEdgeFunction<{ success: boolean; coverage: GraphifyCoverageData }>(
    'graphify-coverage',
    {}
  )
  return res.coverage
}

export async function triggerReEmbedMeetings(batchSize = 10): Promise<{ processed_count: number }> {
  return invokeEdgeFunction('auto-embed-meetings', { batch_size: batchSize })
}

export async function triggerReEmbedKnowledge(): Promise<{ processed_count: number }> {
  return invokeEdgeFunction('auto-embed-knowledge-entry', { batch_mode: true })
}
