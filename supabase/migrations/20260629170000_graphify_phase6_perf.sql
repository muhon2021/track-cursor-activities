-- Graphify Phase 6: traversal cache, index tuning, search deduplication

-- Traversal-oriented relationship indexes (tenant-scoped for large graphs)
CREATE INDEX IF NOT EXISTS idx_graph_relationships_tenant_source_active
  ON public.graph_relationships(tenant_id, source_entity_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_graph_relationships_tenant_target_active
  ON public.graph_relationships(tenant_id, target_entity_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_graph_entities_tenant_type_active
  ON public.graph_entities(tenant_id, entity_type)
  WHERE status = 'active';

-- Short-lived traversal result cache (per user — respects graphify_can_access_entity via stored RPC output)
CREATE TABLE IF NOT EXISTS public.graphify_traversal_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cache_key TEXT NOT NULL,
  result JSONB NOT NULL DEFAULT '[]'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT graphify_traversal_cache_unique UNIQUE (tenant_id, user_id, cache_key)
);

CREATE INDEX IF NOT EXISTS idx_graphify_traversal_cache_expires
  ON public.graphify_traversal_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_graphify_traversal_cache_lookup
  ON public.graphify_traversal_cache(tenant_id, user_id, cache_key);

ALTER TABLE public.graphify_traversal_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "graphify_traversal_cache_select_own"
  ON public.graphify_traversal_cache FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "graphify_traversal_cache_insert_own"
  ON public.graphify_traversal_cache FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "graphify_traversal_cache_update_own"
  ON public.graphify_traversal_cache FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "graphify_traversal_cache_delete_own"
  ON public.graphify_traversal_cache FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "graphify_traversal_cache_manage_service"
  ON public.graphify_traversal_cache FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Purge expired cache rows (call after sync jobs or via pg_cron)
CREATE OR REPLACE FUNCTION public.graphify_purge_traversal_cache(
  p_tenant_id UUID DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deleted AS (
    DELETE FROM public.graphify_traversal_cache c
    WHERE c.expires_at < now()
      AND (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
    RETURNING 1
  )
  SELECT COUNT(*)::BIGINT FROM deleted;
$$;

CREATE OR REPLACE FUNCTION public.graphify_invalidate_traversal_cache(
  p_tenant_id UUID
)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deleted AS (
    DELETE FROM public.graphify_traversal_cache c
    WHERE c.tenant_id = p_tenant_id
    RETURNING 1
  )
  SELECT COUNT(*)::BIGINT FROM deleted;
$$;

GRANT EXECUTE ON FUNCTION public.graphify_purge_traversal_cache(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.graphify_invalidate_traversal_cache(UUID) TO service_role;

-- Prefer one match per (entity_type, canonical_name); source-linked entities win
CREATE OR REPLACE FUNCTION public.graphify_match_entities(
  p_tenant_id UUID,
  p_query TEXT,
  p_entity_types TEXT[] DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  entity_type TEXT,
  canonical_name TEXT,
  display_name TEXT,
  source_table TEXT,
  source_id UUID,
  metadata JSONB,
  confidence NUMERIC,
  match_score REAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT lower(trim(p_query)) AS term
  ),
  name_matches AS (
    SELECT
      e.id,
      e.entity_type,
      e.canonical_name,
      e.display_name,
      e.source_table,
      e.source_id,
      e.metadata,
      e.confidence,
      CASE
        WHEN lower(e.canonical_name) = (SELECT term FROM q) THEN 1.0
        WHEN lower(e.display_name) = (SELECT term FROM q) THEN 0.95
        WHEN lower(e.canonical_name) LIKE (SELECT term FROM q) || '%' THEN 0.85
        ELSE 0.7
      END::REAL AS match_score
    FROM public.graph_entities e, q
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'active'
      AND (
        lower(e.canonical_name) LIKE '%' || q.term || '%'
        OR lower(e.display_name) LIKE '%' || q.term || '%'
      )
      AND (p_entity_types IS NULL OR e.entity_type = ANY(p_entity_types))
      AND public.graphify_can_access_entity(auth.uid(), e.id)
  ),
  alias_matches AS (
    SELECT
      e.id,
      e.entity_type,
      e.canonical_name,
      e.display_name,
      e.source_table,
      e.source_id,
      e.metadata,
      e.confidence,
      0.75::REAL AS match_score
    FROM public.graph_entity_aliases a
    JOIN public.graph_entities e ON e.id = a.entity_id
    CROSS JOIN q
    WHERE a.tenant_id = p_tenant_id
      AND e.status = 'active'
      AND a.normalized_alias LIKE '%' || q.term || '%'
      AND (p_entity_types IS NULL OR e.entity_type = ANY(p_entity_types))
      AND public.graphify_can_access_entity(auth.uid(), e.id)
  ),
  combined AS (
    SELECT * FROM name_matches
    UNION
    SELECT * FROM alias_matches
  ),
  by_id AS (
    SELECT DISTINCT ON (c.id)
      c.id, c.entity_type, c.canonical_name, c.display_name,
      c.source_table, c.source_id, c.metadata, c.confidence, c.match_score
    FROM combined c
    ORDER BY c.id, c.match_score DESC
  ),
  deduped AS (
    SELECT DISTINCT ON (b.entity_type, lower(b.canonical_name))
      b.id, b.entity_type, b.canonical_name, b.display_name,
      b.source_table, b.source_id, b.metadata, b.confidence, b.match_score
    FROM by_id b
    ORDER BY
      b.entity_type,
      lower(b.canonical_name),
      (CASE WHEN b.source_id IS NOT NULL THEN 0 ELSE 1 END),
      b.match_score DESC
  )
  SELECT
    d.id, d.entity_type, d.canonical_name, d.display_name,
    d.source_table, d.source_id, d.metadata, d.confidence, d.match_score
  FROM deduped d
  ORDER BY d.match_score DESC
  LIMIT GREATEST(p_limit, 1);
$$;
