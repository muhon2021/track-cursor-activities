-- ============================================================================
-- RAG Enhancement: kb_source_config, eval, reembed, permissions, memory admin
-- ============================================================================

-- Per-source chunking + reranker configuration
CREATE TABLE IF NOT EXISTS public.kb_source_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
  chunk_size INTEGER NOT NULL DEFAULT 1000,
  chunk_overlap INTEGER NOT NULL DEFAULT 100,
  chunk_strategy TEXT NOT NULL DEFAULT 'fixed'
    CHECK (chunk_strategy IN ('fixed', 'sentence-window', 'heading-aware', 'parent-child')),
  strategy_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  reranker_provider TEXT DEFAULT 'cohere'
    CHECK (reranker_provider IS NULL OR reranker_provider IN ('cohere', 'voyage', 'bge', 'custom')),
  reranker_threshold NUMERIC(4,3) DEFAULT 0.75,
  reranker_max_results INTEGER DEFAULT 10,
  reranker_enabled BOOLEAN DEFAULT false,
  reranker_override_global BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id)
);

CREATE INDEX IF NOT EXISTS idx_kb_source_config_source ON public.kb_source_config(source_id);

-- RAG evaluation runs
CREATE TABLE IF NOT EXISTS public.kb_eval_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  answer TEXT,
  retrieval_latency_ms INTEGER,
  rerank_latency_ms INTEGER,
  generation_latency_ms INTEGER,
  latency_ms INTEGER,
  cost NUMERIC(12,6) DEFAULT 0,
  source_id UUID REFERENCES public.knowledge_sources(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_eval_runs_created_at ON public.kb_eval_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_eval_runs_created_by ON public.kb_eval_runs(created_by);

CREATE TABLE IF NOT EXISTS public.kb_eval_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.kb_eval_runs(id) ON DELETE CASCADE,
  chunk_id UUID,
  chunk_preview TEXT,
  similarity_score NUMERIC(6,5),
  rerank_score NUMERIC(6,5),
  source_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_eval_results_run ON public.kb_eval_results(run_id);
CREATE INDEX IF NOT EXISTS idx_kb_eval_results_chunk ON public.kb_eval_results(chunk_id);

CREATE TABLE IF NOT EXISTS public.kb_eval_test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  expected_answer TEXT,
  run_id UUID REFERENCES public.kb_eval_runs(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_eval_test_cases_created_at ON public.kb_eval_test_cases(created_at DESC);

-- Bulk re-embed jobs
CREATE TABLE IF NOT EXISTS public.kb_reembed_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'paused', 'completed', 'cancelled', 'failed')),
  total_documents INTEGER DEFAULT 0,
  processed_documents INTEGER DEFAULT 0,
  failed_documents INTEGER DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_reembed_jobs_source ON public.kb_reembed_jobs(source_id);
CREATE INDEX IF NOT EXISTS idx_kb_reembed_jobs_status ON public.kb_reembed_jobs(status);

CREATE TABLE IF NOT EXISTS public.kb_reembed_job_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.kb_reembed_jobs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_reembed_job_items_job ON public.kb_reembed_job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_kb_reembed_job_items_status ON public.kb_reembed_job_items(job_id, status);

-- Source-level permissions
CREATE TABLE IF NOT EXISTS public.kb_source_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
  app_role public.app_role,
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  permissions JSONB NOT NULL DEFAULT '["view"]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT kb_source_permissions_target_check CHECK (
    app_role IS NOT NULL OR role_id IS NOT NULL OR pod_id IS NOT NULL OR department_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_kb_source_permissions_source ON public.kb_source_permissions(source_id);
CREATE INDEX IF NOT EXISTS idx_kb_source_permissions_role ON public.kb_source_permissions(source_id, app_role);
CREATE INDEX IF NOT EXISTS idx_kb_source_permissions_pod ON public.kb_source_permissions(source_id, pod_id);
CREATE INDEX IF NOT EXISTS idx_kb_source_permissions_dept ON public.kb_source_permissions(source_id, department_id);

-- Agent memories soft delete
ALTER TABLE public.agent_memories
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agent_memories_not_deleted
  ON public.agent_memories(user_id) WHERE deleted_at IS NULL;

-- Sync attempt tracking on knowledge files
ALTER TABLE public.knowledge_files
  ADD COLUMN IF NOT EXISTS last_sync_attempt_at TIMESTAMPTZ;

-- Updated_at triggers
DROP TRIGGER IF EXISTS set_kb_source_config_updated_at ON public.kb_source_config;
CREATE TRIGGER set_kb_source_config_updated_at
  BEFORE UPDATE ON public.kb_source_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_kb_reembed_jobs_updated_at ON public.kb_reembed_jobs;
CREATE TRIGGER set_kb_reembed_jobs_updated_at
  BEFORE UPDATE ON public.kb_reembed_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_kb_source_permissions_updated_at ON public.kb_source_permissions;
CREATE TRIGGER set_kb_source_permissions_updated_at
  BEFORE UPDATE ON public.kb_source_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default config for existing sources
INSERT INTO public.kb_source_config (source_id, chunk_size, chunk_overlap, chunk_strategy)
SELECT id, 1000, 100, 'fixed'
FROM public.knowledge_sources
ON CONFLICT (source_id) DO NOTHING;

-- Global RAG reranker defaults
INSERT INTO public.system_settings (category, key, value, description)
VALUES
  ('rag', 'reranker_provider', '"cohere"'::jsonb, 'Default reranker provider'),
  ('rag', 'reranker_threshold', '0.75'::jsonb, 'Default reranker score threshold'),
  ('rag', 'reranker_max_results', '10'::jsonb, 'Default max reranked results'),
  ('rag', 'reranker_enabled', 'false'::jsonb, 'Enable reranking globally')
ON CONFLICT (category, key) DO NOTHING;

-- ============================================================================
-- RPC: check_kb_source_permission
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_kb_source_permission(
  p_source_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_admin BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT public.has_role(v_user_id, 'admin') INTO v_is_admin;
  IF v_is_admin THEN
    RETURN true;
  END IF;

  -- No rows = permissive default (backward compatible)
  IF NOT EXISTS (SELECT 1 FROM kb_source_permissions WHERE source_id = p_source_id) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM kb_source_permissions sp
    WHERE sp.source_id = p_source_id
      AND sp.permissions ? p_permission
      AND (
        (sp.app_role IS NOT NULL AND public.has_role(v_user_id, sp.app_role))
        OR (sp.pod_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM pod_members pm
          WHERE pm.pod_id = sp.pod_id AND pm.user_id = v_user_id
        ))
        OR (sp.department_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM employee_profiles ep
          WHERE ep.user_id = v_user_id AND ep.department_id = sp.department_id
        ))
      )
  );
END;
$$;

-- ============================================================================
-- RPC: admin_list_user_memories
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_user_memories(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  agent_id UUID,
  user_id UUID,
  memory_type TEXT,
  memory_category TEXT,
  content TEXT,
  importance_score DOUBLE PRECISION,
  confidence_score DOUBLE PRECISION,
  source TEXT,
  created_at TIMESTAMPTZ,
  user_email TEXT,
  department_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.agent_id,
    m.user_id,
    m.memory_type,
    m.memory_category,
    m.content,
    m.importance_score,
    m.importance_score AS confidence_score,
    COALESCE(m.source_type, 'agent')::TEXT AS source,
    m.created_at,
    p.email AS user_email,
    d.name AS department_name
  FROM agent_memories m
  JOIN profiles p ON p.id = m.user_id
  LEFT JOIN employee_profiles ep ON ep.user_id = m.user_id
  LEFT JOIN departments d ON d.id = ep.department_id
  WHERE m.user_id = p_user_id
    AND m.deleted_at IS NULL
  ORDER BY m.created_at DESC;
END;
$$;

-- ============================================================================
-- RPC: admin_export_user_memories
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_export_user_memories(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT jsonb_build_object(
    'exported_at', now(),
    'user_id', p_user_id,
    'agent_memories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id,
        'memory_type', m.memory_type,
        'memory_category', m.memory_category,
        'content', m.content,
        'importance_score', m.importance_score,
        'created_at', m.created_at
      ))
      FROM agent_memories m
      WHERE m.user_id = p_user_id AND m.deleted_at IS NULL
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.kb_source_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_eval_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_eval_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_eval_test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_reembed_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_reembed_job_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_source_permissions ENABLE ROW LEVEL SECURITY;

-- kb_source_config
CREATE POLICY "Admins manage kb_source_config"
  ON public.kb_source_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read kb_source_config"
  ON public.kb_source_config FOR SELECT TO authenticated
  USING (true);

-- kb_eval_*
CREATE POLICY "Admins manage kb_eval_runs"
  ON public.kb_eval_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage kb_eval_results"
  ON public.kb_eval_results FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage kb_eval_test_cases"
  ON public.kb_eval_test_cases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- kb_reembed_*
CREATE POLICY "Admins manage kb_reembed_jobs"
  ON public.kb_reembed_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage kb_reembed_job_items"
  ON public.kb_reembed_job_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- kb_source_permissions
CREATE POLICY "Admins manage kb_source_permissions"
  ON public.kb_source_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read kb_source_permissions"
  ON public.kb_source_permissions FOR SELECT TO authenticated
  USING (true);

-- Tighten knowledge_sources write to admin only
DROP POLICY IF EXISTS "Authenticated users can manage sources" ON public.knowledge_sources;
CREATE POLICY "Admins manage knowledge_sources"
  ON public.knowledge_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Tighten embedding_queue write to admin only
DROP POLICY IF EXISTS "Authenticated users can manage queue" ON public.embedding_queue;
CREATE POLICY "Admins manage embedding_queue"
  ON public.embedding_queue FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.kb_source_config IS 'Per-source chunking and reranker configuration for RAG pipeline';
