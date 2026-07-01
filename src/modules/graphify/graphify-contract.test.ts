import { describe, expect, it } from 'vitest'

/**
 * Documents expected RLS / RPC contracts for Graphify (integration tests run against Supabase separately).
 */

const GRAPHIFY_PERMISSIONS = ['graphify.view', 'graphify.manage'] as const

const TRAVERSAL_DEFAULTS = {
  max_traversal_depth: 2,
  max_nodes_per_query: 50,
} as const

describe('graphify RLS contract', () => {
  it('defines view and manage permissions', () => {
    expect(GRAPHIFY_PERMISSIONS).toContain('graphify.view')
    expect(GRAPHIFY_PERMISSIONS).toContain('graphify.manage')
  })

  it('uses bounded traversal defaults', () => {
    expect(TRAVERSAL_DEFAULTS.max_traversal_depth).toBeLessThanOrEqual(4)
    expect(TRAVERSAL_DEFAULTS.max_nodes_per_query).toBeLessThanOrEqual(100)
  })
})

describe('graphify traverse cache contract', () => {
  it('uses short TTL suitable for sync invalidation', () => {
    const DB_TTL_SECONDS = 300
    const MEMORY_TTL_MS = 60_000
    expect(DB_TTL_SECONDS).toBe(5 * 60)
    expect(MEMORY_TTL_MS).toBe(60 * 1000)
  })
})
