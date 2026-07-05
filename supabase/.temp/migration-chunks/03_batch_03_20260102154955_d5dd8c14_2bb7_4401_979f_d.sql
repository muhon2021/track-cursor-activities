-- 20260101_knowledge_sources.sql
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


-- 20260101_meeting_categorizations.sql
-- Create meeting_categorizations table
-- This table stores AI-powered categorization of meeting transcripts
-- Used by categorize-meeting edge function

CREATE TABLE public.meeting_categorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_file_id UUID NOT NULL REFERENCES public.zoom_files(id) ON DELETE CASCADE,
  primary_category TEXT,
  secondary_categories TEXT[],
  key_topics TEXT[],
  sentiment TEXT,
  category_confidence NUMERIC,
  analysis_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(meeting_file_id)
);

-- Create indexes for common queries
CREATE INDEX idx_meeting_categorizations_file ON public.meeting_categorizations(meeting_file_id);
CREATE INDEX idx_meeting_categorizations_primary_category ON public.meeting_categorizations(primary_category);
CREATE INDEX idx_meeting_categorizations_created ON public.meeting_categorizations(created_at DESC);

-- Enable RLS
ALTER TABLE public.meeting_categorizations ENABLE ROW LEVEL SECURITY;

-- Users can view categorizations for meetings they organized
CREATE POLICY "Users can view categorizations for their meetings"
  ON public.meeting_categorizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.zoom_files
      JOIN public.meetings ON zoom_files.meeting_id = meetings.id
      WHERE zoom_files.id = meeting_categorizations.meeting_file_id
        AND meetings.organizer_id = auth.uid()
    )
  );

-- Service role can insert/update categorizations (called by edge function)
CREATE POLICY "Service can manage all categorizations"
  ON public.meeting_categorizations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can manage all categorizations
CREATE POLICY "Admins can manage all categorizations"
  ON public.meeting_categorizations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_meeting_categorizations_updated_at
  BEFORE UPDATE ON public.meeting_categorizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- 20260101_meeting_transcripts.sql
-- Create meeting_transcripts table
-- This table stores processed transcripts from Zoom meetings
-- Referenced by existing RLS policies in migration 20251231214950

CREATE TABLE public.meeting_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
  zoom_file_id UUID REFERENCES public.zoom_files(id) ON DELETE CASCADE,
  full_transcript TEXT NOT NULL,
  transcript_segments JSONB,
  language TEXT DEFAULT 'en',
  word_count INTEGER,
  speaker_count INTEGER,
  summary TEXT,
  key_topics TEXT[],
  action_items TEXT[],
  key_decisions TEXT[],
  follow_up_topics TEXT[],
  has_embeddings BOOLEAN DEFAULT false,
  embedding_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_meeting_transcripts_meeting ON public.meeting_transcripts(meeting_id);
CREATE INDEX idx_meeting_transcripts_zoom_file ON public.meeting_transcripts(zoom_file_id);
CREATE INDEX idx_meeting_transcripts_has_embeddings ON public.meeting_transcripts(has_embeddings);
CREATE INDEX idx_meeting_transcripts_created ON public.meeting_transcripts(created_at DESC);

-- Enable RLS (policies already exist in migration 20251231214950)
-- This migration must run before that one or the RLS migration will fail
ALTER TABLE public.meeting_transcripts ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_meeting_transcripts_updated_at
  BEFORE UPDATE ON public.meeting_transcripts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- 20260101_tasks.sql
-- Create tasks table
-- This table stores task management functionality with assignments, priorities, and status tracking
-- Referenced in sidebar navigation but implementation was missing

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  -- Optional links to other entities
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  -- Additional fields
  tags TEXT[] DEFAULT '{}',
  estimated_hours NUMERIC,
  actual_hours NUMERIC,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_priority ON public.tasks(priority);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_tasks_meeting ON public.tasks(meeting_id);
CREATE INDEX idx_tasks_client ON public.tasks(client_id);
CREATE INDEX idx_tasks_tags ON public.tasks USING GIN(tags);
CREATE INDEX idx_tasks_created_at ON public.tasks(created_at DESC);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Users can view tasks assigned to them or created by them
CREATE POLICY "Users can view their tasks"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- Users can create tasks
CREATE POLICY "Users can create tasks"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Users can update tasks they created or are assigned to
CREATE POLICY "Users can update their tasks"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- Users can delete tasks they created
CREATE POLICY "Users can delete tasks they created"
  ON public.tasks FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Admins can manage all tasks
CREATE POLICY "Admins can manage all tasks"
  ON public.tasks FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to auto-set completed_at when status changes to completed
CREATE OR REPLACE FUNCTION public.set_task_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at := NOW();
  ELSIF NEW.status != 'completed' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_task_completed_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_task_completed_at();

-- Create view for task statistics
CREATE OR REPLACE VIEW public.task_stats AS
SELECT
  assigned_to,
  COUNT(*) FILTER (WHERE status = 'todo') as todo_count,
  COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
  COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_count,
  COUNT(*) FILTER (WHERE priority = 'high') as high_count,
  COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('completed', 'cancelled')) as overdue_count,
  COUNT(*) FILTER (WHERE due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days' AND status NOT IN ('completed', 'cancelled')) as due_soon_count
FROM public.tasks
GROUP BY assigned_to;

-- Grant access to the view
GRANT SELECT ON public.task_stats TO authenticated;


-- 20260101_user_agent_personalizations.sql
-- Create user_agent_personalizations table
-- This table stores user-specific customizations for AI agents
-- Including personal knowledge attachment and additional prompts

CREATE TABLE public.user_agent_personalizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  additional_prompt TEXT,
  attached_knowledge_files UUID[],
  use_all_knowledge BOOLEAN DEFAULT false,
  max_context_files INTEGER DEFAULT 5,
  relevance_threshold NUMERIC DEFAULT 0.7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, agent_id)
);

-- Create indexes for common queries
CREATE INDEX idx_user_agent_personalizations_user ON public.user_agent_personalizations(user_id);
CREATE INDEX idx_user_agent_personalizations_agent ON public.user_agent_personalizations(agent_id);
CREATE INDEX idx_user_agent_personalizations_enabled ON public.user_agent_personalizations(is_enabled);

-- Enable RLS
ALTER TABLE public.user_agent_personalizations ENABLE ROW LEVEL SECURITY;

-- Users can manage their own personalizations
CREATE POLICY "Users can view their own personalizations"
  ON public.user_agent_personalizations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own personalizations"
  ON public.user_agent_personalizations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own personalizations"
  ON public.user_agent_personalizations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own personalizations"
  ON public.user_agent_personalizations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can manage all personalizations
CREATE POLICY "Admins can manage all personalizations"
  ON public.user_agent_personalizations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_user_agent_personalizations_updated_at
  BEFORE UPDATE ON public.user_agent_personalizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- 20260101_user_knowledge_files.sql
-- User knowledge files table for tracking uploaded documents
-- This table stores metadata about files uploaded to the knowledge base
-- Supports file tracking, processing status, and Google Drive sync

CREATE TABLE IF NOT EXISTS public.user_knowledge_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source_id text, -- External ID (e.g., Google Drive file ID)
  source_type text DEFAULT 'upload', -- 'upload', 'google_drive', 'zoom', etc.
  file_name text NOT NULL,
  file_path text, -- Storage path or URL
  file_size bigint,
  mime_type text,
  processing_status text DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  processing_error text,
  metadata jsonb DEFAULT '{}'::jsonb, -- Additional file metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX idx_user_knowledge_files_user_id ON public.user_knowledge_files(user_id);
CREATE INDEX idx_user_knowledge_files_status ON public.user_knowledge_files(processing_status);
CREATE INDEX idx_user_knowledge_files_source ON public.user_knowledge_files(source_type, source_id);
CREATE INDEX idx_user_knowledge_files_created_at ON public.user_knowledge_files(created_at DESC);

-- Enable RLS
ALTER TABLE public.user_knowledge_files ENABLE ROW LEVEL SECURITY;

-- Users can view their own files
CREATE POLICY "Users can view own files"
  ON public.user_knowledge_files
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own files
CREATE POLICY "Users can insert own files"
  ON public.user_knowledge_files
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own files
CREATE POLICY "Users can update own files"
  ON public.user_knowledge_files
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own files
CREATE POLICY "Users can delete own files"
  ON public.user_knowledge_files
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all files
CREATE POLICY "Admins can view all files"
  ON public.user_knowledge_files
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_user_knowledge_files_updated_at
  BEFORE UPDATE ON public.user_knowledge_files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get file statistics
CREATE OR REPLACE FUNCTION public.get_user_file_stats(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_stats jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_files', COUNT(*),
    'total_size', COALESCE(SUM(file_size), 0),
    'pending', COUNT(*) FILTER (WHERE processing_status = 'pending'),
    'processing', COUNT(*) FILTER (WHERE processing_status = 'processing'),
    'completed', COUNT(*) FILTER (WHERE processing_status = 'completed'),
    'failed', COUNT(*) FILTER (WHERE processing_status = 'failed'),
    'by_source', jsonb_object_agg(source_type, source_count)
  )
  INTO v_stats
  FROM public.user_knowledge_files
  CROSS JOIN LATERAL (
    SELECT source_type, COUNT(*) as source_count
    FROM public.user_knowledge_files
    WHERE user_id = p_user_id
    GROUP BY source_type
  ) source_stats
  WHERE user_id = p_user_id;

  RETURN COALESCE(v_stats, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 20260102154955_d5dd8c14-2bb7-4401-979f-d627cf2b4d94.sql
-- Seed default app_config values for enterprise deployment
-- This migration creates all default branding, features, email, and system settings

-- Branding settings
INSERT INTO public.app_config (key, value, category, description, is_sensitive)
VALUES 
  ('branding.companyName', '"CollabAi"', 'branding', 'Company name displayed throughout the app', false),
  ('branding.tagline', '"AI-Powered Collaboration Platform"', 'branding', 'Company tagline', false),
  ('branding.supportEmail', '"support@collabai.software"', 'branding', 'Support email address', false),
  ('branding.logoUrl', 'null', 'branding', 'URL to company logo', false)
ON CONFLICT (key) DO NOTHING;

-- Feature flags
INSERT INTO public.app_config (key, value, category, description, is_sensitive)
VALUES 
  ('features.enableAIChat', 'true', 'features', 'Enable AI Chat module', false),
  ('features.enableKnowledgeBase', 'true', 'features', 'Enable Knowledge Base module', false),
  ('features.enableMeetings', 'true', 'features', 'Enable Meetings module', false),
  ('features.enableTasks', 'true', 'features', 'Enable Tasks module', false),
  ('features.enableNotifications', 'true', 'features', 'Enable Notifications', false),
  ('features.enableSemanticSearch', 'true', 'features', 'Enable AI semantic search', false),
  ('features.enableClients', 'true', 'features', 'Enable Clients/CRM module', false),
  ('features.enableAIAgents', 'true', 'features', 'Enable AI Agents management', false),
  ('features.enablePersonalKnowledge', 'true', 'features', 'Enable user file uploads', false),
  ('features.enableFeedback', 'true', 'features', 'Enable feedback collection', false),
  ('features.enableGoogleDrive', 'false', 'features', 'Enable Google Drive integration', false),
  ('features.enableZoomSync', 'false', 'features', 'Enable Zoom meeting sync', false)
ON CONFLICT (key) DO NOTHING;

-- Email settings
INSERT INTO public.app_config (key, value, category, description, is_sensitive)
VALUES 
  ('email.enableEmailNotifications', 'true', 'email', 'Enable email notifications', false),
  ('email.fromName', '"CollabAi"', 'email', 'Sender name for emails', false),
  ('email.fromEmail', '"noreply@collabai.software"', 'email', 'Sender email address', false)
ON CONFLICT (key) DO NOTHING;

-- System settings
INSERT INTO public.app_config (key, value, category, description, is_sensitive)
VALUES 
  ('system.maintenanceMode', 'false', 'system', 'Enable maintenance mode', false),
  ('system.allowSignups', 'true', 'system', 'Allow new user signups', false),
  ('system.requireEmailVerification', 'false', 'system', 'Require email verification', false),
  ('system.sessionTimeout', '7', 'system', 'Session timeout in days', false),
  ('system.onboardingCompleted', 'false', 'system', 'Whether initial setup is complete', false),
  ('system.templateDataSeeded', 'false', 'system', 'Whether template data has been seeded', false)
ON CONFLICT (key) DO NOTHING;

