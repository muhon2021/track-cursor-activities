import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DEFAULT_TENANT_ID } from './graphify-types.ts'
import {
  getEntityBySource,
  linkMemoryToEntity,
  resolveAlias,
  upsertEntity,
  upsertRelationship,
} from './graphify-store.ts'

export interface ExtractedEntity {
  name: string
  entity_type: string
  confidence?: number
}

export async function syncMemoryGraphLinks(
  supabase: SupabaseClient,
  params: {
    memoryId: string
    memoryContent: string
    userId: string
    agentId?: string
    sourceType?: string
    sourceId?: string
    tenantId?: string
  }
): Promise<{ entity_id: string; links_created: number }> {
  const tenantId = params.tenantId ?? DEFAULT_TENANT_ID

  const memoryEntity = await upsertEntity(supabase, {
    tenant_id: tenantId,
    entity_type: 'Memory',
    canonical_name: params.memoryContent.slice(0, 120),
    display_name: params.memoryContent.slice(0, 120),
    source_table: 'agent_memories',
    source_id: params.memoryId,
    metadata: { user_id: params.userId, agent_id: params.agentId },
    confidence: 0.9,
  })

  let linksCreated = 0

  await linkMemoryToEntity(supabase, tenantId, params.memoryId, memoryEntity.id, 'about', 1.0)
  linksCreated++

  if (params.agentId) {
    const agentEntity = await getEntityBySource(supabase, tenantId, 'ai_agents', params.agentId, 'Agent')
    if (agentEntity) {
      await upsertRelationship(supabase, {
        tenant_id: tenantId,
        source_entity_id: memoryEntity.id,
        target_entity_id: agentEntity.id,
        relationship_type: 'GENERATED_BY',
        source_table: 'agent_memories',
        source_id: params.memoryId,
      })
      await linkMemoryToEntity(supabase, tenantId, params.memoryId, agentEntity.id, 'derived_from', 0.9)
      linksCreated++
    }
  }

  const userEntity = await getEntityBySource(supabase, tenantId, 'profiles', params.userId, 'User')
  if (userEntity) {
    await upsertRelationship(supabase, {
      tenant_id: tenantId,
      source_entity_id: memoryEntity.id,
      target_entity_id: userEntity.id,
      relationship_type: 'REFERENCES',
      source_table: 'agent_memories',
      source_id: params.memoryId,
    })
    await linkMemoryToEntity(supabase, tenantId, params.memoryId, userEntity.id, 'mentions', 0.85)
    linksCreated++
  }

  if (params.sourceType === 'conversation' && params.sourceId) {
    const { data: conversation } = await supabase
      .from('agent_conversations')
      .select('agent_id')
      .eq('id', params.sourceId)
      .maybeSingle()
    if (conversation?.agent_id) {
      const convAgent = await getEntityBySource(
        supabase, tenantId, 'ai_agents', conversation.agent_id, 'Agent'
      )
      if (convAgent) {
        await linkMemoryToEntity(supabase, tenantId, params.memoryId, convAgent.id, 'derived_from', 0.8)
        linksCreated++
      }
    }
  }

  // Link to entities mentioned by name in memory content
  const words = params.memoryContent.split(/\s+/).filter((w) => w.length > 3).slice(0, 20)
  for (const word of words) {
    const clean = word.replace(/[^a-zA-Z0-9@._-]/g, '')
    if (clean.length < 4) continue
    const matched = await resolveAlias(supabase, tenantId, clean)
    if (matched && matched.id !== memoryEntity.id) {
      await upsertRelationship(supabase, {
        tenant_id: tenantId,
        source_entity_id: memoryEntity.id,
        target_entity_id: matched.id,
        relationship_type: 'MENTIONS',
        confidence: 0.6,
        source_table: 'agent_memories',
        source_id: params.memoryId,
      })
      await linkMemoryToEntity(supabase, tenantId, params.memoryId, matched.id, 'mentions', 0.6)
      linksCreated++
    }
  }

  return { entity_id: memoryEntity.id, links_created: linksCreated }
}

export async function extractTopicEntitiesFromText(
  supabase: SupabaseClient,
  tenantId: string,
  text: string,
  sourceTable: string,
  sourceId: string
): Promise<ExtractedEntity[]> {
  const extracted: ExtractedEntity[] = []
  const seen = new Set<string>()

  // Capitalized phrase heuristic (e.g. "CRM Migration", "Q3 Revenue")
  const phrasePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g
  let match: RegExpExecArray | null
  while ((match = phrasePattern.exec(text)) !== null) {
    const phrase = match[1].trim()
    const key = phrase.toLowerCase()
    if (seen.has(key) || phrase.length < 4) continue
    seen.add(key)
    extracted.push({ name: phrase, entity_type: 'Topic', confidence: 0.65 })
  }

  for (const item of extracted) {
    const entity = await upsertEntity(supabase, {
      tenant_id: tenantId,
      entity_type: item.entity_type,
      canonical_name: item.name,
      display_name: item.name,
      metadata: { extracted_from: sourceTable, source_id: sourceId },
      confidence: item.confidence ?? 0.65,
    })

    const sourceEntity = await getEntityBySource(supabase, tenantId, sourceTable, sourceId)
    if (sourceEntity) {
      await upsertRelationship(supabase, {
        tenant_id: tenantId,
        source_entity_id: sourceEntity.id,
        target_entity_id: entity.id,
        relationship_type: 'MENTIONS',
        confidence: item.confidence ?? 0.65,
        source_table: sourceTable,
        source_id: sourceId,
      })
    }
  }

  return extracted
}
