-- 20260629170000_graphify_phase6_perf.sql
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


-- 20260629180000_graphify_token_search.sql
-- Graphify: token-based fuzzy search (case/punctuation insensitive)

CREATE OR REPLACE FUNCTION public.graphify_normalize_search_text(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', ' ', 'g'));
$$;

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
    SELECT public.graphify_normalize_search_text(p_query) AS term
  ),
  tokens AS (
    SELECT tok AS token
    FROM q,
    LATERAL regexp_split_to_table(q.term, '\s+') AS tok
    WHERE length(tok) >= 2
  ),
  token_count AS (
    SELECT COUNT(*)::int AS n FROM tokens
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
      public.graphify_normalize_search_text(e.display_name) AS norm_display,
      public.graphify_normalize_search_text(e.canonical_name) AS norm_canonical,
      CASE
        WHEN public.graphify_normalize_search_text(e.canonical_name) = (SELECT term FROM q) THEN 1.0
        WHEN public.graphify_normalize_search_text(e.display_name) = (SELECT term FROM q) THEN 0.95
        WHEN public.graphify_normalize_search_text(e.canonical_name) LIKE (SELECT term FROM q) || '%' THEN 0.85
        WHEN public.graphify_normalize_search_text(e.display_name) LIKE (SELECT term FROM q) || '%' THEN 0.82
        ELSE 0.7
      END::REAL AS base_score
    FROM public.graph_entities e, q
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'active'
      AND (p_entity_types IS NULL OR e.entity_type = ANY(p_entity_types))
      AND public.graphify_can_access_entity(auth.uid(), e.id)
      AND (
        (SELECT term FROM q) = ''
        OR public.graphify_normalize_search_text(e.display_name) LIKE '%' || (SELECT term FROM q) || '%'
        OR public.graphify_normalize_search_text(e.canonical_name) LIKE '%' || (SELECT term FROM q) || '%'
        OR (
          (SELECT n FROM token_count) > 0
          AND NOT EXISTS (
            SELECT 1
            FROM tokens tok
            WHERE public.graphify_normalize_search_text(e.display_name) NOT LIKE '%' || tok.token || '%'
              AND public.graphify_normalize_search_text(e.canonical_name) NOT LIKE '%' || tok.token || '%'
          )
        )
      )
  ),
  scored_names AS (
    SELECT
      nm.id,
      nm.entity_type,
      nm.canonical_name,
      nm.display_name,
      nm.source_table,
      nm.source_id,
      nm.metadata,
      nm.confidence,
      (
        nm.base_score
        + CASE
            WHEN (SELECT n FROM token_count) = 0 THEN 0
            ELSE 0.05 * (
              SELECT COUNT(*)::real
              FROM tokens tok
              WHERE nm.norm_display LIKE '%' || tok.token || '%'
                 OR nm.norm_canonical LIKE '%' || tok.token || '%'
            ) / (SELECT n FROM token_count)::real
          END
      )::REAL AS match_score
    FROM name_matches nm
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
      AND (p_entity_types IS NULL OR e.entity_type = ANY(p_entity_types))
      AND public.graphify_can_access_entity(auth.uid(), e.id)
      AND (
        a.normalized_alias LIKE '%' || (SELECT term FROM q) || '%'
        OR (
          (SELECT n FROM token_count) > 0
          AND NOT EXISTS (
            SELECT 1
            FROM tokens tok
            WHERE a.normalized_alias NOT LIKE '%' || tok.token || '%'
          )
        )
      )
  ),
  combined AS (
    SELECT * FROM scored_names
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

GRANT EXECUTE ON FUNCTION public.graphify_normalize_search_text(TEXT) TO authenticated, service_role;


-- 20260629190000_graphify_caller_user_rpcs.sql
-- Graphify: allow service-role RAG/agent pipelines to pass explicit caller user id
-- (auth.uid() is NULL under service role, which blocked agent chat graph retrieval)
--
-- Also includes graphify_normalize_search_text (from 20260629180000) so this file
-- can be run standalone in SQL Editor without running prior migrations first.

CREATE OR REPLACE FUNCTION public.graphify_normalize_search_text(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', ' ', 'g'));
$$;

GRANT EXECUTE ON FUNCTION public.graphify_normalize_search_text(TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.graphify_effective_user_id(p_caller_user_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_caller_user_id IS NOT NULL AND auth.uid() IS NULL THEN p_caller_user_id
    ELSE auth.uid()
  END;
$$;

GRANT EXECUTE ON FUNCTION public.graphify_effective_user_id(UUID) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.graphify_match_entities(UUID, TEXT, TEXT[], INT);

CREATE OR REPLACE FUNCTION public.graphify_match_entities(
  p_tenant_id UUID,
  p_query TEXT,
  p_entity_types TEXT[] DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_caller_user_id UUID DEFAULT NULL
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
    SELECT public.graphify_normalize_search_text(p_query) AS term
  ),
  tokens AS (
    SELECT tok AS token
    FROM q,
    LATERAL regexp_split_to_table(q.term, '\s+') AS tok
    WHERE length(tok) >= 2
  ),
  token_count AS (
    SELECT COUNT(*)::int AS n FROM tokens
  ),
  eff AS (
    SELECT public.graphify_effective_user_id(p_caller_user_id) AS uid
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
      public.graphify_normalize_search_text(e.display_name) AS norm_display,
      public.graphify_normalize_search_text(e.canonical_name) AS norm_canonical,
      CASE
        WHEN public.graphify_normalize_search_text(e.canonical_name) = (SELECT term FROM q) THEN 1.0
        WHEN public.graphify_normalize_search_text(e.display_name) = (SELECT term FROM q) THEN 0.95
        WHEN public.graphify_normalize_search_text(e.canonical_name) LIKE (SELECT term FROM q) || '%' THEN 0.85
        WHEN public.graphify_normalize_search_text(e.display_name) LIKE (SELECT term FROM q) || '%' THEN 0.82
        ELSE 0.7
      END::REAL AS base_score
    FROM public.graph_entities e, q, eff
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'active'
      AND (p_entity_types IS NULL OR e.entity_type = ANY(p_entity_types))
      AND public.graphify_can_access_entity(eff.uid, e.id)
      AND (
        (SELECT term FROM q) = ''
        OR public.graphify_normalize_search_text(e.display_name) LIKE '%' || (SELECT term FROM q) || '%'
        OR public.graphify_normalize_search_text(e.canonical_name) LIKE '%' || (SELECT term FROM q) || '%'
        OR (
          (SELECT n FROM token_count) > 0
          AND NOT EXISTS (
            SELECT 1
            FROM tokens tok
            WHERE public.graphify_normalize_search_text(e.display_name) NOT LIKE '%' || tok.token || '%'
              AND public.graphify_normalize_search_text(e.canonical_name) NOT LIKE '%' || tok.token || '%'
          )
        )
      )
  ),
  scored_names AS (
    SELECT
      nm.id,
      nm.entity_type,
      nm.canonical_name,
      nm.display_name,
      nm.source_table,
      nm.source_id,
      nm.metadata,
      nm.confidence,
      (
        nm.base_score
        + CASE
            WHEN (SELECT n FROM token_count) = 0 THEN 0
            ELSE 0.05 * (
              SELECT COUNT(*)::real
              FROM tokens tok
              WHERE nm.norm_display LIKE '%' || tok.token || '%'
                 OR nm.norm_canonical LIKE '%' || tok.token || '%'
            ) / (SELECT n FROM token_count)::real
          END
      )::REAL AS match_score
    FROM name_matches nm
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
    CROSS JOIN eff
    WHERE a.tenant_id = p_tenant_id
      AND e.status = 'active'
      AND (p_entity_types IS NULL OR e.entity_type = ANY(p_entity_types))
      AND public.graphify_can_access_entity(eff.uid, e.id)
      AND (
        a.normalized_alias LIKE '%' || (SELECT term FROM q) || '%'
        OR (
          (SELECT n FROM token_count) > 0
          AND NOT EXISTS (
            SELECT 1
            FROM tokens tok
            WHERE a.normalized_alias NOT LIKE '%' || tok.token || '%'
          )
        )
      )
  ),
  combined AS (
    SELECT * FROM scored_names
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

GRANT EXECUTE ON FUNCTION public.graphify_match_entities(UUID, TEXT, TEXT[], INT, UUID) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.graphify_traverse(UUID, UUID[], INT, TEXT[], INT);

CREATE OR REPLACE FUNCTION public.graphify_traverse(
  p_tenant_id UUID,
  p_seed_entity_ids UUID[],
  p_max_depth INT DEFAULT 2,
  p_relationship_types TEXT[] DEFAULT NULL,
  p_max_nodes INT DEFAULT 50,
  p_caller_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  entity_id UUID,
  entity_type TEXT,
  display_name TEXT,
  source_table TEXT,
  source_id UUID,
  depth INT,
  path UUID[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE eff AS (
    SELECT public.graphify_effective_user_id(p_caller_user_id) AS uid
  ),
  walk AS (
    SELECT
      e.id AS entity_id,
      e.entity_type,
      e.display_name,
      e.source_table,
      e.source_id,
      0 AS depth,
      ARRAY[e.id] AS path
    FROM public.graph_entities e
    CROSS JOIN eff
    WHERE e.id = ANY(p_seed_entity_ids)
      AND e.tenant_id = p_tenant_id
      AND e.status = 'active'
      AND public.graphify_can_access_entity(eff.uid, e.id)

    UNION ALL

    SELECT
      n.id AS entity_id,
      n.entity_type,
      n.display_name,
      n.source_table,
      n.source_id,
      w.depth + 1 AS depth,
      w.path || n.id AS path
    FROM walk w
    CROSS JOIN eff
    JOIN public.graph_relationships r ON (
      (r.source_entity_id = w.entity_id OR r.target_entity_id = w.entity_id)
      AND r.status = 'active'
      AND (p_relationship_types IS NULL OR r.relationship_type = ANY(p_relationship_types))
    )
    JOIN public.graph_entities n ON n.id = CASE
      WHEN r.source_entity_id = w.entity_id THEN r.target_entity_id
      ELSE r.source_entity_id
    END
    WHERE w.depth < GREATEST(p_max_depth, 0)
      AND n.status = 'active'
      AND n.tenant_id = p_tenant_id
      AND NOT n.id = ANY(w.path)
      AND public.graphify_can_access_entity(eff.uid, n.id)
  )
  SELECT DISTINCT ON (entity_id)
    entity_id, entity_type, display_name, source_table, source_id, depth, path
  FROM walk
  ORDER BY entity_id, depth ASC
  LIMIT GREATEST(p_max_nodes, 1);
$$;

GRANT EXECUTE ON FUNCTION public.graphify_traverse(UUID, UUID[], INT, TEXT[], INT, UUID) TO authenticated, service_role;


-- 20260629200000_graphify_service_role_access_fix.sql
-- Fix Graphify access when agent/RAG calls RPCs with service role + acting_user_id.
-- graphify_can_access_entity used get_user_tenant_id() which reads auth.uid() (NULL under service role).

CREATE OR REPLACE FUNCTION public.get_tenant_id_for_user(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT r.tenant_id
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = p_user_id
      ORDER BY CASE r.slug
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'manager' THEN 3
        WHEN 'member' THEN 4
        WHEN 'viewer' THEN 5
        ELSE 6
      END
      LIMIT 1
    ),
    '00000000-0000-0000-0000-000000000001'::UUID
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_id_for_user(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.graphify_effective_user_id(p_caller_user_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- Service-role edge functions pass acting_user_id; auth.uid() is NULL
    WHEN p_caller_user_id IS NOT NULL AND auth.uid() IS NULL THEN p_caller_user_id
    ELSE auth.uid()
  END;
$$;

CREATE OR REPLACE FUNCTION public.graphify_can_access_entity(
  p_user_id UUID,
  p_entity_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity public.graph_entities%ROWTYPE;
  v_owner UUID;
  v_source_id UUID;
  v_tenant_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_entity FROM public.graph_entities WHERE id = p_entity_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    v_tenant_id := public.get_user_tenant_id();
  ELSE
    v_tenant_id := public.get_tenant_id_for_user(p_user_id);
  END IF;

  IF v_entity.tenant_id <> v_tenant_id THEN
    RETURN false;
  END IF;

  IF public.has_role(p_user_id, 'admin') OR public.has_permission(p_user_id, 'graphify.manage') THEN
    RETURN true;
  END IF;

  v_owner := NULLIF(v_entity.metadata->>'user_id', '')::UUID;

  IF v_entity.source_table = 'agent_memories' AND v_entity.source_id IS NOT NULL THEN
    SELECT am.user_id INTO v_owner FROM public.agent_memories am
    WHERE am.id = v_entity.source_id AND am.deleted_at IS NULL;
    IF v_owner IS NOT NULL AND v_owner <> p_user_id THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;

  IF v_entity.source_table = 'user_knowledge_files' AND v_entity.source_id IS NOT NULL THEN
    SELECT ukf.user_id INTO v_owner FROM public.user_knowledge_files ukf
    WHERE ukf.id = v_entity.source_id;
    IF v_owner IS NOT NULL AND v_owner <> p_user_id THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;

  IF v_entity.source_table IN ('knowledge_files', 'unified_documents') AND v_entity.source_id IS NOT NULL THEN
    IF v_entity.source_table = 'knowledge_files' THEN
      SELECT kf.source_id INTO v_source_id FROM public.knowledge_files kf WHERE kf.id = v_entity.source_id;
      IF v_source_id IS NOT NULL AND NOT public.check_kb_source_permission(v_source_id, 'view') THEN
        RETURN false;
      END IF;
    END IF;
  END IF;

  IF v_owner IS NOT NULL AND v_owner <> p_user_id THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.graphify_can_access_entity(UUID, UUID) TO authenticated, service_role;


-- 20260630120000_openrouter_integration.sql
-- OpenRouter AI provider integration (Integration Hub catalog + credential fields).
-- Runtime: organization_integrations.config stores encrypted api_key via integration-config Edge Function.
-- AI routing is not wired yet; ai_providers row links the integration for future phases.

-- Environments may have ai_providers without the link column from 20260103_link_ai_providers_to_integrations.
ALTER TABLE public.ai_providers
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.ai_providers
  ADD COLUMN IF NOT EXISTS integration_provider_id UUID
  REFERENCES public.integration_providers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_providers_integration_provider_id
  ON public.ai_providers(integration_provider_id);

DO $$
DECLARE
  ai_category_id UUID;
  openrouter_provider_id UUID;
  dup_category_id UUID;
BEGIN
  -- Use the SAME category tab as OpenAI / Anthropic / Gemini / Perplexity (do not create a second AI tab).
  SELECT ip.category_id INTO ai_category_id
  FROM public.integration_providers ip
  WHERE ip.slug IN ('openai', 'anthropic', 'google-gemini', 'perplexity')
  ORDER BY CASE ip.slug
    WHEN 'openai' THEN 1
    WHEN 'anthropic' THEN 2
    WHEN 'google-gemini' THEN 3
    ELSE 4
  END
  LIMIT 1;

  IF ai_category_id IS NULL THEN
    INSERT INTO public.integration_categories (name, slug, description, icon, display_order, enabled)
    VALUES (
      'AI Providers',
      'ai-providers',
      'AI models for chat, embeddings, and analysis',
      'Brain',
      10,
      true
    )
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      icon = EXCLUDED.icon,
      display_order = EXCLUDED.display_order,
      enabled = true,
      updated_at = now();

    SELECT id INTO ai_category_id
    FROM public.integration_categories
    WHERE slug = 'ai-providers'
    LIMIT 1;
  END IF;

  IF ai_category_id IS NULL THEN
    RAISE EXCEPTION 'Could not resolve AI Providers integration category';
  END IF;

  INSERT INTO public.integration_providers (
    category_id,
    name,
    slug,
    description,
    auth_type,
    docs_url,
    is_available,
    is_coming_soon,
    display_order
  )
  VALUES (
    ai_category_id,
    'OpenRouter',
    'openrouter',
    'Access 300+ AI models through a single API.',
    'api_key',
    'https://openrouter.ai/docs',
    true,
    false,
    50
  )
  ON CONFLICT (slug) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    auth_type = EXCLUDED.auth_type,
    docs_url = EXCLUDED.docs_url,
    is_available = EXCLUDED.is_available,
    is_coming_soon = EXCLUDED.is_coming_soon,
    display_order = EXCLUDED.display_order,
    updated_at = now();

  SELECT id INTO openrouter_provider_id
  FROM public.integration_providers
  WHERE slug = 'openrouter'
  LIMIT 1;

  INSERT INTO public.integration_fields (
    provider_id,
    field_key,
    label,
    field_type,
    placeholder,
    default_value,
    is_required,
    is_sensitive,
    help_text,
    display_order
  )
  VALUES
    (
      openrouter_provider_id,
      'api_key',
      'API Key',
      'password',
      'sk-or-...',
      NULL,
      true,
      true,
      'Your OpenRouter API key from openrouter.ai/keys',
      10
    ),
    (
      openrouter_provider_id,
      'default_model',
      'Default Model (optional)',
      'text',
      'deepseek/deepseek-r1',
      'deepseek/deepseek-r1',
      false,
      false,
      'Optional default model slug for future OpenRouter-powered features.',
      20
    )
  ON CONFLICT (provider_id, field_key) DO UPDATE SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    default_value = EXCLUDED.default_value,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;

  INSERT INTO public.ai_providers (
    name,
    slug,
    description,
    api_key_secret_name,
    base_url,
    enabled,
    integration_provider_id
  )
  VALUES (
    'OpenRouter',
    'openrouter',
    'Unified API gateway for 300+ AI models',
    'OPENROUTER_API_KEY',
    'https://openrouter.ai/api/v1',
    true,
    openrouter_provider_id
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    api_key_secret_name = EXCLUDED.api_key_secret_name,
    base_url = EXCLUDED.base_url,
    enabled = EXCLUDED.enabled,
    integration_provider_id = EXCLUDED.integration_provider_id;

  -- Remove duplicate empty "AI Providers" tabs created when openrouter was assigned to a new category.
  FOR dup_category_id IN
    SELECT ic.id
    FROM public.integration_categories ic
    WHERE ic.id <> ai_category_id
      AND (
        lower(trim(ic.name)) IN ('ai providers', 'ai provider')
        OR ic.slug IN ('ai-providers', 'ai-provider')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.integration_providers ip
        WHERE ip.category_id = ic.id
          AND ip.slug <> 'openrouter'
      )
  LOOP
    DELETE FROM public.integration_categories WHERE id = dup_category_id;
  END LOOP;
END $$;


