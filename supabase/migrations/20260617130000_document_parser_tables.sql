-- Migration: Document Parser Tables
-- Creates parsed_documents, document_pages, document_tables, document_images
-- Also fixes pre-existing schema issues in embedding_queue and knowledge_files

-- ============================================================
-- 1. parsed_documents — one row per processed file
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parsed_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Source reference (polymorphic)
  source_type TEXT NOT NULL CHECK (source_type IN ('knowledge_file', 'unified_document', 'user_knowledge_file')),
  source_id UUID NOT NULL,
  -- File info
  file_name TEXT,
  mime_type TEXT,
  -- Parsing status
  parse_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (parse_status IN ('pending', 'processing', 'completed', 'failed')),
  parse_version TEXT NOT NULL DEFAULT 'v1',
  parse_errors JSONB,
  -- Result summary
  page_count INTEGER DEFAULT 0,
  table_count INTEGER DEFAULT 0,
  image_count INTEGER DEFAULT 0,
  word_count INTEGER DEFAULT 0,
  -- Timestamps
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parsed_documents_source ON public.parsed_documents (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_parsed_documents_status ON public.parsed_documents (parse_status);
CREATE INDEX IF NOT EXISTS idx_parsed_documents_version ON public.parsed_documents (parse_version);

ALTER TABLE public.parsed_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage parsed_documents"
  ON public.parsed_documents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can read parsed_documents"
  ON public.parsed_documents FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 2. document_pages — extracted page content
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.parsed_documents(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_pages_document ON public.document_pages (document_id);
CREATE INDEX IF NOT EXISTS idx_document_pages_number ON public.document_pages (document_id, page_number);

ALTER TABLE public.document_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage document_pages"
  ON public.document_pages FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can read document_pages"
  ON public.document_pages FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 3. document_tables — extracted tabular data
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.parsed_documents(id) ON DELETE CASCADE,
  page_number INTEGER,
  table_index INTEGER NOT NULL DEFAULT 0,
  headers TEXT[] DEFAULT '{}',
  rows JSONB DEFAULT '[]'::jsonb,
  markdown_repr TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_tables_document ON public.document_tables (document_id);

ALTER TABLE public.document_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage document_tables"
  ON public.document_tables FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can read document_tables"
  ON public.document_tables FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 4. document_images — extracted image metadata
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.parsed_documents(id) ON DELETE CASCADE,
  page_number INTEGER,
  image_index INTEGER NOT NULL DEFAULT 0,
  caption TEXT,
  ocr_text TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_images_document ON public.document_images (document_id);

ALTER TABLE public.document_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage document_images"
  ON public.document_images FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can read document_images"
  ON public.document_images FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 5. Add parse_version to knowledge_files and unified_documents
-- ============================================================
ALTER TABLE public.knowledge_files
  ADD COLUMN IF NOT EXISTS parse_version TEXT DEFAULT 'v0';

ALTER TABLE public.unified_documents
  ADD COLUMN IF NOT EXISTS parse_version TEXT DEFAULT 'v0';

-- v0 = processed by old Blob.text() path, v1 = processed by kb-document-parser

-- ============================================================
-- 6. Fix embedding_queue CHECK constraint
--    Old: ('file','entry','meeting','user_file')
--    New: also allows 'knowledge_file','knowledge_entry','unified_document','task'
-- ============================================================
ALTER TABLE public.embedding_queue
  DROP CONSTRAINT IF EXISTS embedding_queue_entity_type_check;

ALTER TABLE public.embedding_queue
  ADD CONSTRAINT embedding_queue_entity_type_check
  CHECK (entity_type IN (
    'file', 'entry', 'meeting', 'user_file', 'task',
    'knowledge_file', 'knowledge_entry', 'unified_document'
  ));

-- ============================================================
-- 7. Updated_at trigger for parsed_documents
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_parsed_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER parsed_documents_updated_at
  BEFORE UPDATE ON public.parsed_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_parsed_documents_updated_at();
