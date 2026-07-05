-- ============================================================================
-- Knowledge Base Module Migration
-- ============================================================================
-- Creates tables for knowledge files, embeddings, processing queue,
-- user knowledge, and search analytics.
-- Note: knowledge_entries and knowledge_categories tables already exist.
-- ============================================================================

-- ========================
-- Knowledge Sources
-- ========================
CREATE TABLE IF NOT EXISTS knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('upload', 'google_drive', 'url', 'meeting', 'api')),
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Knowledge Files
-- ========================
CREATE TABLE IF NOT EXISTS knowledge_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID,
  source_id UUID REFERENCES knowledge_sources(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT,
  processing_status TEXT DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  processing_error TEXT,
  chunk_count INTEGER DEFAULT 0,
  embedding_model TEXT,
  metadata JSONB DEFAULT '{}',
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Knowledge Embeddings
-- ========================
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES knowledge_files(id) ON DELETE CASCADE,
  entry_id UUID,
  content TEXT NOT NULL,
  chunk_index INTEGER DEFAULT 0,
  token_count INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- User Knowledge Files
-- ========================
CREATE TABLE IF NOT EXISTS user_knowledge_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT,
  processing_status TEXT DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  chunk_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Embedding Queue
-- ========================
CREATE TABLE IF NOT EXISTS embedding_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('file', 'entry', 'meeting', 'user_file')),
  entity_id UUID NOT NULL,
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Common Knowledge
-- ========================
CREATE TABLE IF NOT EXISTS common_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Vector Search Logs
-- ========================
CREATE TABLE IF NOT EXISTS vector_search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  result_count INTEGER DEFAULT 0,
  top_score NUMERIC(5,4),
  search_type TEXT DEFAULT 'semantic',
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_knowledge_files_category ON knowledge_files(category_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_files_status ON knowledge_files(processing_status);
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_file ON knowledge_embeddings(file_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_entry ON knowledge_embeddings(entry_id);
CREATE INDEX IF NOT EXISTS idx_user_knowledge_files_user ON user_knowledge_files(user_id);
CREATE INDEX IF NOT EXISTS idx_embedding_queue_status ON embedding_queue(status);
CREATE INDEX IF NOT EXISTS idx_embedding_queue_entity ON embedding_queue(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_vector_search_logs_user ON vector_search_logs(user_id);

-- ========================
-- RLS Policies
-- ========================
ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view sources" ON knowledge_sources;
CREATE POLICY "Authenticated users can view sources" ON knowledge_sources
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can manage sources" ON knowledge_sources;
CREATE POLICY "Authenticated users can manage sources" ON knowledge_sources
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE knowledge_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view files" ON knowledge_files;
CREATE POLICY "Authenticated users can view files" ON knowledge_files
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can manage files" ON knowledge_files;
CREATE POLICY "Authenticated users can manage files" ON knowledge_files
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view embeddings" ON knowledge_embeddings;
CREATE POLICY "Authenticated users can view embeddings" ON knowledge_embeddings
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can manage embeddings" ON knowledge_embeddings;
CREATE POLICY "Authenticated users can manage embeddings" ON knowledge_embeddings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE user_knowledge_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own knowledge" ON user_knowledge_files;
CREATE POLICY "Users can view own knowledge" ON user_knowledge_files
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can manage own knowledge" ON user_knowledge_files;
CREATE POLICY "Users can manage own knowledge" ON user_knowledge_files
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE embedding_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view queue" ON embedding_queue;
CREATE POLICY "Authenticated users can view queue" ON embedding_queue
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can manage queue" ON embedding_queue;
CREATE POLICY "Authenticated users can manage queue" ON embedding_queue
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE common_knowledge ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view common knowledge" ON common_knowledge;
CREATE POLICY "Authenticated users can view common knowledge" ON common_knowledge
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can manage common knowledge" ON common_knowledge;
CREATE POLICY "Authenticated users can manage common knowledge" ON common_knowledge
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE vector_search_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view search logs" ON vector_search_logs;
CREATE POLICY "Authenticated users can view search logs" ON vector_search_logs
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can create search logs" ON vector_search_logs;
CREATE POLICY "Users can create search logs" ON vector_search_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
