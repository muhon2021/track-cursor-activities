-- Create knowledge_sources table (admin-managed global knowledge sources)
-- This table stores information about admin-defined knowledge sources
-- such as internal documentation, company wikis, etc.

CREATE TABLE public.knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('google_drive', 'confluence', 'notion', 'sharepoint', 'github', 'other')),
  source_url TEXT,
  sync_enabled BOOLEAN DEFAULT false,
  sync_frequency TEXT DEFAULT 'daily', -- 'hourly', 'daily', 'weekly', 'manual'
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed')),
  file_count INTEGER DEFAULT 0,
  total_size BIGINT DEFAULT 0,
  credentials JSONB DEFAULT '{}'::jsonb, -- Encrypted connection credentials
  sync_config JSONB DEFAULT '{}'::jsonb, -- Sync settings (folders, filters, etc.)
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_knowledge_sources_slug ON public.knowledge_sources(slug);
CREATE INDEX idx_knowledge_sources_type ON public.knowledge_sources(source_type);
CREATE INDEX idx_knowledge_sources_sync_enabled ON public.knowledge_sources(sync_enabled);
CREATE INDEX idx_knowledge_sources_sync_status ON public.knowledge_sources(sync_status);

-- Enable RLS
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all sources
CREATE POLICY "Authenticated users can view sources"
  ON public.knowledge_sources FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage sources
CREATE POLICY "Admins can manage sources"
  ON public.knowledge_sources FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_knowledge_sources_updated_at
  BEFORE UPDATE ON public.knowledge_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Create user_knowledge_sources table (user-specific sources)
-- This table stores user-specific knowledge sources like personal Google Drive folders
-- ============================================

CREATE TABLE public.user_knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('google_drive', 'dropbox', 'onedrive', 'local_upload', 'other')),
  source_identifier TEXT, -- Google Drive folder ID, Dropbox path, etc.
  source_url TEXT,
  sync_enabled BOOLEAN DEFAULT false,
  sync_frequency TEXT DEFAULT 'manual', -- 'hourly', 'daily', 'weekly', 'manual'
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed')),
  file_count INTEGER DEFAULT 0,
  total_size BIGINT DEFAULT 0,
  credentials JSONB DEFAULT '{}'::jsonb, -- Encrypted OAuth tokens, etc.
  sync_config JSONB DEFAULT '{}'::jsonb, -- File filters, folder depth, etc.
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_user_knowledge_sources_user ON public.user_knowledge_sources(user_id);
CREATE INDEX idx_user_knowledge_sources_type ON public.user_knowledge_sources(source_type);
CREATE INDEX idx_user_knowledge_sources_sync_enabled ON public.user_knowledge_sources(sync_enabled);
CREATE INDEX idx_user_knowledge_sources_sync_status ON public.user_knowledge_sources(sync_status);

-- Enable RLS
ALTER TABLE public.user_knowledge_sources ENABLE ROW LEVEL SECURITY;

-- Users can view their own sources
CREATE POLICY "Users can view own sources"
  ON public.user_knowledge_sources FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own sources
CREATE POLICY "Users can insert own sources"
  ON public.user_knowledge_sources FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own sources
CREATE POLICY "Users can update own sources"
  ON public.user_knowledge_sources FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own sources
CREATE POLICY "Users can delete own sources"
  ON public.user_knowledge_sources FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all user sources
CREATE POLICY "Admins can view all user sources"
  ON public.user_knowledge_sources FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_user_knowledge_sources_updated_at
  BEFORE UPDATE ON public.user_knowledge_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Update user_knowledge_files to add source_id reference
-- ============================================

-- Add foreign key to user_knowledge_files if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_knowledge_files_source_fkey'
  ) THEN
    ALTER TABLE public.user_knowledge_files
    ADD COLUMN knowledge_source_id UUID REFERENCES public.user_knowledge_sources(id) ON DELETE SET NULL;

    CREATE INDEX idx_user_knowledge_files_source_id
    ON public.user_knowledge_files(knowledge_source_id);
  END IF;
END $$;
