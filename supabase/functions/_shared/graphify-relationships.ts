import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DEFAULT_TENANT_ID } from './graphify-types.ts'
import { upsertEntity, upsertRelationship } from './graphify-store.ts'

export interface SyncStats {
  entities_synced: number
  relationships_synced: number
  errors: string[]
  phase?: string
  links_only?: boolean
}

export type SyncPhase = 'all' | 'users' | 'crm' | 'meetings' | 'tasks' | 'content' | 'entities'

export interface SyncFkOptions {
  /** Skip entity upserts — only create FK relationships (much faster when entities exist) */
  linksOnly?: boolean
  phase?: SyncPhase
}

type EntityIndex = Map<string, string>

function indexKey(table: string, sourceId: string, entityType?: string): string {
  return entityType ? `${table}:${sourceId}:${entityType}` : `${table}:${sourceId}`
}

async function buildEntityIndex(supabase: SupabaseClient, tenantId: string): Promise<EntityIndex> {
  const map = new Map<string, string>()
  const pageSize = 1000
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('graph_entities')
      .select('id, entity_type, source_table, source_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .range(offset, offset + pageSize - 1)

    if (error) throw error
    if (!data?.length) break

    for (const e of data) {
      if (!e.source_table || !e.source_id) continue
      map.set(indexKey(e.source_table, e.source_id, e.entity_type), e.id)
      if (!map.has(indexKey(e.source_table, e.source_id))) {
        map.set(indexKey(e.source_table, e.source_id), e.id)
      }
    }

    if (data.length < pageSize) break
    offset += pageSize
  }

  return map
}

function lookup(
  index: EntityIndex,
  table: string,
  sourceId: string,
  entityType?: string
): string | null {
  if (entityType) {
    const typed = index.get(indexKey(table, sourceId, entityType))
    if (typed) return typed
  }
  return index.get(indexKey(table, sourceId)) ?? null
}

async function linkEntities(
  supabase: SupabaseClient,
  tenantId: string,
  sourceEntityId: string,
  targetEntityId: string,
  relationshipType: string,
  sourceTable?: string,
  sourceId?: string
): Promise<boolean> {
  const rel = await upsertRelationship(supabase, {
    tenant_id: tenantId,
    source_entity_id: sourceEntityId,
    target_entity_id: targetEntityId,
    relationship_type: relationshipType,
    source_table: sourceTable ?? null,
    source_id: sourceId ?? null,
  })
  return rel != null
}

async function runInBatches<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<boolean>
): Promise<number> {
  let linked = 0
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize)
    const results = await Promise.all(chunk.map(fn))
    linked += results.filter(Boolean).length
  }
  return linked
}

async function syncEntityRows(
  supabase: SupabaseClient,
  tenantId: string,
  stats: SyncStats
): Promise<void> {
  const syncRow = async (
    entityType: string,
    name: string,
    sourceTable: string,
    sourceId: string,
    metadata: Record<string, unknown> = {}
  ) => {
    try {
      await upsertEntity(supabase, {
        tenant_id: tenantId,
        entity_type: entityType,
        canonical_name: name,
        display_name: name,
        source_table: sourceTable,
        source_id: sourceId,
        metadata,
      })
      stats.entities_synced++
    } catch (e) {
      stats.errors.push(`${sourceTable}:${sourceId} — ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').limit(2000)
  for (const p of profiles ?? []) {
    const name = p.full_name || p.email || `User ${p.id.slice(0, 8)}`
    await syncRow('User', name, 'profiles', p.id, { email: p.email })
  }

  const { data: departments } = await supabase.from('departments').select('id, name').limit(500)
  for (const d of departments ?? []) {
    await syncRow('Department', d.name, 'departments', d.id)
  }

  const { data: clients } = await supabase.from('clients').select('id, name').limit(2000)
  for (const c of clients ?? []) {
    await syncRow('Customer', c.name, 'clients', c.id)
  }

  const { data: deals } = await supabase.from('deals').select('id, name, client_id').limit(2000)
  for (const d of deals ?? []) {
    await syncRow('Deal', d.name || `Deal ${d.id.slice(0, 8)}`, 'deals', d.id, { client_id: d.client_id })
  }

  const { data: meetings } = await supabase
    .from('meetings')
    .select('id, title, client_id, deal_id')
    .limit(2000)
  for (const m of meetings ?? []) {
    await syncRow('Meeting', m.title || `Meeting ${m.id.slice(0, 8)}`, 'meetings', m.id)
  }

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, assigned_to, client_id, meeting_id')
    .limit(2000)
  for (const t of tasks ?? []) {
    await syncRow('Task', t.title || `Task ${t.id.slice(0, 8)}`, 'tasks', t.id)
  }

  const { data: issues } = await supabase.from('eos_issues').select('id, title, meeting_id').limit(1000)
  for (const i of issues ?? []) {
    await syncRow('Issue', i.title || `Issue ${i.id.slice(0, 8)}`, 'eos_issues', i.id)
  }

  const { data: okrs } = await supabase
    .from('okrs')
    .select('id, title, rock_status, department_id, pod_id')
    .not('rock_status', 'is', null)
    .limit(1000)
  for (const o of okrs ?? []) {
    await syncRow('Rock', o.title || `Rock ${o.id.slice(0, 8)}`, 'okrs', o.id)
  }

  const { data: agents } = await supabase.from('ai_agents').select('id, name').limit(500)
  for (const a of agents ?? []) {
    await syncRow('Agent', a.name, 'ai_agents', a.id)
  }

  const { data: kFiles } = await supabase
    .from('knowledge_files')
    .select('id, file_name, source_id')
    .limit(2000)
  for (const f of kFiles ?? []) {
    await syncRow('Document', f.file_name || `File ${f.id.slice(0, 8)}`, 'knowledge_files', f.id, {
      source_id: f.source_id,
    })
  }

  const { data: uDocs } = await supabase
    .from('unified_documents')
    .select('id, title, owner_type, owner_id')
    .limit(2000)
  for (const doc of uDocs ?? []) {
    await syncRow('Document', doc.title || `Document ${doc.id.slice(0, 8)}`, 'unified_documents', doc.id, {
      owner_type: doc.owner_type,
      owner_id: doc.owner_id,
    })
  }

  const { data: zoomFiles } = await supabase
    .from('zoom_files')
    .select('id, meeting_topic, meeting_id')
    .not('transcript_text', 'is', null)
    .limit(2000)
  for (const zf of zoomFiles ?? []) {
    const name = zf.meeting_topic || `Transcript ${zf.id.slice(0, 8)}`
    await syncRow('Transcript', name, 'zoom_files', zf.id, { meeting_id: zf.meeting_id })
  }
}

async function syncUserLinks(
  supabase: SupabaseClient,
  tenantId: string,
  index: EntityIndex,
  stats: SyncStats
): Promise<void> {
  const { data: deptUsers } = await supabase
    .from('department_users')
    .select('user_id, department_id')
    .limit(5000)

  stats.relationships_synced += await runInBatches(deptUsers ?? [], 25, async (du) => {
    const userId = lookup(index, 'profiles', du.user_id, 'User')
    const deptId = lookup(index, 'departments', du.department_id, 'Department')
    if (!userId || !deptId) return false
    return linkEntities(supabase, tenantId, userId, deptId, 'BELONGS_TO', 'department_users', du.user_id)
  })

  const { data: participants } = await supabase
    .from('meeting_participants')
    .select('meeting_id, user_id')
    .limit(5000)

  stats.relationships_synced += await runInBatches(participants ?? [], 25, async (mp) => {
    const meetingId = lookup(index, 'meetings', mp.meeting_id, 'Meeting')
    const userId = lookup(index, 'profiles', mp.user_id, 'User')
    if (!meetingId || !userId) return false
    return linkEntities(
      supabase, tenantId, meetingId, userId, 'WORKS_WITH', 'meeting_participants', mp.meeting_id
    )
  })
}

async function syncCrmLinks(
  supabase: SupabaseClient,
  tenantId: string,
  index: EntityIndex,
  stats: SyncStats
): Promise<void> {
  const { data: deals } = await supabase.from('deals').select('id, client_id').limit(2000)

  stats.relationships_synced += await runInBatches(deals ?? [], 25, async (d) => {
    if (!d.client_id) return false
    const dealId = lookup(index, 'deals', d.id, 'Deal')
    const clientId = lookup(index, 'clients', d.client_id, 'Customer')
    if (!dealId || !clientId) return false
    return linkEntities(supabase, tenantId, dealId, clientId, 'BELONGS_TO', 'deals', d.id)
  })
}

async function syncMeetingLinks(
  supabase: SupabaseClient,
  tenantId: string,
  index: EntityIndex,
  stats: SyncStats
): Promise<void> {
  const { data: meetings } = await supabase
    .from('meetings')
    .select('id, client_id, deal_id')
    .limit(2000)

  stats.relationships_synced += await runInBatches(meetings ?? [], 25, async (m) => {
    const meetingId = lookup(index, 'meetings', m.id, 'Meeting')
    if (!meetingId) return false
    let linked = false
    if (m.client_id) {
      const clientId = lookup(index, 'clients', m.client_id, 'Customer')
      if (clientId) {
        linked = await linkEntities(
          supabase, tenantId, meetingId, clientId, 'REFERENCES', 'meetings', m.id
        ) || linked
      }
    }
    if (m.deal_id) {
      const dealId = lookup(index, 'deals', m.deal_id, 'Deal')
      if (dealId) {
        linked = await linkEntities(
          supabase, tenantId, meetingId, dealId, 'REFERENCES', 'meetings', m.id
        ) || linked
      }
    }
    return linked
  })

  const { data: assignments } = await supabase
    .from('meeting_assignments')
    .select('id, meeting_id, entity_type, entity_id')
    .limit(5000)

  const typeMap: Record<string, { table: string; entityType: string }> = {
    client: { table: 'clients', entityType: 'Customer' },
    deal: { table: 'deals', entityType: 'Deal' },
    project: { table: 'projects', entityType: 'Account' },
  }

  stats.relationships_synced += await runInBatches(assignments ?? [], 25, async (a) => {
    const meetingId = lookup(index, 'meetings', a.meeting_id, 'Meeting')
    const mapped = typeMap[a.entity_type]
    if (!meetingId || !mapped) return false
    const targetId = lookup(index, mapped.table, a.entity_id, mapped.entityType)
    if (!targetId) return false
    return linkEntities(
      supabase, tenantId, meetingId, targetId, 'REFERENCES', 'meeting_assignments', a.id
    )
  })

  const { data: zoomFiles } = await supabase
    .from('zoom_files')
    .select('id, meeting_id')
    .not('meeting_id', 'is', null)
    .limit(2000)

  stats.relationships_synced += await runInBatches(zoomFiles ?? [], 25, async (zf) => {
    if (!zf.meeting_id) return false
    const transcriptId = lookup(index, 'zoom_files', zf.id, 'Transcript')
    const meetingId = lookup(index, 'meetings', zf.meeting_id, 'Meeting')
    if (!transcriptId || !meetingId) return false
    return linkEntities(supabase, tenantId, transcriptId, meetingId, 'LINKED_TO', 'zoom_files', zf.id)
  })
}

async function syncTaskLinks(
  supabase: SupabaseClient,
  tenantId: string,
  index: EntityIndex,
  stats: SyncStats
): Promise<void> {
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, assigned_to, client_id, meeting_id')
    .limit(2000)

  stats.relationships_synced += await runInBatches(tasks ?? [], 25, async (t) => {
    const taskId = lookup(index, 'tasks', t.id, 'Task')
    if (!taskId) return false
    let linked = false
    if (t.assigned_to) {
      const userId = lookup(index, 'profiles', t.assigned_to, 'User')
      if (userId) {
        linked = await linkEntities(
          supabase, tenantId, taskId, userId, 'ASSIGNED_TO', 'tasks', t.id
        ) || linked
      }
    }
    if (t.client_id) {
      const clientId = lookup(index, 'clients', t.client_id, 'Customer')
      if (clientId) {
        linked = await linkEntities(
          supabase, tenantId, taskId, clientId, 'REFERENCES', 'tasks', t.id
        ) || linked
      }
    }
    if (t.meeting_id) {
      const meetingId = lookup(index, 'meetings', t.meeting_id, 'Meeting')
      if (meetingId) {
        linked = await linkEntities(
          supabase, tenantId, taskId, meetingId, 'LINKED_TO', 'tasks', t.id
        ) || linked
      }
    }
    return linked
  })

  const { data: issues } = await supabase.from('eos_issues').select('id, meeting_id').limit(1000)
  stats.relationships_synced += await runInBatches(issues ?? [], 25, async (i) => {
    if (!i.meeting_id) return false
    const issueId = lookup(index, 'eos_issues', i.id, 'Issue')
    const meetingId = lookup(index, 'meetings', i.meeting_id, 'Meeting')
    if (!issueId || !meetingId) return false
    return linkEntities(supabase, tenantId, issueId, meetingId, 'LINKED_TO', 'eos_issues', i.id)
  })

  const { data: okrs } = await supabase
    .from('okrs')
    .select('id, department_id')
    .not('rock_status', 'is', null)
    .limit(1000)

  stats.relationships_synced += await runInBatches(okrs ?? [], 25, async (o) => {
    if (!o.department_id) return false
    const rockId = lookup(index, 'okrs', o.id, 'Rock')
    const deptId = lookup(index, 'departments', o.department_id, 'Department')
    if (!rockId || !deptId) return false
    return linkEntities(supabase, tenantId, rockId, deptId, 'BELONGS_TO', 'okrs', o.id)
  })
}

function shouldRun(phase: SyncPhase, target: SyncPhase): boolean {
  return phase === 'all' || phase === target
}

export async function syncFkRelationships(
  supabase: SupabaseClient,
  tenantId: string = DEFAULT_TENANT_ID,
  options: SyncFkOptions = {}
): Promise<SyncStats> {
  const phase = options.phase ?? 'all'
  const linksOnly = options.linksOnly ?? false
  const stats: SyncStats = {
    entities_synced: 0,
    relationships_synced: 0,
    errors: [],
    phase,
    links_only: linksOnly,
  }

  if (!linksOnly && shouldRun(phase, 'entities')) {
    await syncEntityRows(supabase, tenantId, stats)
  }

  const index = await buildEntityIndex(supabase, tenantId)

  if (shouldRun(phase, 'users')) {
    await syncUserLinks(supabase, tenantId, index, stats)
  }
  if (shouldRun(phase, 'crm')) {
    await syncCrmLinks(supabase, tenantId, index, stats)
  }
  if (shouldRun(phase, 'meetings')) {
    await syncMeetingLinks(supabase, tenantId, index, stats)
  }
  if (shouldRun(phase, 'tasks')) {
    await syncTaskLinks(supabase, tenantId, index, stats)
  }

  return stats
}

export async function syncEntitySources(
  supabase: SupabaseClient,
  tenantId: string = DEFAULT_TENANT_ID
): Promise<number> {
  const result = await syncFkRelationships(supabase, tenantId, { linksOnly: false, phase: 'entities' })
  return result.entities_synced
}
