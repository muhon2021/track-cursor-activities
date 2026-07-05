-- 20260202110000_knowledge_base_unified_documents.sql
-- ============================================================================
-- Knowledge Base: unified_documents, Gemini RAG, processing history
-- ============================================================================
-- Adds unified document layer, Gemini corpus/sync/query tables,
-- processing queue history, and RLS. Supports org + personal knowledge.
-- ============================================================================

-- ========================
-- 1. unified_documents
-- ========================
CREATE TABLE IF NOT EXISTS public.unified_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('user', 'project', 'client', 'deal', 'common')),
  owner_id UUID NOT NULL,
  source_id UUID,
  title TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size BIGINT,
  storage_path TEXT,
  drive_file_id TEXT,
  processing_status TEXT DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  processing_error TEXT,
  chunk_count INTEGER DEFAULT 0,
  embedding_model TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unified_documents_owner ON public.unified_documents(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_unified_documents_status ON public.unified_documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_unified_documents_source ON public.unified_documents(source_id);
CREATE INDEX IF NOT EXISTS idx_unified_documents_created ON public.unified_documents(created_at DESC);

ALTER TABLE public.unified_documents ENABLE ROW LEVEL SECURITY;

-- Users see org-wide docs (common, project, client, deal) or their own (user)
CREATE POLICY "Users can view unified_documents"
  ON public.unified_documents FOR SELECT TO authenticated
  USING (
    owner_type = 'user' AND owner_id = auth.uid()
    OR owner_type IN ('common', 'project', 'client', 'deal')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can insert own user docs"
  ON public.unified_documents FOR INSERT TO authenticated
  WITH CHECK (owner_type = 'user' AND owner_id = auth.uid());

CREATE POLICY "Users can update own user docs"
  ON public.unified_documents FOR UPDATE TO authenticated
  USING (owner_type = 'user' AND owner_id = auth.uid())
  WITH CHECK (owner_type = 'user' AND owner_id = auth.uid());

CREATE POLICY "Users can delete own user docs"
  ON public.unified_documents FOR DELETE TO authenticated
  USING (owner_type = 'user' AND owner_id = auth.uid());

CREATE POLICY "Admins can manage all unified_documents"
  ON public.unified_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========================
-- 2. embeddings: add unified_document_id
-- ========================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'embeddings' AND column_name = 'unified_document_id'
  ) THEN
    ALTER TABLE public.embeddings
    ADD COLUMN unified_document_id UUID REFERENCES public.unified_documents(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_embeddings_unified_document ON public.embeddings(unified_document_id);
  END IF;
END $$;

-- ========================
-- 3. knowledge_categories: add owner_id for "My Categories"
-- ========================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'knowledge_categories' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE public.knowledge_categories
    ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_knowledge_categories_owner ON public.knowledge_categories(owner_id);
  END IF;
END $$;

-- ========================
-- 4. knowledge_files FK to knowledge_categories (if table exists)
-- ========================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'knowledge_files')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'knowledge_categories')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE table_schema = 'public' AND table_name = 'knowledge_files' AND constraint_name LIKE '%category%'
     ) THEN
    ALTER TABLE public.knowledge_files
    ADD CONSTRAINT knowledge_files_category_fkey
    FOREIGN KEY (category_id) REFERENCES public.knowledge_categories(id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ========================
-- 5. processing_queue_history
-- ========================
CREATE TABLE IF NOT EXISTS public.processing_queue_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_type TEXT NOT NULL CHECK (batch_type IN ('knowledge_files', 'unified_documents', 'meetings', 'manual')),
  total_items INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processing_queue_history_status ON public.processing_queue_history(status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_history_started ON public.processing_queue_history(started_at DESC);

ALTER TABLE public.processing_queue_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view processing_queue_history"
  ON public.processing_queue_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage processing_queue_history"
  ON public.processing_queue_history FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========================
-- 6. gemini_corpora
-- ========================
CREATE TABLE IF NOT EXISTS public.gemini_corpora (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_name TEXT,
  external_corpus_id TEXT,
  document_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gemini_corpora_active ON public.gemini_corpora(is_active);

ALTER TABLE public.gemini_corpora ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view gemini_corpora"
  ON public.gemini_corpora FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage gemini_corpora"
  ON public.gemini_corpora FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========================
-- 7. gemini_sync_logs
-- ========================
CREATE TABLE IF NOT EXISTS public.gemini_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corpus_id UUID NOT NULL REFERENCES public.gemini_corpora(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'manual')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  documents_added INTEGER DEFAULT 0,
  documents_removed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gemini_sync_logs_corpus ON public.gemini_sync_logs(corpus_id);
CREATE INDEX IF NOT EXISTS idx_gemini_sync_logs_started ON public.gemini_sync_logs(started_at DESC);

ALTER TABLE public.gemini_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view gemini_sync_logs"
  ON public.gemini_sync_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage gemini_sync_logs"
  ON public.gemini_sync_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========================
-- 8. gemini_query_logs
-- ========================
CREATE TABLE IF NOT EXISTS public.gemini_query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corpus_id UUID REFERENCES public.gemini_corpora(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  query_text TEXT NOT NULL,
  result_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gemini_query_logs_corpus ON public.gemini_query_logs(corpus_id);
CREATE INDEX IF NOT EXISTS idx_gemini_query_logs_user ON public.gemini_query_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_gemini_query_logs_created ON public.gemini_query_logs(created_at DESC);

ALTER TABLE public.gemini_query_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gemini_query_logs"
  ON public.gemini_query_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can insert own gemini_query_logs"
  ON public.gemini_query_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all gemini_query_logs"
  ON public.gemini_query_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ========================
-- 9. user_agent_personalizations: support unified_document IDs
-- ========================
-- attached_knowledge_files UUID[] already exists; optional: add attached_unified_document_ids UUID[]
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_agent_personalizations')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'user_agent_personalizations' AND column_name = 'attached_unified_document_ids'
     ) THEN
    ALTER TABLE public.user_agent_personalizations
    ADD COLUMN attached_unified_document_ids UUID[] DEFAULT '{}';
  END IF;
END $$;

-- ========================
-- 10. app_modules: Personal Knowledge + page_route
-- ========================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_modules' AND column_name = 'page_route'
  ) THEN
    ALTER TABLE public.app_modules ADD COLUMN page_route TEXT;
    UPDATE public.app_modules SET page_route = '/knowledge' WHERE slug = 'knowledge';
  END IF;
END $$;

UPDATE public.app_modules SET page_route = '/knowledge' WHERE slug = 'knowledge';

INSERT INTO public.app_modules (name, slug, description, icon, category, is_core, is_active, sort_order, dependencies, page_route)
VALUES (
  'Personal Knowledge',
  'personal-knowledge',
  'User-specific knowledge library, documents, and AI agent personalization',
  'BookMarked',
  'intelligence',
  false,
  true,
  5,
  '{platform,knowledge}',
  '/personal-knowledge'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  page_route = EXCLUDED.page_route,
  updated_at = now();

-- ========================
-- 11. Triggers for updated_at
-- ========================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_unified_documents_updated_at') THEN
    CREATE TRIGGER update_unified_documents_updated_at
      BEFORE UPDATE ON public.unified_documents
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_gemini_corpora_updated_at') THEN
    CREATE TRIGGER update_gemini_corpora_updated_at
      BEFORE UPDATE ON public.gemini_corpora
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;


-- 20260202110100_match_embeddings_filters.sql
-- Extend match_embeddings to support optional entity_type and user_id filters
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_entity_type text DEFAULT NULL,
  filter_user_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL  -- alias for filter_user_id for backward compatibility
)
RETURNS TABLE (
  id uuid,
  entity_type text,
  entity_id text,
  content text,
  metadata jsonb,
  user_id uuid,
  similarity float,
  unified_document_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.entity_type,
    e.entity_id::text,
    e.content,
    e.metadata,
    e.user_id,
    (1 - (e.embedding <=> query_embedding))::float as similarity,
    e.unified_document_id
  FROM public.embeddings e
  WHERE (1 - (e.embedding <=> query_embedding)) > match_threshold
    AND (filter_entity_type IS NULL OR e.entity_type = filter_entity_type)
    AND (COALESCE(filter_user_id, p_user_id) IS NULL OR e.user_id = COALESCE(filter_user_id, p_user_id))
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_embeddings IS 'Vector similarity search with optional entity_type and user_id filters';


-- 20260202120000_seed_knowledge_dummy_data.sql
-- ============================================================================
-- Seed Knowledge Base with Demo Data
-- ============================================================================
-- Adds sample categories, sources, entries, and files so the Knowledge
-- module has meaningful data out of the box for demos.
-- This migration is idempotent via ON CONFLICT on slugs.
-- ============================================================================

DO $$
BEGIN
  INSERT INTO public.knowledge_categories (name, slug, description, icon, color, sort_order, metadata)
  VALUES (
    'General Knowledge',
    'general-knowledge',
    'High-level internal documentation, FAQs, and onboarding guides.',
    'BookOpen',
    'blue',
    10,
    jsonb_build_object('demo', true)
  )
  ON CONFLICT (slug) DO UPDATE
    SET description = EXCLUDED.description,
        icon = EXCLUDED.icon,
        color = EXCLUDED.color;

  INSERT INTO public.knowledge_categories (name, slug, description, icon, color, sort_order, metadata)
  VALUES (
    'Client Playbooks',
    'client-playbooks',
    'Playbooks, SOPs, and templates for working with clients.',
    'FolderTree',
    'green',
    20,
    jsonb_build_object('demo', true)
  )
  ON CONFLICT (slug) DO UPDATE
    SET description = EXCLUDED.description,
        icon = EXCLUDED.icon,
        color = EXCLUDED.color;

  INSERT INTO public.knowledge_categories (name, slug, description, icon, color, sort_order, metadata)
  VALUES (
    'Meeting Notes',
    'meeting-notes',
    'Important meeting summaries and decision logs.',
    'Calendar',
    'purple',
    30,
    jsonb_build_object('demo', true)
  )
  ON CONFLICT (slug) DO UPDATE
    SET description = EXCLUDED.description,
        icon = EXCLUDED.icon,
        color = EXCLUDED.color;
END $$;

-- 2) Seed knowledge_sources (admin-managed) – schema has no slug; use name + WHERE NOT EXISTS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.knowledge_sources WHERE name = 'Internal Handbook') THEN
    INSERT INTO public.knowledge_sources (name, source_type, config, is_active, last_synced_at, created_at, updated_at)
    VALUES (
      'Internal Handbook',
      'url',
      jsonb_build_object('demo', true, 'url', 'https://example.com/docs/handbook', 'description', 'Core internal handbook and company policies.'),
      true,
      NULL,
      now(),
      now()
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.knowledge_sources WHERE name = 'Client Templates') THEN
    INSERT INTO public.knowledge_sources (name, source_type, config, is_active, last_synced_at, created_at, updated_at)
    VALUES (
      'Client Templates',
      'google_drive',
      jsonb_build_object('demo', true, 'url', 'https://drive.google.com/demo-client-templates', 'description', 'Proposal, SOW, and onboarding templates.'),
      true,
      NULL,
      now(),
      now()
    );
  END IF;
END $$;

-- 3) Seed knowledge_entries (article-style KB)
SELECT
  1
WHERE NOT EXISTS (
  SELECT 1 FROM public.knowledge_entries WHERE slug = 'getting-started-control-tower'
);

DO $$
DECLARE
  v_cat_general UUID;
  v_author UUID;
BEGIN
  SELECT id INTO v_cat_general
  FROM public.knowledge_categories
  WHERE slug = 'general-knowledge';

  -- Use an existing user as author (auth.uid() is null in migration context)
  SELECT id INTO v_author
  FROM auth.users
  ORDER BY created_at
  LIMIT 1;

  IF v_cat_general IS NOT NULL AND v_author IS NOT NULL THEN
    INSERT INTO public.knowledge_entries (
      title,
      slug,
      content,
      summary,
      category_id,
      author_id,
      status,
      tags,
      metadata
    )
    VALUES (
      'Getting Started with the Control Tower',
      'getting-started-control-tower',
      'This article walks through the end-to-end flow of logging in, connecting integrations, and using the Control Tower dashboard for daily operations.',
      'End-to-end overview of how to use the Control Tower for daily work, including modules, navigation, and integrations.',
      v_cat_general,
      v_author,
      'published',
      ARRAY['onboarding', 'overview'],
      jsonb_build_object('demo', true)
    )
    ON CONFLICT (slug) DO NOTHING;
  END IF;
END $$;

-- 4) Seed knowledge_files (document-level KB)
DO $$
DECLARE
  v_cat_general UUID;
  v_cat_clients UUID;
  v_src_internal UUID;
  v_src_client_templates UUID;
BEGIN
  SELECT id INTO v_cat_general FROM public.knowledge_categories WHERE slug = 'general-knowledge';
  SELECT id INTO v_cat_clients FROM public.knowledge_categories WHERE slug = 'client-playbooks';
  SELECT id INTO v_src_internal FROM public.knowledge_sources WHERE name = 'Internal Handbook';
  SELECT id INTO v_src_client_templates FROM public.knowledge_sources WHERE name = 'Client Templates';

  IF v_cat_general IS NOT NULL AND v_src_internal IS NOT NULL THEN
    INSERT INTO public.knowledge_files (
      category_id,
      source_id,
      title,
      file_name,
      file_type,
      file_size,
      storage_path,
      processing_status,
      chunk_count,
      embedding_model,
      metadata,
      uploaded_by,
      processed_at
    )
    VALUES (
      v_cat_general,
      v_src_internal,
      'Control Tower Overview (PDF)',
      'control-tower-overview.pdf',
      'application/pdf',
      123456,
      'demo/knowledge/control-tower-overview.pdf',
      'completed',
      8,
      'text-embedding-3-small',
      jsonb_build_object('demo', true, 'description', 'High-level product overview PDF for demos.'),
      auth.uid(),
      now()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_cat_clients IS NOT NULL AND v_src_client_templates IS NOT NULL THEN
    INSERT INTO public.knowledge_files (
      category_id,
      source_id,
      title,
      file_name,
      file_type,
      file_size,
      storage_path,
      processing_status,
      chunk_count,
      embedding_model,
      metadata,
      uploaded_by,
      processed_at
    )
    VALUES (
      v_cat_clients,
      v_src_client_templates,
      'Client Onboarding Checklist',
      'client-onboarding-checklist.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      45678,
      'demo/knowledge/client-onboarding-checklist.docx',
      'completed',
      5,
      'text-embedding-3-small',
      jsonb_build_object('demo', true, 'description', 'Checklist template for onboarding new clients.'),
      auth.uid(),
      now()
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;



-- 20260202164131_2bfd5f09-737a-4e6c-986b-ce138afe7811.sql
-- Add required OAuth configuration fields for Zoom provider
INSERT INTO integration_fields (provider_id, field_key, label, field_type, is_required, is_sensitive, help_text, display_order)
SELECT 
  ip.id,
  'client_id',
  'Client ID',
  'text',
  true,
  false,
  'Your Zoom OAuth App Client ID from the Zoom Marketplace',
  1
FROM integration_providers ip WHERE ip.slug = 'zoom';

INSERT INTO integration_fields (provider_id, field_key, label, field_type, is_required, is_sensitive, help_text, display_order)
SELECT 
  ip.id,
  'client_secret',
  'Client Secret',
  'password',
  true,
  true,
  'Your Zoom OAuth App Client Secret from the Zoom Marketplace',
  2
FROM integration_providers ip WHERE ip.slug = 'zoom';

-- Also update the oauth_config with proper Zoom OAuth settings
UPDATE integration_providers
SET oauth_config = jsonb_build_object(
  'authorization_url', 'https://zoom.us/oauth/authorize',
  'token_url', 'https://zoom.us/oauth/token',
  'scopes', ARRAY['meeting:read', 'recording:read', 'user:read']
)
WHERE slug = 'zoom';

-- 20260202173537_b1cc1c71-6709-496f-b3b1-c8dc3a2855f1.sql
-- OAuth States table for CSRF protection during OAuth authorization
CREATE TABLE public.oauth_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  redirect_uri TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- RLS Policies for oauth_states
CREATE POLICY "Users can view their own oauth states"
  ON public.oauth_states FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own oauth states"
  ON public.oauth_states FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own oauth states"
  ON public.oauth_states FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster state lookups
CREATE INDEX idx_oauth_states_state ON public.oauth_states(state);
CREATE INDEX idx_oauth_states_expires_at ON public.oauth_states(expires_at);

-- User OAuth Tokens table for storing user credentials
CREATE TABLE public.user_oauth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider_slug TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  scopes TEXT[] DEFAULT '{}',
  account_email TEXT,
  account_name TEXT,
  account_id TEXT,
  account_avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ,
  error_message TEXT,
  error_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider_slug)
);

-- Enable RLS
ALTER TABLE public.user_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_oauth_tokens
CREATE POLICY "Users can view their own oauth tokens"
  ON public.user_oauth_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own oauth tokens"
  ON public.user_oauth_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own oauth tokens"
  ON public.user_oauth_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own oauth tokens"
  ON public.user_oauth_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for user_oauth_tokens
CREATE INDEX idx_user_oauth_tokens_user_id ON public.user_oauth_tokens(user_id);
CREATE INDEX idx_user_oauth_tokens_provider ON public.user_oauth_tokens(provider_slug);
CREATE INDEX idx_user_oauth_tokens_active ON public.user_oauth_tokens(is_active);

-- Trigger for updated_at
CREATE TRIGGER update_user_oauth_tokens_updated_at
  BEFORE UPDATE ON public.user_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 20260202200000_work_types.sql
-- Work Types for project billing and resource planning
CREATE TABLE IF NOT EXISTS work_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'services' CHECK (category IN ('services', 'support', 'admin', 'internal', 'other')),
  is_billable BOOLEAN DEFAULT true,
  default_rate NUMERIC(10, 2),
  color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE work_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read work types"
  ON work_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can manage work types"
  ON work_types FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed default work types
INSERT INTO work_types (name, slug, category, is_billable, default_rate, color, sort_order)
VALUES
  ('Discovery', 'discovery', 'services', true, 150.00, '#8b5cf6', 0),
  ('Development', 'development', 'services', true, 175.00, '#3b82f6', 1),
  ('Design', 'design', 'services', true, 160.00, '#ec4899', 2),
  ('QA / Testing', 'qa-testing', 'services', true, 125.00, '#22c55e', 3),
  ('Project Management', 'project-management', 'services', true, 140.00, '#f59e0b', 4),
  ('Support', 'support', 'support', true, 100.00, '#14b8a6', 5),
  ('Internal Meeting', 'internal-meeting', 'internal', false, NULL, '#6b7280', 6),
  ('Admin / Overhead', 'admin-overhead', 'admin', false, NULL, '#9ca3af', 7)
ON CONFLICT (slug) DO NOTHING;


-- 20260202_admin_exec_sql.sql
-- ============================================================================
-- Admin Seed SQL Executor
-- ============================================================================
-- Provides a SECURITY DEFINER function that admins can call (via edge function)
-- to execute seed SQL scripts from the admin UI.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_exec_sql(sql_content TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $fn$
DECLARE
  err_detail TEXT;
  err_hint   TEXT;
BEGIN
  EXECUTE sql_content;
  RETURN jsonb_build_object('success', true, 'message', 'SQL executed successfully');
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS
    err_detail = PG_EXCEPTION_DETAIL,
    err_hint   = PG_EXCEPTION_HINT;
  RETURN jsonb_build_object(
    'success', false,
    'error',   SQLERRM,
    'state',   SQLSTATE,
    'detail',  COALESCE(err_detail, ''),
    'hint',    COALESCE(err_hint, '')
  );
END;
$fn$;

-- Restrict: only callable via service-role (edge functions), not via anon/authenticated
REVOKE ALL ON FUNCTION public.admin_exec_sql(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_exec_sql(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.admin_exec_sql(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_exec_sql(TEXT) TO service_role;


-- 20260203_productivity_base_tables.sql
-- ============================================================================
-- Path B: Base Project Productivity Tables
-- Migration: 20260203_productivity_base_tables
-- Purpose: Employee productivity tracking (EmployeeProductivity, ActionItem)
--          for parity with sj-control-main. Coexists with existing
--          productivity_records, employee_profiles.
-- ============================================================================

-- ============================================================================
-- HELPER: get_current_user_title for RLS
-- Framework profiles may not have title; use user_roles.role as proxy.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_current_user_title()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM user_roles WHERE user_id = auth.uid() LIMIT 1),
    (SELECT title FROM profiles WHERE id = auth.uid() LIMIT 1),
    'user'
  );
$$;

-- Add title to profiles if missing (for get_current_user_title compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'title'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN title TEXT;
  END IF;
END $$;

-- ============================================================================
-- EMPLOYEE TABLE (base project - PascalCase)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public."Employee" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  title TEXT,
  role TEXT,
  "reportingManagerId" UUID REFERENCES public."Employee"(id) ON DELETE SET NULL,
  "reportingManagerEmail" TEXT,
  "reportingManagerName" TEXT,
  "dottedLineManagerEmail" TEXT,
  location TEXT,
  department TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- ACTION ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public."ActionItem" (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  summary TEXT,
  status TEXT,
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
  week TEXT,
  "excludeFromScoring" BOOLEAN DEFAULT false,
  "createdDate" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT fk_actionitem_employee_email FOREIGN KEY (email)
    REFERENCES public."Employee"(email) ON DELETE CASCADE
);

-- ============================================================================
-- EMPLOYEE PRODUCTIVITY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public."EmployeeProductivity" (
  id TEXT PRIMARY KEY,
  week TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  employee_code JSONB,
  location TEXT,
  department TEXT,
  computer_name TEXT,
  computer_activities_hr TEXT,
  productive_time_hr TEXT,
  productivity_percentage DOUBLE PRECISION,
  unproductive_time_hr TEXT,
  unproductivity_percentage TEXT,
  neutral_time_hr TEXT,
  present_days BIGINT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_employee_productivity_email FOREIGN KEY (email)
    REFERENCES public."Employee"(email) ON DELETE CASCADE,
  CONSTRAINT employee_productivity_week_format_check CHECK (week ~ '^[0-9]{4}-W[0-9]{2}$'),
  CONSTRAINT employee_productivity_email_week_key UNIQUE (email, week)
);

-- ============================================================================
-- MONTHWISE EMPLOYEE PRODUCTIVITY DETAILS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public."MonthwiseEmployeeProductivityDetails" (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  month TEXT NOT NULL,
  "teamMember" TEXT,
  "capacityHrs" DOUBLE PRECISION,
  "presentDays" BIGINT,
  "billableHrs" DOUBLE PRECISION,
  "billableUtilization" DOUBLE PRECISION,
  "nonBillableHrs" DOUBLE PRECISION,
  "totalUtilization" DOUBLE PRECISION,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_monthwise_productivity_email FOREIGN KEY (email)
    REFERENCES public."Employee"(email) ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_employee_email ON public."Employee"(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_employee_department ON public."Employee"(department) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_employee_location ON public."Employee"(location) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_employee_status ON public."Employee"(status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_actionitem_email ON public."ActionItem"(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_actionitem_week ON public."ActionItem"(week) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ep_email ON public."EmployeeProductivity"(email);
CREATE INDEX IF NOT EXISTS idx_ep_week ON public."EmployeeProductivity"(week);
CREATE INDEX IF NOT EXISTS idx_ep_department ON public."EmployeeProductivity"(department);
CREATE INDEX IF NOT EXISTS idx_ep_productivity_pct ON public."EmployeeProductivity"(productivity_percentage);

CREATE INDEX IF NOT EXISTS idx_monthwise_email ON public."MonthwiseEmployeeProductivityDetails"(email);
CREATE INDEX IF NOT EXISTS idx_monthwise_month ON public."MonthwiseEmployeeProductivityDetails"(month);

-- ============================================================================
-- UPDATED_AT TRIGGER (camelCase columns)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_camelcase()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_employee_updated_at ON public."Employee";
CREATE TRIGGER update_employee_updated_at
  BEFORE UPDATE ON public."Employee"
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_camelcase();

DROP TRIGGER IF EXISTS update_actionitem_updated_at ON public."ActionItem";
CREATE TRIGGER update_actionitem_updated_at
  BEFORE UPDATE ON public."ActionItem"
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_camelcase();

DROP TRIGGER IF EXISTS update_employee_productivity_updated_at ON public."EmployeeProductivity";
CREATE TRIGGER update_employee_productivity_updated_at
  BEFORE UPDATE ON public."EmployeeProductivity"
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_camelcase();

DROP TRIGGER IF EXISTS update_monthwise_productivity_updated_at ON public."MonthwiseEmployeeProductivityDetails";
CREATE TRIGGER update_monthwise_productivity_updated_at
  BEFORE UPDATE ON public."MonthwiseEmployeeProductivityDetails"
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_camelcase();

-- ============================================================================
-- RLS (permissive for demo; tighten per client)
-- ============================================================================
ALTER TABLE public."Employee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ActionItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EmployeeProductivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MonthwiseEmployeeProductivityDetails" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employee_select" ON public."Employee";
CREATE POLICY "Employee_select" ON public."Employee" FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Employee_insert" ON public."Employee";
CREATE POLICY "Employee_insert" ON public."Employee" FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Employee_update" ON public."Employee";
CREATE POLICY "Employee_update" ON public."Employee" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ActionItem_select" ON public."ActionItem";
CREATE POLICY "ActionItem_select" ON public."ActionItem" FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "ActionItem_all" ON public."ActionItem";
CREATE POLICY "ActionItem_all" ON public."ActionItem" FOR ALL TO authenticated
  USING (deleted_at IS NULL) WITH CHECK (deleted_at IS NULL);

DROP POLICY IF EXISTS "EmployeeProductivity_select" ON public."EmployeeProductivity";
CREATE POLICY "EmployeeProductivity_select" ON public."EmployeeProductivity" FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "EmployeeProductivity_insert" ON public."EmployeeProductivity";
CREATE POLICY "EmployeeProductivity_insert" ON public."EmployeeProductivity" FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Monthwise_select" ON public."MonthwiseEmployeeProductivityDetails";
CREATE POLICY "Monthwise_select" ON public."MonthwiseEmployeeProductivityDetails" FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Monthwise_insert" ON public."MonthwiseEmployeeProductivityDetails";
CREATE POLICY "Monthwise_insert" ON public."MonthwiseEmployeeProductivityDetails" FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================================
-- RPC: Helper functions for productivity
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_latest_productivity_week()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT week
    FROM public."EmployeeProductivity"
    ORDER BY "createdAt" DESC
    LIMIT 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_productivity_metrics(target_week TEXT DEFAULT NULL)
RETURNS TABLE (
  average_productivity DOUBLE PRECISION,
  total_employees BIGINT,
  high_performers BIGINT,
  average_performers BIGINT,
  low_performers BIGINT,
  week TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  latest_week TEXT;
BEGIN
  IF target_week IS NULL THEN
    latest_week := get_latest_productivity_week();
  ELSE
    latest_week := target_week;
  END IF;

  RETURN QUERY
  SELECT
    AVG(ep.productivity_percentage)::DOUBLE PRECISION AS average_productivity,
    COUNT(DISTINCT ep.email)::BIGINT AS total_employees,
    COUNT(DISTINCT CASE WHEN ep.productivity_percentage >= 75 THEN ep.email END)::BIGINT AS high_performers,
    COUNT(DISTINCT CASE WHEN ep.productivity_percentage >= 50 AND ep.productivity_percentage < 75 THEN ep.email END)::BIGINT AS average_performers,
    COUNT(DISTINCT CASE WHEN ep.productivity_percentage < 50 THEN ep.email END)::BIGINT AS low_performers,
    latest_week AS week
  FROM public."EmployeeProductivity" ep
  WHERE ep.week = latest_week
    AND NOT EXISTS (
      SELECT 1 FROM public."ActionItem" ai
      WHERE ai.email = ep.email AND ai.week = ep.week AND ai."excludeFromScoring" = true
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_reports(manager_email TEXT)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  employee_email TEXT,
  department TEXT,
  location TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id AS employee_id,
    e.name AS employee_name,
    e.email AS employee_email,
    e.department,
    e.location
  FROM public."Employee" e
  WHERE e."reportingManagerEmail" = manager_email
    AND e.deleted_at IS NULL;
END;
$$;

-- ============================================================================
-- VIEWS
-- ============================================================================
CREATE OR REPLACE VIEW productivity_overview AS
SELECT
  ep.department,
  COUNT(DISTINCT ep.email) AS employee_count,
  AVG(ep.productivity_percentage) AS avg_productivity,
  SUM(ep.present_days) AS total_present_days,
  ep.week
FROM public."EmployeeProductivity" ep
GROUP BY ep.department, ep.week;

CREATE OR REPLACE VIEW department_productivity_summary AS
SELECT
  department,
  COUNT(DISTINCT email) AS total_employees,
  AVG(productivity_percentage) AS avg_productivity_percentage,
  SUM(present_days) AS total_present_days
FROM public."EmployeeProductivity"
GROUP BY department;


-- 20260203_project_backups.sql
-- ============================================================================
-- Project Backups - minimal schema for backup/restore UI
-- ============================================================================
-- This table stores snapshot metadata for project-level backups. The actual
-- snapshot format is intentionally generic (JSONB) so that different backup
-- strategies can be implemented by Edge Functions.
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  backup_type TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'completed',
  notes TEXT,
  snapshot JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_backups_project ON project_backups(project_id);
CREATE INDEX IF NOT EXISTS idx_project_backups_created_at ON project_backups(created_at DESC);

ALTER TABLE project_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view project backups" ON project_backups;
CREATE POLICY "Authenticated users can view project backups"
  ON project_backups
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage project backups" ON project_backups;
CREATE POLICY "Authenticated users can manage project backups"
  ON project_backups
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);



-- 20260204050227_c84b5c6f-001f-40d7-b714-9ab9b8810936.sql
-- Insert Google Meet integration fields (client_id and client_secret)
INSERT INTO integration_fields (
  provider_id,
  field_key,
  label,
  field_type,
  is_required,
  display_order,
  placeholder,
  help_text
)
VALUES
  (
    '815ebb95-78cd-4fcf-a90e-7087006b3ea7',
    'client_id',
    'Client ID',
    'text',
    true,
    1,
    'Enter your Google OAuth Client ID',
    'Get this from the Google Cloud Console under APIs & Services > Credentials'
  ),
  (
    '815ebb95-78cd-4fcf-a90e-7087006b3ea7',
    'client_secret',
    'Client Secret',
    'password',
    true,
    2,
    'Enter your Google OAuth Client Secret',
    'Get this from the Google Cloud Console under APIs & Services > Credentials'
  );

-- 20260204_api_keys.sql
/**
 * API Keys Management
 *
 * Enables API key-based authentication for programmatic access to Control Tower APIs.
 * Supports scoped permissions and rate limiting.
 *
 * Use Cases:
 * - Third-party integrations accessing Control Tower APIs
 * - Automation scripts and CI/CD pipelines
 * - Mobile apps and SPAs (for server-side operations)
 * - Webhooks and background jobs
 */

-- ============================================================================
-- API Keys Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Key identification
  name TEXT NOT NULL,
  description TEXT,
  key_prefix TEXT NOT NULL, -- First 8 chars of key for display (e.g., "sk_live_")
  key_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of full key

  -- Ownership
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID, -- Future multi-org support

  -- Permissions
  scopes TEXT[] NOT NULL DEFAULT '{read}', -- read, write, admin
  allowed_endpoints TEXT[] DEFAULT '{}', -- Specific endpoints allowed (empty = all)

  -- Security
  allowed_ips TEXT[] DEFAULT '{}', -- IP whitelist (empty = all IPs)
  rate_limit_per_minute INTEGER DEFAULT 60,

  -- Status
  enabled BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ, -- NULL = never expires

  -- Metadata
  last_used_at TIMESTAMPTZ,
  last_used_ip TEXT,
  total_requests INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_created_by ON api_keys(created_by);
CREATE INDEX idx_api_keys_enabled ON api_keys(enabled);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);

-- RLS Policies
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Admins can manage all API keys
CREATE POLICY "Admins can manage all API keys"
  ON api_keys
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Users can view their own API keys
CREATE POLICY "Users can view their own API keys"
  ON api_keys
  FOR SELECT
  USING (created_by = auth.uid());

-- Users can create their own API keys
CREATE POLICY "Users can create their own API keys"
  ON api_keys
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Users can update their own API keys
CREATE POLICY "Users can update their own API keys"
  ON api_keys
  FOR UPDATE
  USING (created_by = auth.uid());

-- Users can delete their own API keys
CREATE POLICY "Users can delete their own API keys"
  ON api_keys
  FOR DELETE
  USING (created_by = auth.uid());

-- ============================================================================
-- API Key Request Logs Table (for analytics and debugging)
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_key_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,

  -- Request details
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,

  -- Client info
  ip_address TEXT,
  user_agent TEXT,

  -- Error tracking
  error_message TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_api_logs_key_id ON api_key_request_logs(api_key_id);
CREATE INDEX idx_api_logs_created_at ON api_key_request_logs(created_at);
CREATE INDEX idx_api_logs_endpoint ON api_key_request_logs(endpoint);

-- RLS Policies
ALTER TABLE api_key_request_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs
CREATE POLICY "Admins can view all API logs"
  ON api_key_request_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Users can view logs for their API keys
CREATE POLICY "Users can view their API key logs"
  ON api_key_request_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM api_keys
      WHERE api_keys.id = api_key_id
      AND api_keys.created_by = auth.uid()
    )
  );

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Generate API key with prefix
CREATE OR REPLACE FUNCTION generate_api_key(p_prefix TEXT DEFAULT 'sk_live')
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  -- Generate 48-character random string
  FOR i IN 1..48 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;

  -- Return with prefix
  RETURN p_prefix || '_' || result;
END;
$$ LANGUAGE plpgsql;

-- Hash API key using SHA-256
CREATE OR REPLACE FUNCTION hash_api_key(p_key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(p_key, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Validate API key and return key info
CREATE OR REPLACE FUNCTION validate_api_key(p_key TEXT)
RETURNS TABLE (
  id UUID,
  created_by UUID,
  scopes TEXT[],
  allowed_endpoints TEXT[],
  allowed_ips TEXT[],
  rate_limit_per_minute INTEGER
) AS $$
DECLARE
  v_key_hash TEXT;
BEGIN
  -- Hash the provided key
  v_key_hash := hash_api_key(p_key);

  -- Return key info if valid
  RETURN QUERY
  SELECT
    k.id,
    k.created_by,
    k.scopes,
    k.allowed_endpoints,
    k.allowed_ips,
    k.rate_limit_per_minute
  FROM api_keys k
  WHERE k.key_hash = v_key_hash
    AND k.enabled = TRUE
    AND (k.expires_at IS NULL OR k.expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update API key usage stats
CREATE OR REPLACE FUNCTION update_api_key_usage(
  p_key_hash TEXT,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE api_keys
  SET
    last_used_at = NOW(),
    last_used_ip = COALESCE(p_ip_address, last_used_ip),
    total_requests = total_requests + 1
  WHERE key_hash = p_key_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up expired API keys
CREATE OR REPLACE FUNCTION cleanup_expired_api_keys()
RETURNS void AS $$
BEGIN
  -- Delete expired API keys
  DELETE FROM api_keys
  WHERE expires_at < NOW();

  -- Delete old request logs (older than 90 days)
  DELETE FROM api_key_request_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE api_keys IS 'API keys for programmatic access to Control Tower APIs';
COMMENT ON TABLE api_key_request_logs IS 'Request logs for API key usage analytics';

COMMENT ON COLUMN api_keys.key_prefix IS 'First 8 chars of key for display (e.g., sk_live_abc12345)';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash of the full API key';
COMMENT ON COLUMN api_keys.scopes IS 'Permissions: read, write, admin';
COMMENT ON COLUMN api_keys.allowed_endpoints IS 'Specific endpoints allowed (empty = all endpoints)';
COMMENT ON COLUMN api_keys.allowed_ips IS 'IP whitelist (empty = all IPs allowed)';
COMMENT ON COLUMN api_keys.rate_limit_per_minute IS 'Max requests per minute (default: 60)';


-- 20260204_oauth_provider.sql
/**
 * OAuth Provider Tables
 *
 * Enables this Control Tower instance to act as an OAuth 2.0 identity provider
 * for other Control Tower instances or third-party applications.
 *
 * Flow:
 * 1. External app registers as oauth_clients (admin creates)
 * 2. User visits /oauth/authorize with client_id
 * 3. User consents, oauth_authorization_codes created
 * 4. External app exchanges code for access_token at /oauth/token
 * 5. oauth_access_tokens created
 * 6. External app calls /oauth/userinfo with access_token
 */

-- ============================================================================
-- OAuth Clients Table
-- Stores registered OAuth client applications
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT UNIQUE NOT NULL,
  client_secret TEXT NOT NULL, -- hashed
  client_name TEXT NOT NULL,
  client_type TEXT NOT NULL DEFAULT 'confidential', -- 'confidential' or 'public'

  -- OAuth configuration
  redirect_uris TEXT[] NOT NULL DEFAULT '{}', -- Allowed redirect URIs
  allowed_scopes TEXT[] NOT NULL DEFAULT '{openid,profile,email}', -- Scopes this client can request
  grant_types TEXT[] NOT NULL DEFAULT '{authorization_code,refresh_token}', -- Allowed grant types

  -- Client metadata
  logo_url TEXT,
  homepage_url TEXT,
  privacy_policy_url TEXT,
  terms_of_service_url TEXT,

  -- Security
  require_pkce BOOLEAN DEFAULT FALSE,
  require_consent BOOLEAN DEFAULT TRUE,
  trusted BOOLEAN DEFAULT FALSE, -- If true, skip consent screen

  -- Status
  enabled BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metrics
  total_authorizations INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ
);

-- Add indexes
CREATE INDEX idx_oauth_clients_client_id ON oauth_clients(client_id);
CREATE INDEX idx_oauth_clients_enabled ON oauth_clients(enabled);

-- Add RLS
ALTER TABLE oauth_clients ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage OAuth clients
CREATE POLICY "Admins can manage OAuth clients"
  ON oauth_clients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- ============================================================================
-- OAuth Authorization Codes Table
-- Temporary codes issued during authorization flow
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Authorization details
  redirect_uri TEXT NOT NULL,
  scope TEXT[] NOT NULL DEFAULT '{openid,profile,email}',

  -- PKCE support
  code_challenge TEXT,
  code_challenge_method TEXT, -- 'S256' or 'plain'

  -- Lifecycle
  used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_oauth_codes_code ON oauth_authorization_codes(code);
CREATE INDEX idx_oauth_codes_client_id ON oauth_authorization_codes(client_id);
CREATE INDEX idx_oauth_codes_user_id ON oauth_authorization_codes(user_id);
CREATE INDEX idx_oauth_codes_expires_at ON oauth_authorization_codes(expires_at);

-- Add RLS
ALTER TABLE oauth_authorization_codes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own authorization codes
CREATE POLICY "Users can view their own authorization codes"
  ON oauth_authorization_codes
  FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- OAuth Access Tokens Table
-- Long-lived access tokens for API access
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token TEXT UNIQUE NOT NULL,
  refresh_token TEXT UNIQUE,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Token details
  scope TEXT[] NOT NULL DEFAULT '{openid,profile,email}',
  token_type TEXT NOT NULL DEFAULT 'Bearer',

  -- Lifecycle
  revoked BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
  refresh_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Add indexes
CREATE INDEX idx_oauth_tokens_access_token ON oauth_access_tokens(access_token);
CREATE INDEX idx_oauth_tokens_refresh_token ON oauth_access_tokens(refresh_token);
CREATE INDEX idx_oauth_tokens_client_id ON oauth_access_tokens(client_id);
CREATE INDEX idx_oauth_tokens_user_id ON oauth_access_tokens(user_id);
CREATE INDEX idx_oauth_tokens_expires_at ON oauth_access_tokens(expires_at);

-- Add RLS
ALTER TABLE oauth_access_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view their own tokens
CREATE POLICY "Users can view their own access tokens"
  ON oauth_access_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- OAuth User Consents Table
-- Track user consent decisions for each client
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,

  -- Consent details
  scopes TEXT[] NOT NULL DEFAULT '{openid,profile,email}',
  consented_at TIMESTAMPTZ DEFAULT NOW(),

  -- If user revokes, we delete the row
  -- If they re-consent, we recreate

  UNIQUE(user_id, client_id)
);

-- Add indexes
CREATE INDEX idx_oauth_consents_user_id ON oauth_user_consents(user_id);
CREATE INDEX idx_oauth_consents_client_id ON oauth_user_consents(client_id);

-- Add RLS
ALTER TABLE oauth_user_consents ENABLE ROW LEVEL SECURITY;

-- Users can view/revoke their own consents
CREATE POLICY "Users can manage their own consents"
  ON oauth_user_consents
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to generate secure random tokens
CREATE OR REPLACE FUNCTION generate_oauth_token(length INTEGER DEFAULT 32)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired codes and tokens
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_data()
RETURNS void AS $$
BEGIN
  -- Delete expired authorization codes
  DELETE FROM oauth_authorization_codes
  WHERE expires_at < NOW();

  -- Delete expired access tokens
  DELETE FROM oauth_access_tokens
  WHERE expires_at < NOW()
  AND refresh_expires_at < NOW();

  -- Delete revoked tokens older than 30 days
  DELETE FROM oauth_access_tokens
  WHERE revoked = TRUE
  AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Function to verify client secret using bcrypt
CREATE OR REPLACE FUNCTION verify_client_secret(
  p_client_id TEXT,
  p_secret TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_stored_hash TEXT;
BEGIN
  -- Get stored hash for client
  SELECT client_secret INTO v_stored_hash
  FROM oauth_clients
  WHERE client_id = p_client_id
  AND enabled = TRUE;

  IF v_stored_hash IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Verify password using pgcrypto crypt
  RETURN (v_stored_hash = crypt(p_secret, v_stored_hash));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Seed Data - Example OAuth Client
-- ============================================================================

-- Create a sample OAuth client for testing
INSERT INTO oauth_clients (
  client_id,
  client_secret,
  client_name,
  redirect_uris,
  allowed_scopes,
  logo_url,
  homepage_url,
  require_consent,
  trusted
) VALUES (
  'control-tower-dev-client',
  -- This is a hashed version of 'dev_secret_123' using pgcrypto
  crypt('dev_secret_123', gen_salt('bf')),
  'Control Tower Development',
  ARRAY['http://localhost:8080/auth/callback', 'https://dev.controltower.com/auth/callback'],
  ARRAY['openid', 'profile', 'email', 'roles'],
  NULL,
  'http://localhost:8080',
  TRUE,
  FALSE
) ON CONFLICT (client_id) DO NOTHING;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE oauth_clients IS 'Registered OAuth 2.0 client applications that can authenticate users';
COMMENT ON TABLE oauth_authorization_codes IS 'Temporary authorization codes issued during OAuth flow';
COMMENT ON TABLE oauth_access_tokens IS 'Access and refresh tokens for authenticated API access';
COMMENT ON TABLE oauth_user_consents IS 'User consent records for each OAuth client';

COMMENT ON COLUMN oauth_clients.client_type IS 'confidential = server-side apps with secrets, public = SPA/mobile apps';
COMMENT ON COLUMN oauth_clients.require_pkce IS 'Require Proof Key for Code Exchange (recommended for public clients)';
COMMENT ON COLUMN oauth_clients.trusted IS 'If true, skip consent screen (for first-party apps)';

COMMENT ON COLUMN oauth_authorization_codes.code_challenge IS 'PKCE code challenge for enhanced security';
COMMENT ON COLUMN oauth_authorization_codes.code_challenge_method IS 'PKCE method: S256 (SHA-256) or plain';

COMMENT ON COLUMN oauth_access_tokens.scope IS 'Granted scopes for this token';
COMMENT ON COLUMN oauth_access_tokens.revoked IS 'If true, token has been revoked and cannot be used';


-- 20260205000000_add_google_drive_provider.sql
-- ============================================
-- Add Google Drive Provider for Storage Integration
-- Enables Google Drive file sync and management
-- ============================================

-- Add Google Drive provider to storage-productivity category
INSERT INTO public.integration_providers (
  category_id,
  name,
  slug,
  description,
  auth_type,
  oauth_config,
  docs_url,
  is_available,
  is_coming_soon,
  is_beta,
  display_order
)
SELECT
  id,
  'Google Drive',
  'google-drive',
  'Sync and manage files from Google Drive for knowledge base and document management',
  'oauth2',
  '{"authorize_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token", "scopes": ["https://www.googleapis.com/auth/drive.readonly", "https://www.googleapis.com/auth/drive.file"]}'::jsonb,
  'https://developers.google.com/drive/api/guides/about-sdk',
  true,
  false,
  false,
  15
FROM public.integration_categories
WHERE slug = 'storage-productivity'
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  oauth_config = EXCLUDED.oauth_config,
  docs_url = EXCLUDED.docs_url,
  is_available = EXCLUDED.is_available;

-- Insert Google Drive integration fields (client_id and client_secret)
INSERT INTO integration_fields (
  provider_id,
  field_key,
  label,
  field_type,
  is_required,
  is_sensitive,
  display_order,
  placeholder,
  help_text
)
SELECT
  id,
  'client_id',
  'Client ID',
  'text',
  true,
  false,
  1,
  'Enter your Google OAuth Client ID',
  'Get this from the Google Cloud Console under APIs & Services > Credentials'
FROM public.integration_providers
WHERE slug = 'google-drive'
ON CONFLICT (provider_id, field_key) DO UPDATE SET
  label = EXCLUDED.label,
  field_type = EXCLUDED.field_type,
  is_required = EXCLUDED.is_required,
  placeholder = EXCLUDED.placeholder,
  help_text = EXCLUDED.help_text;

INSERT INTO integration_fields (
  provider_id,
  field_key,
  label,
  field_type,
  is_required,
  is_sensitive,
  display_order,
  placeholder,
  help_text
)
SELECT
  id,
  'client_secret',
  'Client Secret',
  'password',
  true,
  true,
  2,
  'Enter your Google OAuth Client Secret',
  'Get this from the Google Cloud Console under APIs & Services > Credentials'
FROM public.integration_providers
WHERE slug = 'google-drive'
ON CONFLICT (provider_id, field_key) DO UPDATE SET
  label = EXCLUDED.label,
  field_type = EXCLUDED.field_type,
  is_required = EXCLUDED.is_required,
  is_sensitive = EXCLUDED.is_sensitive,
  placeholder = EXCLUDED.placeholder,
  help_text = EXCLUDED.help_text;



-- 20260205_agent_memory_system.sql
/**
 * Agent Memory System Migration
 *
 * Enables agents to remember context, preferences, and past interactions.
 * Memory types:
 * - Short-term: Recent conversation context (last N messages)
 * - Long-term: Persistent facts, preferences, learned patterns
 * - Episodic: Key events, milestones, important conversations
 * - Semantic: Embedded knowledge for semantic search
 *
 * This is Phase 1 of the Agentic Evolution Roadmap - Memory & Context.
 */

-- ============================================================================
-- Agent Memories Table
-- Stores all types of agent memories with vector embeddings
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Memory classification
  memory_type TEXT NOT NULL, -- 'short_term', 'long_term', 'episodic', 'semantic'
  memory_category TEXT, -- 'preference', 'fact', 'skill', 'goal', 'relationship', 'context'

  -- Content
  content TEXT NOT NULL, -- The actual memory content
  summary TEXT, -- Short summary for quick lookup

  -- Embedding for semantic search
  embedding vector(1536), -- OpenAI ada-002 dimension

  -- Source context
  source_type TEXT, -- 'conversation', 'feedback', 'observation', 'explicit'
  source_id UUID, -- Conversation ID, message ID, etc.

  -- Importance and relevance
  importance_score FLOAT DEFAULT 0.5, -- 0.0 (trivial) to 1.0 (critical)
  access_count INTEGER DEFAULT 0, -- How many times this memory was retrieved
  last_accessed_at TIMESTAMPTZ,

  -- Temporal relevance
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ, -- NULL means indefinite

  -- Memory lifecycle
  is_active BOOLEAN DEFAULT TRUE,
  consolidated BOOLEAN DEFAULT FALSE, -- Has been consolidated into long-term
  superseded_by UUID REFERENCES agent_memories(id), -- If replaced by newer memory

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional context

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_agent_memories_agent_id ON agent_memories(agent_id);
CREATE INDEX idx_agent_memories_user_id ON agent_memories(user_id);
CREATE INDEX idx_agent_memories_type ON agent_memories(memory_type);
CREATE INDEX idx_agent_memories_category ON agent_memories(memory_category);
CREATE INDEX idx_agent_memories_importance ON agent_memories(importance_score DESC);
CREATE INDEX idx_agent_memories_active ON agent_memories(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_agent_memories_created_at ON agent_memories(created_at DESC);

-- Vector similarity search index (using ivfflat)
CREATE INDEX idx_agent_memories_embedding ON agent_memories
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- RLS Policies
ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;

-- Users can view their own agent memories
CREATE POLICY "Users can view their agent memories"
  ON agent_memories
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all memories
CREATE POLICY "Admins can view all agent memories"
  ON agent_memories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- System can manage memories
CREATE POLICY "System can manage agent memories"
  ON agent_memories
  FOR ALL
  USING (user_id = auth.uid());

-- ============================================================================
-- User Preferences Table
-- Learned preferences from user interactions
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL, -- NULL means global preference

  -- Preference details
  preference_key TEXT NOT NULL, -- 'communication_style', 'preferred_time', 'task_priority_order', etc.
  preference_value JSONB NOT NULL, -- The preference value (flexible structure)

  -- Source and confidence
  learned_from TEXT, -- 'explicit', 'observed', 'inferred'
  confidence_score FLOAT DEFAULT 0.5, -- 0.0 (uncertain) to 1.0 (certain)
  evidence_count INTEGER DEFAULT 1, -- Number of observations supporting this

  -- Impact tracking
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Lifecycle
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one preference key per user per agent (or global)
  UNIQUE(user_id, agent_id, preference_key)
);

-- Indexes
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_user_preferences_agent_id ON user_preferences(agent_id);
CREATE INDEX idx_user_preferences_key ON user_preferences(preference_key);
CREATE INDEX idx_user_preferences_active ON user_preferences(is_active) WHERE is_active = TRUE;

-- RLS Policies
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view their preferences"
  ON user_preferences
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all preferences
CREATE POLICY "Admins can view all preferences"
  ON user_preferences
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- System can manage preferences
CREATE POLICY "System can manage preferences"
  ON user_preferences
  FOR ALL
  USING (user_id = auth.uid());

-- ============================================================================
-- Agent Learning Events Table
-- Tracks feedback, corrections, and learning opportunities
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL, -- 'user_feedback', 'correction', 'reinforcement', 'rejection'
  event_description TEXT NOT NULL,

  -- Context
  related_memory_id UUID REFERENCES agent_memories(id),
  related_conversation_id UUID, -- Link to agent_conversations if exists
  related_message_id UUID, -- Link to agent_messages if exists

  -- Feedback details
  feedback_type TEXT, -- 'positive', 'negative', 'neutral', 'correction'
  feedback_text TEXT,

  -- Agent response
  agent_action_taken TEXT, -- What the agent did in response
  behavior_change JSONB, -- What changed as a result

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_learning_events_agent_id ON agent_learning_events(agent_id);
CREATE INDEX idx_learning_events_user_id ON agent_learning_events(user_id);
CREATE INDEX idx_learning_events_type ON agent_learning_events(event_type);
CREATE INDEX idx_learning_events_created_at ON agent_learning_events(created_at DESC);

-- RLS Policies
ALTER TABLE agent_learning_events ENABLE ROW LEVEL SECURITY;

-- Users can view their learning events
CREATE POLICY "Users can view their learning events"
  ON agent_learning_events
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all learning events
CREATE POLICY "Admins can view all learning events"
  ON agent_learning_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- System can create learning events
CREATE POLICY "System can create learning events"
  ON agent_learning_events
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to retrieve relevant memories using semantic search
CREATE OR REPLACE FUNCTION get_relevant_memories(
  p_agent_id UUID,
  p_user_id UUID,
  p_query_embedding vector(1536),
  p_memory_types TEXT[] DEFAULT ARRAY['short_term', 'long_term', 'episodic'],
  p_limit INTEGER DEFAULT 10,
  p_similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  memory_id UUID,
  content TEXT,
  memory_type TEXT,
  similarity FLOAT,
  importance_score FLOAT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.memory_type,
    1 - (m.embedding <=> p_query_embedding) AS similarity,
    m.importance_score,
    m.created_at
  FROM agent_memories m
  WHERE
    m.agent_id = p_agent_id
    AND m.user_id = p_user_id
    AND m.is_active = TRUE
    AND m.memory_type = ANY(p_memory_types)
    AND (1 - (m.embedding <=> p_query_embedding)) >= p_similarity_threshold
  ORDER BY
    (1 - (m.embedding <=> p_query_embedding)) DESC,
    m.importance_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to consolidate short-term memories into long-term
CREATE OR REPLACE FUNCTION consolidate_short_term_memories(
  p_agent_id UUID,
  p_user_id UUID,
  p_days_old INTEGER DEFAULT 7
)
RETURNS INTEGER AS $$
DECLARE
  consolidated_count INTEGER := 0;
BEGIN
  -- Mark old short-term memories for consolidation
  UPDATE agent_memories
  SET
    memory_type = 'long_term',
    consolidated = TRUE,
    updated_at = NOW()
  WHERE
    agent_id = p_agent_id
    AND user_id = p_user_id
    AND memory_type = 'short_term'
    AND is_active = TRUE
    AND created_at < NOW() - (p_days_old || ' days')::INTERVAL
    AND importance_score >= 0.3 -- Only consolidate somewhat important memories
    AND access_count > 0; -- Only consolidate accessed memories

  GET DIAGNOSTICS consolidated_count = ROW_COUNT;

  RETURN consolidated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to prune low-value short-term memories
CREATE OR REPLACE FUNCTION prune_short_term_memories(
  p_agent_id UUID,
  p_user_id UUID,
  p_days_old INTEGER DEFAULT 30,
  p_importance_threshold FLOAT DEFAULT 0.2
)
RETURNS INTEGER AS $$
DECLARE
  pruned_count INTEGER := 0;
BEGIN
  -- Deactivate old, low-importance, rarely-accessed short-term memories
  UPDATE agent_memories
  SET
    is_active = FALSE,
    updated_at = NOW()
  WHERE
    agent_id = p_agent_id
    AND user_id = p_user_id
    AND memory_type = 'short_term'
    AND is_active = TRUE
    AND created_at < NOW() - (p_days_old || ' days')::INTERVAL
    AND importance_score < p_importance_threshold
    AND access_count < 2;

  GET DIAGNOSTICS pruned_count = ROW_COUNT;

  RETURN pruned_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update memory access statistics
CREATE OR REPLACE FUNCTION update_memory_access()
RETURNS TRIGGER AS $$
BEGIN
  -- This trigger would be called when a memory is accessed
  -- (Implementation depends on how you track access)
  NEW.access_count = OLD.access_count + 1;
  NEW.last_accessed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to increment access count for multiple memories
CREATE OR REPLACE FUNCTION increment_memory_access(memory_ids UUID[])
RETURNS VOID AS $$
BEGIN
  UPDATE agent_memories
  SET
    access_count = access_count + 1,
    last_accessed_at = NOW()
  WHERE id = ANY(memory_ids);
END;
$$ LANGUAGE plpgsql;

-- Function to boost importance of frequently accessed memories
CREATE OR REPLACE FUNCTION boost_memory_importance(
  p_memory_id UUID,
  p_boost_amount FLOAT DEFAULT 0.1
)
RETURNS VOID AS $$
BEGIN
  UPDATE agent_memories
  SET
    importance_score = LEAST(1.0, importance_score + p_boost_amount),
    updated_at = NOW()
  WHERE id = p_memory_id;
END;
$$ LANGUAGE plpgsql;

-- Auto-update timestamps
CREATE TRIGGER update_agent_memories_updated_at
  BEFORE UPDATE ON agent_memories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Views for Analytics
-- ============================================================================

-- Memory usage by agent
CREATE VIEW agent_memory_stats AS
SELECT
  agent_id,
  COUNT(*) as total_memories,
  COUNT(*) FILTER (WHERE memory_type = 'short_term') as short_term_count,
  COUNT(*) FILTER (WHERE memory_type = 'long_term') as long_term_count,
  COUNT(*) FILTER (WHERE memory_type = 'episodic') as episodic_count,
  COUNT(*) FILTER (WHERE memory_type = 'semantic') as semantic_count,
  AVG(importance_score) as avg_importance,
  SUM(access_count) as total_accesses,
  MAX(last_accessed_at) as last_memory_access
FROM agent_memories
WHERE is_active = TRUE
GROUP BY agent_id;

-- User preference coverage
CREATE VIEW user_preference_coverage AS
SELECT
  user_id,
  COUNT(*) as total_preferences,
  COUNT(*) FILTER (WHERE learned_from = 'explicit') as explicit_count,
  COUNT(*) FILTER (WHERE learned_from = 'observed') as observed_count,
  COUNT(*) FILTER (WHERE learned_from = 'inferred') as inferred_count,
  AVG(confidence_score) as avg_confidence,
  SUM(times_used) as total_usage
FROM user_preferences
WHERE is_active = TRUE
GROUP BY user_id;

-- Learning event summary
CREATE VIEW agent_learning_summary AS
SELECT
  agent_id,
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE event_type = 'user_feedback') as feedback_count,
  COUNT(*) FILTER (WHERE event_type = 'correction') as correction_count,
  COUNT(*) FILTER (WHERE event_type = 'reinforcement') as reinforcement_count,
  COUNT(*) FILTER (WHERE feedback_type = 'positive') as positive_feedback,
  COUNT(*) FILTER (WHERE feedback_type = 'negative') as negative_feedback
FROM agent_learning_events
GROUP BY agent_id;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE agent_memories IS 'Agent memory store with vector embeddings for semantic search';
COMMENT ON TABLE user_preferences IS 'Learned user preferences from interactions';
COMMENT ON TABLE agent_learning_events IS 'Tracks feedback and learning opportunities';

COMMENT ON COLUMN agent_memories.memory_type IS 'short_term, long_term, episodic, semantic';
COMMENT ON COLUMN agent_memories.memory_category IS 'preference, fact, skill, goal, relationship, context';
COMMENT ON COLUMN agent_memories.importance_score IS 'Relevance score from 0.0 (trivial) to 1.0 (critical)';
COMMENT ON COLUMN agent_memories.embedding IS 'Vector embedding for semantic similarity search';

COMMENT ON COLUMN user_preferences.learned_from IS 'How the preference was learned: explicit, observed, inferred';
COMMENT ON COLUMN user_preferences.confidence_score IS 'Confidence in this preference from 0.0 (uncertain) to 1.0 (certain)';

COMMENT ON COLUMN agent_learning_events.event_type IS 'user_feedback, correction, reinforcement, rejection';
COMMENT ON COLUMN agent_learning_events.feedback_type IS 'positive, negative, neutral, correction';


-- 20260205_agent_multi_step_execution.sql
/**
 * Multi-Step Agent Execution Tables
 *
 * Enables agents to plan and execute complex workflows with multiple steps.
 * Agents can now:
 * - Decompose goals into actionable steps
 * - Execute steps sequentially or in parallel
 * - Capture reasoning at each decision point
 * - Handle errors and retries
 * - Track progress through multi-step workflows
 *
 * This is Phase 1 of the Agentic Evolution Roadmap.
 */

-- ============================================================================
-- Agent Execution Plans Table
-- Stores high-level workflow plans created by agents
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_execution_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Plan details
  input TEXT NOT NULL, -- User's original input/goal
  goal TEXT NOT NULL, -- Extracted/clarified goal
  plan_summary TEXT, -- High-level description of the plan

  -- Execution state
  status TEXT NOT NULL DEFAULT 'planning', -- 'planning', 'executing', 'paused', 'completed', 'failed', 'cancelled'
  current_step_number INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 0,

  -- Plan structure (array of step objects)
  steps JSONB NOT NULL DEFAULT '[]', -- [{ step_number, action_type, description, depends_on }]

  -- Results
  final_output JSONB,
  success BOOLEAN,

  -- Performance metrics
  total_tokens_used INTEGER DEFAULT 0,
  total_cost DECIMAL(10, 6) DEFAULT 0,
  planning_time_ms INTEGER,
  execution_time_ms INTEGER,

  -- Metadata
  metadata JSONB, -- Additional context (conversation_id, session_id, etc.)

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_agent_plans_agent_id ON agent_execution_plans(agent_id);
CREATE INDEX idx_agent_plans_user_id ON agent_execution_plans(user_id);
CREATE INDEX idx_agent_plans_status ON agent_execution_plans(status);
CREATE INDEX idx_agent_plans_created_at ON agent_execution_plans(created_at DESC);

-- RLS Policies
ALTER TABLE agent_execution_plans ENABLE ROW LEVEL SECURITY;

-- Users can view their own execution plans
CREATE POLICY "Users can view their agent execution plans"
  ON agent_execution_plans
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all plans
CREATE POLICY "Admins can view all agent execution plans"
  ON agent_execution_plans
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- System can create and update plans
CREATE POLICY "System can manage agent execution plans"
  ON agent_execution_plans
  FOR ALL
  USING (user_id = auth.uid());

-- ============================================================================
-- Agent Execution Steps Table
-- Individual steps within an execution plan
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_execution_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  plan_id UUID NOT NULL REFERENCES agent_execution_plans(id) ON DELETE CASCADE,
  parent_step_id UUID REFERENCES agent_execution_steps(id), -- For sub-steps/nested workflows

  -- Step details
  step_number INTEGER NOT NULL,
  step_name TEXT,
  description TEXT,

  -- Action details
  action_type TEXT NOT NULL, -- 'tool_call', 'reasoning', 'user_input', 'data_retrieval', 'api_call'
  action_details JSONB, -- Tool name, parameters, etc.

  -- Dependencies
  depends_on INTEGER[], -- Array of step numbers this step depends on
  can_run_parallel BOOLEAN DEFAULT FALSE,

  -- Execution
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'skipped', 'blocked'
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Results
  result JSONB,
  output_for_next_step TEXT, -- Simplified output passed to next step

  -- Error handling
  error_message TEXT,
  error_code TEXT,

  -- Performance metrics
  tokens_used INTEGER DEFAULT 0,
  cost DECIMAL(10, 6) DEFAULT 0,
  execution_time_ms INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_agent_steps_plan_id ON agent_execution_steps(plan_id);
CREATE INDEX idx_agent_steps_parent_id ON agent_execution_steps(parent_step_id);
CREATE INDEX idx_agent_steps_status ON agent_execution_steps(status);
CREATE INDEX idx_agent_steps_plan_step ON agent_execution_steps(plan_id, step_number);

-- RLS Policies
ALTER TABLE agent_execution_steps ENABLE ROW LEVEL SECURITY;

-- Users can view steps from their plans
CREATE POLICY "Users can view their agent execution steps"
  ON agent_execution_steps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agent_execution_plans
      WHERE agent_execution_plans.id = plan_id
      AND agent_execution_plans.user_id = auth.uid()
    )
  );

-- Admins can view all steps
CREATE POLICY "Admins can view all agent execution steps"
  ON agent_execution_steps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- System can manage steps
CREATE POLICY "System can manage agent execution steps"
  ON agent_execution_steps
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM agent_execution_plans
      WHERE agent_execution_plans.id = plan_id
      AND agent_execution_plans.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Agent Reasoning Traces Table
-- Captures agent's reasoning/thinking at each decision point
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_reasoning_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  plan_id UUID NOT NULL REFERENCES agent_execution_plans(id) ON DELETE CASCADE,
  step_id UUID REFERENCES agent_execution_steps(id) ON DELETE CASCADE,

  -- Reasoning details
  reasoning_type TEXT NOT NULL, -- 'planning', 'decision', 'reflection', 'error_analysis', 'verification'
  content TEXT NOT NULL, -- The actual reasoning/thinking

  -- Context
  context JSONB, -- What information was available when this reasoning occurred

  -- Confidence
  confidence_score FLOAT, -- 0.0 - 1.0

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_reasoning_plan_id ON agent_reasoning_traces(plan_id);
CREATE INDEX idx_reasoning_step_id ON agent_reasoning_traces(step_id);
CREATE INDEX idx_reasoning_type ON agent_reasoning_traces(reasoning_type);
CREATE INDEX idx_reasoning_created_at ON agent_reasoning_traces(created_at DESC);

-- RLS Policies
ALTER TABLE agent_reasoning_traces ENABLE ROW LEVEL SECURITY;

-- Users can view reasoning from their plans
CREATE POLICY "Users can view their agent reasoning traces"
  ON agent_reasoning_traces
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agent_execution_plans
      WHERE agent_execution_plans.id = plan_id
      AND agent_execution_plans.user_id = auth.uid()
    )
  );

-- Admins can view all reasoning
CREATE POLICY "Admins can view all agent reasoning traces"
  ON agent_reasoning_traces
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- System can create reasoning traces
CREATE POLICY "System can create agent reasoning traces"
  ON agent_reasoning_traces
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agent_execution_plans
      WHERE agent_execution_plans.id = plan_id
      AND agent_execution_plans.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Update plan metrics when step completes
CREATE OR REPLACE FUNCTION update_plan_metrics_on_step_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE agent_execution_plans
    SET
      total_tokens_used = total_tokens_used + COALESCE(NEW.tokens_used, 0),
      total_cost = total_cost + COALESCE(NEW.cost, 0),
      current_step_number = GREATEST(current_step_number, NEW.step_number),
      updated_at = NOW()
    WHERE id = NEW.plan_id;
  END IF;

  -- Check if all steps are completed, then mark plan as completed
  IF NEW.status = 'completed' THEN
    PERFORM update_plan_status_if_all_steps_done(NEW.plan_id);
  END IF;

  -- If step failed and no more retries, mark plan as failed
  IF NEW.status = 'failed' AND NEW.retry_count >= NEW.max_retries THEN
    UPDATE agent_execution_plans
    SET
      status = 'failed',
      completed_at = NOW(),
      updated_at = NOW()
    WHERE id = NEW.plan_id
    AND status = 'executing';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_plan_metrics_trigger
  AFTER UPDATE OF status ON agent_execution_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_plan_metrics_on_step_completion();

-- Check if all steps are done and update plan status
CREATE OR REPLACE FUNCTION update_plan_status_if_all_steps_done(p_plan_id UUID)
RETURNS void AS $$
DECLARE
  total_steps_count INTEGER;
  completed_steps_count INTEGER;
  failed_steps_count INTEGER;
BEGIN
  -- Count total steps
  SELECT COUNT(*) INTO total_steps_count
  FROM agent_execution_steps
  WHERE plan_id = p_plan_id;

  -- Count completed steps
  SELECT COUNT(*) INTO completed_steps_count
  FROM agent_execution_steps
  WHERE plan_id = p_plan_id
  AND status = 'completed';

  -- Count failed steps (that exhausted retries)
  SELECT COUNT(*) INTO failed_steps_count
  FROM agent_execution_steps
  WHERE plan_id = p_plan_id
  AND status = 'failed'
  AND retry_count >= max_retries;

  -- If all steps are completed, mark plan as completed
  IF completed_steps_count = total_steps_count THEN
    UPDATE agent_execution_plans
    SET
      status = 'completed',
      success = TRUE,
      completed_at = NOW(),
      execution_time_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
      updated_at = NOW()
    WHERE id = p_plan_id
    AND status = 'executing';
  END IF;

  -- If any step failed, mark plan as failed
  IF failed_steps_count > 0 THEN
    UPDATE agent_execution_plans
    SET
      status = 'failed',
      success = FALSE,
      completed_at = NOW(),
      execution_time_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
      updated_at = NOW()
    WHERE id = p_plan_id
    AND status = 'executing';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Auto-update timestamps
CREATE TRIGGER update_agent_plans_updated_at
  BEFORE UPDATE ON agent_execution_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_steps_updated_at
  BEFORE UPDATE ON agent_execution_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Views for Analytics
-- ============================================================================

-- Agent performance by plan success rate
CREATE VIEW agent_plan_performance AS
SELECT
  agent_id,
  COUNT(*) as total_plans,
  SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END) as successful_plans,
  SUM(CASE WHEN success = FALSE THEN 1 ELSE 0 END) as failed_plans,
  AVG(total_steps) as avg_steps_per_plan,
  AVG(execution_time_ms) as avg_execution_time_ms,
  AVG(total_tokens_used) as avg_tokens_per_plan,
  AVG(total_cost) as avg_cost_per_plan,
  SUM(total_cost) as total_cost
FROM agent_execution_plans
WHERE status IN ('completed', 'failed')
GROUP BY agent_id;

-- Step performance by action type
CREATE VIEW agent_step_performance AS
SELECT
  action_type,
  COUNT(*) as total_steps,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_steps,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_steps,
  AVG(execution_time_ms) as avg_execution_time_ms,
  AVG(retry_count) as avg_retry_count
FROM agent_execution_steps
WHERE status IN ('completed', 'failed')
GROUP BY action_type;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE agent_execution_plans IS 'Multi-step workflow plans created and executed by agents';
COMMENT ON TABLE agent_execution_steps IS 'Individual steps within agent execution plans';
COMMENT ON TABLE agent_reasoning_traces IS 'Agent reasoning/thinking captured at decision points';

COMMENT ON COLUMN agent_execution_plans.status IS 'planning, executing, paused, completed, failed, cancelled';
COMMENT ON COLUMN agent_execution_plans.steps IS 'JSONB array of planned steps with descriptions and dependencies';

COMMENT ON COLUMN agent_execution_steps.action_type IS 'tool_call, reasoning, user_input, data_retrieval, api_call';
COMMENT ON COLUMN agent_execution_steps.depends_on IS 'Array of step numbers this step depends on';
COMMENT ON COLUMN agent_execution_steps.can_run_parallel IS 'Whether this step can run in parallel with others';

COMMENT ON COLUMN agent_reasoning_traces.reasoning_type IS 'planning, decision, reflection, error_analysis, verification';
COMMENT ON COLUMN agent_reasoning_traces.confidence_score IS 'Agent confidence in this reasoning (0.0 - 1.0)';


-- 20260205_mcp_servers_and_tools.sql
/**
 * MCP (Model Context Protocol) Server & Tool Tables
 *
 * Enables agents to discover and execute tools from MCP servers.
 * MCP is an open protocol that standardizes how AI systems connect to external tools,
 * data sources, and services.
 *
 * References:
 * - MCP Specification: https://modelcontextprotocol.io/
 * - Claude Code MCP Servers: https://github.com/anthropics/mcp-servers
 */

-- ============================================================================
-- MCP Servers Table
-- Stores registered MCP server configurations
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Server identification
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon_url TEXT,

  -- Server endpoint configuration
  server_url TEXT NOT NULL,
  transport_type TEXT NOT NULL DEFAULT 'http', -- 'http', 'stdio', 'websocket', 'sse'

  -- Authentication
  auth_type TEXT NOT NULL DEFAULT 'none', -- 'none', 'api_key', 'bearer', 'oauth', 'basic'
  auth_config JSONB, -- Stores credentials and auth settings

  -- Capabilities
  supports_tools BOOLEAN DEFAULT TRUE,
  supports_resources BOOLEAN DEFAULT FALSE,
  supports_prompts BOOLEAN DEFAULT FALSE,
  supports_sampling BOOLEAN DEFAULT FALSE,

  -- Server metadata
  version TEXT,
  homepage_url TEXT,
  documentation_url TEXT,

  -- Ownership & visibility
  is_global BOOLEAN DEFAULT FALSE, -- If true, available to all users
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID, -- Future multi-org support

  -- Status
  is_verified BOOLEAN DEFAULT FALSE, -- Has been tested and confirmed working
  is_enabled BOOLEAN DEFAULT TRUE,
  last_verified_at TIMESTAMPTZ,
  verification_status TEXT, -- 'pending', 'success', 'failed', 'unknown'
  verification_error TEXT,

  -- Usage tracking
  total_tool_calls INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_mcp_servers_slug ON mcp_servers(slug);
CREATE INDEX idx_mcp_servers_created_by ON mcp_servers(created_by);
CREATE INDEX idx_mcp_servers_is_global ON mcp_servers(is_global);
CREATE INDEX idx_mcp_servers_is_enabled ON mcp_servers(is_enabled);
CREATE INDEX idx_mcp_servers_transport ON mcp_servers(transport_type);

-- RLS Policies
ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;

-- Users can view global servers and their own servers
CREATE POLICY "Users can view accessible MCP servers"
  ON mcp_servers
  FOR SELECT
  USING (
    is_global = TRUE
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'moderator')
    )
  );

-- Users can create their own servers
CREATE POLICY "Users can create their own MCP servers"
  ON mcp_servers
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Users can update their own servers, admins can update global servers
CREATE POLICY "Users can update their MCP servers"
  ON mcp_servers
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR (is_global = TRUE AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    ))
  );

-- Users can delete their own servers, admins can delete global servers
CREATE POLICY "Users can delete their MCP servers"
  ON mcp_servers
  FOR DELETE
  USING (
    created_by = auth.uid()
    OR (is_global = TRUE AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    ))
  );

-- ============================================================================
-- MCP Tools Table
-- Discovered tools from MCP servers
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Server reference
  server_id UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,

  -- Tool identification
  name TEXT NOT NULL,
  description TEXT,

  -- Input schema (JSON Schema format)
  input_schema JSONB NOT NULL, -- { type: "object", properties: {...}, required: [...] }

  -- Tool metadata
  is_enabled BOOLEAN DEFAULT TRUE,

  -- Usage tracking
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,
  avg_execution_time_ms INTEGER,
  last_executed_at TIMESTAMPTZ,

  -- Timestamps
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: server + tool name
  UNIQUE(server_id, name)
);

-- Indexes
CREATE INDEX idx_mcp_tools_server_id ON mcp_tools(server_id);
CREATE INDEX idx_mcp_tools_name ON mcp_tools(name);
CREATE INDEX idx_mcp_tools_is_enabled ON mcp_tools(is_enabled);

-- RLS Policies
ALTER TABLE mcp_tools ENABLE ROW LEVEL SECURITY;

-- Users can view tools from servers they have access to
CREATE POLICY "Users can view accessible MCP tools"
  ON mcp_tools
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM mcp_servers
      WHERE mcp_servers.id = server_id
      AND (
        mcp_servers.is_global = TRUE
        OR mcp_servers.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_roles.user_id = auth.uid()
          AND user_roles.role IN ('admin', 'moderator')
        )
      )
    )
  );

-- Only system can insert/update tools (via discovery process)
CREATE POLICY "System can manage MCP tools"
  ON mcp_tools
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- ============================================================================
-- MCP Tool Executions Table
-- Tracks all tool invocations for analytics and debugging
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  tool_id UUID NOT NULL REFERENCES mcp_tools(id) ON DELETE CASCADE,
  server_id UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Execution details
  input_parameters JSONB NOT NULL,
  output_result JSONB,
  status TEXT NOT NULL, -- 'pending', 'running', 'success', 'failed', 'timeout'

  -- Error tracking
  error_message TEXT,
  error_code TEXT,

  -- Performance metrics
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  execution_time_ms INTEGER,

  -- Context
  execution_context JSONB, -- Agent run ID, conversation ID, etc.

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_mcp_executions_tool_id ON mcp_tool_executions(tool_id);
CREATE INDEX idx_mcp_executions_server_id ON mcp_tool_executions(server_id);
CREATE INDEX idx_mcp_executions_agent_id ON mcp_tool_executions(agent_id);
CREATE INDEX idx_mcp_executions_user_id ON mcp_tool_executions(user_id);
CREATE INDEX idx_mcp_executions_status ON mcp_tool_executions(status);
CREATE INDEX idx_mcp_executions_created_at ON mcp_tool_executions(created_at DESC);

-- RLS Policies
ALTER TABLE mcp_tool_executions ENABLE ROW LEVEL SECURITY;

-- Users can view their own tool executions
CREATE POLICY "Users can view their MCP tool executions"
  ON mcp_tool_executions
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all executions
CREATE POLICY "Admins can view all MCP tool executions"
  ON mcp_tool_executions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- System can insert execution records
CREATE POLICY "System can create MCP tool executions"
  ON mcp_tool_executions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Update mcp_tools statistics after execution
CREATE OR REPLACE FUNCTION update_mcp_tool_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'success' THEN
    UPDATE mcp_tools
    SET
      total_executions = total_executions + 1,
      successful_executions = successful_executions + 1,
      avg_execution_time_ms = (
        COALESCE(avg_execution_time_ms * total_executions, 0) + NEW.execution_time_ms
      ) / (total_executions + 1),
      last_executed_at = NEW.completed_at,
      updated_at = NOW()
    WHERE id = NEW.tool_id;
  ELSIF NEW.status = 'failed' THEN
    UPDATE mcp_tools
    SET
      total_executions = total_executions + 1,
      failed_executions = failed_executions + 1,
      updated_at = NOW()
    WHERE id = NEW.tool_id;
  END IF;

  -- Update server stats
  UPDATE mcp_servers
  SET
    total_tool_calls = total_tool_calls + 1,
    last_used_at = NEW.completed_at,
    updated_at = NOW()
  WHERE id = NEW.server_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_mcp_tool_stats_trigger
  AFTER UPDATE OF status ON mcp_tool_executions
  FOR EACH ROW
  WHEN (OLD.status != NEW.status AND NEW.status IN ('success', 'failed'))
  EXECUTE FUNCTION update_mcp_tool_stats();

-- Auto-update updated_at timestamp
CREATE TRIGGER update_mcp_servers_updated_at
  BEFORE UPDATE ON mcp_servers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mcp_tools_updated_at
  BEFORE UPDATE ON mcp_tools
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Seed Data - Pre-built Control Tower MCP Tools
-- ============================================================================

-- Insert global Control Tower MCP Server
INSERT INTO mcp_servers (
  name,
  slug,
  description,
  icon_url,
  server_url,
  transport_type,
  auth_type,
  supports_tools,
  is_global,
  is_verified,
  verification_status
) VALUES (
  'Control Tower Tools',
  'control-tower-tools',
  'Built-in tools for managing tasks, meetings, projects, deals, knowledge, and EOS workflows',
  NULL,
  'internal://control-tower-tools',
  'http',
  'none',
  TRUE,
  TRUE,
  TRUE,
  'success'
) ON CONFLICT (slug) DO NOTHING;

-- Get the server ID for inserting tools
DO $$
DECLARE
  server_uuid UUID;
BEGIN
  SELECT id INTO server_uuid FROM mcp_servers WHERE slug = 'control-tower-tools';

  -- Insert pre-built tools
  INSERT INTO mcp_tools (server_id, name, description, input_schema) VALUES

  -- Task Management Tools
  (server_uuid, 'create_task', 'Create a new task in Control Tower', '{
    "type": "object",
    "properties": {
      "title": {"type": "string", "description": "Task title"},
      "description": {"type": "string", "description": "Task description"},
      "stream_id": {"type": "string", "description": "Task stream UUID (optional)"},
      "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"]},
      "due_date": {"type": "string", "format": "date-time", "description": "Due date (optional)"}
    },
    "required": ["title"]
  }'),

  (server_uuid, 'search_tasks', 'Search tasks with filters', '{
    "type": "object",
    "properties": {
      "query": {"type": "string", "description": "Search query"},
      "status": {"type": "string", "enum": ["open", "in_progress", "completed", "archived"]},
      "assignee_id": {"type": "string", "description": "Assignee UUID"},
      "stream_id": {"type": "string", "description": "Task stream UUID"},
      "limit": {"type": "integer", "default": 10}
    }
  }'),

  (server_uuid, 'update_task', 'Update an existing task', '{
    "type": "object",
    "properties": {
      "task_id": {"type": "string", "description": "Task UUID"},
      "title": {"type": "string"},
      "description": {"type": "string"},
      "status": {"type": "string"},
      "priority": {"type": "string"}
    },
    "required": ["task_id"]
  }'),

  -- Meeting Tools
  (server_uuid, 'schedule_meeting', 'Schedule a new meeting (Zoom/Teams/Google Meet)', '{
    "type": "object",
    "properties": {
      "title": {"type": "string", "description": "Meeting title"},
      "description": {"type": "string"},
      "start_time": {"type": "string", "format": "date-time"},
      "duration_minutes": {"type": "integer", "default": 60},
      "provider": {"type": "string", "enum": ["zoom", "teams", "google_meet"]},
      "participant_emails": {"type": "array", "items": {"type": "string"}}
    },
    "required": ["title", "start_time", "provider"]
  }'),

  (server_uuid, 'get_meeting_transcript', 'Get meeting transcript and AI summary', '{
    "type": "object",
    "properties": {
      "meeting_id": {"type": "string", "description": "Meeting UUID"}
    },
    "required": ["meeting_id"]
  }'),

  -- Project Tools
  (server_uuid, 'create_project', 'Create a new project', '{
    "type": "object",
    "properties": {
      "name": {"type": "string"},
      "description": {"type": "string"},
      "client_id": {"type": "string", "description": "Client UUID"},
      "start_date": {"type": "string", "format": "date"},
      "end_date": {"type": "string", "format": "date"},
      "budget": {"type": "number"}
    },
    "required": ["name"]
  }'),

  (server_uuid, 'get_project_status', 'Get project health and status', '{
    "type": "object",
    "properties": {
      "project_id": {"type": "string", "description": "Project UUID"}
    },
    "required": ["project_id"]
  }'),

  -- Knowledge Tools
  (server_uuid, 'search_knowledge', 'Search knowledge base with semantic search', '{
    "type": "object",
    "properties": {
      "query": {"type": "string", "description": "Search query"},
      "limit": {"type": "integer", "default": 5},
      "category_id": {"type": "string", "description": "Filter by category UUID"}
    },
    "required": ["query"]
  }'),

  (server_uuid, 'create_knowledge_article', 'Create a new knowledge base article', '{
    "type": "object",
    "properties": {
      "title": {"type": "string"},
      "content": {"type": "string"},
      "category_id": {"type": "string", "description": "Category UUID"},
      "tags": {"type": "array", "items": {"type": "string"}}
    },
    "required": ["title", "content"]
  }'),

  -- Business Development Tools
  (server_uuid, 'create_deal', 'Create a new deal in pipeline', '{
    "type": "object",
    "properties": {
      "title": {"type": "string"},
      "value": {"type": "number"},
      "stage": {"type": "string"},
      "expected_close_date": {"type": "string", "format": "date"},
      "contact_id": {"type": "string", "description": "Contact UUID"}
    },
    "required": ["title", "value"]
  }'),

  (server_uuid, 'search_contacts', 'Search contacts in CRM', '{
    "type": "object",
    "properties": {
      "query": {"type": "string"},
      "limit": {"type": "integer", "default": 10}
    }
  }')

  ON CONFLICT (server_id, name) DO NOTHING;
END $$;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE mcp_servers IS 'MCP (Model Context Protocol) servers that provide tools to agents';
COMMENT ON TABLE mcp_tools IS 'Tools discovered from MCP servers';
COMMENT ON TABLE mcp_tool_executions IS 'Execution history for all MCP tool invocations';

COMMENT ON COLUMN mcp_servers.transport_type IS 'Communication protocol: http, stdio, websocket, sse';
COMMENT ON COLUMN mcp_servers.auth_type IS 'Authentication method: none, api_key, bearer, oauth, basic';
COMMENT ON COLUMN mcp_servers.is_global IS 'If true, available to all users; if false, only to creator';
COMMENT ON COLUMN mcp_servers.is_verified IS 'Server has been tested and confirmed working';

COMMENT ON COLUMN mcp_tools.input_schema IS 'JSON Schema defining tool parameters';
COMMENT ON COLUMN mcp_tools.total_executions IS 'Total number of times this tool has been called';
COMMENT ON COLUMN mcp_tools.avg_execution_time_ms IS 'Average execution time in milliseconds';


