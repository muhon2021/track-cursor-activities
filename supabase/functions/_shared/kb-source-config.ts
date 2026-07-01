import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface KbSourceConfig {
  chunk_size: number
  chunk_overlap: number
  chunk_strategy: string
  strategy_config: Record<string, unknown>
  reranker_provider: string | null
  reranker_threshold: number
  reranker_max_results: number
  reranker_enabled: boolean
  reranker_override_global: boolean
}

export interface GlobalRerankerConfig {
  provider: string
  threshold: number
  max_results: number
  enabled: boolean
}

const DEFAULT_SOURCE_CONFIG: KbSourceConfig = {
  chunk_size: 1000,
  chunk_overlap: 100,
  chunk_strategy: 'fixed',
  strategy_config: {},
  reranker_provider: 'cohere',
  reranker_threshold: 0.75,
  reranker_max_results: 10,
  reranker_enabled: false,
  reranker_override_global: false,
}

export async function loadSourceConfig(
  supabase: SupabaseClient,
  sourceId?: string | null
): Promise<KbSourceConfig> {
  if (!sourceId) return { ...DEFAULT_SOURCE_CONFIG }

  const { data } = await supabase
    .from('kb_source_config')
    .select('*')
    .eq('source_id', sourceId)
    .maybeSingle()

  if (!data) return { ...DEFAULT_SOURCE_CONFIG }

  return {
    chunk_size: data.chunk_size ?? 1000,
    chunk_overlap: data.chunk_overlap ?? 100,
    chunk_strategy: data.chunk_strategy ?? 'fixed',
    strategy_config: (data.strategy_config as Record<string, unknown>) ?? {},
    reranker_provider: data.reranker_provider,
    reranker_threshold: Number(data.reranker_threshold ?? 0.75),
    reranker_max_results: data.reranker_max_results ?? 10,
    reranker_enabled: data.reranker_enabled ?? false,
    reranker_override_global: data.reranker_override_global ?? false,
  }
}

export async function loadGlobalRerankerConfig(
  supabase: SupabaseClient
): Promise<GlobalRerankerConfig> {
  const { data } = await supabase
    .from('system_settings')
    .select('key, value')
    .eq('category', 'rag')

  const map: Record<string, unknown> = {}
  for (const row of data ?? []) {
    map[row.key] = row.value
  }

  const parseVal = (v: unknown, fallback: string | number | boolean) => {
    if (v === null || v === undefined) return fallback
    if (typeof v === 'string') {
      try {
        return JSON.parse(v)
      } catch {
        return v
      }
    }
    return v
  }

  return {
    provider: String(parseVal(map.reranker_provider, 'cohere')),
    threshold: Number(parseVal(map.reranker_threshold, 0.75)),
    max_results: Number(parseVal(map.reranker_max_results, 10)),
    enabled: Boolean(parseVal(map.reranker_enabled, false)),
  }
}

export async function resolveRerankerConfig(
  supabase: SupabaseClient,
  sourceId?: string | null
): Promise<GlobalRerankerConfig & { source_override: boolean }> {
  const global = await loadGlobalRerankerConfig(supabase)
  if (!sourceId) {
    return { ...global, source_override: false }
  }

  const source = await loadSourceConfig(supabase, sourceId)
  if (!source.reranker_override_global) {
    return { ...global, source_override: false }
  }

  return {
    provider: source.reranker_provider ?? global.provider,
    threshold: source.reranker_threshold,
    max_results: source.reranker_max_results,
    enabled: source.reranker_enabled,
    source_override: true,
  }
}
