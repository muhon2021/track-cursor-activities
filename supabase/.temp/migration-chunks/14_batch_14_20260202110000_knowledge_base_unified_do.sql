-- 20260201_projects_module.sql
-- ============================================================================
-- Projects Module Migration
-- ============================================================================
-- Creates tables for: projects, statuses, members, milestones, comments,
-- files, risks, checklists, billing, and resource projections.
-- ============================================================================

-- ========================
-- Project Statuses (configurable)
-- ========================
CREATE TABLE IF NOT EXISTS project_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Projects
-- ========================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  status_id UUID REFERENCES project_statuses(id) ON DELETE SET NULL,
  client_id UUID,
  source_deal_id UUID,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  budget NUMERIC(12,2),
  currency TEXT DEFAULT 'USD',
  is_archived BOOLEAN DEFAULT false,
  external_id TEXT,
  external_provider TEXT,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Project Members
-- ========================
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'manager', 'member', 'viewer')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, user_id)
);

-- ========================
-- Project Milestones
-- ========================
CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
  completed_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Project Comments
-- ========================
CREATE TABLE IF NOT EXISTS project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES project_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Project Files
-- ========================
CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT,
  source TEXT DEFAULT 'upload' CHECK (source IN ('upload', 'google_drive', 'activecollab')),
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Project Risks
-- ========================
CREATE TABLE IF NOT EXISTS project_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'mitigated', 'resolved', 'accepted')),
  mitigation TEXT,
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Project Favorites
-- ========================
CREATE TABLE IF NOT EXISTS project_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, user_id)
);

-- ========================
-- Project Billing
-- ========================
CREATE TABLE IF NOT EXISTS project_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  billing_type TEXT DEFAULT 'fixed' CHECK (billing_type IN ('fixed', 'hourly', 'monthly', 'per_task')),
  rate NUMERIC(10,2),
  total_budget NUMERIC(12,2),
  invoiced_amount NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  payment_terms TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Project Invoices
-- ========================
CREATE TABLE IF NOT EXISTS project_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status_id);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_project ON project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_project ON project_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_risks_project ON project_risks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_invoices_project ON project_invoices(project_id);

-- ========================
-- RLS Policies
-- ========================
ALTER TABLE project_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view statuses" ON project_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage statuses" ON project_statuses FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view projects" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage projects" ON projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view members" ON project_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage members" ON project_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view milestones" ON project_milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage milestones" ON project_milestones FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view comments" ON project_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage comments" ON project_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view files" ON project_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage files" ON project_files FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_risks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view risks" ON project_risks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage risks" ON project_risks FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own favorites" ON project_favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own favorites" ON project_favorites FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE project_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view billing" ON project_billing FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage billing" ON project_billing FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view invoices" ON project_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage invoices" ON project_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ========================
-- Seed default statuses
-- ========================
INSERT INTO project_statuses (name, slug, color, sort_order, is_default) VALUES
  ('Planning', 'planning', '#6366f1', 1, true),
  ('In Progress', 'in-progress', '#f59e0b', 2, false),
  ('On Hold', 'on-hold', '#ef4444', 3, false),
  ('Completed', 'completed', '#22c55e', 4, false),
  ('Archived', 'archived', '#6b7280', 5, false)
ON CONFLICT (slug) DO NOTHING;


-- 20260202100000_project_client_access.sql
-- ============================================================================
-- Project Client Access - Client portal authentication and related tables
-- ============================================================================
-- Aligned with sj-control-main. Enables token+password client portal access.
-- ============================================================================

-- ========================
-- project_client_access
-- ========================
CREATE TABLE IF NOT EXISTS public.project_client_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  client_email TEXT NOT NULL,
  client_name TEXT,
  password_hash TEXT NOT NULL,
  access_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  project_slug TEXT,
  login_count INTEGER DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(project_id, client_email)
);

-- ========================
-- project_milestones: pm_notes for client-visible notes
-- ========================
ALTER TABLE public.project_milestones
ADD COLUMN IF NOT EXISTS pm_notes TEXT;

-- ========================
-- project_client_comments (PM comments on sprints/milestones)
-- ========================
CREATE TABLE IF NOT EXISTS public.project_client_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  milestone_id UUID REFERENCES public.project_milestones(id) ON DELETE CASCADE,
  sprint_name TEXT,
  comment_text TEXT NOT NULL,
  is_visible BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- client_feedback (client-submitted feedback)
-- ========================
CREATE TABLE IF NOT EXISTS public.client_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  client_access_id UUID REFERENCES public.project_client_access(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT NOT NULL,
  week_number INTEGER,
  year INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- project_risks: is_client_visible
-- ========================
ALTER TABLE public.project_risks
ADD COLUMN IF NOT EXISTS is_client_visible BOOLEAN DEFAULT false;

-- ========================
-- RLS
-- ========================
ALTER TABLE public.project_client_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_client_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view client access"
  ON public.project_client_access FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert client access"
  ON public.project_client_access FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update client access"
  ON public.project_client_access FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage client comments"
  ON public.project_client_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can insert feedback"
  ON public.client_feedback FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view feedback"
  ON public.client_feedback FOR SELECT TO authenticated USING (true);

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_project_client_access_token ON public.project_client_access(access_token);
CREATE INDEX IF NOT EXISTS idx_project_client_access_project ON public.project_client_access(project_id);
CREATE INDEX IF NOT EXISTS idx_project_client_comments_project ON public.project_client_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_client_feedback_project ON public.client_feedback(project_id);
CREATE INDEX IF NOT EXISTS idx_project_risks_client_visible ON public.project_risks(project_id) WHERE is_client_visible = true;

-- ========================
-- Triggers (updated_at)
-- ========================
CREATE TRIGGER update_project_client_access_updated_at
  BEFORE UPDATE ON public.project_client_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_client_comments_updated_at
  BEFORE UPDATE ON public.project_client_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Unique constraint on projects for sync upserts (external_provider + external_id)
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_external_provider_id
  ON public.projects(external_provider, external_id)
  WHERE external_provider IS NOT NULL AND external_id IS NOT NULL;


-- 20260202100100_add_activecollab_provider.sql
-- Add ActiveCollab to Project Management integration providers
DO $$
DECLARE
  cat_pm UUID;
BEGIN
  SELECT id INTO cat_pm FROM public.integration_categories WHERE slug = 'project-management' LIMIT 1;
  IF cat_pm IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.integration_providers WHERE slug = 'activecollab') THEN
    INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, docs_url, is_available, is_coming_soon, display_order)
    VALUES (cat_pm, 'ActiveCollab', 'activecollab', 'Project management and task tracking with time tracking and invoicing', 'api_key', 'https://developers.activecollab.com/', false, true, 5);
  END IF;
END $$;


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


