export const GRAPHIFY_ENTITY_TYPES = [
  'User', 'Department', 'Meeting', 'Task', 'Issue', 'Rock',
  'Document', 'Chunk', 'Source', 'Agent', 'Memory', 'Integration',
  'Customer', 'Deal', 'Account', 'Team', 'EosTeam', 'Topic',
] as const

export type GraphifyEntityType = typeof GRAPHIFY_ENTITY_TYPES[number]

export const GRAPHIFY_RELATIONSHIP_TYPES = [
  'OWNS', 'WORKS_WITH', 'BELONGS_TO', 'REFERENCES', 'MENTIONS',
  'ASSIGNED_TO', 'DEPENDS_ON', 'LINKED_TO', 'RELATED_TO', 'GENERATED_BY',
] as const

export type GraphifyRelationshipType = typeof GRAPHIFY_RELATIONSHIP_TYPES[number]

export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export interface GraphEntity {
  id: string
  tenant_id: string
  entity_type: string
  canonical_name: string
  display_name: string
  source_table: string | null
  source_id: string | null
  metadata: Record<string, unknown>
  confidence: number
  version: number
  status: string
  created_by?: string | null
  created_at?: string
  updated_at?: string
}

export interface GraphRelationship {
  id: string
  tenant_id: string
  source_entity_id: string
  target_entity_id: string
  relationship_type: string
  weight: number
  confidence: number
  metadata: Record<string, unknown>
  source_table: string | null
  source_id: string | null
  status: string
}

export interface GraphifyConfig {
  id: string
  tenant_id: string
  enabled: boolean
  max_traversal_depth: number
  max_nodes_per_query: number
  entity_extraction_enabled: boolean
  auto_sync_fk_relationships: boolean
  context_merge_strategy: 'graph_first' | 'vector_first' | 'balanced'
  token_budget: number
  metadata: Record<string, unknown>
}

export interface UpsertEntityInput {
  tenant_id?: string
  entity_type: string
  canonical_name: string
  display_name?: string
  source_table?: string | null
  source_id?: string | null
  metadata?: Record<string, unknown>
  confidence?: number
  created_by?: string | null
  aliases?: string[]
}

export interface UpsertRelationshipInput {
  tenant_id?: string
  source_entity_id: string
  target_entity_id: string
  relationship_type: string
  weight?: number
  confidence?: number
  metadata?: Record<string, unknown>
  source_table?: string | null
  source_id?: string | null
}

export interface TraversalNode {
  entity_id: string
  entity_type: string
  display_name: string
  source_table: string | null
  source_id: string | null
  depth: number
  path: string[]
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

export function normalizeAlias(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function toCanonicalName(name: string): string {
  return name.trim()
}
