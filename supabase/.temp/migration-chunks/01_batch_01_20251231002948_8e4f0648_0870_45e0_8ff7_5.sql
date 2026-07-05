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

