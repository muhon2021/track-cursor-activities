/** Entity type colors for graph explorer nodes */
export const GRAPH_ENTITY_COLORS: Record<string, string> = {
  User: '#3b82f6',
  Department: '#6366f1',
  Meeting: '#8b5cf6',
  Task: '#f59e0b',
  Issue: '#ef4444',
  Rock: '#ec4899',
  Document: '#14b8a6',
  Chunk: '#06b6d4',
  Source: '#0ea5e9',
  Agent: '#a855f7',
  Memory: '#d946ef',
  Integration: '#64748b',
  Customer: '#22c55e',
  Deal: '#84cc16',
  Account: '#10b981',
  Team: '#2dd4bf',
  EosTeam: '#0891b2',
  Topic: '#f97316',
  Transcript: '#7c3aed',
  Knowledge: '#059669',
}

export const GRAPH_ENTITY_TYPES = [
  'User', 'Department', 'Meeting', 'Task', 'Issue', 'Rock',
  'Document', 'Chunk', 'Source', 'Agent', 'Memory', 'Integration',
  'Customer', 'Deal', 'Account', 'Team', 'EosTeam', 'Topic',
  'Transcript', 'Knowledge',
] as const

export const GRAPH_RELATIONSHIP_TYPES = [
  'OWNS', 'WORKS_WITH', 'BELONGS_TO', 'REFERENCES', 'MENTIONS',
  'ASSIGNED_TO', 'DEPENDS_ON', 'LINKED_TO', 'RELATED_TO', 'GENERATED_BY',
  'AUTHORED_BY', 'OWNED_BY',
] as const

export function entityColor(entityType: string): string {
  return GRAPH_ENTITY_COLORS[entityType] ?? '#94a3b8'
}
