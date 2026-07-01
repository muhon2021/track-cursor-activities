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
