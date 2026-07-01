import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DEFAULT_TENANT_ID } from './graphify-types.ts'
import {
  getEntityBySource,
  getGraphifyConfig,
  isGraphifyFeatureEnabled,
  upsertEntity,
  upsertRelationship,
} from './graphify-store.ts'
import { extractTopicEntitiesFromText } from './graphify-extraction.ts'

const MAX_EXTRACT_CHARS = 12_000

export interface GraphIngestParams {
  /** Embedding pipeline entity type (e.g. meeting_transcript, knowledge_entry) */
  entity_type: string
  entity_id: string
  content: string
  metadata?: Record<string, unknown>
  user_id?: string | null
}

export interface GraphIngestResult {
  skipped: boolean
  reason?: string
  entity_id?: string
  relationships_created?: number
  topics_extracted?: number
}

interface IngestMapping {
  sourceTable: string
  graphEntityType: string
}

const INGEST_MAPPINGS: Record<string, IngestMapping> = {
  meeting_transcript: { sourceTable: 'zoom_files', graphEntityType: 'Transcript' },
  knowledge_entry: { sourceTable: 'knowledge_entries', graphEntityType: 'Knowledge' },
  knowledge_file: { sourceTable: 'knowledge_files', graphEntityType: 'Document' },
  unified_document: { sourceTable: 'unified_documents', graphEntityType: 'Document' },
  client: { sourceTable: 'clients', graphEntityType: 'Customer' },
  project: { sourceTable: 'projects', graphEntityType: 'Account' },
  task: { sourceTable: 'tasks', graphEntityType: 'Task' },
  meeting: { sourceTable: 'meetings', graphEntityType: 'Meeting' },
}

function resolveMapping(entityType: string): IngestMapping {
  return INGEST_MAPPINGS[entityType] ?? {
    sourceTable: entityType,
    graphEntityType: 'Document',
  }
}

async function resolveDisplayName(
  supabase: SupabaseClient,
  mapping: IngestMapping,
  entityId: string,
  metadata: Record<string, unknown>
): Promise<string> {
  const fromMeta =
    (metadata.title as string) ||
    (metadata.meeting_topic as string) ||
    (metadata.name as string) ||
    (metadata.slug as string)
  if (fromMeta) return fromMeta

  if (mapping.sourceTable === 'zoom_files') {
    const { data } = await supabase
      .from('zoom_files')
      .select('meeting_topic')
      .eq('id', entityId)
      .maybeSingle()
    if (data?.meeting_topic) return data.meeting_topic
  }

  if (mapping.sourceTable === 'knowledge_entries') {
    const { data } = await supabase
      .from('knowledge_entries')
      .select('title')
      .eq('id', entityId)
      .maybeSingle()
    if (data?.title) return data.title
  }

  return `${mapping.graphEntityType} ${entityId.slice(0, 8)}`
}

async function syncIngestFkLinks(
  supabase: SupabaseClient,
  tenantId: string,
  mapping: IngestMapping,
  sourceEntityId: string,
  entityId: string,
  metadata: Record<string, unknown>,
  userId?: string | null
): Promise<number> {
  let created = 0

  const link = async (
    targetTable: string,
    targetId: string,
    targetType: string,
    relationshipType: string,
    sourceTable?: string,
    sourceRowId?: string
  ) => {
    const target = await getEntityBySource(supabase, tenantId, targetTable, targetId, targetType)
    if (!target) return
    const rel = await upsertRelationship(supabase, {
      tenant_id: tenantId,
      source_entity_id: sourceEntityId,
      target_entity_id: target.id,
      relationship_type: relationshipType,
      source_table: sourceTable ?? mapping.sourceTable,
      source_id: sourceRowId ?? entityId,
    })
    if (rel) created++
  }

  if (mapping.sourceTable === 'zoom_files') {
    const { data: file } = await supabase
      .from('zoom_files')
      .select('meeting_id, meeting_topic')
      .eq('id', entityId)
      .maybeSingle()
    if (file?.meeting_id) {
      const meetingEntity = await getEntityBySource(
        supabase, tenantId, 'meetings', file.meeting_id, 'Meeting'
      )
      if (!meetingEntity) {
        const title =
          (metadata.meeting_topic as string) ||
          file.meeting_topic ||
          `Meeting ${file.meeting_id.slice(0, 8)}`
        await upsertEntity(supabase, {
          tenant_id: tenantId,
          entity_type: 'Meeting',
          canonical_name: title,
          display_name: title,
          source_table: 'meetings',
          source_id: file.meeting_id,
        })
      }
      await link('meetings', file.meeting_id, 'Meeting', 'LINKED_TO')
    }
  }

  if (mapping.sourceTable === 'knowledge_entries') {
    const { data: entry } = await supabase
      .from('knowledge_entries')
      .select('author_id, category_id')
      .eq('id', entityId)
      .maybeSingle()
    const authorId = entry?.author_id ?? userId
    if (authorId) {
      let userEntity = await getEntityBySource(supabase, tenantId, 'profiles', authorId, 'User')
      if (!userEntity) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', authorId)
          .maybeSingle()
        const name = profile?.full_name || profile?.email || `User ${authorId.slice(0, 8)}`
        userEntity = await upsertEntity(supabase, {
          tenant_id: tenantId,
          entity_type: 'User',
          canonical_name: name,
          display_name: name,
          source_table: 'profiles',
          source_id: authorId,
          metadata: { email: profile?.email },
        })
      }
      await link('profiles', authorId, 'User', 'AUTHORED_BY')
    }
  }

  if (mapping.sourceTable === 'knowledge_files') {
    const { data: file } = await supabase
      .from('knowledge_files')
      .select('source_id')
      .eq('id', entityId)
      .maybeSingle()
    if (file?.source_id) {
      await link('knowledge_sources', file.source_id, 'Document', 'REFERENCES')
    }
  }

  if (mapping.sourceTable === 'unified_documents') {
    const { data: doc } = await supabase
      .from('unified_documents')
      .select('owner_type, owner_id')
      .eq('id', entityId)
      .maybeSingle()
    if (doc?.owner_id && doc.owner_type === 'user') {
      await link('profiles', doc.owner_id, 'User', 'OWNED_BY')
    }
  }

  return created
}

/**
 * Sync graph entity + optional topic extraction after content is embedded.
 * Non-throwing: logs errors and returns partial results.
 */
export async function syncGraphOnIngest(
  supabase: SupabaseClient,
  params: GraphIngestParams
): Promise<GraphIngestResult> {
  const tenantId = DEFAULT_TENANT_ID

  try {
    const featureOn = await isGraphifyFeatureEnabled(supabase)
    if (!featureOn) {
      return { skipped: true, reason: 'feature_disabled' }
    }

    const config = await getGraphifyConfig(supabase, tenantId)
    if (!config.enabled) {
      return { skipped: true, reason: 'graphify_config_disabled' }
    }

    const mapping = resolveMapping(params.entity_type)
    const metadata = params.metadata ?? {}
    const displayName = await resolveDisplayName(
      supabase,
      mapping,
      params.entity_id,
      metadata
    )

    const sourceEntity = await upsertEntity(supabase, {
      tenant_id: tenantId,
      entity_type: mapping.graphEntityType,
      canonical_name: displayName,
      display_name: displayName,
      source_table: mapping.sourceTable,
      source_id: params.entity_id,
      metadata: {
        ...metadata,
        ingest_entity_type: params.entity_type,
      },
      confidence: 0.95,
    })

    let relationshipsCreated = 0
    let topicsExtracted = 0

    if (config.auto_sync_fk_relationships) {
      relationshipsCreated += await syncIngestFkLinks(
        supabase,
        tenantId,
        mapping,
        sourceEntity.id,
        params.entity_id,
        metadata,
        params.user_id
      )
    }

    if (config.entity_extraction_enabled && params.content?.trim()) {
      const text = params.content.slice(0, MAX_EXTRACT_CHARS)
      const extracted = await extractTopicEntitiesFromText(
        supabase,
        tenantId,
        text,
        mapping.sourceTable,
        params.entity_id
      )
      topicsExtracted = extracted.length
    }

    return {
      skipped: false,
      entity_id: sourceEntity.id,
      relationships_created: relationshipsCreated,
      topics_extracted: topicsExtracted,
    }
  } catch (error) {
    console.error('[graphify-ingest]', error)
    return {
      skipped: true,
      reason: error instanceof Error ? error.message : 'unknown_error',
    }
  }
}
