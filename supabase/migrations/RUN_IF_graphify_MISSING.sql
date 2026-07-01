-- ============================================================================
-- ONE-TIME FIX: Apply Graphify schema if graph_entities is missing
-- ============================================================================
-- Run in Supabase Dashboard -> SQL Editor if npm migrations:run fails
-- (Same as migration 20260629120000_graphify_core.sql)
-- ============================================================================
-- ============================================================================
-- Graphify: Enterprise Knowledge Graph core schema
-- Postgres adjacency model with tenant isolation, RLS, and traversal RPCs
-- ============================================================================

-- Feature flag (default off)
INSERT INTO public.app_config (key, value, category, description)
VALUES ('features.enableGraphify', 'false'::jsonb, 'features', 'Enable Graphify knowledge graph and hybrid retrieval')
ON CONFLICT (key) DO NOTHING;

-- Graphify permissions
INSERT INTO public.permissions (key, name, category, resource, action, description)
SELECT v.key, v.name, v.category, v.resource, v.action, v.description
FROM (VALUES
  ('graphify.view', 'View Graphify', 'Graphify', 'graphify', 'view', 'Search and view knowledge graph entities'),
  ('graphify.manage', 'Manage Graphify', 'Graphify', 'graphify', 'manage', 'Configure Graphify and run sync jobs')
) AS v(key, name, category, resource, action, description)
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.key = v.key);

-- Per-agent Graphify toggle
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS graphify_enabled BOOLEAN NOT NULL DEFAULT false;

-- ========================
-- graph_entities
-- ========================
CREATE TABLE IF NOT EXISTS public.graph_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  source_table TEXT,
  source_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(5,4) DEFAULT 1.0,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'merged', 'archived')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_graph_entities_tenant_type_name
  ON public.graph_entities(tenant_id, entity_type, canonical_name);
CREATE INDEX IF NOT EXISTS idx_graph_entities_source
  ON public.graph_entities(tenant_id, source_table, source_id)
  WHERE source_table IS NOT NULL AND source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_graph_entities_status
  ON public.graph_entities(tenant_id, status) WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_graph_entities_source_unique
  ON public.graph_entities(tenant_id, source_table, source_id, entity_type)
  WHERE source_table IS NOT NULL AND source_id IS NOT NULL AND status = 'active';

-- ========================
-- graph_entity_aliases
-- ========================
CREATE TABLE IF NOT EXISTS public.graph_entity_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES public.graph_entities(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_graph_entity_aliases_unique
  ON public.graph_entity_aliases(tenant_id, normalized_alias, entity_id);
CREATE INDEX IF NOT EXISTS idx_graph_entity_aliases_lookup
  ON public.graph_entity_aliases(tenant_id, normalized_alias);

-- ========================
-- graph_relationships
-- ========================
CREATE TABLE IF NOT EXISTS public.graph_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_entity_id UUID NOT NULL REFERENCES public.graph_entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES public.graph_entities(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  weight NUMERIC(5,4) DEFAULT 0.5,
  confidence NUMERIC(5,4) DEFAULT 1.0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_table TEXT,
  source_id UUID,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT graph_relationships_no_self_loop CHECK (source_entity_id <> target_entity_id)
);

CREATE INDEX IF NOT EXISTS idx_graph_relationships_source
  ON public.graph_relationships(source_entity_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_graph_relationships_target
  ON public.graph_relationships(target_entity_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_graph_relationships_type
  ON public.graph_relationships(tenant_id, relationship_type) WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_graph_relationships_unique_active
  ON public.graph_relationships(source_entity_id, target_entity_id, relationship_type)
  WHERE status = 'active';

-- ========================
-- graph_memory_links
-- ========================
CREATE TABLE IF NOT EXISTS public.graph_memory_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  memory_id UUID NOT NULL,
  entity_id UUID NOT NULL REFERENCES public.graph_entities(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'about'
    CHECK (link_type IN ('mentions', 'about', 'derived_from')),
  confidence NUMERIC(5,4) DEFAULT 0.8,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_graph_memory_links_unique
  ON public.graph_memory_links(memory_id, entity_id, link_type);
CREATE INDEX IF NOT EXISTS idx_graph_memory_links_entity
  ON public.graph_memory_links(entity_id);

-- ========================
-- graph_query_logs
-- ========================
CREATE TABLE IF NOT EXISTS public.graph_query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  query TEXT,
  query_type TEXT NOT NULL DEFAULT 'search',
  latency_ms INTEGER,
  nodes_returned INTEGER DEFAULT 0,
  edges_traversed INTEGER DEFAULT 0,
  tokens_saved INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_graph_query_logs_tenant_created
  ON public.graph_query_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_graph_query_logs_user
  ON public.graph_query_logs(user_id, created_at DESC);

-- ========================
-- graphify_config
-- ========================
CREATE TABLE IF NOT EXISTS public.graphify_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  max_traversal_depth INTEGER NOT NULL DEFAULT 2,
  max_nodes_per_query INTEGER NOT NULL DEFAULT 50,
  entity_extraction_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_sync_fk_relationships BOOLEAN NOT NULL DEFAULT true,
  context_merge_strategy TEXT NOT NULL DEFAULT 'graph_first'
    CHECK (context_merge_strategy IN ('graph_first', 'vector_first', 'balanced')),
  token_budget INTEGER NOT NULL DEFAULT 8000,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

INSERT INTO public.graphify_config (tenant_id, enabled)
VALUES ('00000000-0000-0000-0000-000000000001'::UUID, false)
ON CONFLICT (tenant_id) DO NOTHING;

-- ========================
-- graphify_sync_jobs
-- ========================
CREATE TABLE IF NOT EXISTS public.graphify_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL DEFAULT 'backfill'
    CHECK (job_type IN ('backfill', 'relationships', 'extraction')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  entities_synced INTEGER DEFAULT 0,
  relationships_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_graphify_sync_jobs_tenant_status
  ON public.graphify_sync_jobs(tenant_id, status, created_at DESC);

-- ========================
-- Updated_at triggers
-- ========================
DROP TRIGGER IF EXISTS set_graph_entities_updated_at ON public.graph_entities;
CREATE TRIGGER set_graph_entities_updated_at
  BEFORE UPDATE ON public.graph_entities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_graph_relationships_updated_at ON public.graph_relationships;
CREATE TRIGGER set_graph_relationships_updated_at
  BEFORE UPDATE ON public.graph_relationships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_graphify_config_updated_at ON public.graphify_config;
CREATE TRIGGER set_graphify_config_updated_at
  BEFORE UPDATE ON public.graphify_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_graphify_sync_jobs_updated_at ON public.graphify_sync_jobs;
CREATE TRIGGER set_graphify_sync_jobs_updated_at
  BEFORE UPDATE ON public.graphify_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========================
-- graphify_can_access_entity
-- ========================
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
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_entity FROM public.graph_entities WHERE id = p_entity_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_entity.tenant_id <> public.get_user_tenant_id() THEN
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

GRANT EXECUTE ON FUNCTION public.graphify_can_access_entity(UUID, UUID) TO authenticated;

-- ========================
-- graphify_match_entities
-- ========================
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
  )
  SELECT DISTINCT ON (c.id)
    c.id, c.entity_type, c.canonical_name, c.display_name,
    c.source_table, c.source_id, c.metadata, c.confidence, c.match_score
  FROM combined c
  ORDER BY c.id, c.match_score DESC
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.graphify_match_entities(UUID, TEXT, TEXT[], INT) TO authenticated;

-- ========================
-- graphify_entity_neighbors
-- ========================
CREATE OR REPLACE FUNCTION public.graphify_entity_neighbors(
  p_entity_id UUID,
  p_direction TEXT DEFAULT 'both',
  p_relationship_types TEXT[] DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  relationship_id UUID,
  relationship_type TEXT,
  direction TEXT,
  neighbor_id UUID,
  neighbor_type TEXT,
  neighbor_name TEXT,
  weight NUMERIC,
  confidence NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  (
    SELECT
      r.id AS relationship_id,
      r.relationship_type,
      'out'::TEXT AS direction,
      t.id AS neighbor_id,
      t.entity_type AS neighbor_type,
      t.display_name AS neighbor_name,
      r.weight,
      r.confidence
    FROM public.graph_relationships r
    JOIN public.graph_entities t ON t.id = r.target_entity_id
    WHERE r.source_entity_id = p_entity_id
      AND r.status = 'active'
      AND t.status = 'active'
      AND (p_direction IN ('out', 'both'))
      AND (p_relationship_types IS NULL OR r.relationship_type = ANY(p_relationship_types))
      AND public.graphify_can_access_entity(auth.uid(), t.id)
  )
  UNION ALL
  (
    SELECT
      r.id AS relationship_id,
      r.relationship_type,
      'in'::TEXT AS direction,
      s.id AS neighbor_id,
      s.entity_type AS neighbor_type,
      s.display_name AS neighbor_name,
      r.weight,
      r.confidence
    FROM public.graph_relationships r
    JOIN public.graph_entities s ON s.id = r.source_entity_id
    WHERE r.target_entity_id = p_entity_id
      AND r.status = 'active'
      AND s.status = 'active'
      AND (p_direction IN ('in', 'both'))
      AND (p_relationship_types IS NULL OR r.relationship_type = ANY(p_relationship_types))
      AND public.graphify_can_access_entity(auth.uid(), s.id)
  )
  ORDER BY weight DESC, confidence DESC
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.graphify_entity_neighbors(UUID, TEXT, TEXT[], INT) TO authenticated;

-- ========================
-- graphify_traverse
-- ========================
CREATE OR REPLACE FUNCTION public.graphify_traverse(
  p_tenant_id UUID,
  p_seed_entity_ids UUID[],
  p_max_depth INT DEFAULT 2,
  p_relationship_types TEXT[] DEFAULT NULL,
  p_max_nodes INT DEFAULT 50
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
  WITH RECURSIVE walk AS (
    SELECT
      e.id AS entity_id,
      e.entity_type,
      e.display_name,
      e.source_table,
      e.source_id,
      0 AS depth,
      ARRAY[e.id] AS path
    FROM public.graph_entities e
    WHERE e.id = ANY(p_seed_entity_ids)
      AND e.tenant_id = p_tenant_id
      AND e.status = 'active'
      AND public.graphify_can_access_entity(auth.uid(), e.id)

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
      AND public.graphify_can_access_entity(auth.uid(), n.id)
  )
  SELECT DISTINCT ON (entity_id)
    entity_id, entity_type, display_name, source_table, source_id, depth, path
  FROM walk
  ORDER BY entity_id, depth ASC
  LIMIT GREATEST(p_max_nodes, 1);
$$;

GRANT EXECUTE ON FUNCTION public.graphify_traverse(UUID, UUID[], INT, TEXT[], INT) TO authenticated;

-- ========================
-- RLS
-- ========================
ALTER TABLE public.graph_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_entity_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_memory_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_query_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graphify_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graphify_sync_jobs ENABLE ROW LEVEL SECURITY;

-- graph_entities
CREATE POLICY "graph_entities_select"
  ON public.graph_entities FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.graphify_can_access_entity(auth.uid(), id)
  );

CREATE POLICY "graph_entities_manage"
  ON public.graph_entities FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  );

-- graph_entity_aliases
CREATE POLICY "graph_aliases_select"
  ON public.graph_entity_aliases FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.graphify_can_access_entity(auth.uid(), entity_id)
  );

CREATE POLICY "graph_aliases_manage"
  ON public.graph_entity_aliases FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  );

-- graph_relationships
CREATE POLICY "graph_relationships_select"
  ON public.graph_relationships FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.graphify_can_access_entity(auth.uid(), source_entity_id)
    AND public.graphify_can_access_entity(auth.uid(), target_entity_id)
  );

CREATE POLICY "graph_relationships_manage"
  ON public.graph_relationships FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  );

-- graph_memory_links
CREATE POLICY "graph_memory_links_select"
  ON public.graph_memory_links FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.graphify_can_access_entity(auth.uid(), entity_id)
  );

CREATE POLICY "graph_memory_links_manage"
  ON public.graph_memory_links FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  );

-- graph_query_logs
CREATE POLICY "graph_query_logs_select_own"
  ON public.graph_query_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "graph_query_logs_select_admin"
  ON public.graph_query_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'));

CREATE POLICY "graph_query_logs_insert"
  ON public.graph_query_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- graphify_config
CREATE POLICY "graphify_config_select"
  ON public.graphify_config FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "graphify_config_manage"
  ON public.graphify_config FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  );

-- graphify_sync_jobs
CREATE POLICY "graphify_sync_jobs_select"
  ON public.graphify_sync_jobs FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  );

CREATE POLICY "graphify_sync_jobs_manage"
  ON public.graphify_sync_jobs FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  );

COMMENT ON TABLE public.graph_entities IS 'Graphify canonical knowledge graph nodes';
COMMENT ON TABLE public.graph_relationships IS 'Graphify directed relationship edges';
COMMENT ON TABLE public.graphify_config IS 'Per-tenant Graphify configuration';

-- Register graphify module
INSERT INTO public.app_modules (name, slug, description, icon, category, is_core, is_active, sort_order, dependencies)
VALUES (
  'Graphify',
  'graphify',
  'Enterprise knowledge graph and context intelligence',
  'Network',
  'intelligence',
  false,
  true,
  10,
  '{platform,knowledge}'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- ---------------------------------------------------------------------------
-- Coverage RPC helpers (run if 20260629160000_graphify_coverage_rpcs not applied)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Phase 6 perf (run if 20260629170000_graphify_phase6_perf not applied)
-- Full SQL: supabase/migrations/20260629170000_graphify_phase6_perf.sql
-- ---------------------------------------------------------------------------
