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
