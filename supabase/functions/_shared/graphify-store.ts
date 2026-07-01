import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  DEFAULT_TENANT_ID,
  type GraphEntity,
  type GraphifyConfig,
  type GraphNeighbor,
  type GraphRelationship,
  type TraversalNode,
  type UpsertEntityInput,
  type UpsertRelationshipInput,
  normalizeAlias,
  toCanonicalName,
} from './graphify-types.ts'
import {
  getCachedTraversal,
  setCachedTraversal,
} from './graphify-traverse-cache.ts'

export async function isGraphifyFeatureEnabled(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'features.enableGraphify')
    .maybeSingle()
  if (!data?.value) return false
  const val = data.value
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return ['true', '1', 'yes'].includes(val.toLowerCase())
  return false
}

export async function getGraphifyConfig(
  supabase: SupabaseClient,
  tenantId: string = DEFAULT_TENANT_ID
): Promise<GraphifyConfig> {
  const { data, error } = await supabase
    .from('graphify_config')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw error

  if (data) return data as GraphifyConfig

  return {
    id: '',
    tenant_id: tenantId,
    enabled: false,
    max_traversal_depth: 2,
    max_nodes_per_query: 50,
    entity_extraction_enabled: false,
    auto_sync_fk_relationships: true,
    context_merge_strategy: 'graph_first',
    token_budget: 8000,
    metadata: {},
  }
}

export async function upsertEntity(
  supabase: SupabaseClient,
  input: UpsertEntityInput
): Promise<GraphEntity> {
  const tenantId = input.tenant_id ?? DEFAULT_TENANT_ID
  const canonical = toCanonicalName(input.canonical_name)
  const display = input.display_name ?? canonical

  let existing: GraphEntity | null = null

  if (input.source_table && input.source_id) {
    const { data } = await supabase
      .from('graph_entities')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('source_table', input.source_table)
      .eq('source_id', input.source_id)
      .eq('entity_type', input.entity_type)
      .eq('status', 'active')
      .maybeSingle()
    existing = data as GraphEntity | null
  }

  const payload = {
    tenant_id: tenantId,
    entity_type: input.entity_type,
    canonical_name: canonical,
    display_name: display,
    source_table: input.source_table ?? null,
    source_id: input.source_id ?? null,
    metadata: input.metadata ?? {},
    confidence: input.confidence ?? 1.0,
    status: 'active',
    created_by: input.created_by ?? null,
    version: existing ? (existing.version ?? 1) + 1 : 1,
  }

  let entity: GraphEntity

  if (existing?.id) {
    const { data, error } = await supabase
      .from('graph_entities')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw error
    entity = data as GraphEntity
  } else {
    const { data, error } = await supabase
      .from('graph_entities')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error
    entity = data as GraphEntity
  }

  if (input.aliases?.length) {
    for (const alias of input.aliases) {
      await upsertAlias(supabase, tenantId, entity.id, alias, 'sync')
    }
  }

  return entity
}

export async function upsertAlias(
  supabase: SupabaseClient,
  tenantId: string,
  entityId: string,
  alias: string,
  source = 'manual'
): Promise<void> {
  const normalized = normalizeAlias(alias)
  if (!normalized) return

  await supabase.from('graph_entity_aliases').upsert(
    {
      tenant_id: tenantId,
      entity_id: entityId,
      alias: alias.trim(),
      normalized_alias: normalized,
      source,
    },
    { onConflict: 'tenant_id,normalized_alias,entity_id', ignoreDuplicates: true }
  )
}

export async function getEntityBySource(
  supabase: SupabaseClient,
  tenantId: string,
  sourceTable: string,
  sourceId: string,
  entityType?: string
): Promise<GraphEntity | null> {
  let query = supabase
    .from('graph_entities')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('source_table', sourceTable)
    .eq('source_id', sourceId)
    .eq('status', 'active')

  if (entityType) query = query.eq('entity_type', entityType)

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data as GraphEntity | null
}

export async function resolveAlias(
  supabase: SupabaseClient,
  tenantId: string,
  name: string,
  entityType?: string
): Promise<GraphEntity | null> {
  const normalized = normalizeAlias(name)

  const { data: aliasRow } = await supabase
    .from('graph_entity_aliases')
    .select('entity_id')
    .eq('tenant_id', tenantId)
    .eq('normalized_alias', normalized)
    .limit(1)
    .maybeSingle()

  if (aliasRow?.entity_id) {
    const { data } = await supabase
      .from('graph_entities')
      .select('*')
      .eq('id', aliasRow.entity_id)
      .eq('status', 'active')
      .maybeSingle()
    return data as GraphEntity | null
  }

  let query = supabase
    .from('graph_entities')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .ilike('canonical_name', name.trim())

  if (entityType) query = query.eq('entity_type', entityType)

  const { data } = await query.limit(1).maybeSingle()
  return data as GraphEntity | null
}

export async function upsertRelationship(
  supabase: SupabaseClient,
  input: UpsertRelationshipInput
): Promise<GraphRelationship | null> {
  if (input.source_entity_id === input.target_entity_id) return null

  const tenantId = input.tenant_id ?? DEFAULT_TENANT_ID

  const { data: existing } = await supabase
    .from('graph_relationships')
    .select('id')
    .eq('source_entity_id', input.source_entity_id)
    .eq('target_entity_id', input.target_entity_id)
    .eq('relationship_type', input.relationship_type)
    .eq('status', 'active')
    .maybeSingle()

  const payload = {
    tenant_id: tenantId,
    source_entity_id: input.source_entity_id,
    target_entity_id: input.target_entity_id,
    relationship_type: input.relationship_type,
    weight: input.weight ?? 0.5,
    confidence: input.confidence ?? 1.0,
    metadata: input.metadata ?? {},
    source_table: input.source_table ?? null,
    source_id: input.source_id ?? null,
    status: 'active',
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from('graph_relationships')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw error
    return data as GraphRelationship
  }

  const { data, error } = await supabase
    .from('graph_relationships')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  return data as GraphRelationship
}

export async function matchEntities(
  supabase: SupabaseClient,
  tenantId: string,
  query: string,
  entityTypes?: string[] | null,
  limit = 20,
  callerUserId?: string | null
) {
  const { data, error } = await supabase.rpc('graphify_match_entities', {
    p_tenant_id: tenantId,
    p_query: query,
    p_entity_types: entityTypes?.length ? entityTypes : null,
    p_limit: limit,
    p_caller_user_id: callerUserId ?? null,
  })
  if (error) throw error
  return data ?? []
}

export async function traverseGraph(
  supabase: SupabaseClient,
  tenantId: string,
  seedEntityIds: string[],
  options: {
    maxDepth?: number
    relationshipTypes?: string[] | null
    maxNodes?: number
    userId?: string | null
    skipCache?: boolean
  } = {}
): Promise<TraversalNode[]> {
  if (!seedEntityIds.length) return []

  const cacheOpts = {
    tenantId,
    userId: options.userId,
    seedEntityIds,
    maxDepth: options.maxDepth ?? 2,
    relationshipTypes: options.relationshipTypes ?? null,
    maxNodes: options.maxNodes ?? 50,
  }

  if (!options.skipCache) {
    const cached = await getCachedTraversal(supabase, cacheOpts)
    if (cached) return cached
  }

  const { data, error } = await supabase.rpc('graphify_traverse', {
    p_tenant_id: tenantId,
    p_seed_entity_ids: seedEntityIds,
    p_max_depth: options.maxDepth ?? 2,
    p_relationship_types: options.relationshipTypes?.length ? options.relationshipTypes : null,
    p_max_nodes: options.maxNodes ?? 50,
    p_caller_user_id: options.userId ?? null,
  })
  if (error) throw error
  const nodes = (data ?? []) as TraversalNode[]

  if (!options.skipCache) {
    await setCachedTraversal(supabase, cacheOpts, nodes)
  }

  return nodes
}

export async function getEntityNeighbors(
  supabase: SupabaseClient,
  entityId: string,
  options: {
    direction?: 'out' | 'in' | 'both'
    relationshipTypes?: string[] | null
    limit?: number
  } = {}
): Promise<GraphNeighbor[]> {
  const { data, error } = await supabase.rpc('graphify_entity_neighbors', {
    p_entity_id: entityId,
    p_direction: options.direction ?? 'both',
    p_relationship_types: options.relationshipTypes?.length ? options.relationshipTypes : null,
    p_limit: options.limit ?? 20,
  })
  if (error) throw error
  return (data ?? []) as GraphNeighbor[]
}

export async function linkMemoryToEntity(
  supabase: SupabaseClient,
  tenantId: string,
  memoryId: string,
  entityId: string,
  linkType: 'mentions' | 'about' | 'derived_from' = 'about',
  confidence = 0.8
): Promise<void> {
  await supabase.from('graph_memory_links').upsert(
    {
      tenant_id: tenantId,
      memory_id: memoryId,
      entity_id: entityId,
      link_type: linkType,
      confidence,
    },
    { onConflict: 'memory_id,entity_id,link_type', ignoreDuplicates: false }
  )
}

export async function logGraphQuery(
  supabase: SupabaseClient,
  params: {
    tenant_id?: string
    user_id?: string | null
    query?: string | null
    query_type: string
    latency_ms: number
    nodes_returned?: number
    edges_traversed?: number
    tokens_saved?: number | null
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  await supabase.from('graph_query_logs').insert({
    tenant_id: params.tenant_id ?? DEFAULT_TENANT_ID,
    user_id: params.user_id ?? null,
    query: params.query ?? null,
    query_type: params.query_type,
    latency_ms: params.latency_ms,
    nodes_returned: params.nodes_returned ?? 0,
    edges_traversed: params.edges_traversed ?? 0,
    tokens_saved: params.tokens_saved ?? null,
    metadata: params.metadata ?? {},
  })
}

export async function getGraphStats(supabase: SupabaseClient, tenantId: string) {
  const [entities, relationships, orphanRpc] = await Promise.all([
    supabase.from('graph_entities').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'active'),
    supabase.from('graph_relationships').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'active'),
    supabase.rpc('graphify_count_orphans', { p_tenant_id: tenantId }),
  ])

  let orphanCount = 0
  if (!orphanRpc.error && orphanRpc.data != null) {
    orphanCount = Number(orphanRpc.data)
  } else {
    const { data: entityIds } = await supabase
      .from('graph_entities')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .limit(5000)

    if (entityIds?.length) {
      const ids = entityIds.map((e: { id: string }) => e.id)
      const { data: connected } = await supabase
        .from('graph_relationships')
        .select('source_entity_id, target_entity_id')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .or(`source_entity_id.in.(${ids.join(',')}),target_entity_id.in.(${ids.join(',')})`)

      const connectedSet = new Set<string>()
      for (const row of connected ?? []) {
        connectedSet.add(row.source_entity_id)
        connectedSet.add(row.target_entity_id)
      }
      orphanCount = ids.filter((id) => !connectedSet.has(id)).length
    }
  }

  return {
    entity_count: entities.count ?? 0,
    relationship_count: relationships.count ?? 0,
    orphan_count: orphanCount,
  }
}
