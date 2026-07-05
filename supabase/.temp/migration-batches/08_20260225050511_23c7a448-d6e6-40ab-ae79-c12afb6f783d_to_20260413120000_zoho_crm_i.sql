-- 20260225050511_23c7a448-d6e6-40ab-ae79-c12afb6f783d.sql

-- Seed HubSpot demo data for Sales Hub (all records in one migration)

-- 2 HubSpot Clients
INSERT INTO public.clients (id, name, company, email, phone, status, data_source, external_id, external_url, last_synced_at, created_at, updated_at)
VALUES
  ('a1b2c3d4-1111-4000-8000-000000000001', 'Acme Corp', 'Acme Corporation', 'info@acmecorp.com', '+1-555-100-2000', 'active', 'hubspot', 'hs-company-90210001', 'https://app.hubspot.com/contacts/12345678/company/90210001', now() - interval '2 hours', now() - interval '30 days', now() - interval '2 hours'),
  ('a1b2c3d4-1111-4000-8000-000000000002', 'NovaTech Solutions', 'NovaTech Solutions Inc.', 'hello@novatech.io', '+1-555-300-4000', 'active', 'hubspot', 'hs-company-90210002', 'https://app.hubspot.com/contacts/12345678/company/90210002', now() - interval '45 minutes', now() - interval '14 days', now() - interval '45 minutes')
ON CONFLICT (id) DO NOTHING;

-- 4 HubSpot Contacts
INSERT INTO public.contacts (id, first_name, last_name, email, phone, title, company, client_id, data_source, external_id, external_url, last_synced_at, linkedin_url, source, created_at, updated_at)
VALUES
  ('b2c3d4e5-2222-4000-8000-000000000001', 'Marcus', 'Chen', 'marcus.chen@acmecorp.com', '+1-555-101-0001', 'VP of Engineering', 'Acme Corporation', 'a1b2c3d4-1111-4000-8000-000000000001', 'hubspot', 'hs-contact-80110001', 'https://app.hubspot.com/contacts/12345678/contact/80110001', now() - interval '2 hours', 'https://linkedin.com/in/marcus-chen', 'hubspot', now() - interval '28 days', now() - interval '2 hours'),
  ('b2c3d4e5-2222-4000-8000-000000000002', 'Sarah', 'Winters', 'sarah.winters@acmecorp.com', '+1-555-101-0002', 'Head of Product', 'Acme Corporation', 'a1b2c3d4-1111-4000-8000-000000000001', 'hubspot', 'hs-contact-80110002', 'https://app.hubspot.com/contacts/12345678/contact/80110002', now() - interval '2 hours', 'https://linkedin.com/in/sarah-winters', 'hubspot', now() - interval '21 days', now() - interval '2 hours'),
  ('b2c3d4e5-2222-4000-8000-000000000003', 'Derek', 'Patel', 'derek.patel@novatech.io', '+1-555-301-0001', 'CTO', 'NovaTech Solutions Inc.', 'a1b2c3d4-1111-4000-8000-000000000002', 'hubspot', 'hs-contact-80110003', 'https://app.hubspot.com/contacts/12345678/contact/80110003', now() - interval '45 minutes', 'https://linkedin.com/in/derek-patel', 'hubspot', now() - interval '10 days', now() - interval '45 minutes'),
  ('b2c3d4e5-2222-4000-8000-000000000004', 'Emily', 'Nakamura', 'emily.nakamura@novatech.io', '+1-555-301-0002', 'Director of Operations', 'NovaTech Solutions Inc.', 'a1b2c3d4-1111-4000-8000-000000000002', 'hubspot', 'hs-contact-80110004', 'https://app.hubspot.com/contacts/12345678/contact/80110004', now() - interval '45 minutes', 'https://linkedin.com/in/emily-nakamura', 'hubspot', now() - interval '7 days', now() - interval '45 minutes')
ON CONFLICT (id) DO NOTHING;

-- 3 HubSpot Deals
INSERT INTO public.deals (id, title, slug, stage, value, currency, probability, expected_close_date, description, client_id, contact_id, data_source, external_id, external_url, last_synced_at, source, created_at, updated_at)
VALUES
  ('c3d4e5f6-3333-4000-8000-000000000001', 'Acme — Enterprise Platform License', 'acme-enterprise-platform-license', 'proposal', 120000, 'USD', 60, (now() + interval '45 days')::date, 'Full enterprise platform license for Acme Corp engineering team.', 'a1b2c3d4-1111-4000-8000-000000000001', 'b2c3d4e5-2222-4000-8000-000000000001', 'hubspot', 'hs-deal-70330001', 'https://app.hubspot.com/contacts/12345678/deal/70330001', now() - interval '2 hours', 'hubspot', now() - interval '20 days', now() - interval '2 hours'),
  ('c3d4e5f6-3333-4000-8000-000000000002', 'NovaTech — Pilot Program', 'novatech-pilot-program', 'estimation', 36000, 'USD', 40, (now() + interval '30 days')::date, '3-month pilot program for NovaTech operations team. 25 seats.', 'a1b2c3d4-1111-4000-8000-000000000002', 'b2c3d4e5-2222-4000-8000-000000000003', 'hubspot', 'hs-deal-70330002', 'https://app.hubspot.com/contacts/12345678/deal/70330002', now() - interval '45 minutes', 'hubspot', now() - interval '8 days', now() - interval '45 minutes'),
  ('c3d4e5f6-3333-4000-8000-000000000003', 'Acme — AI Analytics Module', 'acme-ai-analytics-module', 'discovery', 45000, 'USD', 25, (now() + interval '90 days')::date, 'Add-on AI analytics module for Acme Corp.', 'a1b2c3d4-1111-4000-8000-000000000001', 'b2c3d4e5-2222-4000-8000-000000000002', 'hubspot', 'hs-deal-70330003', 'https://app.hubspot.com/contacts/12345678/deal/70330003', now() - interval '2 hours', 'hubspot', now() - interval '5 days', now() - interval '2 hours')
ON CONFLICT (id) DO NOTHING;


-- 20260225_data_source_tracking.sql
-- Migration: 20260225_data_source_tracking.sql
-- User Story 7.1: Add data source tracking to clients, contacts, and deals tables
-- Tracks whether records came from external CRMs (HubSpot, Salesforce, etc.) or were created manually

-- ================================
-- Create data_source enum type
-- ================================
DO $$ BEGIN
  CREATE TYPE data_source_type AS ENUM (
    'manual',
    'hubspot',
    'salesforce',
    'zoho',
    'pipedrive'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ================================
-- clients table: add data source tracking
-- All columns nullable — existing records get NULL
-- ================================
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS data_source data_source_type,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- ================================
-- contacts table: add data source tracking
-- All columns nullable — existing records get NULL
-- Note: contacts already has a legacy `source` TEXT column (unrelated)
-- ================================
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS data_source data_source_type,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- ================================
-- deals table: add data source tracking
-- All columns nullable — existing records get NULL
-- Note: deals already has a legacy `source` TEXT column (unrelated)
-- ================================
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS data_source data_source_type,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- ================================
-- Performance indexes
-- Enables efficient filtering by data_source and last_synced_at
-- ================================

-- clients indexes
CREATE INDEX IF NOT EXISTS idx_clients_data_source ON public.clients(data_source);
CREATE INDEX IF NOT EXISTS idx_clients_last_synced_at ON public.clients(last_synced_at);

-- contacts indexes
CREATE INDEX IF NOT EXISTS idx_contacts_data_source ON public.contacts(data_source);
CREATE INDEX IF NOT EXISTS idx_contacts_last_synced_at ON public.contacts(last_synced_at);

-- deals indexes
CREATE INDEX IF NOT EXISTS idx_deals_data_source ON public.deals(data_source);
CREATE INDEX IF NOT EXISTS idx_deals_last_synced_at ON public.deals(last_synced_at);


-- 20260225_user_dashboard_preferences.sql
-- ============================================================================
-- MIGRATION: User Dashboard Preferences (Personalization)
-- Date: 2026-02-25
-- Purpose: Let users customize which dashboard cards they see + apply filters
-- ============================================================================

-- 1. Create enum for dashboard types
DO $$ BEGIN
  CREATE TYPE dashboard_type AS ENUM ('owner', 'pm', 'ic');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create user_dashboard_preferences table
CREATE TABLE IF NOT EXISTS public.user_dashboard_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dashboard_type dashboard_type NOT NULL,

  -- Widget visibility (which cards are shown)
  widget_slug text NOT NULL,
  is_visible boolean DEFAULT true,
  sort_order integer DEFAULT 0,

  -- Filters (what data the cards show)
  filter_pod_id uuid,
  filter_client_status text,
  filter_project_status text,
  filter_risk_level text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Unique constraint: user can only have one preference per widget per dashboard
  UNIQUE(user_id, dashboard_type, widget_slug)
);

-- 3. Enable RLS
ALTER TABLE public.user_dashboard_preferences ENABLE ROW LEVEL SECURITY;

-- 4. RLS policy: users can only read/write their own preferences
CREATE POLICY "Users manage own dashboard preferences"
  ON public.user_dashboard_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5. Create indexes for performance
CREATE INDEX idx_user_dashboard_prefs_user_id_type
  ON public.user_dashboard_preferences(user_id, dashboard_type);
CREATE INDEX idx_user_dashboard_prefs_pod_filter
  ON public.user_dashboard_preferences(filter_pod_id)
  WHERE filter_pod_id IS NOT NULL;

-- 6. Trigger for updated_at
CREATE TRIGGER update_user_dashboard_preferences_updated_at
  BEFORE UPDATE ON public.user_dashboard_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- 20260226_meeting_intelligence.sql
-- ============================================================================
-- MIGRATION: Meeting Intelligence (Transcripts + Action Items)
-- Date: 2026-02-26
-- Purpose: Add transcript_status and related columns to meetings table
--          to support the Meeting Intelligence MVP (Sprint 9.1-9.2).
-- ============================================================================

-- 1. Add transcript pipeline columns to meetings table
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS transcript_status text DEFAULT 'pending'
    CHECK (transcript_status IN ('pending', 'processing', 'complete', 'failed')),
  ADD COLUMN IF NOT EXISTS transcript_raw jsonb,
  ADD COLUMN IF NOT EXISTS transcript_fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS transcript_error text,
  ADD COLUMN IF NOT EXISTS transcript_processing_started_at timestamptz;

-- 2. Create GIN index for transcript full-text search on transcript_content
--    (transcript_content TEXT column already exists from prior migration)
CREATE INDEX IF NOT EXISTS idx_meetings_transcript_fts
  ON public.meetings
  USING GIN (to_tsvector('english', COALESCE(transcript_content, '')));

-- 3. Create index for transcript status queries
CREATE INDEX IF NOT EXISTS idx_meetings_transcript_status
  ON public.meetings (transcript_status)
  WHERE transcript_status IS NOT NULL AND transcript_status <> 'complete';


-- 20260304071742_dd9b92a3-aac4-414c-866d-78a8a107ef2c.sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('c4642966-5969-4d55-b3a6-ce850c1e2786', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- 20260310094456_02d309ca-d11c-469f-9a22-8ce5a03b4111.sql
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS tool_code_interpreter BOOLEAN DEFAULT false;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS tool_file_search BOOLEAN DEFAULT false;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS tool_web_search BOOLEAN DEFAULT false;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS tool_image_generation BOOLEAN DEFAULT false;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS tool_mcp BOOLEAN DEFAULT false;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS mcp_server_ids UUID[] DEFAULT '{}';
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS tools_config JSONB DEFAULT '[]'::jsonb;

-- 20260310100903_2b827ad1-ee1b-45b6-a9d3-ae6e1e1dcb13.sql
-- Fix RLS policies for agent_conversations and agent_messages.

-- ============================================================
-- agent_conversations
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(500),
  summary TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_agent_user
  ON public.agent_conversations(agent_id, user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_last_message
  ON public.agent_conversations(last_message_at DESC NULLS LAST);

ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Users can view own conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Users can insert own conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Admins can view all conversations" ON public.agent_conversations;

CREATE POLICY "Users can view own conversations"
  ON public.agent_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON public.agent_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON public.agent_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON public.agent_conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all conversations"
  ON public.agent_conversations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- agent_messages
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  content TEXT NOT NULL DEFAULT '',
  model_used VARCHAR(200),
  provider_used VARCHAR(200),
  tokens_input INTEGER,
  tokens_output INTEGER,
  latency_ms INTEGER,
  tool_calls JSONB,
  tool_results JSONB,
  citations JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation
  ON public.agent_messages(conversation_id, created_at);

ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.agent_messages;
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.agent_messages;
DROP POLICY IF EXISTS "Users can create messages in their conversations" ON public.agent_messages;
DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON public.agent_messages;
DROP POLICY IF EXISTS "Users can delete messages in their conversations" ON public.agent_messages;
DROP POLICY IF EXISTS "Users can delete messages in own conversations" ON public.agent_messages;
DROP POLICY IF EXISTS "Admins can view all messages" ON public.agent_messages;

CREATE POLICY "Users can view messages in own conversations"
  ON public.agent_messages FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.agent_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert messages in own conversations"
  ON public.agent_messages FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.agent_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete messages in own conversations"
  ON public.agent_messages FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.agent_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all messages"
  ON public.agent_messages FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Trigger: keep message_count and last_message_at in sync
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_conversation_on_new_message()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.agent_conversations
  SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_conversation_on_message ON public.agent_messages;
CREATE TRIGGER trg_update_conversation_on_message
  AFTER INSERT ON public.agent_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_new_message();

-- 20260310_ai_agents_tool_config_columns.sql
-- Add missing tool configuration columns to ai_agents table.
-- These columns were originally part of 20260126_tool_config_streaming_memory.sql
-- which was not applied to the database.

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

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tools_config JSONB DEFAULT '[]'::jsonb;


-- 20260310_fix_agent_messages_rls.sql
-- Fix RLS policies for agent_conversations and agent_messages.
-- Two older migrations overlap on these tables and can leave the INSERT
-- policies in a broken/missing state. This migration idempotently recreates
-- the tables (if absent) and drops/recreates every policy with safe names.

-- ============================================================
-- agent_conversations
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(500),
  summary TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_agent_user
  ON public.agent_conversations(agent_id, user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_last_message
  ON public.agent_conversations(last_message_at DESC NULLS LAST);

ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;

-- Drop all known variants of the conversation policies before recreating
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Users can view own conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Users can insert own conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Admins can view all conversations" ON public.agent_conversations;

CREATE POLICY "Users can view own conversations"
  ON public.agent_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON public.agent_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON public.agent_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON public.agent_conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all conversations"
  ON public.agent_conversations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- agent_messages
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  content TEXT NOT NULL DEFAULT '',
  model_used VARCHAR(200),
  provider_used VARCHAR(200),
  tokens_input INTEGER,
  tokens_output INTEGER,
  latency_ms INTEGER,
  tool_calls JSONB,
  tool_results JSONB,
  citations JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation
  ON public.agent_messages(conversation_id, created_at);

ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

-- Drop all known variants of the message policies before recreating
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.agent_messages;
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.agent_messages;
DROP POLICY IF EXISTS "Users can create messages in their conversations" ON public.agent_messages;
DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON public.agent_messages;
DROP POLICY IF EXISTS "Users can delete messages in their conversations" ON public.agent_messages;
DROP POLICY IF EXISTS "Users can delete messages in own conversations" ON public.agent_messages;
DROP POLICY IF EXISTS "Admins can view all messages" ON public.agent_messages;

CREATE POLICY "Users can view messages in own conversations"
  ON public.agent_messages FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.agent_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert messages in own conversations"
  ON public.agent_messages FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.agent_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete messages in own conversations"
  ON public.agent_messages FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.agent_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all messages"
  ON public.agent_messages FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Trigger: keep message_count and last_message_at in sync
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_conversation_on_new_message()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.agent_conversations
  SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_conversation_on_message ON public.agent_messages;
CREATE TRIGGER trg_update_conversation_on_message
  AFTER INSERT ON public.agent_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_new_message();


-- 20260312090000_clickup_workamajig_providers.sql
-- Enable ClickUp provider and add Workamajig provider + fields
-- This migration assumes the Integration Hub core schema is already applied.

DO $$
DECLARE
  cat_pm UUID;
  provider_clickup UUID;
  provider_workamajig UUID;
BEGIN
  -- Get Project Management category id
  SELECT id INTO cat_pm
  FROM public.integration_categories
  WHERE slug = 'project-management';

  -- Safety guard
  IF cat_pm IS NULL THEN
    RAISE NOTICE 'Project Management category not found, skipping provider setup';
    RETURN;
  END IF;

  -- Ensure ClickUp provider exists and is enabled (was seeded as coming soon)
  SELECT id INTO provider_clickup
  FROM public.integration_providers
  WHERE slug = 'clickup';

  IF provider_clickup IS NULL THEN
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
      display_order
    )
    VALUES (
      cat_pm,
      'ClickUp',
      'clickup',
      'All-in-one productivity platform',
      'oauth2',
      '{"authorize_url": "https://app.clickup.com/api", "token_url": "https://api.clickup.com/api/v2/oauth/token"}'::jsonb,
      'https://clickup.com/api',
      true,
      false,
      50
    )
    RETURNING id INTO provider_clickup;
  ELSE
    UPDATE public.integration_providers
    SET
      category_id    = COALESCE(category_id, cat_pm),
      auth_type      = 'oauth2',
      oauth_config   = COALESCE(
        oauth_config,
        '{"authorize_url": "https://app.clickup.com/api", "token_url": "https://api.clickup.com/api/v2/oauth/token"}'::jsonb
      ),
      is_available   = true,
      is_coming_soon = false
    WHERE id = provider_clickup;
  END IF;

  -- Ensure Workamajig provider exists (token-based API, not browser OAuth)
  SELECT id INTO provider_workamajig
  FROM public.integration_providers
  WHERE slug = 'workamajig';

  IF provider_workamajig IS NULL THEN
    INSERT INTO public.integration_providers (
      category_id,
      name,
      slug,
      description,
      auth_type,
      docs_url,
      is_available,
      is_coming_soon,
      display_order
    )
    VALUES (
      cat_pm,
      'Workamajig',
      'workamajig',
      'Agency project management and finance platform',
      'api_key',
      'https://support.workamajig.com/hc/en-us/articles/360023007451-API-Overview',
      true,
      false,
      60
    )
    RETURNING id INTO provider_workamajig;
  END IF;

  -- Add ClickUp org-level fields (client_id / client_secret) if missing
  IF provider_clickup IS NOT NULL THEN
    INSERT INTO public.integration_fields (
      provider_id,
      field_key,
      label,
      field_type,
      placeholder,
      is_required,
      is_sensitive,
      help_text,
      display_order
    )
    VALUES
      (
        provider_clickup,
        'client_id',
        'Client ID',
        'text',
        'clk_...',
        true,
        false,
        'ClickUp OAuth app Client ID from your workspace settings',
        10
      )
    ON CONFLICT (provider_id, field_key) DO NOTHING;

    INSERT INTO public.integration_fields (
      provider_id,
      field_key,
      label,
      field_type,
      placeholder,
      is_required,
      is_sensitive,
      help_text,
      display_order
    )
    VALUES
      (
        provider_clickup,
        'client_secret',
        'Client Secret',
        'password',
        '****************',
        true,
        true,
        'ClickUp OAuth app Client Secret (keep this safe)',
        20
      )
    ON CONFLICT (provider_id, field_key) DO NOTHING;
  END IF;

  -- Optional Workamajig org-level defaults for API usage
  IF provider_workamajig IS NOT NULL THEN
    INSERT INTO public.integration_fields (
      provider_id,
      field_key,
      label,
      field_type,
      placeholder,
      is_required,
      is_sensitive,
      help_text,
      display_order
    )
    VALUES
      (
        provider_workamajig,
        'base_url',
        'API Base URL',
        'url',
        'https://your-subdomain.workamajig.com',
        true,
        false,
        'Your Workamajig instance base URL (without /api/beta1).',
        10
      )
    ON CONFLICT (provider_id, field_key) DO NOTHING;

    INSERT INTO public.integration_fields (
      provider_id,
      field_key,
      label,
      field_type,
      placeholder,
      is_required,
      is_sensitive,
      help_text,
      display_order
    )
    VALUES
      (
        provider_workamajig,
        'api_access_token',
        'Company API Access Token',
        'password',
        'APIAccessToken from Workamajig',
        true,
        true,
        'Company API access token from Workamajig API settings (APIAccessToken header).',
        20
      )
    ON CONFLICT (provider_id, field_key) DO NOTHING;

    INSERT INTO public.integration_fields (
      provider_id,
      field_key,
      label,
      field_type,
      placeholder,
      is_required,
      is_sensitive,
      help_text,
      display_order
    )
    VALUES
      (
        provider_workamajig,
        'user_token',
        'User Token',
        'password',
        'UserToken from Workamajig',
        true,
        true,
        'User-specific API user token from Workamajig (UserToken header).',
        30
      )
    ON CONFLICT (provider_id, field_key) DO NOTHING;
  END IF;
END;
$$;



-- 20260312095210_b020fad3-3646-4fed-9065-327f8851a96d.sql

-- Add Project Management category and ClickUp/Workamajig providers

INSERT INTO public.integration_categories (name, slug, description, icon, display_order, enabled)
VALUES ('Project Management', 'project-management', 'Project management and productivity tools', 'FolderKanban', 5, true)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  cat_pm UUID;
  provider_clickup UUID;
  provider_workamajig UUID;
BEGIN
  SELECT id INTO cat_pm FROM public.integration_categories WHERE slug = 'project-management';

  IF cat_pm IS NULL THEN
    RAISE EXCEPTION 'Project Management category not found after insert';
  END IF;

  -- ClickUp provider
  SELECT id INTO provider_clickup FROM public.integration_providers WHERE slug = 'clickup';
  IF provider_clickup IS NULL THEN
    INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, oauth_config, docs_url, is_available, is_coming_soon, display_order)
    VALUES (cat_pm, 'ClickUp', 'clickup', 'All-in-one productivity platform', 'oauth2', '{"authorize_url":"https://app.clickup.com/api","token_url":"https://api.clickup.com/api/v2/oauth/token"}'::jsonb, 'https://clickup.com/api', true, false, 50)
    RETURNING id INTO provider_clickup;
  ELSE
    UPDATE public.integration_providers SET category_id = cat_pm, auth_type = 'oauth2', is_available = true, is_coming_soon = false WHERE id = provider_clickup;
  END IF;

  -- Workamajig provider
  SELECT id INTO provider_workamajig FROM public.integration_providers WHERE slug = 'workamajig';
  IF provider_workamajig IS NULL THEN
    INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, docs_url, is_available, is_coming_soon, display_order)
    VALUES (cat_pm, 'Workamajig', 'workamajig', 'Agency project management and finance platform', 'api_key', 'https://support.workamajig.com/hc/en-us/articles/360023007451-API-Overview', true, false, 60)
    RETURNING id INTO provider_workamajig;
  END IF;

  -- ClickUp fields
  IF provider_clickup IS NOT NULL THEN
    INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
    VALUES (provider_clickup, 'client_id', 'Client ID', 'text', 'clk_...', true, false, 'ClickUp OAuth app Client ID', 10)
    ON CONFLICT (provider_id, field_key) DO NOTHING;
    INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
    VALUES (provider_clickup, 'client_secret', 'Client Secret', 'password', '****************', true, true, 'ClickUp OAuth app Client Secret', 20)
    ON CONFLICT (provider_id, field_key) DO NOTHING;
  END IF;

  -- Workamajig fields
  IF provider_workamajig IS NOT NULL THEN
    INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
    VALUES (provider_workamajig, 'base_url', 'API Base URL', 'url', 'https://your-subdomain.workamajig.com', true, false, 'Your Workamajig instance base URL', 10)
    ON CONFLICT (provider_id, field_key) DO NOTHING;
    INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
    VALUES (provider_workamajig, 'api_access_token', 'Company API Access Token', 'password', 'APIAccessToken from Workamajig', true, true, 'Company API access token (APIAccessToken header)', 20)
    ON CONFLICT (provider_id, field_key) DO NOTHING;
    INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
    VALUES (provider_workamajig, 'user_token', 'User Token', 'password', 'UserToken from Workamajig', true, true, 'User-specific API token (UserToken header)', 30)
    ON CONFLICT (provider_id, field_key) DO NOTHING;
  END IF;
END;
$$;


-- 20260318052542_40a27b66-4593-41af-9e86-1d7502f57aef.sql

INSERT INTO tasks (title, description, status, priority, created_by)
VALUES (
  'Implement 14 Tier 1 AI Agents — Seed into ai_agents table',
  '## Overview

Review **docs/ai-agent-suggestions.md** for the full analysis of 50+ AI agents from the SJ Innovation catalog mapped against this project''s infrastructure.

This task covers the **14 Tier 1 agents** that can be implemented immediately by seeding rows into the `ai_agents` table — no new tables, no new Edge Functions required.

---

## Agents to Implement

| # | Slug | Category | Priority | What It Does |
|---|------|----------|----------|--------------|
| 1 | deal-ai-chat | Sales & CRM | High | Interactive deal strategy chat using deals, contacts, activities data |
| 2 | deal-daily-briefing | Sales & CRM | Medium | Daily summary of pipeline changes, stale deals, upcoming closes |
| 3 | quick-deal-email | Sales & CRM | High | Generate context-aware follow-up emails for deals |
| 4 | lovable-prototype-builder | Sales & CRM | Medium | Generate Lovable prompts for rapid prototyping from deal/project context |
| 5 | client-call-analyzer | Meetings | High | Analyze meeting transcripts for sentiment, action items, risks |
| 6 | client-communication-coach | Meetings | Medium | Coach on communication style based on meeting history |
| 7 | meeting-efficiency-analyzer | Meetings | High | Score meetings on efficiency, suggest improvements |
| 8 | eos-pattern-detective | EOS | Medium | Find recurring patterns in EOS issues across quarters |
| 9 | eos-pod-health | EOS | Medium | Analyze pod health using issues, scorecards, accountability data |
| 10 | eos-quarterly-digest | EOS | High | Generate quarterly EOS performance digest |
| 11 | bug-feature-planner | Project Mgmt | High | Break down bugs/features into actionable tasks with estimates |
| 12 | code-review-generator | Project Mgmt | Medium | Generate code review checklists based on project context |
| 13 | technical-plan-generator | Project Mgmt | High | Create technical implementation plans from requirements |
| 14 | project-analyzer | Project Mgmt | Medium | Analyze project health, risks, timeline adherence |

---

## Implementation Steps

### Step 1: Craft System Prompts
For each agent, write a system prompt that defines the agent''s role, specifies data sources, sets output format, and includes guardrails.

### Step 2: Insert into ai_agents table
Use this SQL pattern:

INSERT INTO ai_agents (name, slug, description, system_prompt, category, is_enabled, welcome_message, conversation_starters, data_sources) VALUES (''Agent Name'', ''agent-slug'', ''Description'', ''System prompt...'', ''category'', true, ''Welcome message'', ''["Starter 1", "Starter 2"]''::jsonb, ''["table1", "table2"]''::jsonb);

### Step 3: Test via AI Hub
1. Navigate to AI Hub
2. Verify each agent appears
3. Test with sample prompts
4. Iterate on system prompts

---

## Acceptance Criteria
- All 14 agents seeded into ai_agents table
- Each agent has a well-crafted system prompt
- Each agent has conversation starters configured
- Each agent has appropriate data_sources JSON
- All agents visible and runnable in AI Hub
- High-priority agents tested with at least 3 sample prompts each

## Reference
- Full analysis: docs/ai-agent-suggestions.md
- Existing agents: SELECT slug, name FROM ai_agents ORDER BY category;
- Edge function: run-ai-agent (generic agent runner)',
  'todo',
  'high',
  (SELECT id FROM profiles LIMIT 1)
);


-- 20260318060800_83c09a2e-9df3-43ca-a833-6230b68fafa9.sql

-- Seed demo data: assign projects and tasks to PM and IC test accounts
DO $$
DECLARE
  u_pm UUID := (SELECT id FROM auth.users WHERE email = 'demo@collabai.software' LIMIT 1);
  u_ic UUID := (SELECT id FROM auth.users WHERE email = 'ic@collabai.software'   LIMIT 1);
  p_techstart UUID := (SELECT id FROM projects WHERE slug = 'techstart-ai-integration' LIMIT 1);
  p_qbr      UUID := (SELECT id FROM projects WHERE slug = 'enterprise-qbr-prep'      LIMIT 1);
  p_acme     UUID := (SELECT id FROM projects WHERE slug = 'acme-platform-rollout'     LIMIT 1);
BEGIN
  IF u_pm IS NULL OR u_ic IS NULL THEN
    RAISE NOTICE 'PM or IC user not found — skipping demo data seed.';
    RETURN;
  END IF;

  -- Assign PM as owner of 2 projects
  UPDATE projects SET owner_id = u_pm WHERE id IN (p_techstart, p_qbr);

  INSERT INTO project_members (project_id, user_id, role) VALUES
    (p_techstart, u_pm, 'owner'),
    (p_qbr,      u_pm, 'owner')
  ON CONFLICT DO NOTHING;

  -- Assign IC as member on 2 projects
  INSERT INTO project_members (project_id, user_id, role) VALUES
    (p_acme,      u_ic, 'member'),
    (p_techstart, u_ic, 'member')
  ON CONFLICT DO NOTHING;

  -- Reassign tasks to PM
  UPDATE tasks SET assigned_to = u_pm
  WHERE slug IN (
    'implement-sso-entra', 'onboard-acme-corp', 'techstart-training',
    'qbr-enterprise-solutions', 'setup-monitoring-alerts', 'csv-export-productivity'
  );

  -- Reassign tasks to IC
  UPDATE tasks SET assigned_to = u_ic
  WHERE slug IN (
    'fix-datepicker-tz', 'api-rate-limit-docs', 'upgrade-react-router-v7',
    'acme-billing-fix', 'renew-ssl-certs', 'followup-finedge'
  );
END $$;


-- 20260318065539_refresh_demo_data_function.sql
-- ============================================================
-- Migration: refresh_demo_data() function
-- Fixes: owner_dashboard_metrics view slug (in_progress → in-progress)
-- Creates: refresh_demo_data() SECURITY DEFINER function
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Fix the owner_dashboard_metrics view — slug was 'in_progress'
--    but actual project_statuses slug is 'in-progress' (hyphenated)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.owner_dashboard_metrics AS
SELECT
  -- Revenue: sum of deal values closed in the last 7 days
  (
    SELECT COALESCE(SUM(value), 0)::numeric
    FROM public.deals
    WHERE closed_at >= now() - interval '7 days'
  ) AS revenue_this_week,

  -- Team utilization: average across current week's records
  (
    SELECT COALESCE(ROUND(AVG(utilization_pct)::numeric, 1), 0)
    FROM public.productivity_records
    WHERE week_start = date_trunc('week', now())::date
  ) AS team_utilization,

  -- Projects in progress (not archived) — FIXED: 'in-progress' not 'in_progress'
  (
    SELECT COUNT(*)
    FROM public.projects p
    JOIN public.project_statuses ps ON ps.id = p.status_id
    WHERE p.is_archived = false
      AND ps.slug = 'in-progress'
  ) AS projects_in_progress,

  -- At-risk projects
  (
    SELECT COUNT(*)
    FROM public.projects
    WHERE is_at_risk = true
      AND is_archived = false
  ) AS projects_at_risk,

  -- Active clients
  (
    SELECT COUNT(*)
    FROM public.clients
    WHERE status = 'active'
  ) AS active_clients,

  -- Active team members
  (
    SELECT COUNT(*)
    FROM public.profiles
    WHERE is_active = true
  ) AS active_team_members,

  now() AS generated_at;


-- ─────────────────────────────────────────────────────────────
-- 2. refresh_demo_data() — idempotent function that inserts
--    relative-date demo data so dashboards always show content.
--    Tagged rows are cleaned up and re-inserted each call.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_demo_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_client_id UUID;
  v_in_progress_status UUID;
  v_today DATE := CURRENT_DATE;
  v_week_start DATE := date_trunc('week', now())::date;
  v_result jsonb := '{}'::jsonb;
BEGIN
  -- ── Resolve owner user (first admin, or first user) ──
  SELECT ur.user_id INTO v_owner_id
  FROM user_roles ur
  WHERE ur.role = 'admin'
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    SELECT id INTO v_owner_id FROM auth.users LIMIT 1;
  END IF;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No users found in auth.users');
  END IF;

  -- ── Resolve first active client ──
  SELECT id INTO v_client_id FROM clients WHERE status = 'active' LIMIT 1;

  -- ── Resolve 'in-progress' status id ──
  SELECT id INTO v_in_progress_status FROM project_statuses WHERE slug = 'in-progress' LIMIT 1;

  -- ═══════════════════════════════════════════════════════
  -- A. DEALS — delete old demo-refresh deals, insert 2 new
  -- ═══════════════════════════════════════════════════════
  DELETE FROM deals WHERE data_source = 'demo_refresh';

  INSERT INTO deals (title, slug, stage, value, currency, probability, closed_at, client_id, owner_id, data_source, created_by)
  VALUES
    (
      'Enterprise Platform License',
      'demo-refresh-deal-1-' || to_char(v_today, 'YYYYMMDD'),
      'won', 35000.00, 'USD', 100,
      (now() - interval '2 days'),
      v_client_id, v_owner_id, 'demo_refresh', v_owner_id
    ),
    (
      'Professional Services Engagement',
      'demo-refresh-deal-2-' || to_char(v_today, 'YYYYMMDD'),
      'won', 25000.00, 'USD', 100,
      (now() - interval '4 days'),
      v_client_id, v_owner_id, 'demo_refresh', v_owner_id
    )
  ON CONFLICT (slug) DO UPDATE SET
    closed_at = EXCLUDED.closed_at,
    updated_at = now();

  v_result := v_result || jsonb_build_object('deals_inserted', 2);

  -- ═══════════════════════════════════════════════════════
  -- B. PRODUCTIVITY RECORDS — delete old, insert 5 for current week
  -- ═══════════════════════════════════════════════════════
  DELETE FROM productivity_records
  WHERE employee_email LIKE 'demo-refresh-%';

  INSERT INTO productivity_records
    (employee_email, week_start, week_number, year, total_hours, billable_hours,
     tasks_completed, tasks_assigned, meetings_attended, utilization_pct, efficiency_score,
     attendance_status, department)
  VALUES
    ('demo-refresh-alice@example.com', v_week_start, EXTRACT(WEEK FROM v_week_start)::int, EXTRACT(YEAR FROM v_week_start)::int,
     40, 35, 12, 14, 5, 87.5, 85.0, 'present', 'Engineering'),
    ('demo-refresh-bob@example.com', v_week_start, EXTRACT(WEEK FROM v_week_start)::int, EXTRACT(YEAR FROM v_week_start)::int,
     38, 30, 8, 10, 4, 78.9, 80.0, 'present', 'Engineering'),
    ('demo-refresh-carol@example.com', v_week_start, EXTRACT(WEEK FROM v_week_start)::int, EXTRACT(YEAR FROM v_week_start)::int,
     42, 37, 15, 16, 6, 88.1, 93.0, 'present', 'Design'),
    ('demo-refresh-dave@example.com', v_week_start, EXTRACT(WEEK FROM v_week_start)::int, EXTRACT(YEAR FROM v_week_start)::int,
     36, 28, 7, 9, 3, 77.8, 78.0, 'present', 'Product'),
    ('demo-refresh-eve@example.com', v_week_start, EXTRACT(WEEK FROM v_week_start)::int, EXTRACT(YEAR FROM v_week_start)::int,
     40, 34, 10, 12, 5, 85.0, 88.0, 'present', 'Engineering')
  ON CONFLICT (employee_email, week_start) DO UPDATE SET
    utilization_pct = EXCLUDED.utilization_pct,
    total_hours = EXCLUDED.total_hours,
    billable_hours = EXCLUDED.billable_hours,
    updated_at = now();

  v_result := v_result || jsonb_build_object('productivity_records_inserted', 5);

  -- ═══════════════════════════════════════════════════════
  -- C. MEETINGS — delete old demo-refresh, insert 4 for current week
  -- ═══════════════════════════════════════════════════════
  DELETE FROM meetings WHERE description LIKE '%[demo-refresh]%';

  INSERT INTO meetings (title, description, organizer_id, client_id, scheduled_at, duration_minutes, status, meeting_type)
  VALUES
    (
      'Weekly Team Standup',
      'Regular team sync to review progress and blockers. [demo-refresh]',
      v_owner_id, v_client_id,
      (v_week_start + interval '1 day' + interval '9 hours'),  -- Monday 9 AM
      30, 'scheduled', 'virtual'
    ),
    (
      'Client Strategy Review',
      'Quarterly strategy alignment with stakeholders. [demo-refresh]',
      v_owner_id, v_client_id,
      (v_week_start + interval '2 days' + interval '14 hours'),  -- Tuesday 2 PM
      60, 'scheduled', 'virtual'
    ),
    (
      'Sprint Planning',
      'Plan next sprint backlog and capacity. [demo-refresh]',
      v_owner_id, NULL,
      (v_week_start + interval '3 days' + interval '10 hours'),  -- Wednesday 10 AM
      45, 'scheduled', 'virtual'
    ),
    (
      'Product Demo & Feedback',
      'Demo latest features to internal stakeholders. [demo-refresh]',
      v_owner_id, v_client_id,
      (v_week_start + interval '4 days' + interval '15 hours'),  -- Thursday 3 PM
      60, 'scheduled', 'virtual'
    );

  v_result := v_result || jsonb_build_object('meetings_inserted', 4);

  -- ═══════════════════════════════════════════════════════
  -- D. PROJECTS — set 3 projects to 'in-progress', 1 at-risk
  -- ═══════════════════════════════════════════════════════
  IF v_in_progress_status IS NOT NULL THEN
    UPDATE projects
    SET status_id = v_in_progress_status,
        is_archived = false,
        updated_at = now()
    WHERE slug IN ('acme-platform-rollout', 'techstart-ai-integration', 'enterprise-qbr-prep')
      AND is_archived = false;

    -- Mark one project at-risk
    UPDATE projects
    SET is_at_risk = true,
        updated_at = now()
    WHERE slug = 'enterprise-qbr-prep'
      AND is_archived = false;

    v_result := v_result || jsonb_build_object('projects_updated', 3, 'projects_at_risk', 1);
  ELSE
    v_result := v_result || jsonb_build_object('projects_warning', 'in-progress status not found');
  END IF;

  v_result := v_result || jsonb_build_object('success', true, 'refreshed_at', now()::text);

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users (admin check can happen in app layer)
GRANT EXECUTE ON FUNCTION public.refresh_demo_data() TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Optional: pg_cron schedule (uncomment to auto-refresh weekly)
-- ─────────────────────────────────────────────────────────────
-- SELECT cron.schedule(
--   'refresh-demo-data-weekly',
--   '0 1 * * 1',  -- Every Monday at 1 AM UTC
--   $$SELECT public.refresh_demo_data()$$
-- );


-- 20260318070717_54f558c2-ff14-431e-b741-e47fb7f011c4.sql

-- Update the agency_role CHECK constraint to include 'bd'
ALTER TABLE public.user_role_preferences
  DROP CONSTRAINT IF EXISTS user_role_preferences_agency_role_check;

ALTER TABLE public.user_role_preferences
  ADD CONSTRAINT user_role_preferences_agency_role_check
  CHECK (agency_role IN ('owner', 'pm', 'ic', 'bd'));


-- 20260318103358_a11a8647-d8ba-429c-9b5a-385317dae7e9.sql
-- 1) Agent setting: rag_enabled
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_agents'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_agents' AND column_name = 'rag_enabled'
  ) THEN
    ALTER TABLE public.ai_agents
      ADD COLUMN rag_enabled BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- 2) Ensure embedding_queue supports tasks if used elsewhere (non-breaking)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'embedding_queue' AND column_name = 'entity_type'
  ) THEN
    BEGIN
      ALTER TABLE public.embedding_queue
        DROP CONSTRAINT IF EXISTS embedding_queue_entity_type_check;
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END;

    ALTER TABLE public.embedding_queue
      ADD CONSTRAINT embedding_queue_entity_type_check
      CHECK (entity_type IN ('file', 'entry', 'meeting', 'user_file', 'task'));
  END IF;
END $$;

-- 3) Delete embeddings when a task is deleted
CREATE OR REPLACE FUNCTION public.delete_task_embeddings()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.embeddings e
  WHERE e.entity_type = 'task'
    AND e.entity_id::text = OLD.id::text;
  RETURN OLD;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_delete_task_embeddings') THEN
    CREATE TRIGGER trg_delete_task_embeddings
      AFTER DELETE ON public.tasks
      FOR EACH ROW
      EXECUTE FUNCTION public.delete_task_embeddings();
  END IF;
END $$;

-- 20260401091500_seed_ai_agents_tier1_tier2.sql
-- Seed and update Tier 1 + Tier 2 AI agents from docs/ai-agent-suggestions.md
-- This migration is idempotent and safe to run multiple times.

INSERT INTO ai_agents (
  name,
  slug,
  category,
  description,
  system_prompt,
  provider_config,
  required_role,
  is_enabled,
  memory_enabled,
  rag_enabled,
  welcome_message,
  conversation_starters,
  data_sources,
  created_at,
  updated_at
) VALUES
  (
    'Deal AI Chat',
    'deal-ai-chat',
    'sales',
    'Interactive sales copilot for deal strategy, risk detection, and next-step planning.',
    'You are a senior B2B deal strategist. Help the user reason through deal stage progression, stakeholder mapping, risks, and next actions. Prefer practical output over theory. Always provide: (1) current deal assessment, (2) top 3 risks, (3) top 3 next actions with owner + timeline, and (4) one concise outreach suggestion.',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.4,"max_tokens":1400}'::jsonb,
    'user',
    true,
    true,
    false,
    'I can help you analyze any deal and decide the best next move.',
    '["Analyze this deal stage and risk profile","What are the highest-probability next actions?","Help me prep for a client call"]'::jsonb,
    '[{"table":"deals","limit":20,"order_by":"updated_at"},{"table":"contacts","limit":20,"order_by":"updated_at"},{"table":"deal_activities","limit":30,"order_by":"created_at"}]'::jsonb,
    now(),
    now()
  ),
  (
    'Deal Daily Briefing',
    'deal-daily-briefing',
    'sales',
    'Summarizes pipeline movement, stale opportunities, and likely close candidates.',
    'You are a sales operations briefing assistant. Produce a concise daily briefing with these sections: Pipeline Snapshot, Biggest Changes, Stale Deals, Likely Closes, and Priority Actions. Keep output skimmable and action-oriented.',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.3,"max_tokens":1300}'::jsonb,
    'user',
    true,
    false,
    false,
    'I can generate a daily pipeline briefing in seconds.',
    '["Generate today''s sales briefing","Show stale deals I should unblock","What changed in the pipeline this week?"]'::jsonb,
    '[{"table":"deals","limit":50,"order_by":"updated_at"},{"table":"deal_activities","limit":60,"order_by":"created_at"}]'::jsonb,
    now(),
    now()
  ),
  (
    'Quick Deal Email',
    'quick-deal-email',
    'sales',
    'Drafts context-aware follow-up emails tied to deal stage and recent activity.',
    'You are a sales email specialist. Draft concise, high-converting follow-up emails using available deal context. Keep tone professional, specific, and outcome-focused. Always include a clear call to action and a subject line.',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.6,"max_tokens":900}'::jsonb,
    'user',
    true,
    true,
    false,
    'I can draft a polished deal follow-up email instantly.',
    '["Draft a follow-up after yesterday''s call","Write a re-engagement email for this deal","Create a concise proposal reminder email"]'::jsonb,
    '[{"table":"deals","limit":15,"order_by":"updated_at"},{"table":"contacts","limit":15,"order_by":"updated_at"},{"table":"deal_activities","limit":20,"order_by":"created_at"}]'::jsonb,
    now(),
    now()
  ),
  (
    'Lovable Prototype Builder',
    'lovable-prototype-builder',
    'sales',
    'Converts requirements into Lovable-ready product prototype prompts and scope.',
    'You are a product prototyping assistant. Convert business requirements into a clear prototype specification suitable for rapid implementation. Output: Product Goal, User Flows, Core Screens, Data Model Draft, Integration Notes, and a final copy-paste "Lovable Prompt".',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.5,"max_tokens":1700}'::jsonb,
    'user',
    true,
    false,
    false,
    'Share a use case and I will generate a prototype-ready plan.',
    '["Turn this feature brief into a prototype spec","Create a Lovable prompt for this workflow","Draft MVP scope from this deal context"]'::jsonb,
    '[{"table":"deals","limit":10,"order_by":"updated_at"},{"table":"projects","limit":10,"order_by":"updated_at"}]'::jsonb,
    now(),
    now()
  ),
  (
    'Client Call Analyzer',
    'client-call-analyzer',
    'meetings',
    'Analyzes call transcripts for sentiment shifts, risk signals, and opportunities.',
    'You are an expert client call analyst. Given transcript or meeting notes, produce: Executive Summary, Sentiment Timeline, Risks, Opportunities, Objections, Action Items, and Recommended Follow-up Message. Distinguish evidence from assumptions.',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.3,"max_tokens":1800}'::jsonb,
    'user',
    true,
    true,
    false,
    'Paste a transcript or notes and I will extract actionable insights.',
    '["Analyze this client transcript","Identify churn risks from this call","What are the strongest upsell signals?"]'::jsonb,
    '[{"table":"meetings","limit":20,"order_by":"start_time"},{"table":"meeting_transcripts","limit":20,"order_by":"created_at"},{"table":"zoom_files","limit":20,"order_by":"created_at"}]'::jsonb,
    now(),
    now()
  ),
  (
    'Client Communication Coach',
    'client-communication-coach',
    'meetings',
    'Coaches teams on messaging clarity, tone, and stakeholder communication.',
    'You are a client communication coach. Evaluate communication quality and coach the user on tone, clarity, persuasion, and trust-building. Provide concrete rewrites for weak phrasing and give role-specific suggestions for sales, delivery, and leadership contexts.',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.5,"max_tokens":1400}'::jsonb,
    'user',
    true,
    true,
    false,
    'I can coach your messaging before or after important client conversations.',
    '["Improve this message before I send it","Coach me for a difficult client update","Rewrite this update to be clearer and stronger"]'::jsonb,
    '[{"table":"meetings","limit":15,"order_by":"updated_at"},{"table":"meeting_transcripts","limit":15,"order_by":"created_at"}]'::jsonb,
    now(),
    now()
  ),
  (
    'Meeting Efficiency Analyzer',
    'meeting-efficiency-analyzer',
    'meetings',
    'Scores meeting quality and recommends specific changes to improve outcomes.',
    'You are a meeting operations analyst. Interpret available efficiency metrics and provide a concise diagnosis: score interpretation, root causes, and prioritized recommendations. Make suggestions measurable and practical.',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.2,"max_tokens":1100}'::jsonb,
    'user',
    true,
    false,
    false,
    'I can evaluate meeting quality and suggest practical improvements.',
    '["Analyze this meeting''s efficiency","What changes will raise our meeting score?","Identify the biggest source of meeting waste"]'::jsonb,
    '[{"table":"meetings","limit":25,"order_by":"start_time"},{"table":"meeting_action_items","limit":50,"order_by":"created_at"},{"table":"meeting_takeaways","limit":50,"order_by":"created_at"}]'::jsonb,
    now(),
    now()
  ),
  (
    'EOS Pattern Detective',
    'eos-pattern-detective',
    'eos',
    'Finds recurring issue patterns across EOS data and highlights systemic causes.',
    'You are an EOS pattern detective. Identify repeated issues, root-cause themes, and escalation hotspots. Output: Pattern Clusters, Frequency Signals, Likely Root Causes, and Next IDS Agenda priorities.',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.3,"max_tokens":1400}'::jsonb,
    'user',
    true,
    true,
    false,
    'I can detect recurring EOS patterns and recommend where to focus.',
    '["Find recurring EOS issue themes","What keeps repeating every quarter?","Which issues deserve IDS first?"]'::jsonb,
    '[{"table":"eos_issues","limit":80,"order_by":"created_at"},{"table":"okrs","limit":40,"order_by":"updated_at"}]'::jsonb,
    now(),
    now()
  ),
  (
    'EOS Pod Health',
    'eos-pod-health',
    'eos',
    'Assesses pod health from accountability ownership, issues, and execution signals.',
    'You are an EOS pod health analyst. Assess health using issue flow, accountability clarity, and execution consistency. Produce: Health Score, Strengths, Gaps, and 30-day interventions with owner-level accountability recommendations.',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.3,"max_tokens":1500}'::jsonb,
    'user',
    true,
    true,
    false,
    'I can evaluate pod health and recommend targeted EOS improvements.',
    '["Assess pod health for this quarter","Where is accountability unclear?","What interventions will improve execution?"]'::jsonb,
    '[{"table":"eos_issues","limit":60,"order_by":"created_at"},{"table":"pods","limit":30,"order_by":"updated_at"},{"table":"accountability_charts","limit":20,"order_by":"updated_at"},{"table":"accountability_responsibilities","limit":80,"order_by":"updated_at"}]'::jsonb,
    now(),
    now()
  ),
  (
    'EOS Quarterly Digest',
    'eos-quarterly-digest',
    'eos',
    'Builds a quarterly EOS digest summarizing execution, risk, and next-quarter priorities.',
    'You are an EOS executive reviewer. Produce a quarterly digest with objective signals, summary narrative, key wins, key misses, and top priorities for next quarter. Keep recommendations specific and measurable.',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.3,"max_tokens":1700}'::jsonb,
    'user',
    true,
    false,
    false,
    'I can generate a quarter-end EOS digest for leadership.',
    '["Generate this quarter''s EOS digest","Summarize key EOS wins and misses","Recommend priorities for next quarter"]'::jsonb,
    '[{"table":"eos_issues","limit":80,"order_by":"created_at"},{"table":"okrs","limit":50,"order_by":"updated_at"},{"table":"eos_scorecard_metrics","limit":100,"order_by":"week_of"}]'::jsonb,
    now(),
    now()
  ),
  (
    'Bug & Feature Planner',
    'bug-feature-planner',
    'projects',
    'Turns bugs/features into implementation-ready plans with effort and rollout guidance.',
    'You are a senior technical product planner. Convert bug reports or feature requests into an actionable plan: Clarified Scope, Implementation Steps, Dependencies, Test Plan, Risks, and Delivery Milestones. Default to practical MVP-first sequencing.',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.4,"max_tokens":1600}'::jsonb,
    'user',
    true,
    true,
    false,
    'I can break down bugs and features into an execution plan.',
    '["Plan this bug fix end-to-end","Turn this feature request into tasks","What are dependencies and rollout risks?"]'::jsonb,
    '[{"table":"projects","limit":20,"order_by":"updated_at"},{"table":"tasks","limit":60,"order_by":"updated_at"}]'::jsonb,
    now(),
    now()
  ),
  (
    'Code Review Generator',
    'code-review-generator',
    'projects',
    'Generates code-review checklists and risk-oriented review feedback.',
    'You are a pragmatic code reviewer. Provide structured review feedback: correctness, security, reliability, performance, maintainability, and test coverage. Highlight concrete issues first and include actionable fixes.',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.2,"max_tokens":1400}'::jsonb,
    'user',
    true,
    true,
    false,
    'I can generate focused code review feedback and checklists.',
    '["Review this code change for risks","Generate a PR review checklist","What tests are missing in this implementation?"]'::jsonb,
    '[{"table":"projects","limit":20,"order_by":"updated_at"},{"table":"tasks","limit":50,"order_by":"updated_at"}]'::jsonb,
    now(),
    now()
  ),
  (
    'Technical Plan Generator',
    'technical-plan-generator',
    'projects',
    'Creates technical implementation plans from product and business requirements.',
    'You are a technical architect. Produce an implementation plan with architecture, data model impact, API contracts, migration strategy, testing strategy, rollout, and rollback. Keep plans realistic and delivery-focused.',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.3,"max_tokens":1800}'::jsonb,
    'user',
    true,
    true,
    false,
    'I can produce a full technical plan from raw requirements.',
    '["Create a technical plan for this requirement","Design API and schema changes for this feature","Give me rollout and rollback steps"]'::jsonb,
    '[{"table":"projects","limit":20,"order_by":"updated_at"},{"table":"tasks","limit":60,"order_by":"updated_at"}]'::jsonb,
    now(),
    now()
  ),
  (
    'Project Analyzer',
    'project-analyzer',
    'projects',
    'Analyzes project health, risks, schedule pressure, and execution focus.',
    'You are a project health analyst. Evaluate project status and provide: Health Summary, Timeline Risk, Delivery Bottlenecks, Team Load Signals, and Next 7-day plan. Prioritize issues that threaten delivery.',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.3,"max_tokens":1400}'::jsonb,
    'user',
    true,
    false,
    false,
    'I can assess project health and surface delivery risks early.',
    '["Analyze this project health","What is most likely to delay delivery?","What should the team do this week?"]'::jsonb,
    '[{"table":"projects","limit":30,"order_by":"updated_at"},{"table":"project_milestones","limit":60,"order_by":"updated_at"},{"table":"project_risks","limit":60,"order_by":"updated_at"},{"table":"tasks","limit":80,"order_by":"updated_at"}]'::jsonb,
    now(),
    now()
  ),

  -- Tier 2
  (
    'Email Draft Generator',
    'email-draft-generator',
    'sales',
    'Server-side email draft generation with deal + client + contact context enrichment.',
    'You are an expert sales email writer. Use server-fetched context to produce concise, personalized drafts with clear CTA and optional follow-up variants.',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.6,"max_tokens":1000}'::jsonb,
    'user',
    true,
    true,
    false,
    'Provide a deal and I will generate a polished, context-aware draft.',
    '["Generate a proposal follow-up email","Draft a re-engagement message","Write a meeting recap email"]'::jsonb,
    '[{"table":"deals","limit":15},{"table":"clients","limit":15},{"table":"contacts","limit":15},{"table":"deal_activities","limit":20}]'::jsonb,
    now(),
    now()
  ),
  (
    'SOW Generator',
    'sow-generator',
    'sales',
    'Creates statement-of-work documents from deal and project context, with PDF output.',
    'You are a solutions consultant writing clear statements of work. Produce a practical SOW with scope, deliverables, assumptions, timeline, pricing notes, and acceptance criteria.',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.3,"max_tokens":2200}'::jsonb,
    'user',
    true,
    false,
    false,
    'I can generate a complete SOW and export-ready PDF content.',
    '["Generate a draft SOW for this deal","Create scope and deliverables for this project","Build a client-ready SOW outline"]'::jsonb,
    '[{"table":"deals","limit":10},{"table":"clients","limit":10},{"table":"projects","limit":10}]'::jsonb,
    now(),
    now()
  ),
  (
    'Meeting Intelligence',
    'meeting-intelligence',
    'meetings',
    'Extracts summary, action items, issues, sentiment, and risk signals in a single pass.',
    'You are a meeting intelligence assistant. Return a high-signal structured analysis with summary, decisions, tasks, issues, sentiment, and recommended follow-up priorities.',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.2,"max_tokens":2200}'::jsonb,
    'user',
    true,
    false,
    false,
    'I can extract structured intelligence from meeting transcripts.',
    '["Run full intelligence extraction on this meeting","Find issues and risks in this transcript","Generate summary plus follow-up actions"]'::jsonb,
    '[{"table":"meetings","limit":20},{"table":"meeting_transcripts","limit":20},{"table":"zoom_files","limit":20}]'::jsonb,
    now(),
    now()
  ),
  (
    'Smart Meeting Categorizer',
    'smart-meeting-categorizer',
    'meetings',
    'Auto-categorizes meetings and provides confidence, rationale, and tags.',
    'You are a meeting categorization assistant. Classify meeting type, category, confidence, rationale, and topic tags based on available metadata and content.',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.2,"max_tokens":1000}'::jsonb,
    'user',
    true,
    false,
    false,
    'I can classify meetings quickly and consistently.',
    '["Categorize this meeting","Suggest tags for this transcript","Explain why this category fits"]'::jsonb,
    '[{"table":"meetings","limit":25},{"table":"meeting_transcripts","limit":25}]'::jsonb,
    now(),
    now()
  ),
  (
    'Meeting Issue Reporter',
    'meeting-issue-reporter',
    'meetings',
    'Extracts risks, blockers, and concerns from meeting transcript content.',
    'You are a meeting issue extraction assistant. Return only real blockers, concerns, and risks, each with severity and evidence summary.',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.2,"max_tokens":1200}'::jsonb,
    'user',
    true,
    false,
    false,
    'I can identify critical issues from meeting discussions.',
    '["Find blockers in this transcript","List top risks discussed","Extract concerns needing follow-up"]'::jsonb,
    '[{"table":"meetings","limit":25},{"table":"meeting_transcripts","limit":25}]'::jsonb,
    now(),
    now()
  ),
  (
    'Accountability Overlap Analyzer',
    'accountability-overlap-analyzer',
    'eos',
    'Detects overlapping ownership and ambiguous responsibilities in accountability charts.',
    'You are an EOS accountability analyst. Detect responsibility overlap, ambiguous ownership, and role conflicts. Output overlaps, impact severity, and cleanup recommendations.',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.2,"max_tokens":1400}'::jsonb,
    'user',
    true,
    false,
    false,
    'I can detect accountability overlap and clarify ownership.',
    '["Analyze overlap in the current chart","Where are responsibilities ambiguous?","Recommend chart cleanup actions"]'::jsonb,
    '[{"table":"accountability_charts","limit":20},{"table":"accountability_responsibilities","limit":120}]'::jsonb,
    now(),
    now()
  ),
  (
    'Accountability Chart Reminder',
    'accountability-chart-reminder',
    'eos',
    'Sends reminder prompts for accountability chart review and freshness checks.',
    'You are an EOS accountability reminder assistant. Generate concise reminder messages prompting owners to review and refresh accountability charts.',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.2,"max_tokens":500}'::jsonb,
    'user',
    true,
    false,
    false,
    'I can prepare accountability chart reminder messages.',
    '["Generate this month''s chart reminder","Draft reminder copy for pod leads","Who should receive accountability reminders?"]'::jsonb,
    '[{"table":"accountability_charts","limit":20},{"table":"accountability_responsibilities","limit":120},{"table":"employee_profiles","limit":120}]'::jsonb,
    now(),
    now()
  ),
  (
    'Accountability Manager Nudge',
    'accountability-manager-nudge',
    'eos',
    'Sends periodic nudges to managers where ownership drift or confusion appears.',
    'You are an EOS leadership nudge assistant. Create concise manager nudges to close ownership gaps and improve accountability hygiene.',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.2,"max_tokens":500}'::jsonb,
    'user',
    true,
    false,
    false,
    'I can draft focused nudges for managers on accountability hygiene.',
    '["Generate manager nudges for ownership gaps","Draft concise accountability coaching notes","Who needs a manager follow-up?"]'::jsonb,
    '[{"table":"accountability_charts","limit":20},{"table":"accountability_responsibilities","limit":120},{"table":"employee_profiles","limit":120}]'::jsonb,
    now(),
    now()
  ),
  (
    'Accountability Revisit Reminder',
    'accountability-revisit-reminder',
    'eos',
    'Schedules recurring reminders to revisit role clarity and responsibilities.',
    'You are an EOS reminder assistant. Generate revisit reminders with practical prompts to reassess role boundaries and eliminate duplicate ownership.',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.2,"max_tokens":500}'::jsonb,
    'user',
    true,
    false,
    false,
    'I can generate recurring reminders for accountability chart health.',
    '["Draft a quarterly accountability revisit reminder","Prepare follow-up prompts for role clarity","Who should review role boundaries this cycle?"]'::jsonb,
    '[{"table":"accountability_charts","limit":20},{"table":"accountability_responsibilities","limit":120},{"table":"employee_profiles","limit":120}]'::jsonb,
    now(),
    now()
  ),
  (
    'HR Request Processing',
    'hr-request-processing',
    'operations',
    'Converts HR requests into structured tasks with triage, ownership, and urgency guidance.',
    'You are an HR operations assistant. Triage HR requests into structured tasks with title, urgency, ownership suggestion, SLA target, and next actions. Keep language respectful and compliant.',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.2,"max_tokens":1200}'::jsonb,
    'user',
    true,
    false,
    false,
    'I can triage HR requests and generate structured follow-up tasks.',
    '["Process this HR request into tasks","Classify urgency and suggest next steps","Create a clean request summary for operations"]'::jsonb,
    '[{"table":"tasks","limit":100,"order_by":"updated_at"}]'::jsonb,
    now(),
    now()
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  system_prompt = EXCLUDED.system_prompt,
  provider_config = EXCLUDED.provider_config,
  required_role = EXCLUDED.required_role,
  is_enabled = EXCLUDED.is_enabled,
  memory_enabled = EXCLUDED.memory_enabled,
  rag_enabled = EXCLUDED.rag_enabled,
  welcome_message = EXCLUDED.welcome_message,
  conversation_starters = EXCLUDED.conversation_starters,
  data_sources = EXCLUDED.data_sources,
  updated_at = now();


-- 20260402101500_enable_activecollab_oauth.sql
-- ActiveCollab: API token via issue-token (org supplies base URL + client app labels).
-- User connects with email/password once; token is stored in user_oauth_tokens.
-- @see https://developers.activecollab.com/api-documentation/v1/authentication.html

DO $$
DECLARE
  cat_pm UUID;
  provider_activecollab UUID;
BEGIN
  SELECT id INTO cat_pm
  FROM public.integration_categories
  WHERE slug = 'project-management'
  LIMIT 1;

  IF cat_pm IS NULL THEN
    RAISE NOTICE 'Project Management category not found, skipping ActiveCollab setup';
    RETURN;
  END IF;

  SELECT id INTO provider_activecollab
  FROM public.integration_providers
  WHERE slug = 'activecollab'
  LIMIT 1;

  IF provider_activecollab IS NULL THEN
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
      display_order
    )
    VALUES (
      cat_pm,
      'ActiveCollab',
      'activecollab',
      'Project management and task tracking with time tracking and invoicing',
      'api_key',
      NULL,
      'https://developers.activecollab.com/api-documentation/v1/authentication.html',
      true,
      false,
      55
    )
    RETURNING id INTO provider_activecollab;
  ELSE
    UPDATE public.integration_providers
    SET
      category_id = cat_pm,
      auth_type = 'api_key',
      oauth_config = NULL,
      docs_url = COALESCE(
        docs_url,
        'https://developers.activecollab.com/api-documentation/v1/authentication.html'
      ),
      is_available = true,
      is_coming_soon = false
    WHERE id = provider_activecollab;
  END IF;

  INSERT INTO public.integration_fields (
    provider_id,
    field_key,
    label,
    field_type,
    placeholder,
    is_required,
    is_sensitive,
    help_text,
    display_order
  )
  VALUES (
    provider_activecollab,
    'base_url',
    'Base URL',
    'url',
    'https://your-company.activecollab.com',
    true,
    false,
    'Your ActiveCollab instance base URL (API under /api/v1).',
    10
  )
  ON CONFLICT (provider_id, field_key) DO UPDATE
  SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;

  INSERT INTO public.integration_fields (
    provider_id,
    field_key,
    label,
    field_type,
    placeholder,
    is_required,
    is_sensitive,
    help_text,
    display_order
  )
  VALUES (
    provider_activecollab,
    'client_name',
    'Client name',
    'text',
    'Control Tower',
    true,
    false,
    'Application name for ActiveCollab issue-token (see API authentication docs).',
    20
  )
  ON CONFLICT (provider_id, field_key) DO UPDATE
  SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;

  INSERT INTO public.integration_fields (
    provider_id,
    field_key,
    label,
    field_type,
    placeholder,
    is_required,
    is_sensitive,
    help_text,
    display_order
  )
  VALUES (
    provider_activecollab,
    'client_vendor',
    'Client vendor',
    'text',
    'Your company name',
    true,
    false,
    'Vendor name for ActiveCollab issue-token (see API authentication docs).',
    30
  )
  ON CONFLICT (provider_id, field_key) DO UPDATE
  SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;

  DELETE FROM public.integration_fields
  WHERE provider_id = provider_activecollab AND field_key IN ('client_id', 'client_secret');
END;
$$;


-- 20260402121618_1af436eb-1b65-4a35-b39a-70c7040a9fdf.sql
DO $$
DECLARE
  cat_pm UUID;
  provider_activecollab UUID;
BEGIN
  SELECT id INTO cat_pm FROM public.integration_categories WHERE slug = 'project-management' LIMIT 1;
  IF cat_pm IS NULL THEN
    RAISE NOTICE 'Project Management category not found, skipping ActiveCollab setup';
    RETURN;
  END IF;
  SELECT id INTO provider_activecollab FROM public.integration_providers WHERE slug = 'activecollab' LIMIT 1;
  IF provider_activecollab IS NULL THEN
    INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, oauth_config, docs_url, is_available, is_coming_soon, display_order)
    VALUES (cat_pm, 'ActiveCollab', 'activecollab', 'Project management and task tracking with time tracking and invoicing', 'oauth2', '{"authorize_url":"https://app.activecollab.com/auth/login","token_url":"https://app.activecollab.com/api/v1/external/login","userinfo_url":"https://app.activecollab.com/api/v1/users/me","response_type":"code"}'::jsonb, 'https://developers.activecollab.com/api-documentation/index.html', true, false, 55)
    RETURNING id INTO provider_activecollab;
  ELSE
    UPDATE public.integration_providers SET category_id = cat_pm, auth_type = 'oauth2', oauth_config = COALESCE(oauth_config, '{"authorize_url":"https://app.activecollab.com/auth/login","token_url":"https://app.activecollab.com/api/v1/external/login","userinfo_url":"https://app.activecollab.com/api/v1/users/me","response_type":"code"}'::jsonb), docs_url = COALESCE(docs_url, 'https://developers.activecollab.com/api-documentation/index.html'), is_available = true, is_coming_soon = false WHERE id = provider_activecollab;
  END IF;
  INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order) VALUES (provider_activecollab, 'base_url', 'Base URL', 'url', 'https://your-company.activecollab.com', true, false, 'Your ActiveCollab instance base URL. OAuth and API calls are resolved from this URL.', 10) ON CONFLICT (provider_id, field_key) DO UPDATE SET label = EXCLUDED.label, field_type = EXCLUDED.field_type, placeholder = EXCLUDED.placeholder, is_required = EXCLUDED.is_required, is_sensitive = EXCLUDED.is_sensitive, help_text = EXCLUDED.help_text, display_order = EXCLUDED.display_order;
  INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order) VALUES (provider_activecollab, 'client_id', 'Client ID', 'text', 'activecollab_client_id', true, false, 'OAuth client id for your ActiveCollab app.', 20) ON CONFLICT (provider_id, field_key) DO UPDATE SET label = EXCLUDED.label, field_type = EXCLUDED.field_type, placeholder = EXCLUDED.placeholder, is_required = EXCLUDED.is_required, is_sensitive = EXCLUDED.is_sensitive, help_text = EXCLUDED.help_text, display_order = EXCLUDED.display_order;
  INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order) VALUES (provider_activecollab, 'client_secret', 'Client Secret', 'password', '****************', true, true, 'OAuth client secret for your ActiveCollab app.', 30) ON CONFLICT (provider_id, field_key) DO UPDATE SET label = EXCLUDED.label, field_type = EXCLUDED.field_type, placeholder = EXCLUDED.placeholder, is_required = EXCLUDED.is_required, is_sensitive = EXCLUDED.is_sensitive, help_text = EXCLUDED.help_text, display_order = EXCLUDED.display_order;
END;
$$;

-- 20260403120000_activecollab_token_auth.sql
-- ActiveCollab uses API token auth (issue-token), not OAuth2.
-- See: https://developers.activecollab.com/api-documentation/v1/authentication.html

DO $$
DECLARE
  pid UUID;
BEGIN
  SELECT id INTO pid FROM public.integration_providers WHERE slug = 'activecollab' LIMIT 1;
  IF pid IS NULL THEN
    RAISE NOTICE 'ActiveCollab provider not found, skipping token-auth migration';
    RETURN;
  END IF;

  UPDATE public.integration_providers
  SET
    auth_type = 'api_key',
    oauth_config = NULL,
    docs_url = COALESCE(
      docs_url,
      'https://developers.activecollab.com/api-documentation/v1/authentication.html'
    )
  WHERE id = pid;

  DELETE FROM public.integration_fields
  WHERE provider_id = pid AND field_key IN ('client_id', 'client_secret');

  INSERT INTO public.integration_fields (
    provider_id,
    field_key,
    label,
    field_type,
    placeholder,
    is_required,
    is_sensitive,
    help_text,
    display_order
  )
  VALUES (
    pid,
    'base_url',
    'Base URL',
    'url',
    'https://your-company.activecollab.com',
    true,
    false,
    'Your ActiveCollab instance base URL (API lives under /api/v1).',
    10
  )
  ON CONFLICT (provider_id, field_key) DO UPDATE
  SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;

  INSERT INTO public.integration_fields (
    provider_id,
    field_key,
    label,
    field_type,
    placeholder,
    is_required,
    is_sensitive,
    help_text,
    display_order
  )
  VALUES (
    pid,
    'client_name',
    'Client name',
    'text',
    'Control Tower',
    true,
    false,
    'Application name sent to ActiveCollab when issuing an API token (see issue-token API).',
    20
  )
  ON CONFLICT (provider_id, field_key) DO UPDATE
  SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;

  INSERT INTO public.integration_fields (
    provider_id,
    field_key,
    label,
    field_type,
    placeholder,
    is_required,
    is_sensitive,
    help_text,
    display_order
  )
  VALUES (
    pid,
    'client_vendor',
    'Client vendor',
    'text',
    'Your company name',
    true,
    false,
    'Vendor name sent to ActiveCollab when issuing an API token (see issue-token API).',
    30
  )
  ON CONFLICT (provider_id, field_key) DO UPDATE
  SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;
END;
$$;


-- 20260410082812_85eee214-9df7-4e50-b7fa-c5f053fa2299.sql
-- Add project_id column to tasks table for ActiveCollab sync
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Add index for join performance
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);

-- 20260413051814_8b6e680a-b77b-495a-9587-64d4fbc3c905.sql

-- 1) Provider availability + OAuth scopes
UPDATE public.integration_providers
SET
  is_available = true,
  is_coming_soon = false,
  oauth_config = jsonb_set(
    COALESCE(oauth_config, '{}'::jsonb),
    '{scopes}',
    '["ZohoCRM.modules.ALL", "ZohoCRM.settings.ALL"]'::jsonb,
    true
  )
WHERE slug = 'zoho-crm';

-- 2) Integration fields for org/user OAuth admin UI
DO $$
DECLARE
  zid UUID;
BEGIN
  SELECT id INTO zid FROM public.integration_providers WHERE slug = 'zoho-crm' LIMIT 1;
  IF zid IS NULL THEN
    RAISE NOTICE 'zoho-crm provider not found; skip integration_fields';
    RETURN;
  END IF;

  INSERT INTO public.integration_fields (
    provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order
  ) VALUES
    (zid, 'zoho_client_id', 'Zoho Client ID', 'text', '1000.xxx', true, false, 'From Zoho API Console (Server-based client)', 10),
    (zid, 'zoho_client_secret', 'Zoho Client Secret', 'password', '••••••••', true, true, 'Keep secret; stored in integration config', 20),
    (zid, 'zoho_redirect_uri', 'Redirect URI', 'url', 'https://…/functions/v1/user-oauth-callback', false, false, 'Must match Zoho API Console redirect URL', 30),
    (zid, 'zoho_accounts_url', 'Accounts domain (optional)', 'url', 'https://accounts.zoho.com', false, false, 'EU/IN/AU accounts host if not US', 40)
  ON CONFLICT (provider_id, field_key) DO UPDATE SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;
END $$;

-- 3) Deal tab cache tables
CREATE TABLE IF NOT EXISTS public.zoho_deal_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  zoho_attachment_id TEXT NOT NULL,
  file_name TEXT,
  size_bytes BIGINT,
  content_type TEXT,
  download_url TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, zoho_attachment_id)
);

CREATE TABLE IF NOT EXISTS public.zoho_deal_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  zoho_module TEXT NOT NULL,
  zoho_record_id TEXT NOT NULL,
  title TEXT,
  content TEXT,
  activity_type TEXT,
  occurred_at TIMESTAMPTZ,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, zoho_module, zoho_record_id)
);

CREATE TABLE IF NOT EXISTS public.zoho_deal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  zoho_event_id TEXT NOT NULL,
  title TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  location TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, zoho_event_id)
);

CREATE TABLE IF NOT EXISTS public.zoho_contact_enrichment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  zoho_contact_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id)
);

CREATE TABLE IF NOT EXISTS public.zoho_account_enrichment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  zoho_account_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id)
);

CREATE INDEX IF NOT EXISTS idx_zoho_deal_attachments_deal ON public.zoho_deal_attachments(deal_id);
CREATE INDEX IF NOT EXISTS idx_zoho_deal_engagements_deal ON public.zoho_deal_engagements(deal_id);
CREATE INDEX IF NOT EXISTS idx_zoho_deal_events_deal ON public.zoho_deal_events(deal_id);
CREATE INDEX IF NOT EXISTS idx_zoho_contact_enrichment_deal ON public.zoho_contact_enrichment(deal_id);
CREATE INDEX IF NOT EXISTS idx_zoho_account_enrichment_deal ON public.zoho_account_enrichment(deal_id);

ALTER TABLE public.zoho_deal_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoho_deal_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoho_deal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoho_contact_enrichment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoho_account_enrichment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage zoho_deal_attachments" ON public.zoho_deal_attachments;
CREATE POLICY "Authenticated users can manage zoho_deal_attachments"
  ON public.zoho_deal_attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage zoho_deal_engagements" ON public.zoho_deal_engagements;
CREATE POLICY "Authenticated users can manage zoho_deal_engagements"
  ON public.zoho_deal_engagements FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage zoho_deal_events" ON public.zoho_deal_events;
CREATE POLICY "Authenticated users can manage zoho_deal_events"
  ON public.zoho_deal_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage zoho_contact_enrichment" ON public.zoho_contact_enrichment;
CREATE POLICY "Authenticated users can manage zoho_contact_enrichment"
  ON public.zoho_contact_enrichment FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage zoho_account_enrichment" ON public.zoho_account_enrichment;
CREATE POLICY "Authenticated users can manage zoho_account_enrichment"
  ON public.zoho_account_enrichment FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 20260413051937_5e63e5e9-e58d-4512-8e85-f4bd80092418.sql

INSERT INTO public.integration_categories (name, slug, description, icon, display_order, enabled)
VALUES (
  'CRM Systems',
  'crm-systems',
  'Customer relationship management platforms',
  'Users',
  40,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  enabled = true,
  updated_at = now();

DO $$
DECLARE
  cat_crm UUID;
BEGIN
  SELECT id INTO cat_crm FROM public.integration_categories WHERE slug = 'crm-systems' LIMIT 1;
  IF cat_crm IS NULL THEN
    RAISE EXCEPTION 'crm-systems category missing after upsert';
  END IF;

  INSERT INTO public.integration_providers (
    category_id, name, slug, description, auth_type, oauth_config, docs_url, is_available, is_coming_soon, display_order
  ) VALUES
    (
      cat_crm,
      'Salesforce',
      'salesforce',
      'Enterprise CRM platform with comprehensive features',
      'oauth2',
      '{"authorize_url": "https://login.salesforce.com/services/oauth2/authorize", "token_url": "https://login.salesforce.com/services/oauth2/token", "scopes": ["api", "refresh_token", "offline_access"]}'::jsonb,
      'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest',
      false,
      true,
      10
    ),
    (
      cat_crm,
      'HubSpot',
      'hubspot',
      'Marketing, sales, and service CRM platform',
      'oauth2',
      '{"authorize_url": "https://app.hubspot.com/oauth/authorize", "token_url": "https://api.hubapi.com/oauth/v1/token", "scopes": ["crm.objects.contacts.read", "crm.objects.contacts.write"]}'::jsonb,
      'https://developers.hubspot.com/docs/api-reference/overview',
      false,
      true,
      20
    ),
    (
      cat_crm,
      'Pipedrive',
      'pipedrive',
      'Sales-focused CRM with simple interface',
      'api_key',
      NULL,
      'https://developers.pipedrive.com/docs/api/v1',
      false,
      true,
      30
    ),
    (
      cat_crm,
      'Zoho CRM',
      'zoho-crm',
      'Affordable CRM for small to medium businesses',
      'oauth2',
      '{"authorize_url": "https://accounts.zoho.com/oauth/v2/auth", "token_url": "https://accounts.zoho.com/oauth/v2/token", "scopes": ["ZohoCRM.modules.ALL", "ZohoCRM.settings.ALL"]}'::jsonb,
      'https://www.zoho.com/crm/developer/docs/api/v8',
      true,
      false,
      40
    )
  ON CONFLICT (slug) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    auth_type = EXCLUDED.auth_type,
    oauth_config = EXCLUDED.oauth_config,
    docs_url = EXCLUDED.docs_url,
    is_available = EXCLUDED.is_available,
    is_coming_soon = EXCLUDED.is_coming_soon,
    display_order = EXCLUDED.display_order,
    updated_at = now();
END $$;


-- 20260413052523_767e4865-c67e-46a4-b76f-eebe21439f1d.sql

INSERT INTO public.integration_categories (name, slug, description, icon, display_order, enabled)
VALUES (
  'CRM Systems',
  'crm-systems',
  'Customer relationship management platforms',
  'Users',
  40,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  enabled = true,
  updated_at = now();

DO $$
DECLARE
  cat_crm UUID;
BEGIN
  SELECT id INTO cat_crm FROM public.integration_categories WHERE slug = 'crm-systems' LIMIT 1;
  IF cat_crm IS NULL THEN
    RAISE EXCEPTION 'crm-systems category missing after upsert';
  END IF;

  INSERT INTO public.integration_providers (
    category_id, name, slug, description, auth_type, oauth_config, docs_url, is_available, is_coming_soon, display_order
  ) VALUES
    (
      cat_crm,
      'Salesforce',
      'salesforce',
      'Enterprise CRM platform with comprehensive features',
      'oauth2',
      '{"authorize_url": "https://login.salesforce.com/services/oauth2/authorize", "token_url": "https://login.salesforce.com/services/oauth2/token", "scopes": ["api", "refresh_token", "offline_access"]}'::jsonb,
      'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest',
      false,
      true,
      10
    ),
    (
      cat_crm,
      'HubSpot',
      'hubspot',
      'Marketing, sales, and service CRM platform',
      'oauth2',
      '{"authorize_url": "https://app.hubspot.com/oauth/authorize", "token_url": "https://api.hubapi.com/oauth/v1/token", "scopes": ["crm.objects.contacts.read", "crm.objects.contacts.write"]}'::jsonb,
      'https://developers.hubspot.com/docs/api-reference/overview',
      false,
      true,
      20
    ),
    (
      cat_crm,
      'Pipedrive',
      'pipedrive',
      'Sales-focused CRM with simple interface',
      'api_key',
      NULL,
      'https://developers.pipedrive.com/docs/api/v1',
      false,
      true,
      30
    ),
    (
      cat_crm,
      'Zoho CRM',
      'zoho-crm',
      'Affordable CRM for small to medium businesses',
      'oauth2',
      '{"authorize_url": "https://accounts.zoho.com/oauth/v2/auth", "token_url": "https://accounts.zoho.com/oauth/v2/token", "scopes": ["ZohoCRM.modules.ALL", "ZohoCRM.settings.ALL"]}'::jsonb,
      'https://www.zoho.com/crm/developer/docs/api/v8',
      true,
      false,
      40
    )
  ON CONFLICT (slug) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    auth_type = EXCLUDED.auth_type,
    oauth_config = EXCLUDED.oauth_config,
    docs_url = EXCLUDED.docs_url,
    is_available = EXCLUDED.is_available,
    is_coming_soon = EXCLUDED.is_coming_soon,
    display_order = EXCLUDED.display_order,
    updated_at = now();
END $$;

DO $$
DECLARE
  zid UUID;
BEGIN
  SELECT id INTO zid FROM public.integration_providers WHERE slug = 'zoho-crm' LIMIT 1;
  IF zid IS NULL THEN
    RAISE NOTICE 'zoho-crm provider not found; skip integration_fields';
    RETURN;
  END IF;

  INSERT INTO public.integration_fields (
    provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order
  ) VALUES
    (zid, 'zoho_client_id', 'Zoho Client ID', 'text', '1000.xxx', true, false, 'From Zoho API Console (Server-based client)', 10),
    (zid, 'zoho_client_secret', 'Zoho Client Secret', 'password', '••••••••', true, true, 'Keep secret; stored in integration config', 20),
    (zid, 'zoho_redirect_uri', 'Redirect URI', 'url', 'https://…/functions/v1/user-oauth-callback', false, false, 'Must match Zoho API Console redirect URL', 30),
    (zid, 'zoho_accounts_url', 'Accounts domain (optional)', 'url', 'https://accounts.zoho.com', false, false, 'EU/IN/AU accounts host if not US', 40)
  ON CONFLICT (provider_id, field_key) DO UPDATE SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;
END $$;


-- 20260413060240_0f447365-0847-4d84-a91b-67233098e7ab.sql
-- Jira: API-key hub fields, task extensions, Jira comment columns, time logs.
-- Keeps existing integration_providers.oauth_config for jira (not dropped).

-- ---------------------------------------------------------------------------
-- Integration hub: Jira as api_key + form fields
-- ---------------------------------------------------------------------------
UPDATE public.integration_providers
SET auth_type = 'api_key'
WHERE slug = 'jira';

INSERT INTO public.integration_fields (
  provider_id,
  field_key,
  label,
  field_type,
  placeholder,
  is_required,
  is_sensitive,
  help_text,
  display_order
)
SELECT
  p.id,
  v.field_key,
  v.label,
  v.field_type::text,
  v.placeholder,
  v.is_required,
  v.is_sensitive,
  v.help_text,
  v.display_order
FROM public.integration_providers p
CROSS JOIN (VALUES
  ('jira_host', 'Jira site URL', 'url', 'https://your-domain.atlassian.net', true, false,
   'Your Jira Cloud site base URL (with or without https://). Must match JIRA_HOST secret for sync.', 10),
  ('jira_email', 'Atlassian account email', 'email', 'you@company.com', true, false,
   'Email for the Atlassian account used to create the API token. Same as JIRA_EMAIL secret.', 20),
  ('jira_api_token', 'API token', 'password', 'API token from id.atlassian.com', true, true,
   'Create at https://id.atlassian.com/manage-profile/security/api-tokens — also set as JIRA_API_TOKEN secret for Edge sync.', 30)
) AS v(field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
WHERE p.slug = 'jira'
ON CONFLICT (provider_id, field_key) DO UPDATE SET
  label = EXCLUDED.label,
  field_type = EXCLUDED.field_type,
  placeholder = EXCLUDED.placeholder,
  is_required = EXCLUDED.is_required,
  is_sensitive = EXCLUDED.is_sensitive,
  help_text = EXCLUDED.help_text,
  display_order = EXCLUDED.display_order;

-- ---------------------------------------------------------------------------
-- Tasks: work type (Jira issue type label) + index for Jira external id
-- ---------------------------------------------------------------------------
ALTER TABLE public.tasks  ADD COLUMN IF NOT EXISTS work_type TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_metadata_external_id
  ON public.tasks ((metadata->>'external_id'))
  WHERE metadata->>'external_id' IS NOT NULL;

COMMENT ON COLUMN public.tasks.work_type IS 'Issue type name when synced from Jira (or other PM tools)';

-- ---------------------------------------------------------------------------
-- Comments: optional user for Jira-imported rows; Jira ids and author display
-- ---------------------------------------------------------------------------
ALTER TABLE public.task_comments
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.task_comments
  ADD COLUMN IF NOT EXISTS jira_comment_id TEXT,
  ADD COLUMN IF NOT EXISTS jira_author_name TEXT,
  ADD COLUMN IF NOT EXISTS jira_author_email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_comments_task_jira_comment
  ON public.task_comments (task_id, jira_comment_id)
  WHERE jira_comment_id IS NOT NULL;

COMMENT ON COLUMN public.task_comments.jira_comment_id IS 'Jira comment id for idempotent sync';
COMMENT ON COLUMN public.task_comments.jira_author_name IS 'Jira display name when user_id is null';
COMMENT ON COLUMN public.task_comments.jira_author_email IS 'Jira author email when available';

-- ---------------------------------------------------------------------------
-- Time logs (Jira worklogs + future manual entries)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  hours NUMERIC NOT NULL CHECK (hours >= 0),
  started_at TIMESTAMPTZ,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_time_logs_task_id ON public.task_time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_time_logs_source ON public.task_time_logs(source);

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_time_logs_jira_worklog
  ON public.task_time_logs (task_id, ((metadata->>'jira_worklog_id')))
  WHERE source = 'jira' AND (metadata->>'jira_worklog_id') IS NOT NULL;

ALTER TABLE public.task_time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read task_time_logs"
  ON public.task_time_logs FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert task_time_logs"
  ON public.task_time_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own task_time_logs"
  ON public.task_time_logs FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete own task_time_logs"
  ON public.task_time_logs FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.task_time_logs IS 'Per-entry time tracking; Jira sync uses source=jira and metadata.jira_worklog_id';

-- 20260413060903_d731dc93-39f7-4951-9932-6fd5eb662f12.sql
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
  display_order
)
SELECT
  c.id,
  'Jira',
  'jira',
  'Issue tracking and project management by Atlassian (Jira Cloud API token)',
  'api_key',
  '{"authorize_url": "https://auth.atlassian.com/authorize", "token_url": "https://auth.atlassian.com/oauth/token", "scopes": ["read:jira-work", "write:jira-work"]}'::jsonb,
  'https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro',
  true,
  false,
  10
FROM public.integration_categories c
WHERE c.slug = 'project-management'
ON CONFLICT (slug) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  auth_type = 'api_key',
  oauth_config = COALESCE(integration_providers.oauth_config, EXCLUDED.oauth_config),
  docs_url = EXCLUDED.docs_url,
  is_available = true,
  is_coming_soon = false,
  display_order = COALESCE(integration_providers.display_order, EXCLUDED.display_order);

-- 20260413062001_3e07cf20-a7d2-4a10-9700-5b518d91d076.sql
DO $$
DECLARE
  jid UUID;
BEGIN
  SELECT id INTO jid FROM public.integration_providers WHERE slug = 'jira' LIMIT 1;
  IF jid IS NULL THEN
    RAISE NOTICE 'jira provider not found; skip integration_fields';
    RETURN;
  END IF;

  INSERT INTO public.integration_fields (
    provider_id,
    field_key,
    label,
    field_type,
    placeholder,
    is_required,
    is_sensitive,
    help_text,
    display_order
  )
  SELECT
    jid,
    v.field_key,
    v.label,
    v.field_type::text,
    v.placeholder,
    v.is_required,
    v.is_sensitive,
    v.help_text,
    v.display_order
  FROM (VALUES
    ('jira_host', 'Jira site URL', 'url', 'https://your-domain.atlassian.net', true, false,
     'Your Jira Cloud site base URL (with or without https://). Must match JIRA_HOST secret for sync.', 10),
    ('jira_email', 'Atlassian account email', 'email', 'you@company.com', true, false,
     'Email for the Atlassian account used to create the API token. Same as JIRA_EMAIL secret.', 20),
    ('jira_api_token', 'API token', 'password', 'API token from id.atlassian.com', true, true,
     'Create at https://id.atlassian.com/manage-profile/security/api-tokens — also set as JIRA_API_TOKEN secret for Edge sync.', 30)
  ) AS v(field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
  ON CONFLICT (provider_id, field_key) DO UPDATE SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;
END $$;

-- 20260413104814_8207002e-9d42-4b7d-ba12-aca9cf769124.sql
DO $$
DECLARE
  pm_category_id UUID;
  float_provider_id UUID;
BEGIN
  SELECT id INTO pm_category_id
  FROM public.integration_categories
  WHERE slug = 'project-management'
  LIMIT 1;

  IF pm_category_id IS NULL THEN
    RAISE EXCEPTION 'integration category project-management not found';
  END IF;

  INSERT INTO public.integration_providers (
    category_id,
    name,
    slug,
    description,
    auth_type,
    docs_url,
    is_available,
    is_coming_soon,
    display_order
  )
  VALUES (
    pm_category_id,
    'Float',
    'float',
    'Resource scheduling platform for people, projects, and allocations',
    'api_key',
    'https://developer.float.com',
    true,
    false,
    60
  )
  ON CONFLICT (slug) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    auth_type = EXCLUDED.auth_type,
    docs_url = EXCLUDED.docs_url,
    is_available = EXCLUDED.is_available,
    is_coming_soon = EXCLUDED.is_coming_soon,
    display_order = EXCLUDED.display_order;

  SELECT id INTO float_provider_id
  FROM public.integration_providers
  WHERE slug = 'float'
  LIMIT 1;

  INSERT INTO public.integration_fields (
    provider_id,
    field_key,
    label,
    field_type,
    placeholder,
    is_required,
    is_sensitive,
    help_text,
    display_order
  )
  VALUES
    (
      float_provider_id,
      'float_api_key',
      'Float API key',
      'password',
      'Paste your Float personal access token',
      true,
      true,
      'Create in Float profile settings. Used by sync-float-schedule.',
      10
    ),
    (
      float_provider_id,
      'float_base_url',
      'Float API base URL',
      'url',
      'https://api.float.com/v3',
      false,
      false,
      'Optional override. Default is https://api.float.com/v3',
      20
    )
  ON CONFLICT (provider_id, field_key) DO UPDATE SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;
END $$;

CREATE TABLE IF NOT EXISTS public.float_synced_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  float_people_id TEXT NOT NULL,
  name TEXT,
  email TEXT,
  role TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT float_synced_people_unique UNIQUE (float_people_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.float_synced_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  float_project_id TEXT NOT NULL,
  name TEXT,
  client_name TEXT,
  projects_linked BOOLEAN NOT NULL DEFAULT false,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT float_synced_projects_unique UNIQUE (float_project_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.float_synced_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  float_allocation_id TEXT NOT NULL,
  float_people_id TEXT,
  float_project_id TEXT,
  starts_at DATE,
  ends_at DATE,
  hours NUMERIC,
  source_type TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT float_synced_allocations_unique UNIQUE (float_allocation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_float_people_user ON public.float_synced_people(user_id);
CREATE INDEX IF NOT EXISTS idx_float_projects_user ON public.float_synced_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_float_allocations_user ON public.float_synced_allocations(user_id);

ALTER TABLE public.float_synced_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.float_synced_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.float_synced_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read float_synced_people" ON public.float_synced_people;
DROP POLICY IF EXISTS "Authenticated users can read float_synced_projects" ON public.float_synced_projects;
DROP POLICY IF EXISTS "Authenticated users can read float_synced_allocations" ON public.float_synced_allocations;

CREATE POLICY "Authenticated users can read float_synced_people"
  ON public.float_synced_people FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read float_synced_projects"
  ON public.float_synced_projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read float_synced_allocations"
  ON public.float_synced_allocations FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.float_synced_people TO authenticated;
GRANT SELECT ON public.float_synced_projects TO authenticated;
GRANT SELECT ON public.float_synced_allocations TO authenticated;
REVOKE ALL ON public.float_synced_people FROM anon;
REVOKE ALL ON public.float_synced_projects FROM anon;
REVOKE ALL ON public.float_synced_allocations FROM anon;

-- 20260413120000_zoho_crm_integration.sql
-- Zoho CRM: enable provider, admin fields, cache tables for deal detail tabs

-- 1) Provider availability + OAuth scopes (settings API used for token validation)
UPDATE public.integration_providers
SET
  is_available = true,
  is_coming_soon = false,
  oauth_config = jsonb_set(
    COALESCE(oauth_config, '{}'::jsonb),
    '{scopes}',
    '["ZohoCRM.modules.ALL", "ZohoCRM.settings.ALL"]'::jsonb,
    true
  )
WHERE slug = 'zoho-crm';

-- 2) Integration fields for org/user OAuth admin UI (client credentials in config)
DO $$
DECLARE
  zid UUID;
BEGIN
  SELECT id INTO zid FROM public.integration_providers WHERE slug = 'zoho-crm' LIMIT 1;
  IF zid IS NULL THEN
    RAISE NOTICE 'zoho-crm provider not found; skip integration_fields';
    RETURN;
  END IF;

  INSERT INTO public.integration_fields (
    provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order
  ) VALUES
    (zid, 'zoho_client_id', 'Zoho Client ID', 'text', '1000.xxx', true, false, 'From Zoho API Console (Server-based client)', 10),
    (zid, 'zoho_client_secret', 'Zoho Client Secret', 'password', '••••••••', true, true, 'Keep secret; stored in integration config', 20),
    (zid, 'zoho_redirect_uri', 'Redirect URI', 'url', 'https://…/functions/v1/user-oauth-callback', false, false, 'Must match Zoho API Console redirect URL', 30),
    (zid, 'zoho_accounts_url', 'Accounts domain (optional)', 'url', 'https://accounts.zoho.com', false, false, 'EU/IN/AU accounts host if not US', 40)
  ON CONFLICT (provider_id, field_key) DO UPDATE SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;
END $$;

-- 3) Deal tab cache tables
CREATE TABLE IF NOT EXISTS public.zoho_deal_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  zoho_attachment_id TEXT NOT NULL,
  file_name TEXT,
  size_bytes BIGINT,
  content_type TEXT,
  download_url TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, zoho_attachment_id)
);

CREATE TABLE IF NOT EXISTS public.zoho_deal_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  zoho_module TEXT NOT NULL,
  zoho_record_id TEXT NOT NULL,
  title TEXT,
  content TEXT,
  activity_type TEXT,
  occurred_at TIMESTAMPTZ,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, zoho_module, zoho_record_id)
);

CREATE TABLE IF NOT EXISTS public.zoho_deal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  zoho_event_id TEXT NOT NULL,
  title TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  location TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, zoho_event_id)
);

CREATE TABLE IF NOT EXISTS public.zoho_contact_enrichment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  zoho_contact_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id)
);

CREATE TABLE IF NOT EXISTS public.zoho_account_enrichment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  zoho_account_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id)
);

CREATE INDEX IF NOT EXISTS idx_zoho_deal_attachments_deal ON public.zoho_deal_attachments(deal_id);
CREATE INDEX IF NOT EXISTS idx_zoho_deal_engagements_deal ON public.zoho_deal_engagements(deal_id);
CREATE INDEX IF NOT EXISTS idx_zoho_deal_events_deal ON public.zoho_deal_events(deal_id);
CREATE INDEX IF NOT EXISTS idx_zoho_contact_enrichment_deal ON public.zoho_contact_enrichment(deal_id);
CREATE INDEX IF NOT EXISTS idx_zoho_account_enrichment_deal ON public.zoho_account_enrichment(deal_id);

ALTER TABLE public.zoho_deal_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoho_deal_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoho_deal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoho_contact_enrichment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoho_account_enrichment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage zoho_deal_attachments" ON public.zoho_deal_attachments;
CREATE POLICY "Authenticated users can manage zoho_deal_attachments"
  ON public.zoho_deal_attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage zoho_deal_engagements" ON public.zoho_deal_engagements;
CREATE POLICY "Authenticated users can manage zoho_deal_engagements"
  ON public.zoho_deal_engagements FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage zoho_deal_events" ON public.zoho_deal_events;
CREATE POLICY "Authenticated users can manage zoho_deal_events"
  ON public.zoho_deal_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage zoho_contact_enrichment" ON public.zoho_contact_enrichment;
CREATE POLICY "Authenticated users can manage zoho_contact_enrichment"
  ON public.zoho_contact_enrichment FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage zoho_account_enrichment" ON public.zoho_account_enrichment;
CREATE POLICY "Authenticated users can manage zoho_account_enrichment"
  ON public.zoho_account_enrichment FOR ALL TO authenticated USING (true) WITH CHECK (true);


