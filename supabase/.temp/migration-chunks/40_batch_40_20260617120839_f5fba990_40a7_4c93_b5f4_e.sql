-- 20260616153000_knowledge_file_manager.sql
-- Knowledge Base file/folder manager tables.
-- Mirrors KNOWLEDGEBASE_IMPLEMENTATION.md using Supabase/RLS for this Vite app.

CREATE TABLE IF NOT EXISTS public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  is_public BOOLEAN NOT NULL DEFAULT false,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  size BIGINT NOT NULL DEFAULT 0,
  file_count INTEGER NOT NULL DEFAULT 0,
  shared_with JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS folders_name_user_id_unique
ON public.folders (user_id, lower(name))
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_folders_user_created
ON public.folders (user_id, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_folders_shared_with
ON public.folders USING GIN (shared_with);

CREATE TABLE IF NOT EXISTS public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID NULL REFERENCES public.folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  path TEXT NOT NULL,
  url TEXT NOT NULL,
  s3_key TEXT NULL,
  storage_type TEXT NOT NULL DEFAULT 'local' CHECK (storage_type IN ('local', 's3')),
  is_public BOOLEAN NOT NULL DEFAULT false,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  openai JSONB NULL,
  shared_with JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_files_user_created
ON public.files (user_id, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_files_user_folder
ON public.files (user_id, folder_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_files_user_type
ON public.files (user_id, type)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_files_storage_type
ON public.files (storage_type);

CREATE INDEX IF NOT EXISTS idx_files_shared_with
ON public.files USING GIN (shared_with);

CREATE OR REPLACE FUNCTION public.update_knowledge_manager_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS folders_updated_at ON public.folders;
CREATE TRIGGER folders_updated_at
BEFORE UPDATE ON public.folders
FOR EACH ROW
EXECUTE FUNCTION public.update_knowledge_manager_updated_at();

DROP TRIGGER IF EXISTS files_updated_at ON public.files;
CREATE TRIGGER files_updated_at
BEFORE UPDATE ON public.files
FOR EACH ROW
EXECUTE FUNCTION public.update_knowledge_manager_updated_at();

CREATE OR REPLACE FUNCTION public.refresh_knowledge_folder_stats(folder_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF folder_uuid IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.folders
  SET
    size = COALESCE((
      SELECT SUM(size)
      FROM public.files
      WHERE folder_id = folder_uuid AND deleted_at IS NULL
    ), 0),
    file_count = COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM public.files
      WHERE folder_id = folder_uuid AND deleted_at IS NULL
    ), 0)
  WHERE id = folder_uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_knowledge_folder_stats_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.refresh_knowledge_folder_stats(NEW.folder_id);
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.refresh_knowledge_folder_stats(OLD.folder_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS files_refresh_folder_stats ON public.files;
CREATE TRIGGER files_refresh_folder_stats
AFTER INSERT OR UPDATE OR DELETE ON public.files
FOR EACH ROW
EXECUTE FUNCTION public.refresh_knowledge_folder_stats_trigger();

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read owned or shared folders" ON public.folders;
CREATE POLICY "Users can read owned or shared folders"
ON public.folders FOR SELECT
USING (
  deleted_at IS NULL
  AND (
    user_id = auth.uid()
    OR is_public
    OR shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
  )
);

DROP POLICY IF EXISTS "Users can create own folders" ON public.folders;
CREATE POLICY "Users can create own folders"
ON public.folders FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners and write shares can update folders" ON public.folders;
CREATE POLICY "Owners and write shares can update folders"
ON public.folders FOR UPDATE
USING (
  user_id = auth.uid()
  OR shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text, 'permissions', 'write'))
)
WITH CHECK (
  user_id = auth.uid()
  OR shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text, 'permissions', 'write'))
);

DROP POLICY IF EXISTS "Owners can delete folders" ON public.folders;
CREATE POLICY "Owners can delete folders"
ON public.folders FOR DELETE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read owned shared or folder shared files" ON public.files;
CREATE POLICY "Users can read owned shared or folder shared files"
ON public.files FOR SELECT
USING (
  deleted_at IS NULL
  AND (
    user_id = auth.uid()
    OR is_public
    OR shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
    OR EXISTS (
      SELECT 1
      FROM public.folders
      WHERE folders.id = files.folder_id
        AND folders.deleted_at IS NULL
        AND (
          folders.user_id = auth.uid()
          OR folders.is_public
          OR folders.shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
        )
    )
  )
);

DROP POLICY IF EXISTS "Users can create own files" ON public.files;
CREATE POLICY "Users can create own files"
ON public.files FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners and write shares can update files" ON public.files;
CREATE POLICY "Owners and write shares can update files"
ON public.files FOR UPDATE
USING (
  user_id = auth.uid()
  OR shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text, 'permissions', 'write'))
  OR EXISTS (
    SELECT 1
    FROM public.folders
    WHERE folders.id = files.folder_id
      AND folders.shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text, 'permissions', 'write'))
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text, 'permissions', 'write'))
  OR EXISTS (
    SELECT 1
    FROM public.folders
    WHERE folders.id = files.folder_id
      AND folders.shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text, 'permissions', 'write'))
  )
);

DROP POLICY IF EXISTS "Owners can delete files" ON public.files;
CREATE POLICY "Owners can delete files"
ON public.files FOR DELETE
USING (user_id = auth.uid());

INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledgebase', 'knowledgebase', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Knowledgebase users can read storage objects" ON storage.objects;
CREATE POLICY "Knowledgebase users can read storage objects"
ON storage.objects FOR SELECT
USING (bucket_id = 'knowledgebase');

DROP POLICY IF EXISTS "Knowledgebase users can upload own storage objects" ON storage.objects;
CREATE POLICY "Knowledgebase users can upload own storage objects"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'knowledgebase'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Knowledgebase users can update own storage objects" ON storage.objects;
CREATE POLICY "Knowledgebase users can update own storage objects"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'knowledgebase'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'knowledgebase'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Knowledgebase users can delete own storage objects" ON storage.objects;
CREATE POLICY "Knowledgebase users can delete own storage objects"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'knowledgebase'
  AND (storage.foldername(name))[1] = auth.uid()::text
);


-- 20260617090000_integration_settings_primary_by_category.sql
-- ============================================
-- Integration Preferences — per-category primary integration with multi-source
-- ============================================

ALTER TABLE public.integration_settings
  ADD COLUMN IF NOT EXISTS primary_by_category JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.integration_settings.primary_by_category IS
  'Per-category integration preferences: { [category_slug]: { primary_slug: string | null, active_slugs: string[] } }. Supersedes primary_integrations, which is kept for backward-compatible reads.';


-- 20260617120000_branding_assets_and_config.sql
-- Migration: Branding Assets Bucket + Extended Branding Config
-- Creates the branding-assets storage bucket and seeds new app_config branding keys

-- ============================================================
-- 1. Create branding-assets storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'branding-assets',
  'branding-assets',
  true,
  10485760, -- 10 MB max file size
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/svg+xml',
    'image/x-icon',
    'image/vnd.microsoft.icon',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. RLS policies for branding-assets bucket
-- ============================================================

-- Allow authenticated users to read all branding assets (public logos etc.)
CREATE POLICY "Authenticated users can read branding assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'branding-assets');

-- Allow anonymous users to read branding assets (needed for login page before auth)
CREATE POLICY "Public read access for branding assets"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'branding-assets');

-- Only admins can upload branding assets
CREATE POLICY "Admins can upload branding assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'branding-assets'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can update branding assets
CREATE POLICY "Admins can update branding assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'branding-assets'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can delete branding assets
CREATE POLICY "Admins can delete branding assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'branding-assets'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- ============================================================
-- 3. Seed new app_config branding keys
--    Uses ON CONFLICT DO NOTHING so existing values are preserved
-- ============================================================
INSERT INTO public.app_config (key, value, category, description, is_sensitive)
VALUES
  (
    'branding.primaryColor',
    '"#6366f1"',
    'branding',
    'Primary brand color used for buttons, links, and accents',
    false
  ),
  (
    'branding.secondaryColor',
    '""',
    'branding',
    'Secondary brand color used for supporting UI elements',
    false
  ),
  (
    'branding.faviconUrl',
    'null',
    'branding',
    'URL to the favicon (ICO or PNG)',
    false
  ),
  (
    'branding.emailFromName',
    '"Control Tower"',
    'branding',
    'Display name used in outgoing email From field',
    false
  ),
  (
    'branding.replyToEmail',
    '""',
    'branding',
    'Reply-to email address for outgoing notifications',
    false
  ),
  (
    'branding.loginMessage',
    '"Welcome to Control Tower"',
    'branding',
    'Welcome message displayed on the login page',
    false
  ),
  (
    'branding.loginBackgroundUrl',
    'null',
    'branding',
    'URL to the login page background image',
    false
  )
ON CONFLICT (key) DO NOTHING;


-- 20260617120000_kb_rag_enhancement.sql
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


-- 20260617120839_f5fba990-40a7-4c93-b5f4-e00909af667a.sql
ALTER TABLE public.integration_settings
  ADD COLUMN IF NOT EXISTS primary_by_category JSONB NOT NULL DEFAULT '{}'::jsonb;

