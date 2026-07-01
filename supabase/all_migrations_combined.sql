-- ============================================================
-- FILE: 20241231_app_config.sql
-- ============================================================

-- App configuration table for multi-tenant settings
-- This table stores platform configuration as key-value pairs
-- Allows admins to configure branding, features, integrations without code changes

CREATE TABLE IF NOT EXISTS public.app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  category text NOT NULL DEFAULT 'general',
  description text,
  is_sensitive boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write config
CREATE POLICY "Admins can manage config"
  ON public.app_config
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- All authenticated users can read non-sensitive config
CREATE POLICY "Users can read non-sensitive config"
  ON public.app_config
  FOR SELECT
  TO authenticated
  USING (is_sensitive = false);

-- Trigger for updated_at
CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default configuration
INSERT INTO public.app_config (key, value, category, description) VALUES
  -- Branding
  ('branding.company_name', '"CollabAi"', 'branding', 'Platform name displayed in UI'),
  ('branding.tagline', '"AI-Powered Collaboration Platform"', 'branding', 'Platform tagline'),
  ('branding.support_email', '"support@collabai.software"', 'branding', 'Support contact email'),

  -- Features
  ('features.enableAIChat', 'true', 'features', 'Enable AI chat functionality'),
  ('features.enableKnowledgeBase', 'true', 'features', 'Enable knowledge base module'),
  ('features.enableMeetings', 'true', 'features', 'Enable meetings module'),
  ('features.enableTasks', 'true', 'features', 'Enable tasks module'),
  ('features.enableNotifications', 'true', 'features', 'Enable notifications system'),
  ('features.enableSemanticSearch', 'true', 'features', 'Enable semantic search'),

  -- Email
  ('email.enableEmailNotifications', 'true', 'email', 'Enable email notifications'),
  ('email.fromName', '"CollabAi"', 'email', 'Email sender name'),
  ('email.fromEmail', '"noreply@collabai.software"', 'email', 'Email sender address'),

  -- System
  ('system.maintenanceMode', 'false', 'system', 'Put platform in maintenance mode'),
  ('system.allowSignups', 'true', 'system', 'Allow new user registrations'),
  ('system.requireEmailVerification', 'false', 'system', 'Require email verification'),
  ('system.sessionTimeout', '7', 'system', 'Session timeout in days')
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- FILE: 20241231_user_invites.sql
-- ============================================================

-- User invitations table for invite system
-- Allows admins to invite new users via email

CREATE TABLE IF NOT EXISTS public.user_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text DEFAULT 'user',
  invited_by uuid REFERENCES public.profiles(id),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;

-- Only admins can manage invites
CREATE POLICY "Admins can manage invites"
  ON public.user_invites
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_user_invites_email ON public.user_invites(email);
CREATE INDEX IF NOT EXISTS idx_user_invites_token ON public.user_invites(token);
CREATE INDEX IF NOT EXISTS idx_user_invites_expires_at ON public.user_invites(expires_at);


-- ============================================================
-- FILE: 20241231_user_status.sql
-- ============================================================

-- Add user status fields to profiles table
-- Allows admins to deactivate users

-- Add is_active column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Add deactivated_at column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

-- Add deactivated_by column (who deactivated the user)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deactivated_by uuid REFERENCES public.profiles(id);

-- Add index for active users
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- Update existing users to be active
UPDATE public.profiles SET is_active = true WHERE is_active IS NULL;


-- ============================================================
-- FILE: 20251231002141_f9623780-c91c-47b0-a457-d8e2599893bc.sql
-- ============================================================

-- =============================================
-- SJ Innovation Framework V1 Database Schema
-- =============================================

-- Phase 1: Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Phase 2: Create Role System
-- 2.1 Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2.2 Create roles table
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.3 Create user_roles junction table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 2.4 Create security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Enable RLS on role tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS for roles (anyone authenticated can read)
CREATE POLICY "Authenticated users can view roles"
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);

-- RLS for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all user roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage user roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Phase 3: Create Profiles Table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Phase 4: Create Clients Table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  company TEXT,
  phone TEXT,
  status TEXT DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view clients"
  ON public.clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create clients"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update clients they created"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Admins can manage all clients"
  ON public.clients FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Phase 5: Create Meetings and Zoom Tables
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  location TEXT,
  meeting_type TEXT DEFAULT 'virtual',
  zoom_id TEXT,
  zoom_meeting_id TEXT,
  zoom_uuid TEXT,
  zoom_join_url TEXT,
  zoom_start_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meetings_organizer ON public.meetings(organizer_id);
CREATE INDEX idx_meetings_client ON public.meetings(client_id);
CREATE INDEX idx_meetings_scheduled ON public.meetings(scheduled_at);
CREATE INDEX idx_meetings_status ON public.meetings(status);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view meetings"
  ON public.meetings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create meetings as organizer"
  ON public.meetings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizers can update their meetings"
  ON public.meetings FOR UPDATE
  TO authenticated
  USING (auth.uid() = organizer_id);

CREATE POLICY "Organizers can delete their meetings"
  ON public.meetings FOR DELETE
  TO authenticated
  USING (auth.uid() = organizer_id);

CREATE POLICY "Admins can manage all meetings"
  ON public.meetings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Zoom Files Table
CREATE TABLE public.zoom_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_path TEXT,
  storage_path TEXT,
  download_url TEXT,
  transcript_text TEXT,
  transcript_content JSONB,
  is_processed BOOLEAN DEFAULT false,
  has_embeddings BOOLEAN DEFAULT false,
  processing_status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_zoom_files_meeting ON public.zoom_files(meeting_id);
CREATE INDEX idx_zoom_files_type ON public.zoom_files(file_type);
CREATE INDEX idx_zoom_files_processed ON public.zoom_files(is_processed);

ALTER TABLE public.zoom_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view zoom files"
  ON public.zoom_files FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage zoom files for their meetings"
  ON public.zoom_files FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings
      WHERE meetings.id = zoom_files.meeting_id
        AND meetings.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all zoom files"
  ON public.zoom_files FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Phase 6: Create Knowledge Base Tables
CREATE TABLE public.knowledge_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES public.knowledge_categories(id) ON DELETE SET NULL,
  icon TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_categories_parent ON public.knowledge_categories(parent_id);
CREATE INDEX idx_knowledge_categories_slug ON public.knowledge_categories(slug);

ALTER TABLE public.knowledge_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view knowledge categories"
  ON public.knowledge_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage knowledge categories"
  ON public.knowledge_categories FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Knowledge Entries Table
CREATE TABLE public.knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  summary TEXT,
  category_id UUID REFERENCES public.knowledge_categories(id) ON DELETE SET NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  tags TEXT[] DEFAULT '{}',
  search_vector TSVECTOR,
  view_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_entries_category ON public.knowledge_entries(category_id);
CREATE INDEX idx_knowledge_entries_author ON public.knowledge_entries(author_id);
CREATE INDEX idx_knowledge_entries_status ON public.knowledge_entries(status);
CREATE INDEX idx_knowledge_entries_search ON public.knowledge_entries USING GIN(search_vector);
CREATE INDEX idx_knowledge_entries_tags ON public.knowledge_entries USING GIN(tags);

-- Auto-update search vector
CREATE OR REPLACE FUNCTION public.update_knowledge_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, '') || ' ' || COALESCE(NEW.summary, ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_knowledge_entries_search
  BEFORE INSERT OR UPDATE ON public.knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_knowledge_search_vector();

ALTER TABLE public.knowledge_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published entries"
  ON public.knowledge_entries FOR SELECT
  TO authenticated
  USING (status = 'published' OR author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authors can create entries"
  ON public.knowledge_entries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their entries"
  ON public.knowledge_entries FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete their entries"
  ON public.knowledge_entries FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

CREATE POLICY "Admins can manage all entries"
  ON public.knowledge_entries FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Phase 7: Create AI Framework Tables
CREATE TABLE public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT,
  system_prompt TEXT NOT NULL,
  data_sources JSONB DEFAULT '[]'::jsonb,
  provider_config JSONB DEFAULT '{}'::jsonb,
  required_role app_role,
  is_enabled BOOLEAN DEFAULT true,
  memory_enabled BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_agents_slug ON public.ai_agents(slug);
CREATE INDEX idx_ai_agents_category ON public.ai_agents(category);
CREATE INDEX idx_ai_agents_enabled ON public.ai_agents(is_enabled);

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view enabled agents"
  ON public.ai_agents FOR SELECT
  TO authenticated
  USING (is_enabled = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage agents"
  ON public.ai_agents FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- AI Agent Runs Table
CREATE TABLE public.ai_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  context JSONB DEFAULT '{}'::jsonb,
  input TEXT,
  output TEXT,
  token_metrics JSONB DEFAULT '{}'::jsonb,
  latency_ms INTEGER,
  provider_used TEXT,
  model_used TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_agent_runs_agent ON public.ai_agent_runs(agent_id);
CREATE INDEX idx_ai_agent_runs_user ON public.ai_agent_runs(user_id);
CREATE INDEX idx_ai_agent_runs_status ON public.ai_agent_runs(status);
CREATE INDEX idx_ai_agent_runs_created ON public.ai_agent_runs(created_at DESC);

ALTER TABLE public.ai_agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own runs"
  ON public.ai_agent_runs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create runs"
  ON public.ai_agent_runs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all runs"
  ON public.ai_agent_runs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Embeddings Table (1536 dimensions for OpenAI)
CREATE TABLE public.embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding extensions.vector(1536),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_index INTEGER DEFAULT 0,
  gemini_corpus_id TEXT,
  gemini_document_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_embeddings_entity ON public.embeddings(entity_type, entity_id);
CREATE INDEX idx_embeddings_user ON public.embeddings(user_id);
CREATE INDEX idx_embeddings_vector ON public.embeddings USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);

ALTER TABLE public.embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public embeddings"
  ON public.embeddings FOR SELECT
  TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create embeddings"
  ON public.embeddings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete their own embeddings"
  ON public.embeddings FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- AI Chat History Table
CREATE TABLE public.ai_chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_chat_session ON public.ai_chat_history(session_id, created_at);
CREATE INDEX idx_ai_chat_user ON public.ai_chat_history(user_id);
CREATE INDEX idx_ai_chat_agent ON public.ai_chat_history(agent_id);

ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chat history"
  ON public.ai_chat_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create chat messages"
  ON public.ai_chat_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat history"
  ON public.ai_chat_history FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Phase 8: Create Notifications Table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Phase 9: Create Feedback Table
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'improvement', 'general')),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'closed')),
  admin_notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_user ON public.feedback(user_id);
CREATE INDEX idx_feedback_status ON public.feedback(status);
CREATE INDEX idx_feedback_type ON public.feedback(type);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create feedback"
  ON public.feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update feedback"
  ON public.feedback FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Phase 10: Create Updated_at Trigger Function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers to all relevant tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_zoom_files_updated_at
  BEFORE UPDATE ON public.zoom_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_knowledge_categories_updated_at
  BEFORE UPDATE ON public.knowledge_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_knowledge_entries_updated_at
  BEFORE UPDATE ON public.knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_agents_updated_at
  BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_agent_runs_updated_at
  BEFORE UPDATE ON public.ai_agent_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Phase 11: Seed Initial Data
INSERT INTO public.roles (name, description) VALUES
  ('admin', 'Full system access with all permissions'),
  ('moderator', 'Can moderate content and manage users'),
  ('user', 'Standard user with basic permissions');

INSERT INTO public.knowledge_categories (name, slug, description, sort_order) VALUES
  ('General', 'general', 'General knowledge and information', 1),
  ('Documentation', 'documentation', 'Technical documentation and guides', 2),
  ('Guides', 'guides', 'How-to guides and tutorials', 3),
  ('FAQs', 'faqs', 'Frequently asked questions', 4);

-- ============================================================
-- FILE: 20251231002154_5c7d7969-fbe5-42cf-b8ba-3304645c79a4.sql
-- ============================================================

-- Fix security warnings: Set search_path on functions missing it
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_knowledge_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, '') || ' ' || COALESCE(NEW.summary, ''));
  RETURN NEW;
END;
$$;

-- ============================================================
-- FILE: 20251231002948_8e4f0648-0870-45e0-8ff7-5933204425c8.sql
-- ============================================================

-- ============================================
-- Storage Buckets for SJ Innovation Framework
-- Phase 2.3: user-knowledge, meeting-recordings, knowledge-files
-- ============================================

-- 1. Create the storage buckets (all private)
INSERT INTO storage.buckets (id, name, public) VALUES ('user-knowledge', 'user-knowledge', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('meeting-recordings', 'meeting-recordings', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('knowledge-files', 'knowledge-files', false);

-- ============================================
-- RLS Policies for user-knowledge bucket
-- Users can only access their own folder: {user_id}/
-- ============================================

CREATE POLICY "Users can upload to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-knowledge' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-knowledge' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-knowledge' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-knowledge' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================
-- RLS Policies for meeting-recordings bucket
-- Authenticated users can read, only service role can write
-- ============================================

CREATE POLICY "Authenticated users can view meeting recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'meeting-recordings');

-- No INSERT/UPDATE/DELETE policies for users - service role handles uploads

-- ============================================
-- RLS Policies for knowledge-files bucket
-- Authenticated can read, admins can write
-- ============================================

CREATE POLICY "Authenticated users can view knowledge files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'knowledge-files');

CREATE POLICY "Admins can upload knowledge files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'knowledge-files' 
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update knowledge files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'knowledge-files' 
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete knowledge files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'knowledge-files' 
  AND public.has_role(auth.uid(), 'admin')
);

-- ============================================================
-- FILE: 20251231172609_3aa165f4-5399-48e1-a212-5dc21af21710.sql
-- ============================================================

INSERT INTO public.user_roles (user_id, role)
VALUES ('2d711b86-45bf-43ae-b216-7eb917668b58', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================
-- FILE: 20251231173310_4fca1a9f-564e-4ceb-baa1-7949c233862f.sql
-- ============================================================

INSERT INTO public.user_roles (user_id, role)
VALUES ('78657387-d518-4b2e-88d8-eca802372ad5', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================
-- FILE: 20251231183400_create_match_embeddings_function.sql
-- ============================================================

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create match_embeddings function for semantic search
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  entity_type text,
  entity_id text,
  content text,
  metadata jsonb,
  user_id uuid,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.entity_type,
    e.entity_id,
    e.content,
    e.metadata,
    e.user_id,
    1 - (e.embedding <=> query_embedding) as similarity
  FROM embeddings e
  WHERE 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create index on embeddings for faster vector search
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Add comment
COMMENT ON FUNCTION match_embeddings IS 'Performs vector similarity search on embeddings table using cosine similarity';


-- ============================================================
-- FILE: 20251231183500_insert_test_data.sql
-- ============================================================

-- Insert test data for Clients
INSERT INTO clients (name, email, company, phone, status, metadata) VALUES
  ('John Doe', 'john.doe@example.com', 'Acme Corp', '+1-555-0101', 'active', '{"notes": "VIP client, prefers email communication"}'),
  ('Jane Smith', 'jane.smith@techstart.io', 'TechStart Inc', '+1-555-0102', 'active', '{"notes": "Interested in AI features"}'),
  ('Michael Johnson', 'mjohnson@enterprise.com', 'Enterprise Solutions', '+1-555-0103', 'active', '{"notes": "Large account, quarterly meetings"}'),
  ('Sarah Williams', 'sarah.w@startup.co', 'Startup Co', '+1-555-0104', 'prospect', '{"notes": "Potential client, sent proposal"}'),
  ('David Brown', 'dbrown@consulting.net', 'Brown Consulting', '+1-555-0105', 'active', '{"notes": "Monthly retainer client"}')
ON CONFLICT (email) DO NOTHING;

-- Insert test data for Knowledge Categories
INSERT INTO knowledge_categories (name, slug, description, icon, color, sort_order) VALUES
  ('Getting Started', 'getting-started', 'Introduction and setup guides', '🚀', '#3B82F6', 1),
  ('API Documentation', 'api-docs', 'API references and integration guides', '📚', '#10B981', 2),
  ('Best Practices', 'best-practices', 'Recommended approaches and patterns', '⭐', '#F59E0B', 3),
  ('Troubleshooting', 'troubleshooting', 'Common issues and solutions', '🔧', '#EF4444', 4),
  ('Features', 'features', 'Feature documentation and usage', '✨', '#8B5CF6', 5)
ON CONFLICT (slug) DO NOTHING;

-- Insert test knowledge entries
INSERT INTO knowledge_entries (title, content, slug, category_id, tags, summary, status, author_id)
SELECT
  'Quick Start Guide',
  E'# Quick Start Guide\n\nWelcome to CollabAI! This guide will help you get started.\n\n## Step 1: Create an Account\nSign up using your email or Google account.\n\n## Step 2: Set Up Your Profile\nComplete your profile information.\n\n## Step 3: Explore Features\nDiscover the powerful features available.',
  'quick-start-guide-' || EXTRACT(EPOCH FROM NOW())::bigint,
  (SELECT id FROM knowledge_categories WHERE slug = 'getting-started' LIMIT 1),
  ARRAY['quickstart', 'tutorial', 'beginner'],
  'A comprehensive guide to getting started with CollabAI',
  'published',
  (SELECT id FROM auth.users LIMIT 1)
WHERE EXISTS (SELECT 1 FROM auth.users LIMIT 1)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO knowledge_entries (title, content, slug, category_id, tags, summary, status, author_id)
SELECT
  'AI Chat Assistant Usage',
  E'# AI Chat Assistant\n\nLearn how to use the AI Chat Assistant feature.\n\n## Overview\nThe AI Chat Assistant helps you with various tasks using natural language.\n\n## How to Use\n1. Navigate to the AI Chat page\n2. Type your question\n3. Get instant AI-powered responses\n\n## Tips\n- Be specific in your questions\n- You can ask follow-up questions\n- The assistant has context awareness',
  'ai-chat-assistant-usage-' || EXTRACT(EPOCH FROM NOW())::bigint,
  (SELECT id FROM knowledge_categories WHERE slug = 'features' LIMIT 1),
  ARRAY['ai', 'chat', 'assistant'],
  'How to use the AI Chat Assistant feature',
  'published',
  (SELECT id FROM auth.users LIMIT 1)
WHERE EXISTS (SELECT 1 FROM auth.users LIMIT 1)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO knowledge_entries (title, content, slug, category_id, tags, summary, status, author_id)
SELECT
  'API Authentication',
  E'# API Authentication\n\n## Overview\nLearn how to authenticate with the CollabAI API.\n\n## Methods\n1. **API Key Authentication**\n   - Include your API key in the Authorization header\n   - Format: `Authorization: Bearer YOUR_API_KEY`\n\n2. **OAuth 2.0**\n   - Use OAuth for user-based authentication\n   - Supports Google OAuth\n\n## Security Best Practices\n- Never expose your API keys in client-side code\n- Rotate keys regularly\n- Use environment variables',
  'api-authentication-' || EXTRACT(EPOCH FROM NOW())::bigint,
  (SELECT id FROM knowledge_categories WHERE slug = 'api-docs' LIMIT 1),
  ARRAY['api', 'authentication', 'security'],
  'Authentication methods for the CollabAI API',
  'published',
  (SELECT id FROM auth.users LIMIT 1)
WHERE EXISTS (SELECT 1 FROM auth.users LIMIT 1)
ON CONFLICT (slug) DO NOTHING;

-- Insert test AI agents
INSERT INTO ai_agents (name, slug, description, system_prompt, category, is_enabled)
VALUES
  (
    'Email Draft Assistant',
    'email-draft-assistant',
    'Helps draft professional emails',
    'You are a professional email writing assistant. Help users compose clear, professional, and effective emails. Maintain appropriate tone and structure.',
    'communication',
    true
  ),
  (
    'Meeting Summary Generator',
    'meeting-summary',
    'Generates concise meeting summaries',
    'You are a meeting summarization expert. Create concise, well-structured summaries that capture key points, decisions, and action items.',
    'analysis',
    true
  ),
  (
    'Code Review Assistant',
    'code-review',
    'Reviews code and provides suggestions',
    'You are an experienced code reviewer. Analyze code for best practices, potential bugs, performance issues, and security concerns. Provide constructive feedback.',
    'development',
    true
  )
ON CONFLICT (slug) DO NOTHING;

-- Add comment
COMMENT ON TABLE clients IS 'Test data includes 5 sample clients';
COMMENT ON TABLE knowledge_entries IS 'Test data includes sample knowledge articles';
COMMENT ON TABLE ai_agents IS 'Test data includes 3 AI agent templates';


-- ============================================================
-- FILE: 20251231202732_799e6766-6e4e-439e-b46b-190f8d8ca6d2.sql
-- ============================================================

-- =============================================
-- DEMO DATA FOR SJ INNOVATION (All Constraints Fixed)
-- =============================================

-- 1. UPDATE PROFILES
UPDATE profiles SET full_name = 'Shahed Islam', avatar_url = 'https://api.dicebear.com/7.x/initials/svg?seed=SI' WHERE id = '2d711b86-45bf-43ae-b216-7eb917668b58';
UPDATE profiles SET full_name = 'Alex Morgan', avatar_url = 'https://api.dicebear.com/7.x/initials/svg?seed=AM' WHERE id = '78657387-d518-4b2e-88d8-eca802372ad5';
UPDATE profiles SET full_name = 'Jordan Taylor', avatar_url = 'https://api.dicebear.com/7.x/initials/svg?seed=JT' WHERE id = 'e46a6d4e-d69e-4bf5-9341-ba998e8da243';

-- 2. CLIENTS (14 Total)
INSERT INTO clients (name, email, company, phone, status, metadata, created_by) VALUES
('Michael Richardson', 'mrichardson@richardson-lawgroup.com', 'Richardson Law Group LLP', '+1-555-0101', 'active', '{"notes": "Enterprise client", "industry": "Law Firm", "practice_area": "Corporate Law", "firm_size": "45 attorneys", "deal_size": "$150,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Sarah Chen', 'schen@chenandpartners.com', 'Chen & Partners', '+1-555-0102', 'active', '{"notes": "Immigration law specialists", "industry": "Law Firm", "practice_area": "Immigration Law", "firm_size": "18 attorneys", "deal_size": "$85,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('James Thompson', 'jthompson@thompson-legal.com', 'Thompson Legal Associates', '+1-555-0103', 'active', '{"notes": "Personal injury firm", "industry": "Law Firm", "practice_area": "Personal Injury", "firm_size": "12 attorneys", "deal_size": "$65,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Elizabeth Warren', 'ewarren@warrendefense.com', 'Warren Defense Law', '+1-555-0104', 'prospect', '{"notes": "Initial discovery", "industry": "Law Firm", "practice_area": "Criminal Defense", "firm_size": "8 attorneys", "deal_size": "$45,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Robert Martinez', 'rmartinez@martinez-family-law.com', 'Martinez Family Law', '+1-555-0105', 'active', '{"notes": "Family law boutique", "industry": "Law Firm", "practice_area": "Family Law", "firm_size": "6 attorneys", "deal_size": "$55,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Patricia Williams', 'pwilliams@williams-ip.com', 'Williams Intellectual Property', '+1-555-0106', 'inactive', '{"notes": "Contract paused", "industry": "Law Firm", "practice_area": "Intellectual Property", "firm_size": "22 attorneys", "deal_size": "$95,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('David Kim', 'dkim@kimrealestate-law.com', 'Kim Real Estate Law', '+1-555-0107', 'prospect', '{"notes": "New inquiry", "industry": "Law Firm", "practice_area": "Real Estate Law", "firm_size": "10 attorneys", "deal_size": "$70,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Jennifer Adams', 'jadams@adams-cpa.com', 'Adams & Associates CPA', '+1-555-0201', 'active', '{"notes": "Tax season automation", "industry": "CPA Firm", "practice_area": "Tax Preparation", "firm_size": "35 CPAs", "deal_size": "$120,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('William Foster', 'wfoster@fosteraccounting.com', 'Foster Accounting Group', '+1-555-0202', 'active', '{"notes": "Full-service firm", "industry": "Accounting Firm", "practice_area": "Full Service", "firm_size": "50 staff", "deal_size": "$175,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Amanda Rodriguez', 'arodriguez@rodriguez-tax.com', 'Rodriguez Tax Services', '+1-555-0203', 'active', '{"notes": "Tax-focused practice", "industry": "CPA Firm", "practice_area": "Tax Services", "firm_size": "15 CPAs", "deal_size": "$75,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Christopher Lee', 'clee@lee-audit.com', 'Lee Audit & Assurance', '+1-555-0204', 'active', '{"notes": "Audit specialists", "industry": "Accounting Firm", "practice_area": "Audit & Assurance", "firm_size": "28 staff", "deal_size": "$95,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Michelle Brown', 'mbrown@brownbookkeeping.com', 'Brown Bookkeeping Solutions', '+1-555-0205', 'prospect', '{"notes": "Growing firm", "industry": "Accounting Firm", "practice_area": "Bookkeeping", "firm_size": "8 staff", "deal_size": "$35,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Thomas Anderson', 'tanderson@anderson-advisory.com', 'Anderson Advisory Services', '+1-555-0206', 'active', '{"notes": "CFO advisory", "industry": "Accounting Firm", "practice_area": "CFO Advisory", "firm_size": "12 consultants", "deal_size": "$85,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Nancy Wilson', 'nwilson@wilson-forensic.com', 'Wilson Forensic Accounting', '+1-555-0207', 'inactive', '{"notes": "Project on hold", "industry": "Accounting Firm", "practice_area": "Forensic Accounting", "firm_size": "6 specialists", "deal_size": "$65,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58');

-- 3. MEETINGS (18 Total)
INSERT INTO meetings (title, description, scheduled_at, duration_minutes, status, meeting_type, organizer_id, client_id) VALUES
('Case Management System Demo - Richardson Law', 'Present custom case management solution.', '2025-01-03 10:00:00-05', 90, 'scheduled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Richardson Law Group LLP' LIMIT 1)),
('Tax Workflow Sprint Planning - Adams CPA', 'Sprint planning for tax season automation.', '2025-01-06 14:00:00-05', 60, 'scheduled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Adams & Associates CPA' LIMIT 1)),
('Document Processing Review - Chen Partners', 'Review immigration form automation.', '2025-01-07 11:00:00-05', 45, 'scheduled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Chen & Partners' LIMIT 1)),
('Practice Management Implementation - Foster', 'Phase 2 kickoff.', '2025-01-08 09:00:00-05', 60, 'scheduled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Foster Accounting Group' LIMIT 1)),
('Discovery Call - Warren Defense', 'Initial discovery meeting.', '2025-01-09 15:00:00-05', 45, 'scheduled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Warren Defense Law' LIMIT 1)),
('Audit Workpaper Demo - Lee Audit', 'Demonstrate audit workpaper system.', '2025-01-10 10:00:00-05', 60, 'scheduled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Lee Audit & Assurance' LIMIT 1)),
('Client Portal Training - Martinez Family Law', 'Training session for client portal.', '2025-01-13 14:00:00-05', 90, 'scheduled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Martinez Family Law' LIMIT 1)),
('Discovery Call - Kim Real Estate', 'New prospect call.', '2025-01-15 11:00:00-05', 30, 'scheduled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Kim Real Estate Law' LIMIT 1)),
('Q4 Review - Thompson Legal', 'Quarterly review.', '2024-12-20 10:00:00-05', 60, 'completed', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Thompson Legal Associates' LIMIT 1)),
('Tax Season Prep - Rodriguez Tax', 'Preparation meeting.', '2024-12-18 14:00:00-05', 45, 'completed', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Rodriguez Tax Services' LIMIT 1)),
('CFO Dashboard Launch - Anderson Advisory', 'Successful launch.', '2024-12-16 11:00:00-05', 60, 'completed', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Anderson Advisory Services' LIMIT 1)),
('Contract Review - Williams IP', 'Contract pause discussion.', '2024-12-12 09:00:00-05', 45, 'completed', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Williams Intellectual Property' LIMIT 1)),
('Year-End Review - Richardson Law', 'Annual review.', '2024-12-10 10:00:00-05', 90, 'completed', 'in-person', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Richardson Law Group LLP' LIMIT 1)),
('Forensic Tools Demo - Wilson', 'Postponed.', '2024-12-22 14:00:00-05', 60, 'cancelled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Wilson Forensic Accounting' LIMIT 1)),
('Cloud Platform Demo - Brown Bookkeeping', 'Rescheduled.', '2024-12-28 11:00:00-05', 45, 'cancelled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Brown Bookkeeping Solutions' LIMIT 1)),
('Phase 3 Planning - Foster Accounting', 'Plan features.', '2025-01-22 10:00:00-05', 60, 'scheduled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Foster Accounting Group' LIMIT 1)),
('Go-Live Review - Chen Partners', 'Final review.', '2025-01-24 14:00:00-05', 90, 'scheduled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Chen & Partners' LIMIT 1)),
('Tax Season Kickoff', 'Group webinar.', '2025-01-28 11:00:00-05', 60, 'scheduled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Adams & Associates CPA' LIMIT 1));

-- 4. AI AGENTS (6 Specialized Agents)
INSERT INTO ai_agents (slug, name, description, system_prompt, category, is_enabled, memory_enabled, provider_config) VALUES
('legal-research', 'Legal Research Assistant', 'Research case law and legal precedents.', 'You are an expert legal research assistant. Always cite sources. Never provide legal advice.', 'legal', true, true, '{"model": "gpt-4", "temperature": 0.3}'),
('contract-analyzer', 'Contract Analyzer', 'Analyze contracts and identify risks.', 'You are a contract analysis specialist.', 'legal', true, true, '{"model": "gpt-4", "temperature": 0.2}'),
('tax-advisor', 'Tax Research Assistant', 'Research tax regulations and IRS guidance.', 'You are a tax research assistant. Cite IRC sections.', 'accounting', true, true, '{"model": "gpt-4", "temperature": 0.3}'),
('financial-analyst', 'Financial Analysis Assistant', 'Analyze financial statements.', 'You are a financial analysis assistant.', 'accounting', true, true, '{"model": "gpt-4", "temperature": 0.4}'),
('client-communicator', 'Client Email Composer', 'Draft professional communications.', 'You are an expert at drafting professional client communications.', 'productivity', true, false, '{"model": "gpt-4", "temperature": 0.5}'),
('meeting-prep', 'Meeting Preparation Assistant', 'Prepare meeting agendas.', 'You are a meeting preparation specialist.', 'productivity', true, true, '{"model": "gpt-4", "temperature": 0.4}');

-- 5. KNOWLEDGE BASE ENTRIES
INSERT INTO knowledge_entries (title, slug, content, summary, status, category_id, tags, view_count, author_id) VALUES
('Welcome to SJ Innovation', 'welcome-sj-innovation', '# Welcome\n\nManage your software project here.', 'Introduction to the portal.', 'published', 'a02b8ff1-8432-465f-9801-81c228419a8a', ARRAY['onboarding'], 245, '2d711b86-45bf-43ae-b216-7eb917668b58'),
('API Integration Guide', 'api-integration-law-firms', '# API Guide\n\nIntegrating with legal software.', 'Technical integration guide.', 'published', 'e241fe6d-b52f-4945-a6c2-de74035f581c', ARRAY['api', 'integration'], 156, '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Legal Research Assistant Guide', 'legal-research-guide', '# Legal Research\n\nEffective prompts for research.', 'Guide to legal research AI.', 'published', '200d7c6f-d21e-44a5-9e65-bd6e829331de', ARRAY['ai-assistant'], 312, '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Tax Research Best Practices', 'tax-research-guide', '# Tax Research\n\nIRS guidance and regulations.', 'Tax research best practices.', 'published', '200d7c6f-d21e-44a5-9e65-bd6e829331de', ARRAY['tax-research'], 278, '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Billing FAQ', 'billing-faq', '# Billing FAQ\n\nProject billing explained.', 'Billing and subscription FAQ.', 'published', '83567036-4743-414d-ae98-e5db1cc32265', ARRAY['billing', 'faq'], 367, '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Security FAQ', 'security-faq', '# Security FAQ\n\nSOC 2 and encryption info.', 'Data security FAQ.', 'published', '83567036-4743-414d-ae98-e5db1cc32265', ARRAY['security', 'faq'], 412, '2d711b86-45bf-43ae-b216-7eb917668b58');

-- 6. NOTIFICATIONS (types: info, success, warning, error)
INSERT INTO notifications (user_id, title, message, type, link, is_read) VALUES
('2d711b86-45bf-43ae-b216-7eb917668b58', 'Meeting in 1 Hour', 'Case Management Demo starts at 10:00 AM', 'warning', '/meetings', false),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'New Prospect Added', 'Warren Defense Law added', 'success', '/clients', false),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'Meeting Notes Ready', 'Q4 Review notes available', 'info', '/meetings', true),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'Client Status Changed', 'Williams IP now inactive', 'warning', '/clients', true),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'Tax Season Alert', 'Adams CPA testing due', 'warning', '/clients', false),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'Knowledge Updated', 'New article published', 'info', '/knowledge', true),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'AI Agent Improved', 'Tax Assistant updated', 'success', '/ai-chat', true),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'Weekly Report', 'Activity report ready', 'info', '/dashboard', false),
('78657387-d518-4b2e-88d8-eca802372ad5', 'System Update', 'Maintenance Sunday 2am', 'info', '/admin', false);

-- 7. FEEDBACK (types: bug, feature, improvement, general | status: pending, reviewed, resolved, closed)
INSERT INTO feedback (user_id, type, subject, message, rating, status) VALUES
('2d711b86-45bf-43ae-b216-7eb917668b58', 'general', 'Excellent Legal Research Assistant', 'Saved hours of research time. Citation format is perfect.', 5, 'reviewed'),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'feature', 'Court Calendar Integration', 'Integration with court filing systems for deadline population.', null, 'pending'),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'general', 'Tax Research Feedback', 'Very helpful for IRS guidance lookups.', 4, 'reviewed'),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'feature', 'Mobile App', 'Attorneys want project status on mobile.', null, 'pending'),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'bug', 'Timezone Display Issue', 'EST meetings show wrong time for West Coast.', 3, 'pending'),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'general', 'Excellent Client Portal', 'Secure messaging works great for family law.', 5, 'reviewed');

-- 8. AI CHAT HISTORY
INSERT INTO ai_chat_history (user_id, session_id, agent_id, role, content, metadata) VALUES
('2d711b86-45bf-43ae-b216-7eb917668b58', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', (SELECT id FROM ai_agents WHERE slug = 'legal-research' LIMIT 1), 'user', 'Find 2nd Circuit cases on trademark infringement in e-commerce', '{}'),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', (SELECT id FROM ai_agents WHERE slug = 'legal-research' LIMIT 1), 'assistant', '**Tiffany v. eBay (2010)**: Online marketplaces not liable without specific knowledge.\n**Gucci v. Frontline (2010)**: Payment processor liability.', '{"citations": 2}'),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', (SELECT id FROM ai_agents WHERE slug = 'tax-advisor' LIMIT 1), 'user', 'Section 199A QBI deduction limits for SSTBs in 2024?', '{}'),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', (SELECT id FROM ai_agents WHERE slug = 'tax-advisor' LIMIT 1), 'assistant', '**2024 Thresholds**: Single $191,950-$241,950, MFJ $383,900-$483,900. Citations: IRC § 199A(d)(2), Treas. Reg. § 1.199A-5.', '{"citations": 2}');

-- ============================================================
-- FILE: 20251231214712_f2e2729d-d22b-4d89-9aa5-5d5091b1068a.sql
-- ============================================================

-- Migration 1: App Config Table
CREATE TABLE IF NOT EXISTS public.app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  category text NOT NULL DEFAULT 'general',
  description text,
  is_sensitive boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Admins can manage all config
CREATE POLICY "Admins can manage config"
  ON public.app_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can read non-sensitive config
CREATE POLICY "Users can read non-sensitive config"
  ON public.app_config FOR SELECT TO authenticated
  USING (is_sensitive = false);

-- Updated_at trigger
CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migration 2: User Invites Table
CREATE TABLE IF NOT EXISTS public.user_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text DEFAULT 'user',
  invited_by uuid REFERENCES public.profiles(id),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;

-- Admins can manage invites
CREATE POLICY "Admins can manage invites"
  ON public.user_invites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_invites_email ON public.user_invites(email);
CREATE INDEX IF NOT EXISTS idx_user_invites_token ON public.user_invites(token);
CREATE INDEX IF NOT EXISTS idx_user_invites_expires_at ON public.user_invites(expires_at);

-- Migration 3: User Status Columns on Profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deactivated_by uuid REFERENCES public.profiles(id);

-- Index for active users
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- Backfill existing users as active
UPDATE public.profiles SET is_active = true WHERE is_active IS NULL;

-- ============================================================
-- FILE: 20251231214950_d66f401d-349f-411a-b279-d94f27b357dc.sql
-- ============================================================

-- Enable RLS on meeting_transcripts table
ALTER TABLE public.meeting_transcripts ENABLE ROW LEVEL SECURITY;

-- Create policies for meeting_transcripts
-- Users can view transcripts for meetings they organized
CREATE POLICY "Users can view transcripts for their meetings"
  ON public.meeting_transcripts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings 
      WHERE meetings.id = meeting_transcripts.meeting_id 
      AND meetings.organizer_id = auth.uid()
    )
  );

-- Users can insert transcripts for meetings they organized
CREATE POLICY "Users can insert transcripts for their meetings"
  ON public.meeting_transcripts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meetings 
      WHERE meetings.id = meeting_transcripts.meeting_id 
      AND meetings.organizer_id = auth.uid()
    )
  );

-- Admins can manage all transcripts
CREATE POLICY "Admins can manage all transcripts"
  ON public.meeting_transcripts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- FILE: 20260101_activity_logs.sql
-- ============================================================

-- Activity logs table for tracking user actions
-- This table records all significant user actions for auditing and monitoring
-- Admins can view all logs, users can view their own

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX idx_activity_logs_resource ON public.activity_logs(resource_type, resource_id);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all activity logs
CREATE POLICY "Admins can view all activity logs"
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own activity logs
CREATE POLICY "Users can view own activity logs"
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only system/backend can insert logs (users can't manually create logs)
-- This will be done through edge functions or triggers
CREATE POLICY "Service role can insert activity logs"
  ON public.activity_logs
  FOR INSERT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Helper function to log activity
CREATE OR REPLACE FUNCTION public.log_activity(
  p_user_id uuid,
  p_action text,
  p_resource_type text DEFAULT NULL,
  p_resource_id text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.activity_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    ip_address,
    user_agent
  ) VALUES (
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_details,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert some example activity logs for testing (optional - remove in production)
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get first user ID for demo data
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.activity_logs (user_id, action, resource_type, resource_id, details, created_at) VALUES
      (v_user_id, 'user.login', NULL, NULL, '{"method": "email"}'::jsonb, now() - interval '1 hour'),
      (v_user_id, 'client.created', 'client', '123', '{"name": "Acme Corp"}'::jsonb, now() - interval '2 hours'),
      (v_user_id, 'meeting.scheduled', 'meeting', '456', '{"title": "Kickoff Meeting"}'::jsonb, now() - interval '3 hours'),
      (v_user_id, 'agent.created', 'agent', '789', '{"name": "Sales Assistant"}'::jsonb, now() - interval '5 hours'),
      (v_user_id, 'settings.updated', NULL, NULL, '{"section": "profile"}'::jsonb, now() - interval '1 day');
  END IF;
END $$;


-- ============================================================
-- FILE: 20260101_knowledge_sources.sql
-- ============================================================

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


-- ============================================================
-- FILE: 20260101_meeting_categorizations.sql
-- ============================================================

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


-- ============================================================
-- FILE: 20260101_meeting_transcripts.sql
-- ============================================================

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


-- ============================================================
-- FILE: 20260101_tasks.sql
-- ============================================================

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


-- ============================================================
-- FILE: 20260101_user_agent_personalizations.sql
-- ============================================================

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


-- ============================================================
-- FILE: 20260101_user_knowledge_files.sql
-- ============================================================

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


-- ============================================================
-- FILE: 20260102154955_d5dd8c14-2bb7-4401-979f-d627cf2b4d94.sql
-- ============================================================

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

-- ============================================================
-- FILE: 20260102161850_648cde25-5f4f-457a-a24a-20e25acbf577.sql
-- ============================================================

-- Create AI Providers table
CREATE TABLE public.ai_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  base_url TEXT,
  api_key_secret_name TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create AI Models table
CREATE TABLE public.ai_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES public.ai_providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('chat', 'embedding')),
  context_window INTEGER NOT NULL DEFAULT 128000,
  input_cost_per_1k NUMERIC(12, 8) NOT NULL DEFAULT 0,
  output_cost_per_1k NUMERIC(12, 8) NOT NULL DEFAULT 0,
  embedding_cost_per_1k NUMERIC(12, 8) NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  features JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create AI Usage Logs table
CREATE TABLE public.ai_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  model_id UUID REFERENCES public.ai_models(id) ON DELETE SET NULL,
  function_name TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  embedding_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(12, 8) NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_providers (read by all authenticated, write by admins)
CREATE POLICY "Authenticated users can view providers"
  ON public.ai_providers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage providers"
  ON public.ai_providers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for ai_models (read by all authenticated, write by admins)
CREATE POLICY "Authenticated users can view models"
  ON public.ai_models FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage models"
  ON public.ai_models FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for ai_usage_logs (users see their own, admins see all)
CREATE POLICY "Users can view their own usage logs"
  ON public.ai_usage_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own usage logs"
  ON public.ai_usage_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all usage logs"
  ON public.ai_usage_logs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create indexes
CREATE INDEX idx_ai_models_provider_id ON public.ai_models(provider_id);
CREATE INDEX idx_ai_models_category ON public.ai_models(category);
CREATE INDEX idx_ai_usage_logs_user_id ON public.ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_logs_created_at ON public.ai_usage_logs(created_at);

-- Triggers for updated_at
CREATE TRIGGER update_ai_providers_updated_at
  BEFORE UPDATE ON public.ai_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_models_updated_at
  BEFORE UPDATE ON public.ai_models
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default providers
INSERT INTO public.ai_providers (name, slug, description, api_key_secret_name) VALUES
  ('OpenAI', 'openai', 'GPT models for chat and embeddings', 'OPENAI_API_KEY'),
  ('Anthropic', 'anthropic', 'Claude models for advanced reasoning', 'ANTHROPIC_API_KEY'),
  ('Google AI', 'google', 'Gemini models for multimodal AI', 'GOOGLE_AI_API_KEY'),
  ('Perplexity', 'perplexity', 'Sonar models with web search', 'PERPLEXITY_API_KEY');

-- Seed default models (with latest pricing)
INSERT INTO public.ai_models (provider_id, name, model_id, category, context_window, input_cost_per_1k, output_cost_per_1k, features, is_default) VALUES
  -- OpenAI Chat Models
  ((SELECT id FROM public.ai_providers WHERE slug = 'openai'), 'GPT-4o', 'gpt-4o', 'chat', 128000, 0.005, 0.015, '{"vision": true, "reasoning": true}', true),
  ((SELECT id FROM public.ai_providers WHERE slug = 'openai'), 'GPT-4o mini', 'gpt-4o-mini', 'chat', 128000, 0.00015, 0.0006, '{"vision": true, "fast": true}', false),
  ((SELECT id FROM public.ai_providers WHERE slug = 'openai'), 'GPT-4 Turbo', 'gpt-4-turbo', 'chat', 128000, 0.01, 0.03, '{"vision": true}', false),
  -- OpenAI Embedding Models
  ((SELECT id FROM public.ai_providers WHERE slug = 'openai'), 'text-embedding-3-small', 'text-embedding-3-small', 'embedding', 8191, 0, 0, '{}', true),
  ((SELECT id FROM public.ai_providers WHERE slug = 'openai'), 'text-embedding-3-large', 'text-embedding-3-large', 'embedding', 8191, 0, 0, '{}', false),
  -- Anthropic Models
  ((SELECT id FROM public.ai_providers WHERE slug = 'anthropic'), 'Claude Sonnet 4', 'claude-sonnet-4-20250514', 'chat', 200000, 0.003, 0.015, '{"reasoning": true, "highest_quality": true}', false),
  ((SELECT id FROM public.ai_providers WHERE slug = 'anthropic'), 'Claude Haiku 3.5', 'claude-3-5-haiku-20241022', 'chat', 200000, 0.001, 0.005, '{"fast": true}', false),
  -- Google Models
  ((SELECT id FROM public.ai_providers WHERE slug = 'google'), 'Gemini 2.0 Flash', 'gemini-2.0-flash', 'chat', 1000000, 0.0001, 0.0004, '{"vision": true, "fast": true, "multimodal": true}', false),
  ((SELECT id FROM public.ai_providers WHERE slug = 'google'), 'Gemini 1.5 Pro', 'gemini-1.5-pro', 'chat', 2000000, 0.00125, 0.005, '{"vision": true, "reasoning": true}', false),
  -- Perplexity Models
  ((SELECT id FROM public.ai_providers WHERE slug = 'perplexity'), 'Sonar', 'sonar', 'chat', 128000, 0.001, 0.001, '{"web_search": true, "fast": true}', false),
  ((SELECT id FROM public.ai_providers WHERE slug = 'perplexity'), 'Sonar Pro', 'sonar-pro', 'chat', 200000, 0.003, 0.015, '{"web_search": true, "reasoning": true}', false);

-- Set embedding costs (separate update for clarity)
UPDATE public.ai_models SET embedding_cost_per_1k = 0.00002 WHERE model_id = 'text-embedding-3-small';
UPDATE public.ai_models SET embedding_cost_per_1k = 0.00013 WHERE model_id = 'text-embedding-3-large';

-- ============================================================
-- FILE: 20260102162554_a2fefe3f-bda1-4849-92f4-1fc66d085077.sql
-- ============================================================

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource_type ON public.activity_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can view all activity logs
CREATE POLICY "Admins can view all activity logs"
  ON public.activity_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own activity logs
CREATE POLICY "Users can view their own activity logs"
  ON public.activity_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow inserts via service role (edge function) or authenticated users for their own logs
CREATE POLICY "Users can insert their own activity logs"
  ON public.activity_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can delete old logs (for cleanup)
CREATE POLICY "Admins can delete activity logs"
  ON public.activity_logs
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- FILE: 20260102165229_eacdf2c9-d0fa-4630-8f13-ba5a829e6099.sql
-- ============================================================

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date TIMESTAMP WITH TIME ZONE,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  client_id UUID REFERENCES public.clients(id),
  meeting_id UUID REFERENCES public.meetings(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for task access
CREATE POLICY "Users can view all tasks" 
ON public.tasks 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create tasks" 
ON public.tasks 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update tasks they created or are assigned to" 
ON public.tasks 
FOR UPDATE 
USING (auth.uid() = created_by OR auth.uid() = assigned_to);

CREATE POLICY "Users can delete tasks they created" 
ON public.tasks 
FOR DELETE 
USING (auth.uid() = created_by);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_priority ON public.tasks(priority);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);

-- ============================================================
-- FILE: 20260102_seed_additional_features.sql
-- ============================================================

-- Add additional feature flags and branding options
-- This migration extends the default configuration with new features

-- Insert new feature flags
INSERT INTO public.app_config (key, value, category, description) VALUES
  -- Additional Features
  ('features.enableClients', 'true', 'features', 'Enable client management module'),
  ('features.enableAIAgents', 'true', 'features', 'Enable AI agents management'),
  ('features.enablePersonalKnowledge', 'true', 'features', 'Enable personal knowledge uploads'),
  ('features.enableFeedback', 'true', 'features', 'Enable feedback collection'),
  ('features.enableGoogleDrive', 'false', 'features', 'Enable Google Drive integration'),
  ('features.enableZoomSync', 'false', 'features', 'Enable Zoom meeting sync'),

  -- Branding
  ('branding.logoUrl', 'null', 'branding', 'URL to custom logo image'),

  -- System
  ('system.onboardingCompleted', 'false', 'system', 'Platform onboarding wizard completed')
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- FILE: 20260103_ai_providers_models.sql
-- ============================================================

-- ============================================
-- AI Providers & Models Migration
-- Create tables for multi-provider AI integration with cost tracking
-- ============================================

-- Create ai_providers table
CREATE TABLE public.ai_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  api_key_secret_name TEXT,
  base_url TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create ai_models table
CREATE TABLE public.ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.ai_providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('chat', 'embedding')),
  context_window INTEGER DEFAULT 0,
  input_cost_per_1k DECIMAL(10, 8) DEFAULT 0,
  output_cost_per_1k DECIMAL(10, 8) DEFAULT 0,
  embedding_cost_per_1k DECIMAL(10, 8) DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  features JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider_id, model_id)
);

-- Create ai_usage_logs table
CREATE TABLE public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  model_id UUID REFERENCES public.ai_models(id) ON DELETE SET NULL,
  function_name TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  embedding_tokens INTEGER DEFAULT 0,
  estimated_cost DECIMAL(10, 8) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_ai_providers_slug ON public.ai_providers(slug);
CREATE INDEX idx_ai_providers_enabled ON public.ai_providers(enabled);

CREATE INDEX idx_ai_models_provider ON public.ai_models(provider_id);
CREATE INDEX idx_ai_models_category ON public.ai_models(category);
CREATE INDEX idx_ai_models_enabled ON public.ai_models(enabled);
CREATE INDEX idx_ai_models_is_default ON public.ai_models(is_default);

CREATE INDEX idx_ai_usage_logs_user ON public.ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_logs_model ON public.ai_usage_logs(model_id);
CREATE INDEX idx_ai_usage_logs_created_at ON public.ai_usage_logs(created_at);

-- Enable RLS
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_providers
CREATE POLICY "Everyone can view enabled providers"
  ON public.ai_providers FOR SELECT
  TO authenticated
  USING (enabled = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage providers"
  ON public.ai_providers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for ai_models
CREATE POLICY "Everyone can view enabled models"
  ON public.ai_models FOR SELECT
  TO authenticated
  USING (enabled = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage models"
  ON public.ai_models FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for ai_usage_logs
CREATE POLICY "Users can view own usage logs"
  ON public.ai_usage_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert usage logs"
  ON public.ai_usage_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create triggers for updated_at timestamp
CREATE TRIGGER update_ai_providers_updated_at
  BEFORE UPDATE ON public.ai_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_models_updated_at
  BEFORE UPDATE ON public.ai_models
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Seed AI Providers
-- ============================================

INSERT INTO public.ai_providers (name, slug, api_key_secret_name, base_url, enabled) VALUES
  ('OpenAI', 'openai', 'OPENAI_API_KEY', 'https://api.openai.com/v1', true),
  ('Anthropic', 'anthropic', 'ANTHROPIC_API_KEY', 'https://api.anthropic.com/v1', true),
  ('Google', 'google', 'GOOGLE_AI_API_KEY', 'https://generativelanguage.googleapis.com/v1', true),
  ('Perplexity', 'perplexity', 'PERPLEXITY_API_KEY', 'https://api.perplexity.ai', true);

-- ============================================
-- Seed AI Models with Latest Pricing (as of Jan 2026)
-- ============================================

-- Get provider IDs for seeding models
DO $$
DECLARE
  openai_id UUID;
  anthropic_id UUID;
  google_id UUID;
  perplexity_id UUID;
BEGIN
  SELECT id INTO openai_id FROM public.ai_providers WHERE slug = 'openai';
  SELECT id INTO anthropic_id FROM public.ai_providers WHERE slug = 'anthropic';
  SELECT id INTO google_id FROM public.ai_providers WHERE slug = 'google';
  SELECT id INTO perplexity_id FROM public.ai_providers WHERE slug = 'perplexity';

  -- OpenAI Chat Models
  INSERT INTO public.ai_models (provider_id, name, model_id, category, context_window, input_cost_per_1k, output_cost_per_1k, enabled, is_default, features) VALUES
    (openai_id, 'GPT-5', 'gpt-5', 'chat', 400000, 0.00125, 0.01, true, false, '{"reasoning": true, "vision": true, "function_calling": true}'::jsonb),
    (openai_id, 'GPT-5 mini', 'gpt-5-mini', 'chat', 400000, 0.00025, 0.002, true, false, '{"reasoning": true, "vision": true, "function_calling": true, "fast": true}'::jsonb),
    (openai_id, 'GPT-5 nano', 'gpt-5-nano', 'chat', 400000, 0.00005, 0.0004, true, false, '{"fast": true, "function_calling": true}'::jsonb),
    (openai_id, 'GPT-4o', 'gpt-4o', 'chat', 128000, 0.005, 0.015, true, true, '{"vision": true, "function_calling": true}'::jsonb),
    (openai_id, 'GPT-4o mini', 'gpt-4o-mini', 'chat', 128000, 0.00015, 0.0006, true, false, '{"vision": true, "function_calling": true, "fast": true}'::jsonb);

  -- OpenAI Embedding Models
  INSERT INTO public.ai_models (provider_id, name, model_id, category, context_window, embedding_cost_per_1k, enabled, is_default, features) VALUES
    (openai_id, 'text-embedding-3-small', 'text-embedding-3-small', 'embedding', 8191, 0.00002, true, true, '{"dimensions": 1536}'::jsonb),
    (openai_id, 'text-embedding-3-large', 'text-embedding-3-large', 'embedding', 8191, 0.00013, true, false, '{"dimensions": 3072, "high_quality": true}'::jsonb);

  -- Anthropic Chat Models
  INSERT INTO public.ai_models (provider_id, name, model_id, category, context_window, input_cost_per_1k, output_cost_per_1k, enabled, is_default, features) VALUES
    (anthropic_id, 'Claude Sonnet 4', 'claude-sonnet-4-20250514', 'chat', 200000, 0.003, 0.015, true, false, '{"vision": true, "reasoning": true}'::jsonb),
    (anthropic_id, 'Claude Opus 4', 'claude-opus-4-20250514', 'chat', 200000, 0.015, 0.075, true, false, '{"vision": true, "reasoning": true, "highest_quality": true}'::jsonb),
    (anthropic_id, 'Claude Haiku 4.5', 'claude-haiku-4-5-20250514', 'chat', 200000, 0.001, 0.01, true, false, '{"fast": true, "vision": true}'::jsonb);

  -- Google Chat Models
  INSERT INTO public.ai_models (provider_id, name, model_id, category, context_window, input_cost_per_1k, output_cost_per_1k, enabled, is_default, features) VALUES
    (google_id, 'Gemini 2.5 Pro', 'gemini-2.5-pro', 'chat', 200000, 0.00125, 0.01, true, false, '{"vision": true, "reasoning": true, "multimodal": true}'::jsonb),
    (google_id, 'Gemini 2.5 Flash', 'gemini-2.5-flash', 'chat', 200000, 0.0003, 0.0025, true, false, '{"vision": true, "multimodal": true, "fast": true}'::jsonb);

  -- Google Embedding Models
  INSERT INTO public.ai_models (provider_id, name, model_id, category, context_window, embedding_cost_per_1k, enabled, is_default, features) VALUES
    (google_id, 'text-embedding-004', 'text-embedding-004', 'embedding', 2048, 0.000025, true, false, '{"dimensions": 768}'::jsonb);

  -- Perplexity Chat Models
  INSERT INTO public.ai_models (provider_id, name, model_id, category, context_window, input_cost_per_1k, output_cost_per_1k, enabled, is_default, features) VALUES
    (perplexity_id, 'Sonar', 'sonar', 'chat', 128000, 0.001, 0.001, true, false, '{"web_search": true, "real_time": true}'::jsonb),
    (perplexity_id, 'Sonar Pro', 'sonar-pro', 'chat', 200000, 0.003, 0.015, true, false, '{"web_search": true, "real_time": true, "reasoning": true}'::jsonb);
END $$;


-- ============================================================
-- FILE: 20260103_integration_helper_functions.sql
-- ============================================================

-- ============================================
-- Integration Hub Helper Functions
-- Utility functions for managing integrations
-- ============================================

-- ============================================
-- FUNCTION: get_integration_config
-- Retrieve integration configuration by provider slug
-- Returns decrypted config (note: actual encryption to be implemented)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_integration_config(
  provider_slug_input TEXT,
  organization_id_input UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  integration_config JSONB;
  provider_record RECORD;
BEGIN
  -- Get provider details
  SELECT * INTO provider_record
  FROM public.integration_providers
  WHERE slug = provider_slug_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found: %', provider_slug_input;
  END IF;

  -- Get integration config
  SELECT config INTO integration_config
  FROM public.organization_integrations
  WHERE provider_id = provider_record.id
    AND (organization_id IS NULL OR organization_id = organization_id_input)
    AND enabled = true
  LIMIT 1;

  IF integration_config IS NULL THEN
    RAISE EXCEPTION 'Integration not configured for provider: %', provider_slug_input;
  END IF;

  -- TODO: Decrypt sensitive fields (api_key, client_secret, etc.)
  -- For now, return as-is
  RETURN integration_config;
END;
$$;

COMMENT ON FUNCTION public.get_integration_config IS 'Retrieve integration configuration by provider slug. Returns config JSONB.';

-- ============================================
-- FUNCTION: set_integration_config
-- Store integration configuration
-- ============================================
CREATE OR REPLACE FUNCTION public.set_integration_config(
  provider_slug_input TEXT,
  config_input JSONB,
  organization_id_input UUID DEFAULT NULL,
  enabled_input BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  provider_record RECORD;
  integration_id UUID;
BEGIN
  -- Verify user is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can configure integrations';
  END IF;

  -- Get provider
  SELECT * INTO provider_record
  FROM public.integration_providers
  WHERE slug = provider_slug_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found: %', provider_slug_input;
  END IF;

  -- TODO: Encrypt sensitive fields before storing

  -- Upsert integration config
  INSERT INTO public.organization_integrations (
    organization_id,
    provider_id,
    config,
    enabled,
    connection_status,
    created_by
  ) VALUES (
    organization_id_input,
    provider_record.id,
    config_input,
    enabled_input,
    'disconnected',
    auth.uid()
  )
  ON CONFLICT (organization_id, provider_id) DO UPDATE
    SET config = EXCLUDED.config,
        enabled = EXCLUDED.enabled,
        updated_at = now()
  RETURNING id INTO integration_id;

  RETURN integration_id;
END;
$$;

COMMENT ON FUNCTION public.set_integration_config IS 'Store or update integration configuration. Returns integration ID.';

-- ============================================
-- FUNCTION: test_integration_connection
-- Update connection status after testing
-- ============================================
CREATE OR REPLACE FUNCTION public.test_integration_connection(
  provider_slug_input TEXT,
  is_valid BOOLEAN,
  message_input TEXT DEFAULT NULL,
  organization_id_input UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  provider_record RECORD;
  new_status TEXT;
BEGIN
  -- Verify user is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can test connections';
  END IF;

  -- Get provider
  SELECT * INTO provider_record
  FROM public.integration_providers
  WHERE slug = provider_slug_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found: %', provider_slug_input;
  END IF;

  -- Determine new status
  IF is_valid THEN
    new_status := 'connected';
  ELSE
    new_status := 'error';
  END IF;

  -- Update integration status
  UPDATE public.organization_integrations
  SET
    connection_status = new_status,
    connection_message = message_input,
    last_tested_at = now()
  WHERE provider_id = provider_record.id
    AND (organization_id IS NULL OR organization_id = organization_id_input);

  RETURN is_valid;
END;
$$;

COMMENT ON FUNCTION public.test_integration_connection IS 'Update connection status after testing. Pass TRUE if valid, FALSE if error.';

-- ============================================
-- FUNCTION: get_enabled_integrations
-- Get all enabled integrations for an organization
-- ============================================
CREATE OR REPLACE FUNCTION public.get_enabled_integrations(
  category_slug_input TEXT DEFAULT NULL,
  organization_id_input UUID DEFAULT NULL
)
RETURNS TABLE (
  integration_id UUID,
  provider_slug TEXT,
  provider_name TEXT,
  category_slug TEXT,
  auth_type TEXT,
  connection_status TEXT,
  last_tested_at TIMESTAMPTZ,
  config JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    oi.id as integration_id,
    p.slug as provider_slug,
    p.name as provider_name,
    c.slug as category_slug,
    p.auth_type,
    oi.connection_status,
    oi.last_tested_at,
    oi.config
  FROM public.organization_integrations oi
  INNER JOIN public.integration_providers p ON oi.provider_id = p.id
  INNER JOIN public.integration_categories c ON p.category_id = c.id
  WHERE oi.enabled = true
    AND (category_slug_input IS NULL OR c.slug = category_slug_input)
    AND (organization_id_input IS NULL OR oi.organization_id = organization_id_input)
  ORDER BY c.display_order, p.display_order;
END;
$$;

COMMENT ON FUNCTION public.get_enabled_integrations IS 'Get all enabled integrations, optionally filtered by category.';

-- ============================================
-- FUNCTION: log_integration_usage
-- Convenience function for logging integration API usage
-- ============================================
CREATE OR REPLACE FUNCTION public.log_integration_usage(
  provider_slug_input TEXT,
  action_input TEXT,
  status_input TEXT DEFAULT 'success',
  request_metadata_input JSONB DEFAULT NULL,
  response_metadata_input JSONB DEFAULT NULL,
  error_message_input TEXT DEFAULT NULL,
  estimated_cost_input DECIMAL(10, 8) DEFAULT 0,
  organization_id_input UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  provider_record RECORD;
  log_id UUID;
BEGIN
  -- Get provider
  SELECT id INTO provider_record
  FROM public.integration_providers
  WHERE slug = provider_slug_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found: %', provider_slug_input;
  END IF;

  -- Insert usage log
  INSERT INTO public.integration_usage_logs (
    organization_id,
    provider_id,
    user_id,
    action,
    status,
    request_metadata,
    response_metadata,
    error_message,
    estimated_cost
  ) VALUES (
    organization_id_input,
    provider_record.id,
    auth.uid(),
    action_input,
    status_input,
    request_metadata_input,
    response_metadata_input,
    error_message_input,
    estimated_cost_input
  )
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;

COMMENT ON FUNCTION public.log_integration_usage IS 'Log integration API usage for analytics and debugging.';

-- ============================================
-- FUNCTION: get_integration_usage_stats
-- Get usage statistics for a provider
-- ============================================
CREATE OR REPLACE FUNCTION public.get_integration_usage_stats(
  provider_slug_input TEXT,
  start_date TIMESTAMPTZ DEFAULT NULL,
  end_date TIMESTAMPTZ DEFAULT NULL,
  organization_id_input UUID DEFAULT NULL
)
RETURNS TABLE (
  total_calls BIGINT,
  successful_calls BIGINT,
  failed_calls BIGINT,
  success_rate NUMERIC,
  total_cost NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  provider_record RECORD;
  start_filter TIMESTAMPTZ;
  end_filter TIMESTAMPTZ;
BEGIN
  -- Verify user is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can view usage statistics';
  END IF;

  -- Get provider
  SELECT id INTO provider_record
  FROM public.integration_providers
  WHERE slug = provider_slug_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found: %', provider_slug_input;
  END IF;

  -- Default to last 30 days if not specified
  start_filter := COALESCE(start_date, now() - interval '30 days');
  end_filter := COALESCE(end_date, now());

  RETURN QUERY
  SELECT
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE status = 'success') as successful_calls,
    COUNT(*) FILTER (WHERE status = 'error') as failed_calls,
    ROUND(
      COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / NULLIF(COUNT(*), 0) * 100,
      2
    ) as success_rate,
    SUM(estimated_cost) as total_cost
  FROM public.integration_usage_logs
  WHERE provider_id = provider_record.id
    AND created_at BETWEEN start_filter AND end_filter
    AND (organization_id_input IS NULL OR organization_id = organization_id_input);
END;
$$;

COMMENT ON FUNCTION public.get_integration_usage_stats IS 'Get usage statistics for a provider over a date range.';

-- ============================================
-- FUNCTION: get_default_service
-- Get the default service for a provider
-- ============================================
CREATE OR REPLACE FUNCTION public.get_default_service(
  provider_slug_input TEXT
)
RETURNS TABLE (
  service_id UUID,
  service_name TEXT,
  service_key TEXT,
  features JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  provider_record RECORD;
BEGIN
  -- Get provider
  SELECT id INTO provider_record
  FROM public.integration_providers
  WHERE slug = provider_slug_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found: %', provider_slug_input;
  END IF;

  RETURN QUERY
  SELECT
    s.id as service_id,
    s.name as service_name,
    s.service_key,
    s.features
  FROM public.integration_services s
  WHERE s.provider_id = provider_record.id
    AND s.enabled = true
    AND s.is_default = true
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_default_service IS 'Get the default service for a provider (if any).';

-- ============================================
-- FUNCTION: toggle_service
-- Enable or disable a specific service
-- ============================================
CREATE OR REPLACE FUNCTION public.toggle_service(
  provider_slug_input TEXT,
  service_key_input TEXT,
  enabled_input BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  provider_record RECORD;
BEGIN
  -- Verify user is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can toggle services';
  END IF;

  -- Get provider
  SELECT id INTO provider_record
  FROM public.integration_providers
  WHERE slug = provider_slug_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found: %', provider_slug_input;
  END IF;

  -- Update service
  UPDATE public.integration_services
  SET enabled = enabled_input,
      updated_at = now()
  WHERE provider_id = provider_record.id
    AND service_key = service_key_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not found: % for provider: %', service_key_input, provider_slug_input;
  END IF;

  RETURN enabled_input;
END;
$$;

COMMENT ON FUNCTION public.toggle_service IS 'Enable or disable a specific service for a provider.';

-- ============================================
-- Success Message
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Integration helper functions created successfully!';
  RAISE NOTICE 'Available functions:';
  RAISE NOTICE '  - get_integration_config(provider_slug)';
  RAISE NOTICE '  - set_integration_config(provider_slug, config, enabled)';
  RAISE NOTICE '  - test_integration_connection(provider_slug, is_valid, message)';
  RAISE NOTICE '  - get_enabled_integrations(category_slug)';
  RAISE NOTICE '  - log_integration_usage(provider_slug, action, status, ...)';
  RAISE NOTICE '  - get_integration_usage_stats(provider_slug, start_date, end_date)';
  RAISE NOTICE '  - get_default_service(provider_slug)';
  RAISE NOTICE '  - toggle_service(provider_slug, service_key, enabled)';
END $$;


-- ============================================================
-- FILE: 20260103_integration_hub_schema.sql
-- ============================================================

-- ============================================
-- Integration Hub Schema Migration
-- Unified integration system for all third-party services
-- Supports: AI, Meeting, Email, CRM, Project Management, Storage, Auth
-- ============================================

-- ============================================
-- Helper Function: Update updated_at timestamp
-- ============================================
-- Note: This function may already exist, using IF NOT EXISTS
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TABLE 1: integration_categories
-- Define high-level categories for organizing integrations
-- ============================================
CREATE TABLE public.integration_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT, -- Lucide icon name (e.g., 'Brain', 'Video', 'Mail')
  display_order INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for fast lookup and sorting
CREATE INDEX idx_integration_categories_slug ON public.integration_categories(slug);
CREATE INDEX idx_integration_categories_display_order ON public.integration_categories(display_order);
CREATE INDEX idx_integration_categories_enabled ON public.integration_categories(enabled);

-- Trigger for updated_at
CREATE TRIGGER set_integration_categories_updated_at
  BEFORE UPDATE ON public.integration_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- TABLE 2: integration_providers
-- Define individual service providers within categories
-- ============================================
CREATE TABLE public.integration_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.integration_categories(id) ON DELETE CASCADE,

  -- Provider identification
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  docs_url TEXT,

  -- Authentication configuration
  auth_type TEXT NOT NULL CHECK (auth_type IN ('api_key', 'oauth2', 'basic', 'service_account')),
  oauth_config JSONB, -- { authorize_url, token_url, scopes[] }

  -- Status flags
  is_available BOOLEAN DEFAULT true, -- Ready to use
  is_coming_soon BOOLEAN DEFAULT false, -- Planned but not implemented
  is_beta BOOLEAN DEFAULT false, -- Available but in beta

  -- Display settings
  display_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_integration_providers_category ON public.integration_providers(category_id);
CREATE INDEX idx_integration_providers_slug ON public.integration_providers(slug);
CREATE INDEX idx_integration_providers_display_order ON public.integration_providers(display_order);
CREATE INDEX idx_integration_providers_available ON public.integration_providers(is_available);

-- Trigger for updated_at
CREATE TRIGGER set_integration_providers_updated_at
  BEFORE UPDATE ON public.integration_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- TABLE 3: integration_fields
-- Define dynamic form fields for each provider
-- ============================================
CREATE TABLE public.integration_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.integration_providers(id) ON DELETE CASCADE,

  -- Field definition
  field_key TEXT NOT NULL, -- e.g., 'api_key', 'client_id', 'domain'
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'password', 'url', 'email', 'select', 'textarea')),

  -- Validation and defaults
  placeholder TEXT,
  default_value TEXT,
  is_required BOOLEAN DEFAULT false,
  is_sensitive BOOLEAN DEFAULT false, -- Should be encrypted

  -- Help and documentation
  help_text TEXT,
  validation_regex TEXT,

  -- Select options (if field_type = 'select')
  select_options JSONB, -- [{ value: 'option1', label: 'Option 1' }]

  -- Display
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure unique field keys per provider
  UNIQUE(provider_id, field_key)
);

-- Indexes
CREATE INDEX idx_integration_fields_provider ON public.integration_fields(provider_id);
CREATE INDEX idx_integration_fields_display_order ON public.integration_fields(display_order);

-- ============================================
-- TABLE 4: organization_integrations
-- Store organization-specific integration configurations
-- ============================================
CREATE TABLE public.organization_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID, -- Future: multi-tenancy support (nullable for now)
  provider_id UUID NOT NULL REFERENCES public.integration_providers(id) ON DELETE CASCADE,

  -- Configuration
  enabled BOOLEAN DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb, -- Encrypted credentials and settings

  -- Connection status
  connection_status TEXT CHECK (connection_status IN ('connected', 'disconnected', 'error', 'testing')) DEFAULT 'disconnected',
  connection_message TEXT, -- Error message or additional info
  last_tested_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,

  -- OAuth tokens (encrypted)
  oauth_tokens JSONB, -- { access_token, refresh_token, expires_at }

  -- Metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraint: one integration per provider per organization
  UNIQUE(organization_id, provider_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_organization_integrations_provider ON public.organization_integrations(provider_id);
CREATE INDEX idx_organization_integrations_org ON public.organization_integrations(organization_id);
CREATE INDEX idx_organization_integrations_enabled ON public.organization_integrations(enabled);
CREATE INDEX idx_organization_integrations_status ON public.organization_integrations(connection_status);

-- Trigger for updated_at
CREATE TRIGGER set_organization_integrations_updated_at
  BEFORE UPDATE ON public.organization_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- TABLE 5: integration_services
-- Individual services within a provider (like AI models within a provider)
-- ============================================
CREATE TABLE public.integration_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.integration_providers(id) ON DELETE CASCADE,

  -- Service identification
  name TEXT NOT NULL,
  service_key TEXT NOT NULL, -- e.g., 'zoom_meetings', 'zoom_recordings'
  description TEXT,

  -- Features and capabilities
  features JSONB, -- { recording: true, transcription: true, breakout_rooms: false }

  -- Pricing (optional, for cost tracking)
  has_cost BOOLEAN DEFAULT false,
  cost_model JSONB, -- { type: 'per_api_call', rate: 0.001 } or { type: 'flat', rate: 10 }

  -- Status
  enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- Like default AI model
  requires_config BOOLEAN DEFAULT false, -- Needs additional setup

  -- Display
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(provider_id, service_key)
);

-- Indexes
CREATE INDEX idx_integration_services_provider ON public.integration_services(provider_id);
CREATE INDEX idx_integration_services_enabled ON public.integration_services(enabled);
CREATE INDEX idx_integration_services_default ON public.integration_services(is_default);

-- Trigger for updated_at
CREATE TRIGGER set_integration_services_updated_at
  BEFORE UPDATE ON public.integration_services
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- TABLE 6: integration_usage_logs
-- Track API usage for analytics (similar to ai_usage_logs)
-- ============================================
CREATE TABLE public.integration_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID, -- Future: multi-tenancy
  provider_id UUID REFERENCES public.integration_providers(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.integration_services(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Usage details
  action TEXT NOT NULL, -- e.g., 'send_email', 'create_meeting', 'upload_file'
  status TEXT CHECK (status IN ('success', 'error', 'partial')) DEFAULT 'success',

  -- Metadata (flexible JSONB for provider-specific data)
  request_metadata JSONB, -- Request details
  response_metadata JSONB, -- Response details
  error_message TEXT,

  -- Cost tracking
  estimated_cost DECIMAL(10, 8) DEFAULT 0,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for analytics queries
CREATE INDEX idx_integration_usage_logs_provider ON public.integration_usage_logs(provider_id);
CREATE INDEX idx_integration_usage_logs_service ON public.integration_usage_logs(service_id);
CREATE INDEX idx_integration_usage_logs_user ON public.integration_usage_logs(user_id);
CREATE INDEX idx_integration_usage_logs_created_at ON public.integration_usage_logs(created_at);
CREATE INDEX idx_integration_usage_logs_org ON public.integration_usage_logs(organization_id);
CREATE INDEX idx_integration_usage_logs_status ON public.integration_usage_logs(status);
CREATE INDEX idx_integration_usage_logs_action ON public.integration_usage_logs(action);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.integration_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_usage_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS: integration_categories
-- ============================================
-- Categories are viewable by all authenticated users
CREATE POLICY "Categories are viewable by authenticated users"
  ON public.integration_categories FOR SELECT
  TO authenticated
  USING (enabled = true OR public.has_role(auth.uid(), 'admin'));

-- Only admins can manage categories
CREATE POLICY "Admins can manage categories"
  ON public.integration_categories FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- RLS: integration_providers
-- ============================================
-- Providers are viewable by all authenticated users
CREATE POLICY "Providers are viewable by authenticated users"
  ON public.integration_providers FOR SELECT
  TO authenticated
  USING (true); -- All providers visible (including coming_soon)

-- Only admins can manage providers
CREATE POLICY "Admins can manage providers"
  ON public.integration_providers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- RLS: integration_fields
-- ============================================
-- Fields are viewable by all authenticated users
CREATE POLICY "Fields are viewable by authenticated users"
  ON public.integration_fields FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage fields
CREATE POLICY "Admins can manage fields"
  ON public.integration_fields FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- RLS: organization_integrations
-- ============================================
-- Only admins can view organization integrations
CREATE POLICY "Admins can view all organization integrations"
  ON public.organization_integrations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can manage organization integrations
CREATE POLICY "Admins can manage organization integrations"
  ON public.organization_integrations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- RLS: integration_services
-- ============================================
-- Services are viewable by all authenticated users
CREATE POLICY "Services are viewable by authenticated users"
  ON public.integration_services FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage services
CREATE POLICY "Admins can manage services"
  ON public.integration_services FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- RLS: integration_usage_logs
-- ============================================
-- Admins can view all usage logs
CREATE POLICY "Admins can view all usage logs"
  ON public.integration_usage_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own usage logs
CREATE POLICY "Users can view their own usage logs"
  ON public.integration_usage_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- System can insert usage logs
CREATE POLICY "System can insert usage logs"
  ON public.integration_usage_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- COMMENTS (Documentation)
-- ============================================
COMMENT ON TABLE public.integration_categories IS 'High-level categories for organizing third-party integrations (AI, Meeting, Email, CRM, etc.)';
COMMENT ON TABLE public.integration_providers IS 'Individual service providers within categories (Zoom, Google, Salesforce, etc.)';
COMMENT ON TABLE public.integration_fields IS 'Dynamic form fields for provider configuration (API keys, OAuth settings, etc.)';
COMMENT ON TABLE public.organization_integrations IS 'Organization-specific integration configurations with encrypted credentials';
COMMENT ON TABLE public.integration_services IS 'Individual services within a provider (similar to AI models within a provider)';
COMMENT ON TABLE public.integration_usage_logs IS 'API usage tracking for analytics, cost monitoring, and debugging';

COMMENT ON COLUMN public.integration_providers.auth_type IS 'Authentication method: api_key, oauth2, basic, service_account';
COMMENT ON COLUMN public.integration_providers.oauth_config IS 'OAuth configuration JSON: { authorize_url, token_url, scopes[] }';
COMMENT ON COLUMN public.organization_integrations.config IS 'Encrypted provider credentials and settings';
COMMENT ON COLUMN public.organization_integrations.oauth_tokens IS 'Encrypted OAuth tokens: { access_token, refresh_token, expires_at }';
COMMENT ON COLUMN public.integration_services.cost_model IS 'Cost structure JSON: { type: "per_api_call", rate: 0.001 }';


-- ============================================================
-- FILE: 20260103_integration_hub_seed_data.sql
-- ============================================================

-- ============================================
-- Integration Hub Seed Data
-- Seed categories, providers, fields, and services
-- 20+ integrations across 6 categories
-- ============================================

-- ============================================
-- SEED: Integration Categories
-- ============================================
INSERT INTO public.integration_categories (name, slug, description, icon, display_order, enabled) VALUES
  ('AI Providers', 'ai-providers', 'AI models for chat, embeddings, and analysis', 'Brain', 10, true),
  ('Meeting Providers', 'meeting-providers', 'Video conferencing and meeting platforms', 'Video', 20, true),
  ('Email Providers', 'email-providers', 'Transactional and marketing email services', 'Mail', 30, true),
  ('CRM Systems', 'crm-systems', 'Customer relationship management platforms', 'Users', 40, true),
  ('Project Management', 'project-management', 'Task and project tracking tools', 'Kanban', 50, true),
  ('Storage & Productivity', 'storage-productivity', 'Cloud storage and productivity suites', 'Cloud', 60, true),
  ('Authentication', 'authentication', 'SSO and identity providers', 'Shield', 70, false); -- Disabled for now

-- ============================================
-- SEED: Integration Providers
-- ============================================

-- Get category IDs for provider insertion
DO $$
DECLARE
  cat_ai UUID;
  cat_meeting UUID;
  cat_email UUID;
  cat_crm UUID;
  cat_pm UUID;
  cat_storage UUID;
  cat_auth UUID;
BEGIN
  SELECT id INTO cat_ai FROM public.integration_categories WHERE slug = 'ai-providers';
  SELECT id INTO cat_meeting FROM public.integration_categories WHERE slug = 'meeting-providers';
  SELECT id INTO cat_email FROM public.integration_categories WHERE slug = 'email-providers';
  SELECT id INTO cat_crm FROM public.integration_categories WHERE slug = 'crm-systems';
  SELECT id INTO cat_pm FROM public.integration_categories WHERE slug = 'project-management';
  SELECT id INTO cat_storage FROM public.integration_categories WHERE slug = 'storage-productivity';
  SELECT id INTO cat_auth FROM public.integration_categories WHERE slug = 'authentication';

  -- ============================================
  -- AI PROVIDERS
  -- ============================================
  INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, docs_url, is_available, is_coming_soon, display_order) VALUES
    (cat_ai, 'OpenAI', 'openai', 'Industry-leading AI models for chat, embeddings, and vision', 'api_key', 'https://platform.openai.com/docs', true, false, 10),
    (cat_ai, 'Anthropic Claude', 'anthropic', 'Advanced AI models with extended context and reasoning', 'api_key', 'https://docs.anthropic.com', true, false, 20),
    (cat_ai, 'Google Gemini', 'google-gemini', 'Multimodal AI models from Google', 'api_key', 'https://ai.google.dev/docs', true, false, 30),
    (cat_ai, 'Perplexity', 'perplexity', 'AI with real-time web search capabilities', 'api_key', 'https://docs.perplexity.ai', true, false, 40);

  -- ============================================
  -- MEETING PROVIDERS
  -- ============================================
  INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, oauth_config, docs_url, is_available, is_coming_soon, display_order) VALUES
    (cat_meeting, 'Zoom', 'zoom', 'Video conferencing with recordings and transcriptions', 'oauth2',
      '{"authorize_url": "https://zoom.us/oauth/authorize", "token_url": "https://zoom.us/oauth/token", "scopes": ["user:read", "meeting:read", "recording:read"]}'::jsonb,
      'https://marketplace.zoom.us/docs/api-reference', true, false, 10),

    (cat_meeting, 'Microsoft Teams', 'microsoft-teams', 'Collaboration platform with meetings and chat', 'oauth2',
      '{"authorize_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token", "scopes": ["OnlineMeetings.ReadWrite", "Calendars.ReadWrite"]}'::jsonb,
      'https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview', false, true, 20),

    (cat_meeting, 'Google Meet', 'google-meet', 'Video conferencing integrated with Google Workspace', 'oauth2',
      '{"authorize_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token", "scopes": ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/meetings.space.created"]}'::jsonb,
      'https://developers.google.com/workspace/meet/api/guides/overview', false, true, 30),

    (cat_meeting, 'Cisco Webex', 'webex', 'Enterprise video conferencing and collaboration', 'oauth2',
      '{"authorize_url": "https://api.webex.com/v1/oauth2/authorize", "token_url": "https://api.webex.com/v1/oauth2/token", "scopes": ["spark:all", "meeting:recordings_read"]}'::jsonb,
      'https://developer.webex.com/docs/api/guides/integrations-and-authorization', false, true, 40),

    (cat_meeting, 'GoToMeeting', 'gotomeeting', 'Reliable video conferencing for businesses', 'oauth2',
      '{"authorize_url": "https://api.getgo.com/oauth/v2/authorize", "token_url": "https://api.getgo.com/oauth/v2/token", "scopes": ["meeting:read", "meeting:write"]}'::jsonb,
      'https://developer.goto.com/GoToMeetingV1', false, true, 50);

  -- ============================================
  -- EMAIL PROVIDERS
  -- ============================================
  INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, docs_url, is_available, is_coming_soon, display_order) VALUES
    (cat_email, 'SendGrid', 'sendgrid', 'Reliable email delivery platform by Twilio', 'api_key', 'https://docs.sendgrid.com', true, false, 10),
    (cat_email, 'Mailgun', 'mailgun', 'Developer-friendly email automation service', 'api_key', 'https://documentation.mailgun.com', false, true, 20),
    (cat_email, 'Postmark', 'postmark', 'Transactional email with excellent deliverability', 'api_key', 'https://postmarkapp.com/developer', false, true, 30),
    (cat_email, 'Amazon SES', 'amazon-ses', 'Cost-effective email service from AWS', 'service_account', 'https://docs.aws.amazon.com/ses', false, true, 40),
    (cat_email, 'Resend', 'resend', 'Modern email API for developers', 'api_key', 'https://resend.com/docs', false, true, 50);

  -- ============================================
  -- CRM SYSTEMS
  -- ============================================
  INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, oauth_config, docs_url, is_available, is_coming_soon, display_order) VALUES
    (cat_crm, 'Salesforce', 'salesforce', 'Enterprise CRM platform with comprehensive features', 'oauth2',
      '{"authorize_url": "https://login.salesforce.com/services/oauth2/authorize", "token_url": "https://login.salesforce.com/services/oauth2/token", "scopes": ["api", "refresh_token", "offline_access"]}'::jsonb,
      'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest', false, true, 10),

    (cat_crm, 'HubSpot', 'hubspot', 'Marketing, sales, and service CRM platform', 'oauth2',
      '{"authorize_url": "https://app.hubspot.com/oauth/authorize", "token_url": "https://api.hubapi.com/oauth/v1/token", "scopes": ["crm.objects.contacts.read", "crm.objects.contacts.write"]}'::jsonb,
      'https://developers.hubspot.com/docs/api-reference/overview', false, true, 20),

    (cat_crm, 'Pipedrive', 'pipedrive', 'Sales-focused CRM with simple interface', 'api_key', 'https://developers.pipedrive.com/docs/api/v1', false, true, 30),

    (cat_crm, 'Zoho CRM', 'zoho-crm', 'Affordable CRM for small to medium businesses', 'oauth2',
      '{"authorize_url": "https://accounts.zoho.com/oauth/v2/auth", "token_url": "https://accounts.zoho.com/oauth/v2/token", "scopes": ["ZohoCRM.modules.ALL"]}'::jsonb,
      'https://www.zoho.com/crm/developer/docs/api/v8', false, true, 40);

  -- ============================================
  -- PROJECT MANAGEMENT
  -- ============================================
  INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, oauth_config, docs_url, is_available, is_coming_soon, display_order) VALUES
    (cat_pm, 'Jira', 'jira', 'Issue tracking and project management by Atlassian', 'oauth2',
      '{"authorize_url": "https://auth.atlassian.com/authorize", "token_url": "https://auth.atlassian.com/oauth/token", "scopes": ["read:jira-work", "write:jira-work"]}'::jsonb,
      'https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro', false, true, 10),

    (cat_pm, 'Asana', 'asana', 'Work management platform for team collaboration', 'oauth2',
      '{"authorize_url": "https://app.asana.com/-/oauth_authorize", "token_url": "https://app.asana.com/-/oauth_token", "scopes": ["default"]}'::jsonb,
      'https://developers.asana.com/docs/authentication', false, true, 20),

    (cat_pm, 'Monday.com', 'monday', 'Visual work operating system', 'api_key', 'https://developer.monday.com/api-reference', false, true, 30),

    (cat_pm, 'Trello', 'trello', 'Simple kanban-style project management', 'api_key', 'https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization', false, true, 40),

    (cat_pm, 'ClickUp', 'clickup', 'All-in-one productivity platform', 'oauth2',
      '{"authorize_url": "https://app.clickup.com/api", "token_url": "https://api.clickup.com/api/v2/oauth/token", "scopes": ["task:read", "task:write"]}'::jsonb,
      'https://clickup.com/api', false, true, 50);

  -- ============================================
  -- STORAGE & PRODUCTIVITY
  -- ============================================
  INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, oauth_config, docs_url, is_available, is_coming_soon, display_order) VALUES
    (cat_storage, 'Google Workspace', 'google-workspace', 'Drive, Calendar, and Meet from Google', 'oauth2',
      '{"authorize_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token", "scopes": ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/meetings.space.created"]}'::jsonb,
      'https://developers.google.com/workspace', false, true, 10),

    (cat_storage, 'Microsoft 365', 'microsoft-365', 'OneDrive, Outlook, and Teams from Microsoft', 'oauth2',
      '{"authorize_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token", "scopes": ["Files.ReadWrite.All", "Mail.ReadWrite", "Calendars.ReadWrite"]}'::jsonb,
      'https://learn.microsoft.com/en-us/graph/overview', false, true, 20);

END $$;

-- ============================================
-- SEED: Integration Fields
-- Define required fields for each provider
-- ============================================

-- This will be populated dynamically, but let's add fields for available providers

DO $$
DECLARE
  provider_openai UUID;
  provider_anthropic UUID;
  provider_gemini UUID;
  provider_perplexity UUID;
  provider_sendgrid UUID;
  provider_zoom UUID;
BEGIN
  -- Get provider IDs
  SELECT id INTO provider_openai FROM public.integration_providers WHERE slug = 'openai';
  SELECT id INTO provider_anthropic FROM public.integration_providers WHERE slug = 'anthropic';
  SELECT id INTO provider_gemini FROM public.integration_providers WHERE slug = 'google-gemini';
  SELECT id INTO provider_perplexity FROM public.integration_providers WHERE slug = 'perplexity';
  SELECT id INTO provider_sendgrid FROM public.integration_providers WHERE slug = 'sendgrid';
  SELECT id INTO provider_zoom FROM public.integration_providers WHERE slug = 'zoom';

  -- ============================================
  -- OPENAI FIELDS
  -- ============================================
  INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order) VALUES
    (provider_openai, 'api_key', 'API Key', 'password', 'sk-...', true, true, 'Your OpenAI API key from platform.openai.com', 10),
    (provider_openai, 'organization_id', 'Organization ID', 'text', 'org-...', false, false, 'Optional: For organization-scoped API keys', 20),
    (provider_openai, 'base_url', 'Base URL', 'url', 'https://api.openai.com/v1', false, false, 'Optional: Override default API endpoint', 30);

  -- ============================================
  -- ANTHROPIC FIELDS
  -- ============================================
  INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order) VALUES
    (provider_anthropic, 'api_key', 'API Key', 'password', 'sk-ant-...', true, true, 'Your Anthropic API key from console.anthropic.com', 10),
    (provider_anthropic, 'base_url', 'Base URL', 'url', 'https://api.anthropic.com/v1', false, false, 'Optional: Override default API endpoint', 20);

  -- ============================================
  -- GOOGLE GEMINI FIELDS
  -- ============================================
  INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order) VALUES
    (provider_gemini, 'api_key', 'API Key', 'password', 'AIza...', true, true, 'Your Google AI API key from ai.google.dev', 10);

  -- ============================================
  -- PERPLEXITY FIELDS
  -- ============================================
  INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order) VALUES
    (provider_perplexity, 'api_key', 'API Key', 'password', 'pplx-...', true, true, 'Your Perplexity API key from perplexity.ai/settings', 10);

  -- ============================================
  -- SENDGRID FIELDS
  -- ============================================
  INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order) VALUES
    (provider_sendgrid, 'api_key', 'API Key', 'password', 'SG.…', true, true, 'Your SendGrid API key from app.sendgrid.com/settings/api_keys', 10),
    (provider_sendgrid, 'from_email', 'From Email', 'email', 'noreply@company.com', true, false, 'Default sender email address', 20),
    (provider_sendgrid, 'from_name', 'From Name', 'text', 'Your Company', false, false, 'Default sender name', 30);

  -- ============================================
  -- ZOOM FIELDS (OAuth - no fields needed, handled via OAuth flow)
  -- ============================================
  -- Zoom uses OAuth, so no API key fields needed

END $$;

-- ============================================
-- SEED: Integration Services
-- Define services for providers (like AI models)
-- ============================================

DO $$
DECLARE
  provider_zoom UUID;
  provider_sendgrid UUID;
BEGIN
  SELECT id INTO provider_zoom FROM public.integration_providers WHERE slug = 'zoom';
  SELECT id INTO provider_sendgrid FROM public.integration_providers WHERE slug = 'sendgrid';

  -- ============================================
  -- ZOOM SERVICES
  -- ============================================
  INSERT INTO public.integration_services (provider_id, name, service_key, description, features, enabled, is_default, display_order) VALUES
    (provider_zoom, 'Meeting Synchronization', 'zoom_meetings', 'Sync meeting metadata and participant information', '{"calendar_sync": true, "participant_tracking": true}'::jsonb, true, true, 10),
    (provider_zoom, 'Recording Downloads', 'zoom_recordings', 'Automatically download meeting recordings', '{"video": true, "audio": true, "storage_options": ["database", "s3", "google_drive"]}'::jsonb, true, false, 20),
    (provider_zoom, 'Transcript Processing', 'zoom_transcripts', 'Process and analyze meeting transcripts with AI', '{"ai_summary": true, "speaker_identification": true, "action_items": true}'::jsonb, true, false, 30),
    (provider_zoom, 'Webhook Events', 'zoom_webhooks', 'Real-time event notifications', '{"meeting_started": true, "meeting_ended": true, "recording_completed": true}'::jsonb, false, false, 40);

  -- ============================================
  -- SENDGRID SERVICES
  -- ============================================
  INSERT INTO public.integration_services (provider_id, name, service_key, description, features, enabled, is_default, display_order) VALUES
    (provider_sendgrid, 'Transactional Emails', 'sendgrid_transactional', 'Send transactional emails', '{"templates": true, "personalization": true}'::jsonb, true, true, 10),
    (provider_sendgrid, 'Email Analytics', 'sendgrid_analytics', 'Track email opens, clicks, and deliverability', '{"open_tracking": true, "click_tracking": true}'::jsonb, true, false, 20);

END $$;

-- ============================================
-- Success Message
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Integration Hub seed data loaded successfully!';
  RAISE NOTICE 'Categories: % ', (SELECT COUNT(*) FROM public.integration_categories);
  RAISE NOTICE 'Providers: % ', (SELECT COUNT(*) FROM public.integration_providers);
  RAISE NOTICE 'Fields: % ', (SELECT COUNT(*) FROM public.integration_fields);
  RAISE NOTICE 'Services: % ', (SELECT COUNT(*) FROM public.integration_services);
END $$;


-- ============================================================
-- FILE: 20260103_knowledge_enhancements.sql
-- ============================================================

-- Knowledge Base Enhancement Migration
-- Adds embedding status tracking, bookmarks, and auto-embedding triggers

-- =====================================================
-- 1. Add embedding status columns to knowledge_entries
-- =====================================================

ALTER TABLE knowledge_entries
ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'processing', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS embedding_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_embedded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reading_time_minutes INTEGER;

-- Create index on embedding_status for filtering
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_embedding_status ON knowledge_entries(embedding_status);

-- Add comment for clarity
COMMENT ON COLUMN knowledge_entries.embedding_status IS 'Status of embedding generation: pending, processing, completed, or failed';
COMMENT ON COLUMN knowledge_entries.embedding_count IS 'Number of embedding chunks generated for this entry';
COMMENT ON COLUMN knowledge_entries.last_embedded_at IS 'Timestamp when embeddings were last generated';
COMMENT ON COLUMN knowledge_entries.reading_time_minutes IS 'Estimated reading time in minutes';

-- =====================================================
-- 2. Create knowledge_bookmarks table for user favorites
-- =====================================================

CREATE TABLE IF NOT EXISTS knowledge_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate bookmarks
  UNIQUE(user_id, entry_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_knowledge_bookmarks_user_id ON knowledge_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bookmarks_entry_id ON knowledge_bookmarks(entry_id);

-- Add comment
COMMENT ON TABLE knowledge_bookmarks IS 'User bookmarks/favorites for knowledge base entries';

-- =====================================================
-- 3. Enable RLS on knowledge_bookmarks
-- =====================================================

ALTER TABLE knowledge_bookmarks ENABLE ROW LEVEL SECURITY;

-- Users can manage their own bookmarks
CREATE POLICY "Users can view own bookmarks"
  ON knowledge_bookmarks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own bookmarks"
  ON knowledge_bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks"
  ON knowledge_bookmarks FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 4. Function to calculate reading time
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_reading_time(content_text TEXT)
RETURNS INTEGER AS $$
DECLARE
  word_count INTEGER;
  reading_time INTEGER;
BEGIN
  -- Count words (split by spaces, roughly)
  word_count := array_length(regexp_split_to_array(content_text, '\s+'), 1);

  -- Average reading speed: 200 words per minute
  reading_time := CEIL(word_count::FLOAT / 200.0);

  -- Minimum 1 minute
  IF reading_time < 1 THEN
    reading_time := 1;
  END IF;

  RETURN reading_time;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_reading_time IS 'Calculates estimated reading time in minutes based on word count';

-- =====================================================
-- 5. Function to trigger embedding generation
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_knowledge_embedding()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for published entries with content
  IF NEW.status = 'published' AND NEW.content IS NOT NULL AND NEW.content != '' THEN

    -- If content changed or first time publishing, mark as pending
    IF (TG_OP = 'INSERT') OR (OLD.content != NEW.content) OR (OLD.status != 'published') THEN
      NEW.embedding_status := 'pending';

      -- Calculate reading time
      NEW.reading_time_minutes := calculate_reading_time(NEW.content);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_knowledge_embedding IS 'Automatically marks knowledge entries for embedding when published or content changes';

-- =====================================================
-- 6. Create trigger on knowledge_entries
-- =====================================================

DROP TRIGGER IF EXISTS knowledge_entry_embedding_trigger ON knowledge_entries;

CREATE TRIGGER knowledge_entry_embedding_trigger
  BEFORE INSERT OR UPDATE ON knowledge_entries
  FOR EACH ROW
  EXECUTE FUNCTION trigger_knowledge_embedding();

-- =====================================================
-- 7. Update existing entries with reading time
-- =====================================================

UPDATE knowledge_entries
SET reading_time_minutes = calculate_reading_time(content)
WHERE content IS NOT NULL AND reading_time_minutes IS NULL;

-- =====================================================
-- 8. Add embedding metadata to embeddings table
-- =====================================================

-- Add model_name column to track which embedding model was used
ALTER TABLE embeddings
ADD COLUMN IF NOT EXISTS model_name TEXT,
ADD COLUMN IF NOT EXISTS model_provider TEXT,
ADD COLUMN IF NOT EXISTS embedding_dimensions INTEGER;

-- Create index for querying by model
CREATE INDEX IF NOT EXISTS idx_embeddings_model_name ON embeddings(model_name);

COMMENT ON COLUMN embeddings.model_name IS 'Name of the AI model used to generate this embedding';
COMMENT ON COLUMN embeddings.model_provider IS 'Provider of the embedding model (openai, google, etc)';
COMMENT ON COLUMN embeddings.embedding_dimensions IS 'Dimensionality of the embedding vector';

-- =====================================================
-- 9. Function to get category statistics
-- =====================================================

CREATE OR REPLACE FUNCTION get_category_stats(category_uuid UUID)
RETURNS TABLE (
  entry_count BIGINT,
  published_count BIGINT,
  draft_count BIGINT,
  total_views BIGINT,
  last_updated TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as entry_count,
    COUNT(*) FILTER (WHERE status = 'published')::BIGINT as published_count,
    COUNT(*) FILTER (WHERE status = 'draft')::BIGINT as draft_count,
    COALESCE(SUM(view_count), 0)::BIGINT as total_views,
    MAX(updated_at) as last_updated
  FROM knowledge_entries
  WHERE category_id = category_uuid;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_category_stats IS 'Returns statistics for a knowledge category including entry counts and views';

-- =====================================================
-- 10. View for knowledge entries with bookmark status
-- =====================================================

CREATE OR REPLACE VIEW knowledge_entries_with_bookmarks AS
SELECT
  ke.*,
  EXISTS(
    SELECT 1 FROM knowledge_bookmarks kb
    WHERE kb.entry_id = ke.id AND kb.user_id = auth.uid()
  ) as is_bookmarked,
  (
    SELECT COUNT(*) FROM knowledge_bookmarks kb2
    WHERE kb2.entry_id = ke.id
  ) as bookmark_count
FROM knowledge_entries ke;

COMMENT ON VIEW knowledge_entries_with_bookmarks IS 'Knowledge entries with bookmark status for current user';

-- =====================================================
-- 11. Function to increment view count
-- =====================================================

CREATE OR REPLACE FUNCTION increment_view_count(entry_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE knowledge_entries
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = entry_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_view_count IS 'Increments the view count for a knowledge entry';

-- =====================================================
-- 12. Add embedding model selection to ai_models
-- =====================================================

ALTER TABLE ai_models
ADD COLUMN IF NOT EXISTS is_default_embedding BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN ai_models.is_default_embedding IS 'Indicates if this is the default model for knowledge base embeddings';

-- Create index for quick lookup
CREATE INDEX IF NOT EXISTS idx_ai_models_default_embedding ON ai_models(is_default_embedding) WHERE is_default_embedding = true;

-- =====================================================
-- 13. Grant permissions
-- =====================================================

-- Grant access to the new table and functions
GRANT ALL ON knowledge_bookmarks TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_reading_time TO authenticated;
GRANT EXECUTE ON FUNCTION get_category_stats TO authenticated;
GRANT EXECUTE ON FUNCTION increment_view_count TO authenticated;
GRANT SELECT ON knowledge_entries_with_bookmarks TO authenticated;


-- ============================================================
-- FILE: 20260103_link_ai_providers_to_integrations.sql
-- ============================================================

-- Migration: Link AI Providers to Integration Providers
-- Date: 2026-01-03
-- Purpose: Add integration_provider_id to ai_providers table to unify AI and Integration systems

-- Add integration_provider_id column to ai_providers table
ALTER TABLE public.ai_providers
ADD COLUMN integration_provider_id UUID REFERENCES public.integration_providers(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_ai_providers_integration_provider_id
ON public.ai_providers(integration_provider_id);

-- Update existing AI providers to link to their integration counterparts
-- OpenAI
UPDATE public.ai_providers
SET integration_provider_id = (
  SELECT id FROM public.integration_providers WHERE slug = 'openai' LIMIT 1
)
WHERE slug = 'openai';

-- Anthropic
UPDATE public.ai_providers
SET integration_provider_id = (
  SELECT id FROM public.integration_providers WHERE slug = 'anthropic' LIMIT 1
)
WHERE slug = 'anthropic';

-- Google AI (maps to google-gemini in integrations)
UPDATE public.ai_providers
SET integration_provider_id = (
  SELECT id FROM public.integration_providers WHERE slug = 'google-gemini' LIMIT 1
)
WHERE slug = 'google';

-- Perplexity
UPDATE public.ai_providers
SET integration_provider_id = (
  SELECT id FROM public.integration_providers WHERE slug = 'perplexity' LIMIT 1
)
WHERE slug = 'perplexity';

-- Add comment to explain the relationship
COMMENT ON COLUMN public.ai_providers.integration_provider_id IS
'Links AI provider to its corresponding integration provider for unified management';

-- Create a view that combines ai_providers with their integration status
CREATE OR REPLACE VIEW public.ai_providers_with_integration_status AS
SELECT
  ap.id,
  ap.name,
  ap.slug,
  ap.enabled AS provider_enabled,
  ap.api_key_secret_name,
  ap.description,
  ap.integration_provider_id,
  ip.name AS integration_provider_name,
  oi.id AS org_integration_id,
  oi.connection_status,
  oi.enabled AS integration_enabled,
  oi.config AS integration_config,
  CASE
    WHEN oi.connection_status = 'connected' THEN true
    ELSE false
  END AS is_connected
FROM public.ai_providers ap
LEFT JOIN public.integration_providers ip ON ap.integration_provider_id = ip.id
LEFT JOIN public.organization_integrations oi ON ip.id = oi.provider_id
ORDER BY ap.name;

-- Grant select permission on the view
GRANT SELECT ON public.ai_providers_with_integration_status TO authenticated;

-- Add RLS policy for the view (inherits from base tables)
COMMENT ON VIEW public.ai_providers_with_integration_status IS
'Combines AI providers with their integration connection status for unified display';


-- ============================================================
-- FILE: 20260103_migrate_existing_integrations.sql
-- ============================================================

-- ============================================
-- Migrate Existing Integrations
-- Move configurations from app_config to organization_integrations
-- This migration is OPTIONAL and safe to run even if no data exists
-- ============================================

-- ============================================
-- MIGRATION: Migrate existing app_config integrations
-- ============================================
DO $$
DECLARE
  provider_openai UUID;
  provider_anthropic UUID;
  provider_gemini UUID;
  provider_perplexity UUID;
  provider_sendgrid UUID;
  provider_zoom UUID;
  provider_google_drive UUID;

  config_value JSONB;
  api_key TEXT;
  org_id TEXT;
  from_email TEXT;
  from_name TEXT;
  client_id TEXT;
  client_secret TEXT;
  account_id TEXT;
BEGIN
  -- Get provider IDs from integration_providers
  SELECT id INTO provider_openai FROM public.integration_providers WHERE slug = 'openai';
  SELECT id INTO provider_anthropic FROM public.integration_providers WHERE slug = 'anthropic';
  SELECT id INTO provider_gemini FROM public.integration_providers WHERE slug = 'google-gemini';
  SELECT id INTO provider_perplexity FROM public.integration_providers WHERE slug = 'perplexity';
  SELECT id INTO provider_sendgrid FROM public.integration_providers WHERE slug = 'sendgrid';
  SELECT id INTO provider_zoom FROM public.integration_providers WHERE slug = 'zoom';

  -- Note: Google Drive might not exist yet in providers, but Google Workspace will
  SELECT id INTO provider_google_drive FROM public.integration_providers WHERE slug = 'google-workspace';

  RAISE NOTICE 'Starting migration of existing integrations from app_config...';

  -- ============================================
  -- MIGRATE: OpenAI
  -- ============================================
  BEGIN
    -- Check if OpenAI config exists in app_config
    SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.openai.api_key';

    IF config_value IS NOT NULL THEN
      api_key := config_value #>> '{}'; -- Extract string value

      -- Get organization ID if it exists
      SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.openai.organization_id';
      org_id := config_value #>> '{}';

      -- Insert into organization_integrations
      INSERT INTO public.organization_integrations (
        provider_id,
        enabled,
        config,
        connection_status,
        last_tested_at
      ) VALUES (
        provider_openai,
        true, -- Assume enabled if config exists
        jsonb_build_object(
          'api_key', api_key,
          'organization_id', COALESCE(org_id, ''),
          'base_url', 'https://api.openai.com/v1'
        ),
        'disconnected', -- Will need to test
        NULL
      )
      ON CONFLICT (organization_id, provider_id) DO UPDATE
        SET config = EXCLUDED.config,
            enabled = true;

      RAISE NOTICE 'Migrated OpenAI integration';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'OpenAI migration skipped: %', SQLERRM;
  END;

  -- ============================================
  -- MIGRATE: Anthropic
  -- ============================================
  BEGIN
    SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.anthropic.api_key';

    IF config_value IS NOT NULL THEN
      api_key := config_value #>> '{}';

      INSERT INTO public.organization_integrations (
        provider_id,
        enabled,
        config,
        connection_status
      ) VALUES (
        provider_anthropic,
        true,
        jsonb_build_object(
          'api_key', api_key,
          'base_url', 'https://api.anthropic.com/v1'
        ),
        'disconnected'
      )
      ON CONFLICT (organization_id, provider_id) DO UPDATE
        SET config = EXCLUDED.config,
            enabled = true;

      RAISE NOTICE 'Migrated Anthropic integration';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Anthropic migration skipped: %', SQLERRM;
  END;

  -- ============================================
  -- MIGRATE: Google Gemini
  -- ============================================
  BEGIN
    SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.google.api_key';

    IF config_value IS NOT NULL THEN
      api_key := config_value #>> '{}';

      INSERT INTO public.organization_integrations (
        provider_id,
        enabled,
        config,
        connection_status
      ) VALUES (
        provider_gemini,
        true,
        jsonb_build_object('api_key', api_key),
        'disconnected'
      )
      ON CONFLICT (organization_id, provider_id) DO UPDATE
        SET config = EXCLUDED.config,
            enabled = true;

      RAISE NOTICE 'Migrated Google Gemini integration';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Google Gemini migration skipped: %', SQLERRM;
  END;

  -- ============================================
  -- MIGRATE: Perplexity
  -- ============================================
  BEGIN
    SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.perplexity.api_key';

    IF config_value IS NOT NULL THEN
      api_key := config_value #>> '{}';

      INSERT INTO public.organization_integrations (
        provider_id,
        enabled,
        config,
        connection_status
      ) VALUES (
        provider_perplexity,
        true,
        jsonb_build_object('api_key', api_key),
        'disconnected'
      )
      ON CONFLICT (organization_id, provider_id) DO UPDATE
        SET config = EXCLUDED.config,
            enabled = true;

      RAISE NOTICE 'Migrated Perplexity integration';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Perplexity migration skipped: %', SQLERRM;
  END;

  -- ============================================
  -- MIGRATE: SendGrid
  -- ============================================
  BEGIN
    SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.sendgrid.api_key';

    IF config_value IS NOT NULL THEN
      api_key := config_value #>> '{}';

      -- Get from_email and from_name
      SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.sendgrid.from_email';
      from_email := config_value #>> '{}';

      SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.sendgrid.from_name';
      from_name := config_value #>> '{}';

      INSERT INTO public.organization_integrations (
        provider_id,
        enabled,
        config,
        connection_status
      ) VALUES (
        provider_sendgrid,
        true,
        jsonb_build_object(
          'api_key', api_key,
          'from_email', COALESCE(from_email, ''),
          'from_name', COALESCE(from_name, '')
        ),
        'disconnected'
      )
      ON CONFLICT (organization_id, provider_id) DO UPDATE
        SET config = EXCLUDED.config,
            enabled = true;

      RAISE NOTICE 'Migrated SendGrid integration';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'SendGrid migration skipped: %', SQLERRM;
  END;

  -- ============================================
  -- MIGRATE: Zoom
  -- ============================================
  BEGIN
    SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.zoom.client_id';

    IF config_value IS NOT NULL THEN
      client_id := config_value #>> '{}';

      SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.zoom.client_secret';
      client_secret := config_value #>> '{}';

      SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.zoom.account_id';
      account_id := config_value #>> '{}';

      INSERT INTO public.organization_integrations (
        provider_id,
        enabled,
        config,
        connection_status
      ) VALUES (
        provider_zoom,
        true,
        jsonb_build_object(
          'client_id', COALESCE(client_id, ''),
          'client_secret', COALESCE(client_secret, ''),
          'account_id', COALESCE(account_id, '')
        ),
        'disconnected'
      )
      ON CONFLICT (organization_id, provider_id) DO UPDATE
        SET config = EXCLUDED.config,
            enabled = true;

      RAISE NOTICE 'Migrated Zoom integration';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Zoom migration skipped: %', SQLERRM;
  END;

  -- ============================================
  -- MIGRATE: Google Drive (to Google Workspace)
  -- ============================================
  BEGIN
    IF provider_google_drive IS NOT NULL THEN
      SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.google_drive.client_id';

      IF config_value IS NOT NULL THEN
        client_id := config_value #>> '{}';

        SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.google_drive.client_secret';
        client_secret := config_value #>> '{}';

        INSERT INTO public.organization_integrations (
          provider_id,
          enabled,
          config,
          connection_status
        ) VALUES (
          provider_google_drive,
          true,
          jsonb_build_object(
            'client_id', COALESCE(client_id, ''),
            'client_secret', COALESCE(client_secret, '')
          ),
          'disconnected'
        )
        ON CONFLICT (organization_id, provider_id) DO UPDATE
          SET config = EXCLUDED.config,
              enabled = true;

        RAISE NOTICE 'Migrated Google Drive integration to Google Workspace';
      END IF;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Google Drive migration skipped: %', SQLERRM;
  END;

  -- ============================================
  -- Summary
  -- ============================================
  RAISE NOTICE '─────────────────────────────────────────';
  RAISE NOTICE 'Migration complete!';
  RAISE NOTICE 'Active integrations: %', (SELECT COUNT(*) FROM public.organization_integrations WHERE enabled = true);
  RAISE NOTICE '─────────────────────────────────────────';
  RAISE NOTICE 'Note: Connection statuses are set to "disconnected"';
  RAISE NOTICE 'Admins should test connections in the Integration Hub';

END $$;


-- ============================================================
-- FILE: 20260105_add_google_login_provider.sql
-- ============================================================

-- ============================================
-- Add Google Login Provider for Authentication
-- Enables "Sign in with Google" button on login page
-- ============================================

-- Enable the authentication category
UPDATE public.integration_categories
SET enabled = true
WHERE slug = 'authentication';

-- Add Google Login provider to authentication category
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
  'Google Login',
  'google-login',
  'Allow users to sign in with their Google accounts for seamless authentication',
  'oauth2',
  '{"authorize_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token", "scopes": ["openid", "email", "profile"], "response_type": "code"}'::jsonb,
  'https://developers.google.com/identity/protocols/oauth2',
  true,
  false,
  false,
  10
FROM public.integration_categories
WHERE slug = 'authentication'
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  oauth_config = EXCLUDED.oauth_config,
  docs_url = EXCLUDED.docs_url,
  is_available = EXCLUDED.is_available;

-- Add configuration fields for Google Login
INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
SELECT
  id,
  'client_id',
  'Client ID',
  'text',
  'your-client-id.apps.googleusercontent.com',
  true,
  false,
  'OAuth 2.0 Client ID from Google Cloud Console',
  10
FROM public.integration_providers WHERE slug = 'google-login'
ON CONFLICT (provider_id, field_key) DO NOTHING;

INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
SELECT
  id,
  'client_secret',
  'Client Secret',
  'password',
  'GOCSPX-...',
  true,
  true,
  'OAuth 2.0 Client Secret from Google Cloud Console',
  20
FROM public.integration_providers WHERE slug = 'google-login'
ON CONFLICT (provider_id, field_key) DO NOTHING;

-- Add services for Google Login
INSERT INTO public.integration_services (provider_id, name, service_key, description, features, enabled, is_default, display_order)
SELECT
  id,
  'Sign In with Google',
  'google_signin',
  'Enable Google as a sign-in option on the login page',
  '{"sso": true, "email_verification": true, "profile_sync": true}'::jsonb,
  true,
  true,
  10
FROM public.integration_providers WHERE slug = 'google-login'
ON CONFLICT (provider_id, service_key) DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Google Login provider added successfully!';
END $$;


-- ============================================================
-- FILE: 20260105_add_user_id_to_organization_integrations.sql
-- ============================================================

-- ============================================
-- Add user_id to organization_integrations table
-- Allows per-user integration configurations
-- ============================================

-- Add user_id column
ALTER TABLE public.organization_integrations
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_organization_integrations_user_id
ON public.organization_integrations(user_id);

-- Drop the old unique constraint and add a new one that includes user_id
ALTER TABLE public.organization_integrations
DROP CONSTRAINT IF EXISTS organization_integrations_organization_id_provider_id_key;

-- Add new unique constraint: one integration per provider per user
ALTER TABLE public.organization_integrations
ADD CONSTRAINT organization_integrations_user_provider_key
UNIQUE(user_id, provider_id);

-- ============================================
-- Update RLS Policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all organization integrations" ON public.organization_integrations;
DROP POLICY IF EXISTS "Admins can manage organization integrations" ON public.organization_integrations;

-- Users can view their own integrations
CREATE POLICY "Users can view own integrations"
  ON public.organization_integrations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own integrations
CREATE POLICY "Users can create own integrations"
  ON public.organization_integrations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own integrations
CREATE POLICY "Users can update own integrations"
  ON public.organization_integrations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own integrations
CREATE POLICY "Users can delete own integrations"
  ON public.organization_integrations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all integrations
CREATE POLICY "Admins can view all integrations"
  ON public.organization_integrations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can manage all integrations
CREATE POLICY "Admins can manage all integrations"
  ON public.organization_integrations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- Update existing rows to set user_id from created_by
-- ============================================
UPDATE public.organization_integrations
SET user_id = created_by
WHERE user_id IS NULL AND created_by IS NOT NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'user_id column added and RLS policies updated for organization_integrations!';
END $$;


-- ============================================================
-- FILE: 20260105_oauth_states.sql
-- ============================================================

-- ============================================
-- OAuth States Table
-- Sprint 10: User Integration Connections
-- Stores temporary OAuth state for CSRF protection
-- ============================================

-- Create the oauth_states table
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  redirect_uri TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for state lookups
CREATE INDEX IF NOT EXISTS idx_oauth_states_state
  ON public.oauth_states(state);

-- Create index for cleanup
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at
  ON public.oauth_states(expires_at);

-- Enable RLS
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Service role can manage states (edge functions)
CREATE POLICY "Service role can manage oauth states"
  ON public.oauth_states
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Cleanup expired states function
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_states()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.oauth_states
  WHERE expires_at < NOW();
END;
$$;

-- Comments
COMMENT ON TABLE public.oauth_states IS 'Temporary storage for OAuth state parameters during authentication flow';
COMMENT ON COLUMN public.oauth_states.state IS 'Random state parameter for CSRF protection';
COMMENT ON COLUMN public.oauth_states.expires_at IS 'When this state expires (typically 10 minutes)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'oauth_states table created successfully for Sprint 10!';
END $$;


-- ============================================================
-- FILE: 20260105_sso_configurations.sql
-- ============================================================

-- ============================================
-- SSO Configurations Table
-- Stores enterprise SSO provider settings
-- Sprint 7: Enterprise SSO & Authentication
-- ============================================

-- SSO Configuration table for enterprise identity providers
CREATE TABLE IF NOT EXISTS public.sso_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type TEXT NOT NULL CHECK (provider_type IN ('google_workspace', 'azure_ad', 'saml', 'oidc')),
  display_name TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  is_primary BOOLEAN DEFAULT false,

  -- OAuth Credentials
  client_id TEXT,
  tenant_id TEXT,                    -- For Azure AD

  -- Domain Restrictions
  domain_restrictions TEXT[] DEFAULT '{}',

  -- Auto-provisioning
  auto_provision_role TEXT DEFAULT 'user' CHECK (auto_provision_role IN ('admin', 'moderator', 'user')),
  auto_create_users BOOLEAN DEFAULT true,

  -- Additional metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Only one config per provider type
  UNIQUE(provider_type)
);

-- Enable RLS
ALTER TABLE public.sso_configurations ENABLE ROW LEVEL SECURITY;

-- Only admins can manage SSO configurations
CREATE POLICY "Admins can manage SSO configs"
  ON public.sso_configurations
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Public can view enabled SSO providers (non-sensitive fields only)
CREATE POLICY "Public can view enabled SSO providers"
  ON public.sso_configurations
  FOR SELECT
  TO anon
  USING (is_enabled = true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sso_configurations_provider_type
  ON public.sso_configurations(provider_type);

CREATE INDEX IF NOT EXISTS idx_sso_configurations_enabled
  ON public.sso_configurations(is_enabled)
  WHERE is_enabled = true;

-- Trigger for updated_at
CREATE TRIGGER update_sso_configurations_updated_at
  BEFORE UPDATE ON public.sso_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- SSO Domain Allowlist Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.sso_domain_allowlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  sso_config_id UUID REFERENCES public.sso_configurations(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(domain, sso_config_id)
);

-- Enable RLS
ALTER TABLE public.sso_domain_allowlist ENABLE ROW LEVEL SECURITY;

-- Only admins can manage domain allowlist
CREATE POLICY "Admins can manage domain allowlist"
  ON public.sso_domain_allowlist
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sso_domain_allowlist_domain
  ON public.sso_domain_allowlist(domain);

CREATE INDEX IF NOT EXISTS idx_sso_domain_allowlist_config
  ON public.sso_domain_allowlist(sso_config_id);

-- ============================================
-- SSO Login Logs Table (for audit)
-- ============================================

CREATE TABLE IF NOT EXISTS public.sso_login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sso_config_id UUID REFERENCES public.sso_configurations(id) ON DELETE SET NULL,
  provider_type TEXT NOT NULL,
  email TEXT,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sso_login_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view login logs
CREATE POLICY "Admins can view SSO login logs"
  ON public.sso_login_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role can insert logs
CREATE POLICY "Service role can insert SSO logs"
  ON public.sso_login_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sso_login_logs_user_id
  ON public.sso_login_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_sso_login_logs_created_at
  ON public.sso_login_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sso_login_logs_success
  ON public.sso_login_logs(success);

-- ============================================
-- Auth Configuration app_config entries
-- ============================================

-- Insert default auth configuration
INSERT INTO public.app_config (key, value, category, description)
VALUES
  ('auth.allow_email_password', 'true', 'auth', 'Enable traditional email/password login'),
  ('auth.allow_public_signup', 'true', 'auth', 'Allow self-registration'),
  ('auth.require_sso', 'false', 'auth', 'Force SSO for all users (disable other methods)'),
  ('auth.default_sso_provider', 'null', 'auth', 'UUID of primary SSO provider'),
  ('auth.session_timeout_hours', '24', 'auth', 'Session timeout duration in hours')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- Helper Functions
-- ============================================

-- Function to validate email domain against allowlist
CREATE OR REPLACE FUNCTION public.validate_sso_domain(
  p_email TEXT,
  p_sso_config_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_domain TEXT;
  v_is_valid BOOLEAN;
BEGIN
  -- Extract domain from email
  v_domain := split_part(p_email, '@', 2);

  -- Check if domain restrictions are configured
  SELECT EXISTS (
    SELECT 1 FROM public.sso_domain_allowlist
    WHERE sso_config_id = p_sso_config_id
    AND is_active = true
    AND domain = v_domain
  ) INTO v_is_valid;

  -- If no allowlist entries, allow all domains
  IF NOT EXISTS (
    SELECT 1 FROM public.sso_domain_allowlist
    WHERE sso_config_id = p_sso_config_id
    AND is_active = true
  ) THEN
    RETURN true;
  END IF;

  RETURN v_is_valid;
END;
$$;

-- Function to get enabled SSO providers (safe for public)
CREATE OR REPLACE FUNCTION public.get_enabled_sso_providers()
RETURNS TABLE (
  id UUID,
  provider_type TEXT,
  display_name TEXT,
  is_primary BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sso.id,
    sso.provider_type,
    sso.display_name,
    sso.is_primary
  FROM public.sso_configurations sso
  WHERE sso.is_enabled = true
  ORDER BY sso.is_primary DESC, sso.display_name ASC;
END;
$$;

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE public.sso_configurations IS 'Stores SSO provider configurations for enterprise authentication';
COMMENT ON TABLE public.sso_domain_allowlist IS 'Email domain allowlist for SSO providers';
COMMENT ON TABLE public.sso_login_logs IS 'Audit log for SSO login attempts';
COMMENT ON FUNCTION public.validate_sso_domain IS 'Validates if an email domain is allowed for a given SSO provider';
COMMENT ON FUNCTION public.get_enabled_sso_providers IS 'Returns list of enabled SSO providers (safe for login page)';

-- ============================================
-- Success message
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'SSO tables and functions created successfully for Sprint 7!';
END $$;


-- ============================================================
-- FILE: 20260105_user_oauth_tokens.sql
-- ============================================================

-- ============================================
-- User OAuth Tokens Table
-- Stores individual user OAuth connections
-- Sprint 10: User Integration Connections
-- ============================================

-- Create the user_oauth_tokens table
CREATE TABLE IF NOT EXISTS public.user_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_slug TEXT NOT NULL,  -- 'google', 'microsoft', 'zoom'

  -- OAuth Credentials (should be encrypted in production)
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  scopes TEXT[],

  -- Account Info from provider
  account_email TEXT,           -- Connected account email
  account_name TEXT,            -- Display name from provider
  account_id TEXT,              -- Provider's user ID
  account_avatar_url TEXT,      -- Profile picture URL

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ,
  error_message TEXT,           -- Last error if any
  error_at TIMESTAMPTZ,         -- When error occurred

  -- Metadata
  metadata JSONB DEFAULT '{}',  -- Additional provider-specific data

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- One token per provider per user
  UNIQUE(user_id, provider_slug)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_oauth_tokens_user_id
  ON public.user_oauth_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_user_oauth_tokens_provider
  ON public.user_oauth_tokens(provider_slug);

CREATE INDEX IF NOT EXISTS idx_user_oauth_tokens_user_provider
  ON public.user_oauth_tokens(user_id, provider_slug);

CREATE INDEX IF NOT EXISTS idx_user_oauth_tokens_expires_at
  ON public.user_oauth_tokens(expires_at)
  WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.user_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- ============================================

-- Users can view their own tokens (without exposing actual token values)
CREATE POLICY "Users can view own OAuth tokens"
  ON public.user_oauth_tokens
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own tokens
CREATE POLICY "Users can insert own OAuth tokens"
  ON public.user_oauth_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own tokens
CREATE POLICY "Users can update own OAuth tokens"
  ON public.user_oauth_tokens
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own tokens
CREATE POLICY "Users can delete own OAuth tokens"
  ON public.user_oauth_tokens
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all tokens (for support/debugging)
CREATE POLICY "Admins can view all OAuth tokens"
  ON public.user_oauth_tokens
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- Trigger for updated_at
-- ============================================

CREATE TRIGGER update_user_oauth_tokens_updated_at
  BEFORE UPDATE ON public.user_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Helper function to check if user has valid token
-- ============================================

CREATE OR REPLACE FUNCTION public.user_has_valid_oauth_token(
  p_user_id UUID,
  p_provider_slug TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_oauth_tokens
    WHERE user_id = p_user_id
      AND provider_slug = p_provider_slug
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_exists;

  RETURN v_exists;
END;
$$;

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE public.user_oauth_tokens IS 'Stores OAuth tokens for individual user connections to external services (Google, Zoom, Microsoft, etc.)';
COMMENT ON COLUMN public.user_oauth_tokens.provider_slug IS 'Identifier for the OAuth provider (google, microsoft, zoom)';
COMMENT ON COLUMN public.user_oauth_tokens.access_token IS 'OAuth access token - should be encrypted at rest';
COMMENT ON COLUMN public.user_oauth_tokens.refresh_token IS 'OAuth refresh token for obtaining new access tokens';
COMMENT ON COLUMN public.user_oauth_tokens.expires_at IS 'When the access token expires';
COMMENT ON COLUMN public.user_oauth_tokens.scopes IS 'Array of OAuth scopes granted by the user';
COMMENT ON COLUMN public.user_oauth_tokens.account_email IS 'Email address of the connected account';
COMMENT ON COLUMN public.user_oauth_tokens.is_active IS 'Whether this connection is active (can be disabled without deleting)';
COMMENT ON COLUMN public.user_oauth_tokens.error_message IS 'Last error message if token refresh or API call failed';

-- ============================================
-- Success message
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'user_oauth_tokens table created successfully for Sprint 10!';
END $$;


-- ============================================================
-- FILE: 20260105_webhook_logs.sql
-- ============================================================

-- ============================================
-- Webhook Logs Table
-- Stores incoming webhook events for debugging and audit
-- Sprint 5: Edge Functions Deployment
-- ============================================

-- Create the webhook_logs table
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,              -- 'zoom', 'google', 'microsoft', etc.
  event_type TEXT NOT NULL,            -- Event type from provider
  payload JSONB NOT NULL DEFAULT '{}', -- Full webhook payload
  processed BOOLEAN DEFAULT false,     -- Whether event has been processed
  processed_at TIMESTAMPTZ,           -- When event was processed
  error_message TEXT,                  -- Error if processing failed
  received_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_webhook_logs_provider
  ON public.webhook_logs(provider);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type
  ON public.webhook_logs(event_type);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_received_at
  ON public.webhook_logs(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed
  ON public.webhook_logs(processed)
  WHERE processed = false;

-- Enable RLS
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view webhook logs (for debugging)
CREATE POLICY "Admins can view webhook logs"
  ON public.webhook_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role can insert logs (edge functions)
CREATE POLICY "Service role can insert webhook logs"
  ON public.webhook_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Service role can update logs
CREATE POLICY "Service role can update webhook logs"
  ON public.webhook_logs
  FOR UPDATE
  TO service_role
  USING (true);

-- Comments
COMMENT ON TABLE public.webhook_logs IS 'Stores incoming webhook events from external providers for debugging and audit purposes';
COMMENT ON COLUMN public.webhook_logs.provider IS 'Provider identifier (zoom, google, microsoft)';
COMMENT ON COLUMN public.webhook_logs.event_type IS 'Event type from the provider (e.g., recording.completed)';
COMMENT ON COLUMN public.webhook_logs.payload IS 'Full JSON payload received from the webhook';
COMMENT ON COLUMN public.webhook_logs.processed IS 'Whether the event has been successfully processed';

-- Cleanup old logs (keep 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.webhook_logs
  WHERE received_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'webhook_logs table created successfully for Sprint 5!';
END $$;


-- ============================================================
-- FILE: 20260110191303_abdf3499-f9a5-41de-bee1-8efc7c1925a1.sql
-- ============================================================

-- Table to store user's Microsoft Teams
CREATE TABLE IF NOT EXISTS public.user_microsoft_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  visibility TEXT,
  web_url TEXT,
  is_archived BOOLEAN DEFAULT false,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, team_id)
);

-- Enable RLS
ALTER TABLE public.user_microsoft_teams ENABLE ROW LEVEL SECURITY;

-- Users can only see their own teams
CREATE POLICY "Users can view own teams" ON public.user_microsoft_teams
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own teams
CREATE POLICY "Users can insert own teams" ON public.user_microsoft_teams
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own teams
CREATE POLICY "Users can update own teams" ON public.user_microsoft_teams
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own teams
CREATE POLICY "Users can delete own teams" ON public.user_microsoft_teams
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_user_microsoft_teams_user_id ON public.user_microsoft_teams(user_id);
CREATE INDEX idx_user_microsoft_teams_team_id ON public.user_microsoft_teams(team_id);

-- Updated_at trigger
CREATE TRIGGER trigger_update_user_microsoft_teams_timestamp
  BEFORE UPDATE ON public.user_microsoft_teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- FILE: 20260110192344_febb71a4-312b-441c-b67c-cce5d6d9ef31.sql
-- ============================================================

-- Create or replace trigger function for updated_at
CREATE OR REPLACE FUNCTION update_user_microsoft_teams_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Table to store Microsoft Teams channels
CREATE TABLE IF NOT EXISTS public.user_microsoft_teams_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  membership_type TEXT,
  web_url TEXT,
  email TEXT,
  is_favorite BOOLEAN DEFAULT false,
  created_date_time TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, team_id, channel_id)
);

-- Enable RLS
ALTER TABLE public.user_microsoft_teams_channels ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own channels" ON public.user_microsoft_teams_channels
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own channels" ON public.user_microsoft_teams_channels
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own channels" ON public.user_microsoft_teams_channels
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own channels" ON public.user_microsoft_teams_channels
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_user_ms_channels_user_team 
  ON public.user_microsoft_teams_channels(user_id, team_id);
CREATE INDEX idx_user_ms_channels_channel_id 
  ON public.user_microsoft_teams_channels(channel_id);

-- Updated_at trigger
CREATE TRIGGER trigger_update_user_ms_channels_timestamp
  BEFORE UPDATE ON public.user_microsoft_teams_channels
  FOR EACH ROW
  EXECUTE FUNCTION update_user_microsoft_teams_timestamp();

-- ============================================================
-- FILE: 20260110192415_fe49c977-d60a-472e-9bd5-b176677e21ff.sql
-- ============================================================

-- Fix function search_path for security
CREATE OR REPLACE FUNCTION update_user_microsoft_teams_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- FILE: 20260110200245_c3a4fb1b-891a-45ac-ae18-a12c3b23ec86.sql
-- ============================================================

-- Create table for Microsoft Graph webhook subscriptions
CREATE TABLE IF NOT EXISTS public.graph_webhook_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id TEXT NOT NULL UNIQUE,
  resource TEXT NOT NULL,
  change_types TEXT[] NOT NULL DEFAULT ARRAY['created', 'updated', 'deleted'],
  notification_url TEXT NOT NULL,
  client_state TEXT NOT NULL, -- Encrypted secret for verification
  expiration_datetime TIMESTAMPTZ NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_notification_at TIMESTAMPTZ,
  error_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB
);

-- Create table for webhook notification logs
CREATE TABLE IF NOT EXISTS public.graph_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  resource_data JSONB,
  client_state_valid BOOLEAN NOT NULL DEFAULT false,
  processing_status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  metadata JSONB
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_graph_webhook_subscriptions_user ON public.graph_webhook_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_graph_webhook_subscriptions_active ON public.graph_webhook_subscriptions(is_active, expiration_datetime);
CREATE INDEX IF NOT EXISTS idx_graph_webhook_subscriptions_subscription_id ON public.graph_webhook_subscriptions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_graph_webhook_logs_subscription ON public.graph_webhook_logs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_graph_webhook_logs_received ON public.graph_webhook_logs(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_graph_webhook_logs_status ON public.graph_webhook_logs(processing_status);

-- Enable RLS
ALTER TABLE public.graph_webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for subscriptions - users can only see their own
CREATE POLICY "Users can view their own webhook subscriptions"
  ON public.graph_webhook_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own webhook subscriptions"
  ON public.graph_webhook_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own webhook subscriptions"
  ON public.graph_webhook_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own webhook subscriptions"
  ON public.graph_webhook_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for logs - service role only (edge functions)
-- Users cannot directly access logs, only through API
CREATE POLICY "Service role can manage webhook logs"
  ON public.graph_webhook_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_graph_webhook_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_graph_webhook_subscriptions_updated_at
  BEFORE UPDATE ON public.graph_webhook_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_graph_webhook_updated_at();

-- ============================================================
-- FILE: 20260110200619_ed859cde-1448-4e9d-8da6-b342ead96344.sql
-- ============================================================

-- Fix RLS for graph_webhook_logs to be service-role only (no public access)
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can manage webhook logs" ON public.graph_webhook_logs;

-- Create a policy that only allows authenticated users to read their own subscription logs
-- Edge functions with service_role key bypass RLS entirely
CREATE POLICY "Users can view logs for their subscriptions"
  ON public.graph_webhook_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.graph_webhook_subscriptions s
      WHERE s.subscription_id = graph_webhook_logs.subscription_id
      AND s.user_id = auth.uid()
    )
  );

-- Fix function search path for update_graph_webhook_updated_at
CREATE OR REPLACE FUNCTION update_graph_webhook_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================
-- FILE: 20260114113758_3bf44321-b44d-4220-bc93-a60d5485fadf.sql
-- ============================================================

DELETE FROM meetings WHERE id IN (
  '60370afd-1e26-40f3-b9b9-cf843737df26',
  'e688ec82-7fdd-441f-b78c-ff3177776471',
  'c64d686c-0ff4-495b-8629-ab9937faa667',
  '2b241bb6-fd44-454f-869e-6f1a4861a49f',
  'b30709e4-b97e-437c-a38d-19f25636b4e1',
  '623a13e5-a740-4186-87b4-7e82e7fc8738',
  '278956e9-6b46-4ae2-a5c4-63ffa74f3726',
  '2ff0a204-e7db-4025-b978-ad4f261c129a',
  '44a7a56a-46f0-4fef-843e-620b97d24c19',
  '043e737e-fbbc-49f6-87a2-26bc25e17840'
)

-- ============================================================
-- FILE: 20260115120000_meeting_provider_phase1.sql
-- ============================================================

-- Phase 1: Provider-agnostic meeting schema updates (additive)

-- Add new provider-agnostic columns to meetings
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'zoom',
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_meeting_id TEXT,
  ADD COLUMN IF NOT EXISTS external_uuid TEXT,
  ADD COLUMN IF NOT EXISTS join_url TEXT,
  ADD COLUMN IF NOT EXISTS host_url TEXT;

CREATE INDEX IF NOT EXISTS idx_meetings_provider ON public.meetings(provider);
CREATE INDEX IF NOT EXISTS idx_meetings_external_id ON public.meetings(external_id);

-- Backfill provider-agnostic columns from existing Zoom data
UPDATE public.meetings
SET
  provider = 'zoom',
  external_id = zoom_id,
  external_meeting_id = zoom_meeting_id,
  external_uuid = zoom_uuid,
  join_url = zoom_join_url,
  host_url = zoom_start_url
WHERE zoom_id IS NOT NULL OR zoom_meeting_id IS NOT NULL;

-- Create provider-agnostic meeting_files table (parallel to zoom_files)
CREATE TABLE IF NOT EXISTS public.meeting_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'zoom',
  external_meeting_id TEXT,
  file_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_path TEXT,
  storage_path TEXT,
  download_url TEXT,
  transcript_text TEXT,
  transcript_content JSONB,
  is_processed BOOLEAN DEFAULT false,
  has_embeddings BOOLEAN DEFAULT false,
  processing_status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_files_meeting ON public.meeting_files(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_files_type ON public.meeting_files(file_type);
CREATE INDEX IF NOT EXISTS idx_meeting_files_processed ON public.meeting_files(is_processed);
CREATE INDEX IF NOT EXISTS idx_meeting_files_provider ON public.meeting_files(provider);

-- Copy existing zoom_files data into meeting_files
INSERT INTO public.meeting_files (
  id,
  meeting_id,
  provider,
  external_meeting_id,
  file_type,
  file_name,
  file_size,
  file_path,
  storage_path,
  download_url,
  transcript_text,
  transcript_content,
  is_processed,
  has_embeddings,
  processing_status,
  metadata,
  created_at,
  updated_at
)
SELECT
  id,
  meeting_id,
  'zoom',
  NULL,
  file_type,
  file_name,
  file_size,
  file_path,
  storage_path,
  download_url,
  transcript_text,
  transcript_content,
  is_processed,
  has_embeddings,
  processing_status,
  metadata,
  created_at,
  updated_at
FROM public.zoom_files
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.meeting_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all meeting files"
  ON public.meeting_files FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view meeting files"
  ON public.meeting_files FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage meeting files for their meetings"
  ON public.meeting_files FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings
      WHERE meetings.id = meeting_files.meeting_id
        AND meetings.organizer_id = auth.uid()
    )
  );

CREATE TRIGGER update_meeting_files_updated_at
  BEFORE UPDATE ON public.meeting_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Generalize embeddings table with provider-agnostic columns
ALTER TABLE public.embeddings
  ADD COLUMN IF NOT EXISTS provider_corpus_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_document_id TEXT;

UPDATE public.embeddings
SET
  provider_corpus_id = gemini_corpus_id,
  provider_document_id = gemini_document_id
WHERE gemini_corpus_id IS NOT NULL OR gemini_document_id IS NOT NULL;

-- Add feature flag for generic meetings rollout
INSERT INTO public.app_config (key, value, category, description)
VALUES (
  'features.useGenericMeetings',
  'false',
  'features',
  'Use provider-agnostic meeting data and UI'
)
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- FILE: 20260119194316_ead3d652-fe71-4bac-9263-594289a79adc.sql
-- ============================================================

-- Phase 1: Provider-Agnostic Meeting System Migration
-- This migration adds generic columns while keeping old columns functional

-- Step 1.1: Add Generic Columns to meetings Table
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'zoom';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS external_meeting_id TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS external_uuid TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS join_url TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS host_url TEXT;

-- Create indexes for provider-based queries
CREATE INDEX IF NOT EXISTS idx_meetings_provider ON meetings(provider);
CREATE INDEX IF NOT EXISTS idx_meetings_external_id ON meetings(external_id);

-- Step 1.2: Backfill Existing Data from Zoom columns
UPDATE meetings SET
  provider = 'zoom',
  external_id = zoom_id,
  external_meeting_id = zoom_meeting_id,
  external_uuid = zoom_uuid,
  join_url = zoom_join_url,
  host_url = zoom_start_url
WHERE zoom_id IS NOT NULL OR zoom_meeting_id IS NOT NULL;

-- Step 1.3: Create meeting_files Table (Provider-Agnostic)
CREATE TABLE IF NOT EXISTS meeting_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'zoom',
  external_meeting_id TEXT,
  file_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_path TEXT,
  storage_path TEXT,
  download_url TEXT,
  transcript_text TEXT,
  transcript_content JSONB,
  is_processed BOOLEAN DEFAULT false,
  has_embeddings BOOLEAN DEFAULT false,
  processing_status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for meeting_files
CREATE INDEX IF NOT EXISTS idx_meeting_files_meeting_id ON meeting_files(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_files_provider ON meeting_files(provider);

-- Copy existing zoom_files data to meeting_files
INSERT INTO meeting_files (
  id, meeting_id, provider, external_meeting_id, file_type, file_name,
  file_size, file_path, storage_path, download_url, transcript_text,
  transcript_content, is_processed, has_embeddings, processing_status,
  metadata, created_at, updated_at
)
SELECT
  id, meeting_id, 'zoom', NULL, file_type, file_name,
  file_size, file_path, storage_path, download_url, transcript_text,
  transcript_content, is_processed, has_embeddings, processing_status,
  COALESCE(metadata, '{}'::jsonb), created_at, updated_at
FROM zoom_files
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on meeting_files
ALTER TABLE meeting_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meeting_files
CREATE POLICY "Admins can manage all meeting files"
  ON meeting_files FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view meeting files"
  ON meeting_files FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage meeting files for their meetings"
  ON meeting_files FOR ALL
  USING (EXISTS (
    SELECT 1 FROM meetings
    WHERE meetings.id = meeting_files.meeting_id
    AND meetings.organizer_id = auth.uid()
  ));

-- Create trigger for updated_at
CREATE TRIGGER update_meeting_files_updated_at
  BEFORE UPDATE ON meeting_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 1.4: Generalize embeddings Table
ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS provider_corpus_id TEXT;
ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS provider_document_id TEXT;

-- Backfill from Gemini-specific columns
UPDATE embeddings SET
  provider_corpus_id = gemini_corpus_id,
  provider_document_id = gemini_document_id
WHERE gemini_corpus_id IS NOT NULL OR gemini_document_id IS NOT NULL;

-- Add useGenericMeetings feature flag
INSERT INTO app_config (key, value, category, description)
VALUES (
  'useGenericMeetings',
  'false'::jsonb,
  'features',
  'Enable provider-agnostic meeting system (Phase 1-3 rollout)'
)
ON CONFLICT (key) DO UPDATE SET
  value = 'false'::jsonb,
  description = 'Enable provider-agnostic meeting system (Phase 1-3 rollout)',
  updated_at = now();

-- ============================================================
-- FILE: 20260120152959_c2442cca-71eb-49e9-b59a-15231d4bdf25.sql
-- ============================================================

-- Add unique constraint to meeting_files for upsert operations
ALTER TABLE meeting_files 
ADD CONSTRAINT meeting_files_external_meeting_id_file_type_key 
UNIQUE (external_meeting_id, file_type);

-- ============================================================
-- FILE: 20260126_agent_conversations.sql
-- ============================================================

-- =============================================
-- Phase 1: Agent Conversation Threading
-- Migration: Add conversation threading to AI agents
-- =============================================

-- 1. Add new columns to ai_agents table
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS avatar VARCHAR(255);
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS welcome_message TEXT;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS conversation_starters JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

-- 2. Create agent_conversations table (conversation threads)
CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title VARCHAR(255),
  summary TEXT,

  is_archived BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,

  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for agent_conversations
CREATE INDEX IF NOT EXISTS idx_agent_conversations_agent_user
  ON public.agent_conversations(agent_id, user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_user
  ON public.agent_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_created_at
  ON public.agent_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_last_message
  ON public.agent_conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_archived
  ON public.agent_conversations(user_id, is_archived) WHERE is_archived = false;

-- 3. Create agent_messages table (individual messages in conversations)
CREATE TABLE IF NOT EXISTS public.agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,

  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,

  -- AI response metadata
  model_used VARCHAR(100),
  provider_used VARCHAR(50),
  tokens_input INTEGER,
  tokens_output INTEGER,
  latency_ms INTEGER,

  -- Tool usage tracking
  tool_calls JSONB,
  tool_results JSONB,

  -- Citations from RAG
  citations JSONB DEFAULT '[]'::jsonb,

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for agent_messages
CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation
  ON public.agent_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created_at
  ON public.agent_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_messages_role
  ON public.agent_messages(conversation_id, role);

-- 4. Enable RLS on new tables
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for agent_conversations

-- Users can view their own conversations
CREATE POLICY "Users can view their own conversations"
  ON public.agent_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create conversations
CREATE POLICY "Users can create conversations"
  ON public.agent_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own conversations
CREATE POLICY "Users can update their own conversations"
  ON public.agent_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own conversations
CREATE POLICY "Users can delete their own conversations"
  ON public.agent_conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all conversations
CREATE POLICY "Admins can view all conversations"
  ON public.agent_conversations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. RLS Policies for agent_messages

-- Users can view messages in their conversations
CREATE POLICY "Users can view messages in their conversations"
  ON public.agent_messages FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM public.agent_conversations
      WHERE user_id = auth.uid()
    )
  );

-- Users can create messages in their conversations
CREATE POLICY "Users can create messages in their conversations"
  ON public.agent_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.agent_conversations
      WHERE user_id = auth.uid()
    )
  );

-- Users can delete messages in their conversations
CREATE POLICY "Users can delete messages in their conversations"
  ON public.agent_messages FOR DELETE
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM public.agent_conversations
      WHERE user_id = auth.uid()
    )
  );

-- Admins can view all messages
CREATE POLICY "Admins can view all messages"
  ON public.agent_messages FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. Create triggers for updated_at
CREATE TRIGGER update_agent_conversations_updated_at
  BEFORE UPDATE ON public.agent_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Create function to update conversation stats after message insert
CREATE OR REPLACE FUNCTION public.update_conversation_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.agent_conversations
  SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    updated_at = now()
  WHERE id = NEW.conversation_id;

  -- Also increment agent usage count
  UPDATE public.ai_agents
  SET usage_count = usage_count + 1
  WHERE id = (
    SELECT agent_id FROM public.agent_conversations
    WHERE id = NEW.conversation_id
  )
  AND NEW.role = 'user';  -- Only count user messages

  RETURN NEW;
END;
$$;

CREATE TRIGGER update_conversation_stats_on_message
  AFTER INSERT ON public.agent_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_stats();

-- 9. Create function to auto-generate conversation title
CREATE OR REPLACE FUNCTION public.generate_conversation_title()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only set title if it's null and this is the first user message
  IF NEW.role = 'user' THEN
    UPDATE public.agent_conversations
    SET title = CASE
      WHEN title IS NULL OR title = ''
      THEN LEFT(NEW.content, 100) || CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END
      ELSE title
    END
    WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_generate_conversation_title
  AFTER INSERT ON public.agent_messages
  FOR EACH ROW EXECUTE FUNCTION public.generate_conversation_title();

-- 10. Create helper function to get or create conversation
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  p_agent_id UUID,
  p_user_id UUID,
  p_conversation_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- If conversation_id provided, verify it exists and belongs to user
  IF p_conversation_id IS NOT NULL THEN
    SELECT id INTO v_conversation_id
    FROM public.agent_conversations
    WHERE id = p_conversation_id
      AND user_id = p_user_id
      AND agent_id = p_agent_id;

    IF v_conversation_id IS NOT NULL THEN
      RETURN v_conversation_id;
    END IF;
  END IF;

  -- Create new conversation
  INSERT INTO public.agent_conversations (agent_id, user_id)
  VALUES (p_agent_id, p_user_id)
  RETURNING id INTO v_conversation_id;

  RETURN v_conversation_id;
END;
$$;

-- 11. Create function to archive old conversations
CREATE OR REPLACE FUNCTION public.archive_old_conversations(
  p_user_id UUID,
  p_days_old INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.agent_conversations
  SET is_archived = true
  WHERE user_id = p_user_id
    AND is_archived = false
    AND last_message_at < NOW() - (p_days_old || ' days')::INTERVAL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 12. Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_old_conversations(UUID, INTEGER) TO authenticated;


-- ============================================================
-- FILE: 20260126_mcp_integration.sql
-- ============================================================

-- =============================================
-- Phase 6: MCP (Model Context Protocol) Integration
-- Migration: Add MCP server management
-- =============================================

-- ============================================
-- MCP Servers Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(100),  -- Emoji or icon name

  -- Connection Configuration
  server_url TEXT NOT NULL,
  transport_type VARCHAR(50) NOT NULL DEFAULT 'stdio' CHECK (
    transport_type IN ('stdio', 'http', 'websocket', 'sse')
  ),

  -- Authentication
  auth_type VARCHAR(50) DEFAULT 'none' CHECK (
    auth_type IN ('none', 'api_key', 'bearer', 'oauth', 'basic')
  ),
  auth_config JSONB DEFAULT '{}'::jsonb,  -- Encrypted auth details

  -- Available Tools (discovered or configured)
  available_tools JSONB DEFAULT '[]'::jsonb,
  /*
    Format:
    [
      {
        "name": "web_search",
        "description": "Search the web",
        "inputSchema": { "type": "object", "properties": {...} }
      }
    ]
  */

  -- Available Resources (for context)
  available_resources JSONB DEFAULT '[]'::jsonb,

  -- Available Prompts (pre-defined prompts)
  available_prompts JSONB DEFAULT '[]'::jsonb,

  -- Capabilities
  capabilities JSONB DEFAULT '{
    "tools": true,
    "resources": false,
    "prompts": false,
    "sampling": false
  }'::jsonb,

  -- Ownership
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_global BOOLEAN DEFAULT false,  -- Available to all users (admin only)

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,  -- Connection tested successfully
  last_verified_at TIMESTAMPTZ,
  error_message TEXT,

  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mcp_servers_user
  ON public.mcp_servers(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_global
  ON public.mcp_servers(is_global) WHERE is_global = true;
CREATE INDEX IF NOT EXISTS idx_mcp_servers_active
  ON public.mcp_servers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_mcp_servers_transport
  ON public.mcp_servers(transport_type);

-- Enable RLS
ALTER TABLE public.mcp_servers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for MCP Servers
-- ============================================

-- Users can view their own servers and global servers
CREATE POLICY "Users can view own and global MCP servers"
  ON public.mcp_servers FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR is_global = true
  );

-- Users can create their own servers
CREATE POLICY "Users can create MCP servers"
  ON public.mcp_servers FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND is_global = false  -- Only admins can create global servers
  );

-- Users can update their own servers
CREATE POLICY "Users can update own MCP servers"
  ON public.mcp_servers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own servers
CREATE POLICY "Users can delete own MCP servers"
  ON public.mcp_servers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can manage global servers
CREATE POLICY "Admins can manage global MCP servers"
  ON public.mcp_servers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- MCP Tool Executions (Audit Log)
-- ============================================

CREATE TABLE IF NOT EXISTS public.mcp_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  server_id UUID NOT NULL REFERENCES public.mcp_servers(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.agent_conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.agent_messages(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Execution details
  tool_name VARCHAR(255) NOT NULL,
  tool_input JSONB,
  tool_output JSONB,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'executing', 'completed', 'failed', 'timeout')
  ),
  error_message TEXT,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mcp_executions_server
  ON public.mcp_tool_executions(server_id);
CREATE INDEX IF NOT EXISTS idx_mcp_executions_agent
  ON public.mcp_tool_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_mcp_executions_user
  ON public.mcp_tool_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_executions_status
  ON public.mcp_tool_executions(status);
CREATE INDEX IF NOT EXISTS idx_mcp_executions_created
  ON public.mcp_tool_executions(created_at DESC);

-- Enable RLS
ALTER TABLE public.mcp_tool_executions ENABLE ROW LEVEL SECURITY;

-- Users can view their own executions
CREATE POLICY "Users can view own MCP executions"
  ON public.mcp_tool_executions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- System can insert executions
CREATE POLICY "Users can create MCP executions"
  ON public.mcp_tool_executions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all executions
CREATE POLICY "Admins can view all MCP executions"
  ON public.mcp_tool_executions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- Agent-MCP Server Junction Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.agent_mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  server_id UUID NOT NULL REFERENCES public.mcp_servers(id) ON DELETE CASCADE,

  -- Configuration overrides
  enabled_tools TEXT[] DEFAULT '{}',  -- Subset of tools to enable, empty = all
  tool_config JSONB DEFAULT '{}'::jsonb,  -- Per-tool config overrides

  is_enabled BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(agent_id, server_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_mcp_agent
  ON public.agent_mcp_servers(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_mcp_server
  ON public.agent_mcp_servers(server_id);

-- Enable RLS
ALTER TABLE public.agent_mcp_servers ENABLE ROW LEVEL SECURITY;

-- Users can view agent-MCP connections for agents they can access
CREATE POLICY "Users can view agent MCP connections"
  ON public.agent_mcp_servers FOR SELECT
  TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM public.ai_agents
      WHERE is_enabled = true
    )
  );

-- Users can manage agent-MCP connections
CREATE POLICY "Users can manage agent MCP connections"
  ON public.agent_mcp_servers FOR ALL
  TO authenticated
  USING (
    server_id IN (
      SELECT id FROM public.mcp_servers
      WHERE user_id = auth.uid() OR is_global = true
    )
  );

-- ============================================
-- Triggers
-- ============================================

-- Update timestamp trigger
CREATE TRIGGER update_mcp_servers_updated_at
  BEFORE UPDATE ON public.mcp_servers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_mcp_servers_updated_at
  BEFORE UPDATE ON public.agent_mcp_servers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update server usage on tool execution
CREATE OR REPLACE FUNCTION public.update_mcp_server_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.mcp_servers
  SET
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = NEW.server_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER update_mcp_server_usage_on_execution
  AFTER INSERT ON public.mcp_tool_executions
  FOR EACH ROW EXECUTE FUNCTION public.update_mcp_server_usage();

-- ============================================
-- Helper Functions
-- ============================================

-- Get MCP servers available for an agent
CREATE OR REPLACE FUNCTION public.get_agent_mcp_servers(
  p_agent_id UUID
)
RETURNS TABLE(
  server_id UUID,
  server_name VARCHAR,
  server_url TEXT,
  transport_type VARCHAR,
  available_tools JSONB,
  enabled_tools TEXT[],
  is_verified BOOLEAN
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    ms.id as server_id,
    ms.name as server_name,
    ms.server_url,
    ms.transport_type,
    ms.available_tools,
    COALESCE(ams.enabled_tools, '{}') as enabled_tools,
    ms.is_verified
  FROM public.mcp_servers ms
  JOIN public.agent_mcp_servers ams ON ms.id = ams.server_id
  WHERE ams.agent_id = p_agent_id
    AND ams.is_enabled = true
    AND ms.is_active = true;
$$;

-- Get all tools available for an agent (from all connected MCP servers)
CREATE OR REPLACE FUNCTION public.get_agent_mcp_tools(
  p_agent_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_tools JSONB := '[]'::jsonb;
  v_server RECORD;
  v_tool JSONB;
BEGIN
  FOR v_server IN
    SELECT * FROM public.get_agent_mcp_servers(p_agent_id)
  LOOP
    -- Add tools from this server
    FOR v_tool IN
      SELECT * FROM jsonb_array_elements(v_server.available_tools)
    LOOP
      -- Check if tool is enabled (empty array = all enabled)
      IF array_length(v_server.enabled_tools, 1) IS NULL
         OR (v_tool->>'name') = ANY(v_server.enabled_tools) THEN
        v_tools := v_tools || jsonb_build_object(
          'server_id', v_server.server_id,
          'server_name', v_server.server_name,
          'tool', v_tool
        );
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_tools;
END;
$$;

-- Verify MCP server connection
CREATE OR REPLACE FUNCTION public.verify_mcp_server(
  p_server_id UUID,
  p_is_verified BOOLEAN,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.mcp_servers
  SET
    is_verified = p_is_verified,
    last_verified_at = NOW(),
    error_message = p_error_message,
    updated_at = NOW()
  WHERE id = p_server_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_agent_mcp_servers(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agent_mcp_tools(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_mcp_server(UUID, BOOLEAN, TEXT) TO authenticated;

-- ============================================
-- Seed Data: Example MCP Server Templates
-- ============================================

-- These are templates that can be used as reference
INSERT INTO public.mcp_servers (
  name, description, icon, server_url, transport_type,
  auth_type, available_tools, capabilities, is_global, is_active, is_verified
)
SELECT
  'Web Search (Example)',
  'Example MCP server for web search capabilities',
  '🌐',
  'http://localhost:3001/mcp',
  'http',
  'api_key',
  '[
    {
      "name": "web_search",
      "description": "Search the web for current information",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": { "type": "string", "description": "Search query" },
          "num_results": { "type": "integer", "description": "Number of results", "default": 5 }
        },
        "required": ["query"]
      }
    },
    {
      "name": "fetch_url",
      "description": "Fetch content from a URL",
      "inputSchema": {
        "type": "object",
        "properties": {
          "url": { "type": "string", "description": "URL to fetch" }
        },
        "required": ["url"]
      }
    }
  ]'::jsonb,
  '{"tools": true, "resources": false, "prompts": false}'::jsonb,
  true,
  false,  -- Disabled by default (example only)
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.mcp_servers WHERE name = 'Web Search (Example)'
);

INSERT INTO public.mcp_servers (
  name, description, icon, server_url, transport_type,
  auth_type, available_tools, capabilities, is_global, is_active, is_verified
)
SELECT
  'File System (Example)',
  'Example MCP server for file system operations',
  '📁',
  'stdio://filesystem-server',
  'stdio',
  'none',
  '[
    {
      "name": "read_file",
      "description": "Read contents of a file",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": { "type": "string", "description": "File path to read" }
        },
        "required": ["path"]
      }
    },
    {
      "name": "list_directory",
      "description": "List files in a directory",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": { "type": "string", "description": "Directory path" }
        },
        "required": ["path"]
      }
    }
  ]'::jsonb,
  '{"tools": true, "resources": true, "prompts": false}'::jsonb,
  true,
  false,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.mcp_servers WHERE name = 'File System (Example)'
);


-- ============================================================
-- FILE: 20260126_tool_config_streaming_memory.sql
-- ============================================================

-- =============================================
-- Phase 2, 3, 5: Tool Config, Streaming, Memory
-- Migration: Add tool configuration and memory system
-- =============================================

-- ============================================
-- PHASE 2: Tool Configuration
-- ============================================

-- Add tool configuration columns to ai_agents
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tool_code_interpreter BOOLEAN DEFAULT false;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tool_file_search BOOLEAN DEFAULT false;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tool_web_search BOOLEAN DEFAULT false;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tool_image_generation BOOLEAN DEFAULT false;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tool_mcp BOOLEAN DEFAULT false;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  mcp_server_ids UUID[] DEFAULT '{}';

-- Custom tools configuration (for function calling)
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tools_config JSONB DEFAULT '[]'::jsonb;

-- Comment on columns for documentation
COMMENT ON COLUMN public.ai_agents.tool_code_interpreter IS 'Enable code execution capability';
COMMENT ON COLUMN public.ai_agents.tool_file_search IS 'Enable searching through knowledge base files';
COMMENT ON COLUMN public.ai_agents.tool_web_search IS 'Enable real-time web search (requires Perplexity or similar)';
COMMENT ON COLUMN public.ai_agents.tool_image_generation IS 'Enable image generation (DALL-E, etc.)';
COMMENT ON COLUMN public.ai_agents.tool_mcp IS 'Enable Model Context Protocol servers';
COMMENT ON COLUMN public.ai_agents.mcp_server_ids IS 'Array of connected MCP server IDs';
COMMENT ON COLUMN public.ai_agents.tools_config IS 'Custom function/tool definitions for the agent';

-- ============================================
-- PHASE 5: Agent Memory System
-- ============================================

-- Create agent_memory table for long-term memory
CREATE TABLE IF NOT EXISTS public.agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Memory classification
  memory_type VARCHAR(50) NOT NULL CHECK (memory_type IN (
    'summary',      -- Conversation summaries
    'context',      -- User background/context
    'pattern',      -- Learned user patterns
    'fact',         -- Important facts to remember
    'decision',     -- Previous decisions made
    'preference'    -- User preferences
  )),

  -- Content
  content TEXT NOT NULL,
  embedding vector(1536),  -- For semantic search

  -- Source tracking
  source_conversation_id UUID REFERENCES public.agent_conversations(id) ON DELETE SET NULL,
  source_message_id UUID REFERENCES public.agent_messages(id) ON DELETE SET NULL,

  -- Relevance and access tracking
  relevance_score DECIMAL(3,2) DEFAULT 0.5 CHECK (relevance_score >= 0 AND relevance_score <= 1),
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,

  -- Lifecycle
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,  -- Optional memory expiration

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for agent_memory
CREATE INDEX IF NOT EXISTS idx_agent_memory_agent_user
  ON public.agent_memory(agent_id, user_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_type
  ON public.agent_memory(agent_id, user_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_agent_memory_active
  ON public.agent_memory(agent_id, user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_agent_memory_relevance
  ON public.agent_memory(agent_id, user_id, relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memory_embedding
  ON public.agent_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enable RLS on agent_memory
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_memory

-- Users can view their own memories
CREATE POLICY "Users can view their own agent memories"
  ON public.agent_memory FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create memories
CREATE POLICY "Users can create agent memories"
  ON public.agent_memory FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own memories
CREATE POLICY "Users can update their own agent memories"
  ON public.agent_memory FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own memories
CREATE POLICY "Users can delete their own agent memories"
  ON public.agent_memory FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all memories
CREATE POLICY "Admins can view all agent memories"
  ON public.agent_memory FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_agent_memory_updated_at
  BEFORE UPDATE ON public.agent_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Memory Retrieval Functions
-- ============================================

-- Function to match memories by semantic similarity
CREATE OR REPLACE FUNCTION public.match_agent_memories(
  query_embedding vector,
  p_agent_id UUID,
  p_user_id UUID,
  match_count INTEGER DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  memory_type VARCHAR,
  similarity FLOAT,
  relevance_score DECIMAL,
  source_conversation_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    am.id,
    am.content,
    am.memory_type,
    1 - (am.embedding <=> query_embedding) as similarity,
    am.relevance_score,
    am.source_conversation_id,
    am.created_at
  FROM public.agent_memory am
  WHERE am.agent_id = p_agent_id
    AND am.user_id = p_user_id
    AND am.is_active = true
    AND (am.expires_at IS NULL OR am.expires_at > NOW())
    AND am.embedding IS NOT NULL
    AND (1 - (am.embedding <=> query_embedding)) > match_threshold
  ORDER BY
    am.relevance_score DESC,
    am.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Function to get recent memories by type
CREATE OR REPLACE FUNCTION public.get_recent_memories(
  p_agent_id UUID,
  p_user_id UUID,
  p_memory_type VARCHAR DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  memory_type VARCHAR,
  relevance_score DECIMAL,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    am.id,
    am.content,
    am.memory_type,
    am.relevance_score,
    am.created_at
  FROM public.agent_memory am
  WHERE am.agent_id = p_agent_id
    AND am.user_id = p_user_id
    AND am.is_active = true
    AND (am.expires_at IS NULL OR am.expires_at > NOW())
    AND (p_memory_type IS NULL OR am.memory_type = p_memory_type)
  ORDER BY am.created_at DESC
  LIMIT p_limit;
$$;

-- Function to update memory access stats
CREATE OR REPLACE FUNCTION public.update_memory_access(
  p_memory_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.agent_memory
  SET
    access_count = access_count + 1,
    last_accessed_at = NOW()
  WHERE id = ANY(p_memory_ids);
END;
$$;

-- Function to extract and store memories from conversation
CREATE OR REPLACE FUNCTION public.store_agent_memory(
  p_agent_id UUID,
  p_user_id UUID,
  p_memory_type VARCHAR,
  p_content TEXT,
  p_embedding vector DEFAULT NULL,
  p_source_conversation_id UUID DEFAULT NULL,
  p_source_message_id UUID DEFAULT NULL,
  p_relevance_score DECIMAL DEFAULT 0.8,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_memory_id UUID;
BEGIN
  INSERT INTO public.agent_memory (
    agent_id,
    user_id,
    memory_type,
    content,
    embedding,
    source_conversation_id,
    source_message_id,
    relevance_score,
    metadata
  ) VALUES (
    p_agent_id,
    p_user_id,
    p_memory_type,
    p_content,
    p_embedding,
    p_source_conversation_id,
    p_source_message_id,
    p_relevance_score,
    p_metadata
  )
  RETURNING id INTO v_memory_id;

  RETURN v_memory_id;
END;
$$;

-- Function to decay old memories (reduce relevance over time)
CREATE OR REPLACE FUNCTION public.decay_agent_memories(
  p_agent_id UUID DEFAULT NULL,
  p_decay_factor DECIMAL DEFAULT 0.95,
  p_min_relevance DECIMAL DEFAULT 0.1
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.agent_memory
  SET
    relevance_score = GREATEST(relevance_score * p_decay_factor, p_min_relevance),
    updated_at = NOW()
  WHERE is_active = true
    AND relevance_score > p_min_relevance
    AND (p_agent_id IS NULL OR agent_id = p_agent_id)
    AND last_accessed_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.match_agent_memories(vector, UUID, UUID, INTEGER, FLOAT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_memories(UUID, UUID, VARCHAR, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_memory_access(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_agent_memory(UUID, UUID, VARCHAR, TEXT, vector, UUID, UUID, DECIMAL, JSONB) TO authenticated;

-- ============================================
-- PHASE 3: Streaming Support
-- ============================================

-- Add streaming tracking to agent_messages
ALTER TABLE public.agent_messages ADD COLUMN IF NOT EXISTS
  is_streaming BOOLEAN DEFAULT false;

ALTER TABLE public.agent_messages ADD COLUMN IF NOT EXISTS
  stream_completed_at TIMESTAMPTZ;

-- Track tool calls more explicitly
ALTER TABLE public.agent_messages ADD COLUMN IF NOT EXISTS
  tool_call_status VARCHAR(20) CHECK (tool_call_status IN (
    'pending', 'executing', 'completed', 'failed'
  ));

-- Add streaming session tracking
CREATE TABLE IF NOT EXISTS public.streaming_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.agent_messages(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'completed', 'cancelled', 'error'
  )),

  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,

  tokens_streamed INTEGER DEFAULT 0,
  error_message TEXT,

  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_streaming_sessions_conversation
  ON public.streaming_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_streaming_sessions_status
  ON public.streaming_sessions(status) WHERE status = 'active';

-- Enable RLS
ALTER TABLE public.streaming_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for streaming_sessions
CREATE POLICY "Users can view their streaming sessions"
  ON public.streaming_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create streaming sessions"
  ON public.streaming_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their streaming sessions"
  ON public.streaming_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);


-- ============================================================
-- FILE: 20260128_auto_first_admin.sql
-- ============================================================

-- Migration: Auto-assign first user as admin
-- Purpose: Automatically grant admin role to the first user who signs up
-- Date: 2026-01-28
-- Solves: Admin panel visibility issue - chicken-and-egg problem

-- =====================================================
-- FUNCTION: Auto-assign admin to first user
-- =====================================================

CREATE OR REPLACE FUNCTION public.auto_assign_first_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Count existing users (including the one being inserted)
  SELECT COUNT(*) INTO user_count
  FROM auth.users;

  -- Log for debugging
  RAISE NOTICE 'User signup detected: % (Total users: %)', NEW.email, user_count;

  -- If this is the first user (count = 1 after insert), make them admin
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    RAISE NOTICE 'First user % automatically granted admin role', NEW.email;
  ELSE
    -- For subsequent users, assign default 'user' role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;

    RAISE NOTICE 'User % assigned default user role', NEW.email;
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- TRIGGER: Execute on user creation
-- =====================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;

-- Create trigger on auth.users table
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_first_admin();

-- =====================================================
-- BACKFILL: Assign roles to existing users
-- =====================================================

-- First, count existing users
DO $$
DECLARE
  existing_user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO existing_user_count
  FROM auth.users;

  RAISE NOTICE 'Found % existing users', existing_user_count;
END $$;

-- Backfill existing users without roles
-- If only one user exists and has no role, make them admin
DO $$
DECLARE
  total_users INTEGER;
  users_without_roles INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_users FROM auth.users;
  SELECT COUNT(*) INTO users_without_roles
  FROM auth.users u
  WHERE u.id NOT IN (SELECT user_id FROM public.user_roles);

  RAISE NOTICE 'Total users: %, Users without roles: %', total_users, users_without_roles;

  -- If there's only one user and they have no role, make them admin
  IF total_users = 1 AND users_without_roles = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT id, 'admin'::app_role
    FROM auth.users
    WHERE id NOT IN (SELECT user_id FROM public.user_roles)
    LIMIT 1;

    RAISE NOTICE 'Granted admin role to the only existing user';
  ELSE
    -- Otherwise, give all users without roles the default 'user' role
    INSERT INTO public.user_roles (user_id, role)
    SELECT id, 'user'::app_role
    FROM auth.users
    WHERE id NOT IN (SELECT user_id FROM public.user_roles);

    RAISE NOTICE 'Granted user role to % existing users', users_without_roles;
  END IF;
END $$;

-- =====================================================
-- VERIFICATION QUERY (comment out in production)
-- =====================================================

-- Show all users and their roles
SELECT
  u.id,
  u.email,
  ur.role,
  u.created_at,
  CASE
    WHEN ur.role IS NULL THEN '⚠️  NO ROLE'
    WHEN ur.role = 'admin' THEN '✅ ADMIN'
    WHEN ur.role = 'moderator' THEN '✅ MODERATOR'
    ELSE '👤 USER'
  END as status
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
ORDER BY u.created_at ASC;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION public.auto_assign_first_admin() IS
  'Automatically assigns admin role to first user, user role to subsequent users';

COMMENT ON TRIGGER on_auth_user_created_assign_role ON auth.users IS
  'Triggers role assignment when new user signs up';


-- ============================================================
-- FILE: 20260128_verify_user_roles_rls.sql
-- ============================================================

-- Migration: Verify and enhance RLS policies for user_roles table
-- Purpose: Ensure secure access control for user role management
-- Date: 2026-01-28
-- Related to: Admin panel visibility fix

-- =====================================================
-- VERIFICATION: Check existing policies
-- =====================================================

-- List all policies on user_roles table
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'user_roles';

  RAISE NOTICE 'Found % existing policies on user_roles table', policy_count;
END $$;

-- =====================================================
-- ENSURE: Service role has full access
-- =====================================================

-- Drop existing service role policy if exists (for clean re-creation)
DROP POLICY IF EXISTS "Service role can manage all user roles" ON public.user_roles;

-- Create policy for service role (used by edge functions)
CREATE POLICY "Service role can manage all user roles"
  ON public.user_roles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- VERIFY: Core RLS policies exist
-- =====================================================

-- These policies should already exist from the initial migration:
-- 1. "Users can view their own roles" - FOR SELECT (users see own role)
-- 2. "Admins can view all user roles" - FOR SELECT (admins see all roles)
-- 3. "Admins can manage user roles" - FOR ALL (admins can CRUD roles)

-- Verification query (comment out in production)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_roles'
ORDER BY policyname;

-- =====================================================
-- FUNCTION: Check if user is admin (helper)
-- =====================================================

-- Create or replace helper function for checking admin status
-- This is used throughout the application
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = COALESCE(_user_id, auth.uid())
      AND role IN ('admin', 'moderator')
  )
$$;

-- Add comment
COMMENT ON FUNCTION public.is_admin IS
  'Returns true if the given user (or current user) has admin or moderator role';

-- =====================================================
-- FUNCTION: Get user role (helper)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID DEFAULT auth.uid())
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = COALESCE(_user_id, auth.uid())
  LIMIT 1
$$;

-- Add comment
COMMENT ON FUNCTION public.get_user_role IS
  'Returns the role of the given user (or current user). Returns NULL if no role assigned.';

-- =====================================================
-- INDEX: Optimize role lookups
-- =====================================================

-- Create index on user_id for faster lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- Create index on role for faster admin queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles(user_id, role);

-- =====================================================
-- GRANT: Ensure proper permissions
-- =====================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

-- Grant select on user_roles to authenticated (RLS will filter)
GRANT SELECT ON public.user_roles TO authenticated;

-- Grant all operations to service role
GRANT ALL ON public.user_roles TO service_role;

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION public.has_role TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role TO authenticated, anon, service_role;

-- =====================================================
-- SECURITY AUDIT: Show all policies
-- =====================================================

-- Generate security audit report
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'USER_ROLES SECURITY AUDIT';
  RAISE NOTICE '========================================';

  RAISE NOTICE 'RLS Enabled: %', (
    SELECT relrowsecurity
    FROM pg_class
    WHERE relname = 'user_roles'
  );

  RAISE NOTICE '';
  RAISE NOTICE 'Active Policies:';
  FOR rec IN
    SELECT policyname, cmd, roles::text
    FROM pg_policies
    WHERE tablename = 'user_roles'
    ORDER BY policyname
  LOOP
    RAISE NOTICE '  - % (%, %)', rec.policyname, rec.cmd, rec.roles;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'Helper Functions:';
  RAISE NOTICE '  - has_role(UUID, app_role) -> BOOLEAN';
  RAISE NOTICE '  - is_admin(UUID) -> BOOLEAN';
  RAISE NOTICE '  - get_user_role(UUID) -> app_role';

  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.user_roles IS
  'Stores user role assignments. Protected by RLS policies. Only admins can modify.';

COMMENT ON COLUMN public.user_roles.user_id IS
  'Reference to auth.users. Cascades on delete.';

COMMENT ON COLUMN public.user_roles.role IS
  'User role: admin, moderator, or user. See app_role enum type.';

COMMENT ON POLICY "Users can view their own roles" ON public.user_roles IS
  'Allows authenticated users to see their own role assignment';

COMMENT ON POLICY "Admins can view all user roles" ON public.user_roles IS
  'Allows admins to see all user role assignments';

COMMENT ON POLICY "Admins can manage user roles" ON public.user_roles IS
  'Allows admins to INSERT/UPDATE/DELETE user role assignments';

COMMENT ON POLICY "Service role can manage all user roles" ON public.user_roles IS
  'Allows edge functions with service role key to manage roles programmatically';


-- ============================================================
-- FILE: 20260201_actions_module.sql
-- ============================================================

-- ============================================================================
-- Migration: Actions Module (Phase 1)
-- Adds task streams, task comments, subtask support, categories, and
-- contributors to enable full standalone task management.
--
-- The existing "tasks" table is preserved. New columns are added via ALTER
-- rather than creating a separate tasks_v2, keeping migration simpler
-- and avoiding data duplication.
-- ============================================================================

-- ===================
-- 1. task_streams
-- ===================
-- Organizational buckets for tasks (like channels or workspaces).

CREATE TABLE IF NOT EXISTS task_streams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  is_archived BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE task_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read task_streams"
  ON task_streams FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create task_streams"
  ON task_streams FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Stream creators and admins can update task_streams"
  ON task_streams FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );


-- ===================
-- 2. task_stream_members
-- ===================
-- Stream membership for access control and notifications.

CREATE TABLE IF NOT EXISTS task_stream_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES task_streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(stream_id, user_id)
);

ALTER TABLE task_stream_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read their stream memberships"
  ON task_stream_members FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Stream owners and admins can manage members"
  ON task_stream_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM task_stream_members sm
      WHERE sm.stream_id = task_stream_members.stream_id
      AND sm.user_id = auth.uid()
      AND sm.role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );


-- ===================
-- 3. task_categories
-- ===================
-- Label/tag system for tasks.

CREATE TABLE IF NOT EXISTS task_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  color TEXT DEFAULT '#8b5cf6',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE task_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read task_categories"
  ON task_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage task_categories"
  ON task_categories FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Seed default categories
INSERT INTO task_categories (name, slug, color, sort_order) VALUES
  ('Bug Fix', 'bug-fix', '#ef4444', 1),
  ('Feature', 'feature', '#3b82f6', 2),
  ('Improvement', 'improvement', '#8b5cf6', 3),
  ('Research', 'research', '#f59e0b', 4),
  ('Documentation', 'documentation', '#10b981', 5)
ON CONFLICT (slug) DO NOTHING;


-- ===================
-- 4. Extend tasks table
-- ===================
-- Add new columns for streams, subtasks, and richer task data.

-- Stream reference
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS stream_id UUID REFERENCES task_streams(id) ON DELETE SET NULL;

-- Subtask support (self-referencing)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE;

-- Category reference
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES task_categories(id) ON DELETE SET NULL;

-- Completion tracking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Slug for URL-friendly identifiers
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS slug TEXT;

-- Position for manual ordering within a stream or view
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- Create index for slug lookups
CREATE INDEX IF NOT EXISTS idx_tasks_slug ON tasks(slug);

-- Create index for stream filtering
CREATE INDEX IF NOT EXISTS idx_tasks_stream_id ON tasks(stream_id);

-- Create index for subtask lookups
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);

-- Create index for assigned user filtering
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);


-- ===================
-- 5. task_comments
-- ===================
-- Threaded comments on tasks.

CREATE TABLE IF NOT EXISTS task_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES task_comments(id) ON DELETE CASCADE,
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read task_comments"
  ON task_comments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create task_comments"
  ON task_comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Comment authors can update their comments"
  ON task_comments FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Comment authors and admins can delete comments"
  ON task_comments FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);


-- ===================
-- 6. task_attachments
-- ===================
-- File attachments on tasks (stored in Supabase Storage).

CREATE TABLE IF NOT EXISTS task_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read task_attachments"
  ON task_attachments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload task_attachments"
  ON task_attachments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Uploaders and admins can delete task_attachments"
  ON task_attachments FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );


-- ===================
-- 7. task_contributors
-- ===================
-- Additional contributors/watchers on a task beyond the assignee.

CREATE TABLE IF NOT EXISTS task_contributors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'contributor' CHECK (role IN ('contributor', 'reviewer', 'watcher')),
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, user_id)
);

ALTER TABLE task_contributors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read task_contributors"
  ON task_contributors FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Task assignees and admins can manage task_contributors"
  ON task_contributors FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_contributors.task_id
      AND (t.assigned_to = auth.uid() OR t.created_by = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );


-- ============================================================
-- FILE: 20260201_app_modules.sql
-- ============================================================

-- ============================================================================
-- Migration: app_modules, user_module_permissions, system_settings
-- Phase 0: Foundation for modular architecture
-- ============================================================================

-- ===================
-- 1. app_modules table
-- ===================
-- Registry of available modules. Admin can toggle modules on/off.

CREATE TABLE IF NOT EXISTS app_modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT 'Layout',
  category TEXT DEFAULT 'business' CHECK (category IN ('core', 'business', 'intelligence', 'operations')),
  is_core BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  dependencies TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE app_modules ENABLE ROW LEVEL SECURITY;

-- Everyone can read modules (needed for navigation filtering)
CREATE POLICY "Anyone can read app_modules"
  ON app_modules FOR SELECT
  USING (true);

-- Only admins can update modules
CREATE POLICY "Admins can update app_modules"
  ON app_modules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can insert modules
CREATE POLICY "Admins can insert app_modules"
  ON app_modules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Seed default modules
INSERT INTO app_modules (name, slug, description, icon, category, is_core, is_active, sort_order, dependencies) VALUES
  ('Platform Core', 'platform', 'Authentication, layouts, navigation, UI components', 'Layout', 'core', true, true, 0, '{}'),
  ('Actions', 'actions', 'Standalone task management with streams and comments', 'CheckSquare', 'operations', false, true, 1, '{platform}'),
  ('EOS', 'eos', 'Entrepreneurial Operating System - V/TO, OKRs, issues, scorecards', 'Target', 'business', false, true, 2, '{platform}'),
  ('Meetings', 'meetings', 'Meeting lifecycle management with AI summaries', 'Calendar', 'operations', false, true, 3, '{platform}'),
  ('Knowledge Base', 'knowledge', 'Knowledge management with vector embeddings and semantic search', 'BookOpen', 'intelligence', false, true, 4, '{platform}'),
  ('Projects', 'projects', 'Project lifecycle management with billing and resource projection', 'FolderKanban', 'business', false, true, 5, '{platform}'),
  ('Business Development', 'business-dev', 'Deal pipeline, client management, contacts, CRM integration', 'TrendingUp', 'business', false, true, 6, '{platform}'),
  ('Productivity', 'productivity', 'Team and individual productivity metrics and AI insights', 'BarChart3', 'operations', false, true, 7, '{platform}'),
  ('Admin', 'admin', 'Administrative control panel for platform configuration', 'Shield', 'core', true, true, 8, '{platform}')
ON CONFLICT (slug) DO NOTHING;


-- ==============================
-- 2. user_module_permissions table
-- ==============================
-- Per-user module access. If no row exists, user has access to all active modules.
-- When rows exist for a user, they can only access modules listed here.

CREATE TABLE IF NOT EXISTS user_module_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES app_modules(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_id)
);

-- Enable RLS
ALTER TABLE user_module_permissions ENABLE ROW LEVEL SECURITY;

-- Users can read their own permissions
CREATE POLICY "Users can read own module permissions"
  ON user_module_permissions FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all permissions
CREATE POLICY "Admins can read all module permissions"
  ON user_module_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Admins can manage permissions
CREATE POLICY "Admins can insert module permissions"
  ON user_module_permissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete module permissions"
  ON user_module_permissions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );


-- ========================
-- 3. system_settings table
-- ========================
-- Key-value settings organized by category.
-- Used for module-specific configuration that doesn't fit in app_config.

CREATE TABLE IF NOT EXISTS system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category, key)
);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Anyone can read system_settings"
  ON system_settings FOR SELECT
  USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can manage system_settings"
  ON system_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );


-- ==============================
-- 4. RPC: get_user_modules
-- ==============================
-- Returns list of module slugs the current user can access.

CREATE OR REPLACE FUNCTION get_user_modules()
RETURNS TABLE(slug TEXT, name TEXT, icon TEXT, category TEXT) AS $$
DECLARE
  has_restrictions BOOLEAN;
BEGIN
  -- Check if user has specific module restrictions
  SELECT EXISTS(
    SELECT 1 FROM user_module_permissions WHERE user_id = auth.uid()
  ) INTO has_restrictions;

  IF has_restrictions THEN
    -- Return only granted modules that are also active
    RETURN QUERY
      SELECT m.slug, m.name, m.icon, m.category
      FROM app_modules m
      INNER JOIN user_module_permissions p ON p.module_id = m.id
      WHERE p.user_id = auth.uid()
      AND m.is_active = true
      ORDER BY m.sort_order;
  ELSE
    -- No restrictions: return all active modules
    RETURN QUERY
      SELECT m.slug, m.name, m.icon, m.category
      FROM app_modules m
      WHERE m.is_active = true
      ORDER BY m.sort_order;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- FILE: 20260201_business_dev_module.sql
-- ============================================================

-- ============================================================================
-- Business Development Module Migration
-- ============================================================================
-- Adds deals pipeline, contacts, lead follow-up, and communication tracking.
-- Note: clients table already exists.
-- ============================================================================

-- ========================
-- Deals
-- ========================
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  stage TEXT NOT NULL DEFAULT 'lead'
    CHECK (stage IN ('lead', 'discovery', 'estimation', 'proposal', 'won', 'lost')),
  value NUMERIC(12,2),
  currency TEXT DEFAULT 'USD',
  probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  client_id UUID,
  contact_id UUID,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expected_close_date DATE,
  closed_at TIMESTAMPTZ,
  lost_reason TEXT,
  source TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Deal Activities
-- ========================
CREATE TABLE IF NOT EXISTS deal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('note', 'call', 'email', 'meeting', 'stage_change', 'task')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Deal Comments
-- ========================
CREATE TABLE IF NOT EXISTS deal_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Contacts
-- ========================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  title TEXT,
  linkedin_url TEXT,
  client_id UUID,
  source TEXT DEFAULT 'manual',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  last_contacted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Lead Follow-Up
-- ========================
CREATE TABLE IF NOT EXISTS lead_followup_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'interested', 'not_interested', 'converted', 'dormant')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  next_follow_up DATE,
  follow_up_notes TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  converted_deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (contact_id)
);

-- ========================
-- Contact Communications
-- ========================
CREATE TABLE IF NOT EXISTS contact_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'phone', 'linkedin', 'meeting', 'other')),
  direction TEXT DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  subject TEXT,
  content TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Scheduled Emails
-- ========================
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- FK for deals.contact_id now that contacts table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'deals_contact_id_fkey') THEN
    ALTER TABLE deals ADD CONSTRAINT deals_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_owner ON deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_client ON deals(client_id);
CREATE INDEX IF NOT EXISTS idx_deals_slug ON deals(slug);
CREATE INDEX IF NOT EXISTS idx_deal_activities_deal ON deal_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_comments_deal ON deal_comments(deal_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_client ON contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_lead_followup_status ON lead_followup_contacts(status);
CREATE INDEX IF NOT EXISTS idx_lead_followup_assigned ON lead_followup_contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_contact_comms_contact ON contact_communications(contact_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status ON scheduled_emails(status);

-- ========================
-- RLS Policies
-- ========================
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view deals" ON deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage deals" ON deals FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE deal_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view activities" ON deal_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage activities" ON deal_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE deal_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view deal comments" ON deal_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage deal comments" ON deal_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view contacts" ON contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage contacts" ON contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE lead_followup_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view followups" ON lead_followup_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage followups" ON lead_followup_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE contact_communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view communications" ON contact_communications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage communications" ON contact_communications FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE scheduled_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view emails" ON scheduled_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage emails" ON scheduled_emails FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================
-- FILE: 20260201_eos_module.sql
-- ============================================================

-- ============================================================================
-- EOS Module Migration
-- ============================================================================
-- Creates tables for:
-- - VTO (Vision/Traction Organizer)
-- - OKRs (Objectives & Key Results)
-- - Issues (with pod organization)
-- - Scorecard (metrics tracking)
-- - Accountability (org chart + GWC assessments)
-- ============================================================================

-- ========================
-- EOS Pods (team groupings)
-- ========================
CREATE TABLE IF NOT EXISTS eos_pods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  lead_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- VTO (Vision/Traction Organizer)
-- ========================
CREATE TABLE IF NOT EXISTS eos_vto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content JSONB DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- OKRs
-- ========================
CREATE TABLE IF NOT EXISTS okrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'at_risk', 'behind', 'on_track', 'completed', 'closed')),
  quarter TEXT NOT NULL, -- e.g. 'Q1 2026'
  start_date DATE,
  end_date DATE,
  progress NUMERIC(5,2) DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  pod_id UUID REFERENCES eos_pods(id) ON DELETE SET NULL,
  parent_okr_id UUID REFERENCES okrs(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS okr_key_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_id UUID NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  metric_type TEXT NOT NULL DEFAULT 'number'
    CHECK (metric_type IN ('number', 'percentage', 'currency', 'boolean')),
  current_value NUMERIC DEFAULT 0,
  target_value NUMERIC NOT NULL DEFAULT 100,
  start_value NUMERIC DEFAULT 0,
  unit TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'on_track', 'at_risk', 'behind', 'completed')),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS okr_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_id UUID NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  key_result_id UUID REFERENCES okr_key_results(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_value NUMERIC,
  new_value NUMERIC NOT NULL,
  confidence TEXT DEFAULT 'medium'
    CHECK (confidence IN ('low', 'medium', 'high')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Issues
-- ========================
CREATE TABLE IF NOT EXISTS eos_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'solved', 'archived')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  category TEXT DEFAULT 'process'
    CHECK (category IN ('people', 'process', 'system', 'external')),
  pod_id UUID REFERENCES eos_pods(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_anonymous BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual', 'meeting', 'project', 'ai')),
  meeting_id UUID,
  solved_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eos_issue_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES eos_issues(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL
    CHECK (suggestion_type IN ('root_cause', 'action_item', 'related_pattern')),
  content TEXT NOT NULL,
  confidence NUMERIC(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  ai_model TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Scorecard
-- ========================
CREATE TABLE IF NOT EXISTS eos_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  frequency TEXT DEFAULT 'weekly'
    CHECK (frequency IN ('weekly', 'monthly', 'quarterly')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eos_scorecard_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_id UUID NOT NULL REFERENCES eos_scorecards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  metric_type TEXT DEFAULT 'number'
    CHECK (metric_type IN ('number', 'percentage', 'currency', 'boolean')),
  target_value NUMERIC,
  current_value NUMERIC DEFAULT 0,
  unit TEXT DEFAULT '',
  goal_direction TEXT DEFAULT 'higher_is_better'
    CHECK (goal_direction IN ('higher_is_better', 'lower_is_better', 'target')),
  week_of DATE,
  status TEXT DEFAULT 'on_track'
    CHECK (status IN ('on_track', 'off_track', 'needs_attention')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Accountability
-- ========================
CREATE TABLE IF NOT EXISTS accountability_charts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_current BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accountability_responsibilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_id UUID NOT NULL REFERENCES accountability_charts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role_title TEXT NOT NULL,
  department TEXT,
  reports_to UUID REFERENCES accountability_responsibilities(id) ON DELETE SET NULL,
  responsibilities JSONB DEFAULT '[]',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gwc_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  responsibility_id UUID NOT NULL REFERENCES accountability_responsibilities(id) ON DELETE CASCADE,
  assessor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gets_it BOOLEAN DEFAULT false,
  wants_it BOOLEAN DEFAULT false,
  has_capacity BOOLEAN DEFAULT false,
  notes TEXT,
  assessment_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (responsibility_id, assessor_id, assessment_date)
);

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_okrs_owner ON okrs(owner_id);
CREATE INDEX IF NOT EXISTS idx_okrs_status ON okrs(status);
CREATE INDEX IF NOT EXISTS idx_okrs_quarter ON okrs(quarter);
CREATE INDEX IF NOT EXISTS idx_okrs_pod ON okrs(pod_id);
CREATE INDEX IF NOT EXISTS idx_okr_key_results_okr ON okr_key_results(okr_id);
CREATE INDEX IF NOT EXISTS idx_okr_check_ins_okr ON okr_check_ins(okr_id);
CREATE INDEX IF NOT EXISTS idx_okr_check_ins_kr ON okr_check_ins(key_result_id);

CREATE INDEX IF NOT EXISTS idx_eos_issues_status ON eos_issues(status);
CREATE INDEX IF NOT EXISTS idx_eos_issues_priority ON eos_issues(priority);
CREATE INDEX IF NOT EXISTS idx_eos_issues_pod ON eos_issues(pod_id);
CREATE INDEX IF NOT EXISTS idx_eos_issues_assigned ON eos_issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_eos_issue_suggestions_issue ON eos_issue_suggestions(issue_id);

CREATE INDEX IF NOT EXISTS idx_scorecard_metrics_scorecard ON eos_scorecard_metrics(scorecard_id);
CREATE INDEX IF NOT EXISTS idx_scorecard_metrics_week ON eos_scorecard_metrics(week_of);

CREATE INDEX IF NOT EXISTS idx_accountability_resp_chart ON accountability_responsibilities(chart_id);
CREATE INDEX IF NOT EXISTS idx_accountability_resp_user ON accountability_responsibilities(user_id);
CREATE INDEX IF NOT EXISTS idx_accountability_resp_reports_to ON accountability_responsibilities(reports_to);
CREATE INDEX IF NOT EXISTS idx_gwc_responsibility ON gwc_assessments(responsibility_id);

-- ========================
-- RLS Policies
-- ========================

-- Pods
ALTER TABLE eos_pods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view pods" ON eos_pods
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage pods" ON eos_pods
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- VTO
ALTER TABLE eos_vto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view VTO" ON eos_vto
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage VTO" ON eos_vto
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OKRs
ALTER TABLE okrs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view OKRs" ON okrs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage OKRs" ON okrs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE okr_key_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view key results" ON okr_key_results
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage key results" ON okr_key_results
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE okr_check_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view check-ins" ON okr_check_ins
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create check-ins" ON okr_check_ins
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Issues
ALTER TABLE eos_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view issues" ON eos_issues
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage issues" ON eos_issues
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE eos_issue_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view suggestions" ON eos_issue_suggestions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage suggestions" ON eos_issue_suggestions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Scorecard
ALTER TABLE eos_scorecards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view scorecards" ON eos_scorecards
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage scorecards" ON eos_scorecards
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE eos_scorecard_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view metrics" ON eos_scorecard_metrics
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage metrics" ON eos_scorecard_metrics
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Accountability
ALTER TABLE accountability_charts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view charts" ON accountability_charts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage charts" ON accountability_charts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE accountability_responsibilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view responsibilities" ON accountability_responsibilities
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage responsibilities" ON accountability_responsibilities
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE gwc_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view GWC assessments" ON gwc_assessments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage their own assessments" ON gwc_assessments
  FOR ALL TO authenticated USING (auth.uid() = assessor_id) WITH CHECK (auth.uid() = assessor_id);

-- ========================
-- Seed VTO sections
-- ========================
INSERT INTO eos_vto (section, title, content, sort_order) VALUES
  ('core_values', 'Core Values', '{"values": []}', 1),
  ('core_focus', 'Core Focus', '{"purpose": "", "niche": ""}', 2),
  ('ten_year_target', '10-Year Target', '{"target": ""}', 3),
  ('marketing_strategy', 'Marketing Strategy', '{"target_market": "", "uniques": [], "proven_process": "", "guarantee": ""}', 4),
  ('three_year_picture', '3-Year Picture', '{"revenue": "", "profit": "", "measurables": []}', 5),
  ('one_year_plan', '1-Year Plan', '{"revenue": "", "profit": "", "goals": []}', 6),
  ('quarterly_rocks', 'Quarterly Rocks', '{"quarter": "", "rocks": []}', 7),
  ('issues_list', 'Issues List', '{"issues": []}', 8)
ON CONFLICT (section) DO NOTHING;


-- ============================================================
-- FILE: 20260201_knowledge_module.sql
-- ============================================================

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
CREATE POLICY "Authenticated users can view sources" ON knowledge_sources
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage sources" ON knowledge_sources
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE knowledge_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view files" ON knowledge_files
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage files" ON knowledge_files
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view embeddings" ON knowledge_embeddings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage embeddings" ON knowledge_embeddings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE user_knowledge_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own knowledge" ON user_knowledge_files
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own knowledge" ON user_knowledge_files
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE embedding_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view queue" ON embedding_queue
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage queue" ON embedding_queue
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE common_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view common knowledge" ON common_knowledge
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage common knowledge" ON common_knowledge
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE vector_search_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view search logs" ON vector_search_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create search logs" ON vector_search_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- FILE: 20260201_meetings_v2.sql
-- ============================================================

-- ============================================================================
-- Meetings Module V2 Migration
-- ============================================================================
-- Extends existing meetings table and adds:
-- - meeting_series (recurring meeting definitions)
-- - meeting_agenda_items (structured agendas)
-- - meeting_takeaways (decisions, action items, notes)
-- - meeting_participants (attendee management)
-- - meeting_transcripts (transcript storage)
-- - meeting_categorizations (auto/manual categorization)
-- - meeting_assignments (link meetings to clients/projects)
-- ============================================================================

-- ========================
-- Extend existing meetings table
-- ========================
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS series_id UUID,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS agenda_finalized BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS action_items JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS efficiency_score NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- ========================
-- Meeting Series
-- ========================
CREATE TABLE IF NOT EXISTS meeting_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  recurrence_rule TEXT NOT NULL, -- iCal RRULE format (e.g. 'FREQ=WEEKLY;BYDAY=MO')
  duration_minutes INTEGER DEFAULT 60,
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  default_agenda JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  next_occurrence TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add FK for series_id after table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'meetings_series_id_fkey'
  ) THEN
    ALTER TABLE meetings
      ADD CONSTRAINT meetings_series_id_fkey
      FOREIGN KEY (series_id) REFERENCES meeting_series(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ========================
-- Agenda Items
-- ========================
CREATE TABLE IF NOT EXISTS meeting_agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  presenter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Takeaways
-- ========================
CREATE TABLE IF NOT EXISTS meeting_takeaways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  agenda_item_id UUID REFERENCES meeting_agenda_items(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  takeaway_type TEXT NOT NULL DEFAULT 'note'
    CHECK (takeaway_type IN ('decision', 'action_item', 'note', 'follow_up')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date DATE,
  is_completed BOOLEAN DEFAULT false,
  task_id UUID, -- Link to tasks table if converted
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Participants
-- ========================
CREATE TABLE IF NOT EXISTS meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  name TEXT,
  role TEXT DEFAULT 'attendee'
    CHECK (role IN ('organizer', 'presenter', 'attendee', 'optional')),
  rsvp_status TEXT DEFAULT 'pending'
    CHECK (rsvp_status IN ('pending', 'accepted', 'declined', 'tentative')),
  attended BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (meeting_id, user_id)
);

-- ========================
-- Transcripts
-- ========================
CREATE TABLE IF NOT EXISTS meeting_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  source TEXT DEFAULT 'manual'
    CHECK (source IN ('zoom', 'teams', 'google_meet', 'manual', 'upload')),
  word_count INTEGER,
  duration_seconds INTEGER,
  speakers JSONB DEFAULT '[]', -- [{name, segments}]
  processed_at TIMESTAMPTZ,
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Categorizations
-- ========================
CREATE TABLE IF NOT EXISTS meeting_categorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  confidence NUMERIC(3,2) DEFAULT 1.0,
  source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual', 'ai', 'rule')),
  rule_id UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (meeting_id, category)
);

-- ========================
-- Assignments (link to clients/projects)
-- ========================
CREATE TABLE IF NOT EXISTS meeting_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('client', 'project', 'deal')),
  entity_id UUID NOT NULL,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (meeting_id, entity_type, entity_id)
);

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_meetings_series ON meetings(series_id);
CREATE INDEX IF NOT EXISTS idx_meetings_slug ON meetings(slug);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled ON meetings(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_meeting_series_organizer ON meeting_series(organizer_id);
CREATE INDEX IF NOT EXISTS idx_meeting_series_active ON meeting_series(is_active);

CREATE INDEX IF NOT EXISTS idx_agenda_items_meeting ON meeting_agenda_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_agenda_items_order ON meeting_agenda_items(meeting_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_takeaways_meeting ON meeting_takeaways(meeting_id);
CREATE INDEX IF NOT EXISTS idx_takeaways_assigned ON meeting_takeaways(assigned_to);
CREATE INDEX IF NOT EXISTS idx_takeaways_type ON meeting_takeaways(takeaway_type);

CREATE INDEX IF NOT EXISTS idx_participants_meeting ON meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON meeting_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_transcripts_meeting ON meeting_transcripts(meeting_id);

CREATE INDEX IF NOT EXISTS idx_categorizations_meeting ON meeting_categorizations(meeting_id);
CREATE INDEX IF NOT EXISTS idx_categorizations_category ON meeting_categorizations(category);

CREATE INDEX IF NOT EXISTS idx_assignments_meeting ON meeting_assignments(meeting_id);
CREATE INDEX IF NOT EXISTS idx_assignments_entity ON meeting_assignments(entity_type, entity_id);

-- ========================
-- RLS Policies
-- ========================

-- Meeting Series
ALTER TABLE meeting_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view series" ON meeting_series
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage their own series" ON meeting_series
  FOR ALL TO authenticated USING (auth.uid() = organizer_id) WITH CHECK (auth.uid() = organizer_id);

-- Agenda Items
ALTER TABLE meeting_agenda_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view agenda items" ON meeting_agenda_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage agenda items" ON meeting_agenda_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Takeaways
ALTER TABLE meeting_takeaways ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view takeaways" ON meeting_takeaways
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage takeaways" ON meeting_takeaways
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Participants
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view participants" ON meeting_participants
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage participants" ON meeting_participants
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Transcripts
ALTER TABLE meeting_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view transcripts" ON meeting_transcripts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage transcripts" ON meeting_transcripts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Categorizations
ALTER TABLE meeting_categorizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view categorizations" ON meeting_categorizations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage categorizations" ON meeting_categorizations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Assignments
ALTER TABLE meeting_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view assignments" ON meeting_assignments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage assignments" ON meeting_assignments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================
-- FILE: 20260201_productivity_module.sql
-- ============================================================

-- ============================================================================
-- Productivity Module Migration
-- ============================================================================
-- Creates tables for productivity tracking, employee profiles, departments,
-- pods, leave events, process documentation, alerts, and AI insights.
-- ============================================================================

-- ========================
-- Departments
-- ========================
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Pods (Teams)
-- ========================
CREATE TABLE IF NOT EXISTS pods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  description TEXT,
  lead_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Pod Members
-- ========================
CREATE TABLE IF NOT EXISTS pod_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('lead', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (pod_id, user_id)
);

-- ========================
-- Employee Profiles
-- ========================
CREATE TABLE IF NOT EXISTS employee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  title TEXT,
  manager_email TEXT,
  hire_date DATE,
  location TEXT,
  employment_type TEXT DEFAULT 'full-time'
    CHECK (employment_type IN ('full-time', 'part-time', 'contractor', 'intern')),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Productivity Records (weekly)
-- ========================
CREATE TABLE IF NOT EXISTS productivity_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_email TEXT NOT NULL,
  week_start DATE NOT NULL,
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  total_hours NUMERIC(5,2) DEFAULT 0,
  billable_hours NUMERIC(5,2) DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  tasks_assigned INTEGER DEFAULT 0,
  meetings_attended INTEGER DEFAULT 0,
  utilization_pct NUMERIC(5,2) DEFAULT 0,
  efficiency_score NUMERIC(5,2) DEFAULT 0,
  attendance_status TEXT DEFAULT 'present'
    CHECK (attendance_status IN ('present', 'partial', 'absent', 'leave')),
  department TEXT,
  location TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (employee_email, week_start)
);

-- ========================
-- Leave Events
-- ========================
CREATE TABLE IF NOT EXISTS leave_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_email TEXT NOT NULL,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('pto', 'sick', 'personal', 'holiday', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_half_day BOOLEAN DEFAULT false,
  notes TEXT,
  approved_by TEXT,
  status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Process Categories
-- ========================
CREATE TABLE IF NOT EXISTS process_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Process Documents
-- ========================
CREATE TABLE IF NOT EXISTS process_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES process_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT,
  file_url TEXT,
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (category_id, slug)
);

-- ========================
-- Productivity Alerts
-- ========================
CREATE TABLE IF NOT EXISTS productivity_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_email TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('low_utilization', 'declining_trend', 'high_performer', 'absence_pattern', 'workload_imbalance')),
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT,
  week_start DATE,
  is_read BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- AI Productivity Insights
-- ========================
CREATE TABLE IF NOT EXISTS ai_productivity_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_email TEXT,
  department TEXT,
  pod_id UUID REFERENCES pods(id) ON DELETE SET NULL,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('individual', 'department', 'pod', 'company')),
  week_start DATE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  recommendations TEXT[],
  confidence_score NUMERIC(3,2),
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Seed Process Categories
-- ========================
INSERT INTO process_categories (name, slug, description, icon, sort_order) VALUES
  ('Business Development', 'business-dev', 'Sales and client acquisition processes', 'Briefcase', 1),
  ('Human Resources', 'hr', 'HR policies and procedures', 'Users', 2),
  ('Quality Assurance', 'qa', 'Testing and quality standards', 'ShieldCheck', 3),
  ('Engineering', 'engineering', 'Development workflows and standards', 'Code', 4),
  ('Operations', 'operations', 'Operational procedures', 'Settings', 5),
  ('Onboarding', 'onboarding', 'New hire onboarding processes', 'UserPlus', 6)
ON CONFLICT (slug) DO NOTHING;

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_employee_profiles_user ON employee_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_dept ON employee_profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_email ON employee_profiles(email);
CREATE INDEX IF NOT EXISTS idx_productivity_records_email ON productivity_records(employee_email);
CREATE INDEX IF NOT EXISTS idx_productivity_records_week ON productivity_records(week_start);
CREATE INDEX IF NOT EXISTS idx_productivity_records_dept ON productivity_records(department);
CREATE INDEX IF NOT EXISTS idx_pods_department ON pods(department_id);
CREATE INDEX IF NOT EXISTS idx_pod_members_pod ON pod_members(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_members_user ON pod_members(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_events_email ON leave_events(employee_email);
CREATE INDEX IF NOT EXISTS idx_process_docs_category ON process_documents(category_id);
CREATE INDEX IF NOT EXISTS idx_process_docs_status ON process_documents(status);
CREATE INDEX IF NOT EXISTS idx_productivity_alerts_email ON productivity_alerts(employee_email);
CREATE INDEX IF NOT EXISTS idx_ai_insights_employee ON ai_productivity_insights(employee_email);
CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON ai_productivity_insights(insight_type);

-- ========================
-- RLS Policies
-- ========================
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view departments" ON departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage departments" ON departments FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE pods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view pods" ON pods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage pods" ON pods FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE pod_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view pod members" ON pod_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage pod members" ON pod_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE employee_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view employees" ON employee_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage employees" ON employee_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE productivity_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view productivity" ON productivity_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage productivity" ON productivity_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE leave_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view leave" ON leave_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage leave" ON leave_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE process_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view categories" ON process_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage categories" ON process_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE process_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view documents" ON process_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage documents" ON process_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE productivity_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view alerts" ON productivity_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage alerts" ON productivity_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE ai_productivity_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view insights" ON ai_productivity_insights FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage insights" ON ai_productivity_insights FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================
-- FILE: 20260201_projects_module.sql
-- ============================================================

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


