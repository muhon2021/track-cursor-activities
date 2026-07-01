-- Graphify coverage helpers (fast orphan/topic stats)

CREATE OR REPLACE FUNCTION public.graphify_count_orphans(p_tenant_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::BIGINT
  FROM public.graph_entities e
  WHERE e.tenant_id = p_tenant_id
    AND e.status = 'active'
    AND NOT EXISTS (
      SELECT 1
      FROM public.graph_relationships r
      WHERE r.status = 'active'
        AND (r.source_entity_id = e.id OR r.target_entity_id = e.id)
    );
$$;

CREATE OR REPLACE FUNCTION public.graphify_list_orphans(
  p_tenant_id UUID,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  entity_type TEXT,
  source_table TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.display_name, e.entity_type, e.source_table
  FROM public.graph_entities e
  WHERE e.tenant_id = p_tenant_id
    AND e.status = 'active'
    AND NOT EXISTS (
      SELECT 1
      FROM public.graph_relationships r
      WHERE r.status = 'active'
        AND (r.source_entity_id = e.id OR r.target_entity_id = e.id)
    )
  ORDER BY e.updated_at DESC
  LIMIT GREATEST(p_limit, 1);
$$;

CREATE OR REPLACE FUNCTION public.graphify_topic_mention_stats(
  p_tenant_id UUID,
  p_limit INT DEFAULT 500
)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  mention_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.display_name,
    COUNT(r.id)::BIGINT AS mention_count
  FROM public.graph_entities t
  LEFT JOIN public.graph_relationships r
    ON r.status = 'active'
    AND (r.target_entity_id = t.id OR r.source_entity_id = t.id)
  WHERE t.tenant_id = p_tenant_id
    AND t.status = 'active'
    AND t.entity_type = 'Topic'
  GROUP BY t.id, t.display_name
  ORDER BY mention_count ASC, t.display_name ASC
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.graphify_count_orphans(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.graphify_list_orphans(UUID, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.graphify_topic_mention_stats(UUID, INT) TO authenticated, service_role;
