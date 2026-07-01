import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DEFAULT_TENANT_ID } from './graphify-types.ts'
import { getGraphStats } from './graphify-store.ts'

export interface GraphifyAnalyticsResult {
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

function dateKey(iso: string): string {
  return iso.slice(0, 10)
}

function buildDailySeries(
  rows: Array<{ created_at: string }>,
  days: number
): Array<{ date: string; count: number; cumulative: number }> {
  const counts = new Map<string, number>()
  const start = new Date()
  start.setUTCDate(start.getUTCDate() - days + 1)
  start.setUTCHours(0, 0, 0, 0)

  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    counts.set(d.toISOString().slice(0, 10), 0)
  }

  for (const row of rows) {
    const key = dateKey(row.created_at)
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  let cumulative = 0
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => {
      cumulative += count
      return { date, count, cumulative }
    })
}

export async function getGraphifyAnalytics(
  supabase: SupabaseClient,
  tenantId: string = DEFAULT_TENANT_ID,
  days = 30
): Promise<GraphifyAnalyticsResult> {
  const periodDays = Math.min(Math.max(1, days), 90)
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - periodDays)
  const sinceIso = since.toISOString()

  const [stats, entitiesRes, relationshipsRes, logsRes, topicsRes] = await Promise.all([
    getGraphStats(supabase, tenantId),
    supabase
      .from('graph_entities')
      .select('id, entity_type, display_name, created_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true }),
    supabase
      .from('graph_relationships')
      .select('source_entity_id, target_entity_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),
    supabase
      .from('graph_query_logs')
      .select('query_type, latency_ms, tokens_saved, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase
      .from('graph_entities')
      .select('id, display_name')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .eq('entity_type', 'Topic')
      .order('updated_at', { ascending: false })
      .limit(50),
  ])

  const entities = entitiesRes.data ?? []
  const relationships = relationshipsRes.data ?? []
  const logs = logsRes.data ?? []
  const topics = topicsRes.data ?? []

  const typeCounts = new Map<string, number>()
  for (const e of entities) {
    typeCounts.set(e.entity_type, (typeCounts.get(e.entity_type) ?? 0) + 1)
  }

  const { data: allTypes } = await supabase
    .from('graph_entities')
    .select('entity_type')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')

  const allTypeCounts = new Map<string, number>()
  for (const row of allTypes ?? []) {
    allTypeCounts.set(row.entity_type, (allTypeCounts.get(row.entity_type) ?? 0) + 1)
  }

  const connected = new Set<string>()
  for (const rel of relationships) {
    connected.add(rel.source_entity_id)
    connected.add(rel.target_entity_id)
  }

  const { data: allEntityIds } = await supabase
    .from('graph_entities')
    .select('id, display_name, entity_type')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .limit(5000)

  const orphanSamples = (allEntityIds ?? [])
    .filter((e) => !connected.has(e.id))
    .slice(0, 10)
    .map((e) => ({
      id: e.id,
      display_name: e.display_name,
      entity_type: e.entity_type,
    }))

  const topicIds = new Set(topics.map((t) => t.id))
  const topicMentions = new Map<string, number>()
  for (const rel of relationships) {
    if (topicIds.has(rel.target_entity_id)) {
      topicMentions.set(rel.target_entity_id, (topicMentions.get(rel.target_entity_id) ?? 0) + 1)
    }
    if (topicIds.has(rel.source_entity_id)) {
      topicMentions.set(rel.source_entity_id, (topicMentions.get(rel.source_entity_id) ?? 0) + 1)
    }
  }

  const topTopics = topics
    .map((t) => ({
      id: t.id,
      name: t.display_name,
      mention_count: topicMentions.get(t.id) ?? 0,
    }))
    .sort((a, b) => b.mention_count - a.mention_count)
    .slice(0, 10)

  const queryTypeCounts = new Map<string, number>()
  let latencySum = 0
  let latencyCount = 0
  let totalTokensSaved = 0
  let contextQueries = 0

  for (const log of logs) {
    queryTypeCounts.set(log.query_type, (queryTypeCounts.get(log.query_type) ?? 0) + 1)
    if (typeof log.latency_ms === 'number') {
      latencySum += log.latency_ms
      latencyCount++
    }
    if (typeof log.tokens_saved === 'number' && log.tokens_saved > 0) {
      totalTokensSaved += log.tokens_saved
    }
    if (log.query_type === 'context') contextQueries++
  }

  const queryVolumeMap = new Map<string, number>()
  for (let i = 0; i < periodDays; i++) {
    const d = new Date(since)
    d.setUTCDate(since.getUTCDate() + i)
    queryVolumeMap.set(d.toISOString().slice(0, 10), 0)
  }
  for (const log of logs) {
    const key = dateKey(log.created_at)
    if (queryVolumeMap.has(key)) {
      queryVolumeMap.set(key, (queryVolumeMap.get(key) ?? 0) + 1)
    }
  }

  return {
    period_days: periodDays,
    summary: {
      entity_count: stats.entity_count,
      relationship_count: stats.relationship_count,
      orphan_count: stats.orphan_count,
      query_count: logs.length,
      avg_latency_ms: latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0,
      total_tokens_saved: totalTokensSaved,
      context_queries: contextQueries,
    },
    entity_growth: buildDailySeries(
      entities.map((e) => ({ created_at: e.created_at })),
      periodDays
    ),
    entities_by_type: [...allTypeCounts.entries()]
      .map(([entity_type, count]) => ({ entity_type, count }))
      .sort((a, b) => b.count - a.count),
    top_topics: topTopics,
    query_volume: [...queryVolumeMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count })),
    query_by_type: [...queryTypeCounts.entries()]
      .map(([query_type, count]) => ({ query_type, count }))
      .sort((a, b) => b.count - a.count),
    orphan_samples: orphanSamples,
  }
}
