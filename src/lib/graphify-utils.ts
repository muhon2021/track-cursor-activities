/**
 * Client-side Graphify utilities (pure functions — safe for unit tests)
 */

export interface GraphSearchEntityLike {
  id: string
  entity_type: string
  display_name: string
  canonical_name?: string
  source_id?: string | null
  source_table?: string | null
  match_score?: number
}

function nameKey(entity: GraphSearchEntityLike): string {
  const name = (entity.canonical_name ?? entity.display_name).trim().toLowerCase()
  return `${entity.entity_type}:${name}`
}

/** Normalize text for fuzzy comparison (mirrors server-side graphify_normalize_search_text) */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Collapse duplicate search hits (prefer profile-linked / higher match score) */
export function dedupeSearchEntities<T extends GraphSearchEntityLike>(entities: T[]): T[] {
  const best = new Map<string, T>()

  for (const entity of entities) {
    const key = nameKey(entity)
    const existing = best.get(key)
    if (!existing) {
      best.set(key, entity)
      continue
    }

    const existingLinked = existing.source_id ? 1 : 0
    const candidateLinked = entity.source_id ? 1 : 0
    const existingScore = existing.match_score ?? 0
    const candidateScore = entity.match_score ?? 0

    if (
      candidateLinked > existingLinked ||
      (candidateLinked === existingLinked && candidateScore > existingScore)
    ) {
      best.set(key, entity)
    }
  }

  return [...best.values()].sort(
    (a, b) => (b.match_score ?? 0) - (a.match_score ?? 0)
  )
}

export function buildTraverseQueryKey(
  seedIds: string[],
  depth: number,
  entityTypes: string[] = [],
  relationshipTypes: string[] = []
): string {
  const seeds = [...seedIds].sort().join(',')
  const types = [...entityTypes].sort().join(',') || '*'
  const rels = [...relationshipTypes].sort().join(',') || '*'
  return `${seeds}|d${depth}|t${types}|r${rels}`
}
