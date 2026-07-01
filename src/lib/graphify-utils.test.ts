import { describe, expect, it } from 'vitest'
import { dedupeSearchEntities, buildTraverseQueryKey, normalizeSearchText } from '@/lib/graphify-utils'
import { edgesFromTraversal, layoutTraversalNodes } from '@/modules/graphify/lib/graphExplorerLayout'
import type { GraphTraversalNode } from '@/lib/graphify'

describe('normalizeSearchText', () => {
  it('strips punctuation and lowercases', () => {
    expect(normalizeSearchText('Year-End Review - Richardson Law')).toBe(
      'year end review richardson law'
    )
  })
})

describe('dedupeSearchEntities', () => {
  it('keeps one entity per type+name, preferring source-linked', () => {
    const input = [
      {
        id: 'orphan',
        entity_type: 'User',
        display_name: 'Omkar Shinde',
        canonical_name: 'Omkar Shinde',
        source_id: null,
        match_score: 0.9,
      },
      {
        id: 'profile',
        entity_type: 'User',
        display_name: 'Omkar Shinde',
        canonical_name: 'Omkar Shinde',
        source_id: 'uuid-1',
        source_table: 'profiles',
        match_score: 0.7,
      },
    ]

    const result = dedupeSearchEntities(input)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('profile')
  })

  it('preserves distinct names', () => {
    const input = [
      { id: 'a', entity_type: 'User', display_name: 'Alice', match_score: 1 },
      { id: 'b', entity_type: 'User', display_name: 'Bob', match_score: 1 },
    ]
    expect(dedupeSearchEntities(input)).toHaveLength(2)
  })
})

describe('buildTraverseQueryKey', () => {
  it('is stable regardless of seed order', () => {
    const a = buildTraverseQueryKey(['b', 'a'], 2)
    const b = buildTraverseQueryKey(['a', 'b'], 2)
    expect(a).toBe(b)
  })
})

describe('graphExplorerLayout', () => {
  const nodes: GraphTraversalNode[] = [
    {
      entity_id: 'root',
      entity_type: 'User',
      display_name: 'Root',
      source_table: 'profiles',
      source_id: '1',
      depth: 0,
      path: ['root'],
    },
    {
      entity_id: 'child',
      entity_type: 'Meeting',
      display_name: 'Standup',
      source_table: 'meetings',
      source_id: '2',
      depth: 1,
      path: ['root', 'child'],
    },
  ]

  it('creates one flow node per traversal node', () => {
    const flow = layoutTraversalNodes(nodes)
    expect(flow).toHaveLength(2)
    expect(flow.map((n) => n.id)).toEqual(['root', 'child'])
  })

  it('derives edges from traversal paths', () => {
    const edges = edgesFromTraversal(nodes)
    expect(edges).toHaveLength(1)
    expect(edges[0].source).toBe('root')
    expect(edges[0].target).toBe('child')
  })

  it('deduplicates node ids when merging layout', () => {
    const flow = layoutTraversalNodes(nodes)
    const again = layoutTraversalNodes(nodes)
    const merged = new Map(flow.map((n) => [n.id, n]))
    for (const n of again) merged.set(n.id, n)
    expect(merged.size).toBe(2)
  })
})
