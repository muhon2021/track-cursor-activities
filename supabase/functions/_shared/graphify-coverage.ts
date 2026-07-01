import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DEFAULT_TENANT_ID } from './graphify-types.ts'
import { getGraphStats, getGraphifyConfig } from './graphify-store.ts'

export type CoverageSuggestionAction =
  | 'run_relationship_sync'
  | 'run_backfill'
  | 're_embed_meetings'
  | 're_embed_knowledge'
  | 'enable_entity_extraction'
  | 'review_orphans'

export interface CoverageSuggestion {
  id: string
  priority: 'high' | 'medium' | 'low'
  action: CoverageSuggestionAction
  title: string
  description: string
  count?: number
}

export interface HealthFactor {
  factor: string
  score: number
  max: number
  detail: string
}

export interface GraphifyCoverageResult {
  health_score: number
  health_grade: 'excellent' | 'good' | 'fair' | 'poor'
  health_factors: HealthFactor[]
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
  suggestions: CoverageSuggestion[]
  last_sync_at: string | null
  entity_count: number
  relationship_count: number
}

function gradeFromScore(score: number): GraphifyCoverageResult['health_grade'] {
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 50) return 'fair'
  return 'poor'
}

function clampScore(value: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(value)))
}

export async function getGraphifyCoverage(
  supabase: SupabaseClient,
  tenantId: string = DEFAULT_TENANT_ID
): Promise<GraphifyCoverageResult> {
  const [
    stats,
    config,
    lastJobRes,
    orphansRpc,
    topicsRpc,
    unembeddedMeetingsRes,
    pendingKnowledgeRes,
    failedKnowledgeRes,
    noSourceRes,
  ] = await Promise.all([
    getGraphStats(supabase, tenantId),
    getGraphifyConfig(supabase, tenantId),
    supabase
      .from('graphify_sync_jobs')
      .select('completed_at, created_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc('graphify_list_orphans', { p_tenant_id: tenantId, p_limit: 50 }),
    supabase.rpc('graphify_topic_mention_stats', { p_tenant_id: tenantId, p_limit: 500 }),
    supabase
      .from('zoom_files')
      .select('id', { count: 'exact', head: true })
      .eq('is_processed', true)
      .not('transcript_text', 'is', null)
      .eq('has_embeddings', false),
    supabase
      .from('knowledge_entries')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .eq('embedding_status', 'pending'),
    supabase
      .from('knowledge_entries')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .eq('embedding_status', 'failed'),
    supabase
      .from('graph_entities')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .is('source_id', null),
  ])

  const entityCount = stats.entity_count
  const relationshipCount = stats.relationship_count

  let orphans: GraphifyCoverageResult['orphans'] = []
  if (!orphansRpc.error && orphansRpc.data?.length) {
    orphans = orphansRpc.data.map((o: {
      id: string
      display_name: string
      entity_type: string
      source_table: string | null
    }) => ({
      id: o.id,
      display_name: o.display_name,
      entity_type: o.entity_type,
      source_table: o.source_table,
    }))
  } else if (orphansRpc.error) {
    const { data: allEntities } = await supabase
      .from('graph_entities')
      .select('id, display_name, entity_type, source_table')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .limit(200)
    orphans = (allEntities ?? []).slice(0, 10).map((e) => ({
      id: e.id,
      display_name: e.display_name,
      entity_type: e.entity_type,
      source_table: e.source_table,
    }))
  }

  let sparseTopics: GraphifyCoverageResult['sparse_topics'] = []
  let topicsWithMentions = 0
  let topicTotal = 0

  if (!topicsRpc.error && topicsRpc.data?.length) {
    topicTotal = topicsRpc.data.length
    const mapped = topicsRpc.data.map((t: { id: string; display_name: string; mention_count: number }) => ({
      id: t.id,
      name: t.display_name,
      mention_count: Number(t.mention_count),
    }))
    topicsWithMentions = mapped.filter((t) => t.mention_count >= 2).length
    sparseTopics = mapped.filter((t) => t.mention_count <= 1).slice(0, 25)
  }

  const coverageGaps = {
    unembedded_meetings: unembeddedMeetingsRes.count ?? 0,
    pending_knowledge_entries: pendingKnowledgeRes.count ?? 0,
    failed_knowledge_entries: failedKnowledgeRes.count ?? 0,
    entities_without_source: noSourceRes.count ?? 0,
  }

  const healthFactors: HealthFactor[] = []

  const connectivityScore =
    entityCount === 0
      ? 0
      : clampScore(25 * (1 - stats.orphan_count / entityCount), 25)
  healthFactors.push({
    factor: 'Connectivity',
    score: connectivityScore,
    max: 25,
    detail:
      entityCount === 0
        ? 'No entities in graph'
        : `${stats.orphan_count} orphan${stats.orphan_count === 1 ? '' : 's'} (${Math.round((stats.orphan_count / entityCount) * 100)}%)`,
  })

  const relsPerEntity = entityCount > 0 ? relationshipCount / entityCount : 0
  const densityScore = entityCount === 0 ? 0 : clampScore(relsPerEntity * 12.5, 25)
  healthFactors.push({
    factor: 'Relationship density',
    score: densityScore,
    max: 25,
    detail: `${relsPerEntity.toFixed(1)} relationships per entity`,
  })

  const topicsWithMentionsCount = topicsWithMentions
  const topicScore =
    topicTotal === 0
      ? 15
      : clampScore(25 * (topicsWithMentionsCount / topicTotal), 25)
  healthFactors.push({
    factor: 'Topic richness',
    score: topicScore,
    max: 25,
    detail:
      topicTotal === 0
        ? 'No topics extracted yet'
        : `${topicsWithMentionsCount}/${topicTotal} topics with 2+ links`,
  })

  const meetingTotal = coverageGaps.unembedded_meetings
  const embedDenom = Math.max(1, meetingTotal + 10)
  const knowledgePending = coverageGaps.pending_knowledge_entries + coverageGaps.failed_knowledge_entries
  const embedPenalty = (meetingTotal / embedDenom) * 12.5 + Math.min(12.5, knowledgePending * 2.5)
  const embedScore = clampScore(25 - embedPenalty, 25)
  healthFactors.push({
    factor: 'Embed coverage',
    score: embedScore,
    max: 25,
    detail: `${coverageGaps.unembedded_meetings} meetings without embeddings, ${knowledgePending} KB entries need embed`,
  })

  const healthScore = healthFactors.reduce((sum, f) => sum + f.score, 0)

  const lastSyncAt =
    lastJobRes.data?.completed_at ?? lastJobRes.data?.created_at ?? null

  const suggestions: CoverageSuggestion[] = []

  if (stats.orphan_count > 3) {
    suggestions.push({
      id: 'sync-orphans',
      priority: 'high',
      action: 'run_relationship_sync',
      title: 'Sync FK relationships',
      description: 'Run relationship sync to link orphan nodes via foreign keys.',
      count: stats.orphan_count,
    })
  }

  if (stats.orphan_count > 0) {
    suggestions.push({
      id: 'review-orphans',
      priority: stats.orphan_count > 10 ? 'high' : 'medium',
      action: 'review_orphans',
      title: 'Review orphan entities',
      description: 'Orphan nodes have no relationships. Inspect and re-sync or remove stale entries.',
      count: stats.orphan_count,
    })
  }

  if (coverageGaps.unembedded_meetings > 0) {
    suggestions.push({
      id: 'embed-meetings',
      priority: 'medium',
      action: 're_embed_meetings',
      title: 'Embed meeting transcripts',
      description: 'Generate embeddings and graph links for processed meetings missing vectors.',
      count: coverageGaps.unembedded_meetings,
    })
  }

  if (coverageGaps.pending_knowledge_entries > 0 || coverageGaps.failed_knowledge_entries > 0) {
    suggestions.push({
      id: 'embed-knowledge',
      priority: coverageGaps.failed_knowledge_entries > 0 ? 'high' : 'medium',
      action: 're_embed_knowledge',
      title: 'Embed knowledge entries',
      description: 'Process pending or failed knowledge base embeddings for graph ingest.',
      count: coverageGaps.pending_knowledge_entries + coverageGaps.failed_knowledge_entries,
    })
  }

  if (entityCount < 25) {
    suggestions.push({
      id: 'run-backfill',
      priority: 'medium',
      action: 'run_backfill',
      title: 'Run full backfill',
      description: 'Graph is sparse. Backfill syncs entities and relationships from existing data.',
      count: entityCount,
    })
  }

  if (!config.entity_extraction_enabled && sparseTopics.length > 5) {
    suggestions.push({
      id: 'enable-extraction',
      priority: 'low',
      action: 'enable_entity_extraction',
      title: 'Enable entity extraction on ingest',
      description: 'Turn on topic extraction to enrich sparse areas of the graph.',
      count: sparseTopics.length,
    })
  }

  if (entityCount > 0) {
    const staleSync =
      !lastSyncAt ||
      Date.now() - new Date(lastSyncAt).getTime() > 7 * 24 * 60 * 60 * 1000
    if (staleSync) {
      suggestions.push({
        id: 'stale-sync',
        priority: 'low',
        action: 'run_relationship_sync',
        title: 'Refresh relationship sync',
        description: 'Last successful sync was over 7 days ago. Incremental FK sync keeps the graph current.',
      })
    }
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 }
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return {
    health_score: healthScore,
    health_grade: gradeFromScore(healthScore),
    health_factors: healthFactors,
    orphan_count: stats.orphan_count,
    orphans,
    sparse_topic_count: sparseTopics.length,
    sparse_topics: sparseTopics,
    coverage_gaps: coverageGaps,
    suggestions,
    last_sync_at: lastSyncAt,
    entity_count: entityCount,
    relationship_count: relationshipCount,
  }
}
