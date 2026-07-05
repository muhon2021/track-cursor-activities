-- 20241231_app_config.sql
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

-- Only admins can read/write config (idempotent: drop if exists then create)
DROP POLICY IF EXISTS "Admins can manage config" ON public.app_config;
CREATE POLICY "Admins can manage config"
  ON public.app_config
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- All authenticated users can read non-sensitive config
DROP POLICY IF EXISTS "Users can read non-sensitive config" ON public.app_config;
CREATE POLICY "Users can read non-sensitive config"
  ON public.app_config
  FOR SELECT
  TO authenticated
  USING (is_sensitive = false);

-- Trigger for updated_at (idempotent)
DROP TRIGGER IF EXISTS update_app_config_updated_at ON public.app_config;
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


-- 20241231_user_invites.sql
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
DROP POLICY IF EXISTS "Admins can manage invites" ON public.user_invites;
CREATE POLICY "Admins can manage invites"
  ON public.user_invites
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_user_invites_email ON public.user_invites(email);
CREATE INDEX IF NOT EXISTS idx_user_invites_token ON public.user_invites(token);
CREATE INDEX IF NOT EXISTS idx_user_invites_expires_at ON public.user_invites(expires_at);


-- 20241231_user_status.sql
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


-- 20251231002141_f9623780-c91c-47b0-a457-d8e2599893bc.sql
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

-- 20251231002154_5c7d7969-fbe5-42cf-b8ba-3304645c79a4.sql
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

-- 20251231002948_8e4f0648-0870-45e0-8ff7-5933204425c8.sql
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

-- 20251231172609_3aa165f4-5399-48e1-a212-5dc21af21710.sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('2d711b86-45bf-43ae-b216-7eb917668b58', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- 20251231173310_4fca1a9f-564e-4ceb-baa1-7949c233862f.sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('78657387-d518-4b2e-88d8-eca802372ad5', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- 20251231183400_create_match_embeddings_function.sql
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


-- 20251231183500_insert_test_data.sql
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


-- 20251231202732_799e6766-6e4e-439e-b46b-190f8d8ca6d2.sql
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

-- 20251231214712_f2e2729d-d22b-4d89-9aa5-5d5091b1068a.sql
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

-- 20251231214950_d66f401d-349f-411a-b279-d94f27b357dc.sql
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

-- 20260101_activity_logs.sql
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

-- 20260102161850_648cde25-5f4f-457a-a24a-20e25acbf577.sql
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

-- 20260102162554_a2fefe3f-bda1-4849-92f4-1fc66d085077.sql
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

-- 20260102165229_eacdf2c9-d0fa-4630-8f13-ba5a829e6099.sql
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

-- 20260102_seed_additional_features.sql
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


-- 20260103_ai_providers_models.sql
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


-- 20260103_integration_helper_functions.sql
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


