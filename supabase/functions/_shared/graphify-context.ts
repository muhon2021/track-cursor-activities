import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { performRetrieval, type RetrievalMatch, type RetrievalOptions, type RetrievalResponse } from './rag-retrieval.ts'
import { DEFAULT_TENANT_ID } from './graphify-types.ts'
import {
  getGraphifyConfig,
  isGraphifyFeatureEnabled,
  logGraphQuery,
  matchEntities,
  traverseGraph,
} from './graphify-store.ts'

export interface GraphifyRetrievalOptions extends RetrievalOptions {
  graphify?: {
    enabled?: boolean
    tenant_id?: string
    depth?: number
    seed_entity_types?: string[] | null
    max_nodes?: number
    /** User-scoped client for graph RPCs (auth.uid()). Required for match/traverse. */
    auth_client?: SupabaseClient
  }
  user_id?: string | null
}

export interface GraphAwareRetrievalResponse extends RetrievalResponse {
  graph_context: string
  graph_entities: Array<{
    entity_id: string
    entity_type: string
    display_name: string
    depth: number
  }>
  graph_latency_ms: number
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function formatGraphContext(
  entities: Array<{ entity_type: string; display_name: string; depth: number; source_table?: string | null }>,
  neighborCounts: Map<string, number>
): string {
  if (entities.length === 0) return ''

  const lines = entities.slice(0, 15).map((e) => {
    const neighbors = neighborCounts.get(e.display_name) ?? 0
    const suffix = neighbors > 0 ? ` (${neighbors} connections)` : ''
    return `- ${e.entity_type}: ${e.display_name}${suffix}`
  })

  return `[Graph Context]\n${lines.join('\n')}`
}

function rankResultsWithGraphBoost(
  results: RetrievalMatch[],
  linkedSourceIds: Set<string>,
  graphEntityTypes: Map<string, string>
): RetrievalMatch[] {
  return [...results].sort((a, b) => {
    const aLinked = linkedSourceIds.has(a.entity_id) ? 0.15 : 0
    const bLinked = linkedSourceIds.has(b.entity_id) ? 0.15 : 0
    const aScore = (a.rerank_score ?? a.similarity) + aLinked
    const bScore = (b.rerank_score ?? b.similarity) + bLinked
    return bScore - aScore
  })
}

export async function performGraphAwareRetrieval(
  supabase: SupabaseClient,
  options: GraphifyRetrievalOptions
): Promise<GraphAwareRetrievalResponse> {
  const graphStart = Date.now()
  const tenantId = options.graphify?.tenant_id ?? DEFAULT_TENANT_ID

  const featureEnabled = await isGraphifyFeatureEnabled(supabase)
  const config = await getGraphifyConfig(supabase, tenantId)
  const useGraph = featureEnabled && config.enabled && options.graphify?.enabled !== false

  if (!useGraph) {
    const base = await performRetrieval(supabase, options)
    return {
      ...base,
      graph_context: '',
      graph_entities: [],
      graph_latency_ms: 0,
    }
  }

  const depth = options.graphify?.depth ?? config.max_traversal_depth
  const maxNodes = options.graphify?.max_nodes ?? config.max_nodes_per_query
  const graphDb = options.graphify?.auth_client ?? supabase
  const callerUserId = options.user_id ?? null

  const matched = await matchEntities(
    graphDb,
    tenantId,
    options.query,
    options.graphify?.seed_entity_types ?? null,
    10,
    callerUserId
  )

  const seedIds = (matched as Array<{ id: string }>).map((m) => m.id)

  let traversed: Array<{
    entity_id: string
    entity_type: string
    display_name: string
    source_table: string | null
    source_id: string | null
    depth: number
  }> = []

  if (seedIds.length > 0) {
    traversed = await traverseGraph(graphDb, tenantId, seedIds, {
      maxDepth: depth,
      maxNodes,
      userId: options.user_id ?? null,
    })
  }

  const linkedSourceIds = new Set<string>()
  for (const node of traversed) {
    if (node.source_id) linkedSourceIds.add(node.source_id)
  }
  for (const m of matched as Array<{ source_id?: string | null }>) {
    if (m.source_id) linkedSourceIds.add(m.source_id)
  }

  const neighborCounts = new Map<string, number>()
  for (const node of traversed) {
    neighborCounts.set(node.display_name, (neighborCounts.get(node.display_name) ?? 0) + 1)
  }

  const graph_context = formatGraphContext(traversed, neighborCounts)
  const graph_latency_ms = Date.now() - graphStart

  const base = await performRetrieval(supabase, options)

  let results = base.results
  if (linkedSourceIds.size > 0) {
    results = rankResultsWithGraphBoost(results, linkedSourceIds, new Map())
  }

  const tokenBudget = config.token_budget
  const graphContextTokens = estimateTokens(graph_context)
  const fullResultTokens = base.results.reduce((sum, r) => sum + estimateTokens(r.content), 0)

  let tokenCount = graphContextTokens
  const trimmed: RetrievalMatch[] = []
  for (const r of base.results) {
    const chunkTokens = estimateTokens(r.content)
    if (tokenCount + chunkTokens > tokenBudget) break
    tokenCount += chunkTokens
    trimmed.push(r)
  }
  results = trimmed.length > 0 ? trimmed : base.results.slice(0, Math.min(5, base.results.length))

  const finalResultTokens = results.reduce((sum, r) => sum + estimateTokens(r.content), 0)
  const hypotheticalTokens = graphContextTokens + fullResultTokens
  const actualTokens = graphContextTokens + finalResultTokens
  const tokensSaved = Math.max(0, hypotheticalTokens - actualTokens)

  await logGraphQuery(supabase, {
    tenant_id: tenantId,
    user_id: options.user_id ?? null,
    query: options.query,
    query_type: 'context',
    latency_ms: graph_latency_ms,
    nodes_returned: traversed.length,
    edges_traversed: Math.max(0, traversed.length - seedIds.length),
    tokens_saved: tokensSaved,
    metadata: {
      vector_results: results.length,
      seeds: seedIds.length,
      graph_context_tokens: graphContextTokens,
      result_tokens: finalResultTokens,
    },
  })

  return {
    ...base,
    results,
    graph_context,
    graph_entities: traversed.map((n) => ({
      entity_id: n.entity_id,
      entity_type: n.entity_type,
      display_name: n.display_name,
      depth: n.depth,
    })),
    graph_latency_ms,
  }
}

export async function buildGraphContextForQuery(
  supabase: SupabaseClient,
  query: string,
  tenantId: string = DEFAULT_TENANT_ID,
  userId?: string | null
): Promise<{ context: string; entities: GraphAwareRetrievalResponse['graph_entities'] }> {
  const result = await performGraphAwareRetrieval(supabase, {
    query,
    match_count: 0,
    skip_rerank: true,
    user_id: userId,
    graphify: { enabled: true, tenant_id: tenantId },
  })
  return { context: result.graph_context, entities: result.graph_entities }
}
