import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { TraversalNode } from './graphify-types.ts'

const MEMORY_TTL_MS = 60_000
const DB_TTL_SECONDS = 300

type MemoryEntry = { expires: number; nodes: TraversalNode[] }

const memoryCache = new Map<string, MemoryEntry>()

export interface TraverseCacheOptions {
  tenantId: string
  userId?: string | null
  seedEntityIds: string[]
  maxDepth?: number
  relationshipTypes?: string[] | null
  maxNodes?: number
}

export function buildTraverseCacheKey(opts: TraverseCacheOptions): string {
  const seeds = [...opts.seedEntityIds].sort().join(',')
  const rels = opts.relationshipTypes?.length
    ? [...opts.relationshipTypes].sort().join(',')
    : '*'
  return `${opts.tenantId}:${opts.userId ?? 'anon'}:${seeds}:${opts.maxDepth ?? 2}:${rels}:${opts.maxNodes ?? 50}`
}

function readMemory(key: string): TraversalNode[] | null {
  const entry = memoryCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    memoryCache.delete(key)
    return null
  }
  return entry.nodes
}

function writeMemory(key: string, nodes: TraversalNode[]): void {
  memoryCache.set(key, { expires: Date.now() + MEMORY_TTL_MS, nodes })
  if (memoryCache.size > 200) {
    const oldest = memoryCache.keys().next().value
    if (oldest) memoryCache.delete(oldest)
  }
}

export async function getCachedTraversal(
  supabase: SupabaseClient,
  opts: TraverseCacheOptions
): Promise<TraversalNode[] | null> {
  const key = buildTraverseCacheKey(opts)
  const fromMemory = readMemory(key)
  if (fromMemory) return fromMemory

  if (!opts.userId) return null

  const { data, error } = await supabase
    .from('graphify_traversal_cache')
    .select('result, expires_at')
    .eq('tenant_id', opts.tenantId)
    .eq('user_id', opts.userId)
    .eq('cache_key', key)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error || !data?.result) return null

  const nodes = data.result as TraversalNode[]
  writeMemory(key, nodes)
  return nodes
}

export async function setCachedTraversal(
  supabase: SupabaseClient,
  opts: TraverseCacheOptions,
  nodes: TraversalNode[]
): Promise<void> {
  const key = buildTraverseCacheKey(opts)
  writeMemory(key, nodes)

  if (!opts.userId) return

  const expiresAt = new Date(Date.now() + DB_TTL_SECONDS * 1000).toISOString()
  await supabase.from('graphify_traversal_cache').upsert(
    {
      tenant_id: opts.tenantId,
      user_id: opts.userId,
      cache_key: key,
      result: nodes,
      expires_at: expiresAt,
    },
    { onConflict: 'tenant_id,user_id,cache_key' }
  )
}

export async function invalidateTenantTraversalCache(
  supabase: SupabaseClient,
  tenantId: string
): Promise<void> {
  memoryCache.clear()
  await supabase.rpc('graphify_invalidate_traversal_cache', { p_tenant_id: tenantId })
}
