-- 20260225043935_31375bd6-03a7-40d4-8188-69eb298423e9.sql

-- Add project members
INSERT INTO project_members (project_id, user_id, role) VALUES
  ('3ecefe6b-556a-4abf-ade5-6843c807f7ce', 'd2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39', 'member'),
  ('1c8ad1e2-8318-4b50-9e4b-47082dec46c5', 'd2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39', 'member'),
  ('3ecefe6b-556a-4abf-ade5-6843c807f7ce', 'e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'manager'),
  ('1c8ad1e2-8318-4b50-9e4b-47082dec46c5', 'e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'manager'),
  ('7dc6bd63-56ec-4697-87a7-f4cee514ceaa', 'e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'manager'),
  ('433fb262-7ab2-4a2c-b26d-c40a1eb70d76', 'c4642966-5969-4d55-b3a6-ce850c1e2786', 'viewer')
ON CONFLICT DO NOTHING;

-- Create current-week meetings
INSERT INTO meetings (id, title, description, organizer_id, scheduled_at, duration_minutes, status, meeting_type, slug, summary, action_items, notes) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001',
   'Sprint Planning — Platform V2',
   'Plan sprint deliverables for the next two weeks including SSO integration, CSV export, and monitoring setup.',
   '78657387-d518-4b2e-88d8-eca802372ad5',
   date_trunc('week', now()) + interval '1 day 10 hours',
   60, 'scheduled', 'internal', 'sprint-planning-platform-v2',
   'Team aligned on 3 key deliverables: SSO integration (IC lead), CSV export for productivity module, and monitoring alerts setup.',
   '["IC to complete SSO Entra integration by March 3", "PM to finalize CSV export requirements", "Admin to configure monitoring alerts in Datadog"]',
   'Sprint velocity target: 34 points. Carry-over from last sprint: 8 points.'),
  ('a1b2c3d4-0002-4000-8000-000000000002',
   'Acme Corp — Quarterly Business Review',
   'Review Q4 performance metrics, discuss renewal terms, and present roadmap for Q1.',
   'e46a6d4e-d69e-4bf5-9341-ba998e8da243',
   date_trunc('week', now()) + interval '2 days 14 hours',
   90, 'scheduled', 'client', 'acme-corp-qbr',
   'Acme expressed strong satisfaction with platform adoption (87% DAU). Renewal confirmed at +15% uplift.',
   '["Send updated pricing proposal by Friday", "Schedule technical deep-dive on SSO for Acme IT team", "Share Q1 product roadmap PDF"]',
   'Key stakeholders present: VP Engineering, Director of Product, IT Manager. NPS score: 9/10.'),
  ('a1b2c3d4-0003-4000-8000-000000000003',
   'FinEdge — Proof of Concept Demo',
   'Live demo of the platform for FinEdge evaluation team. Focus on compliance features and audit trail.',
   'e46a6d4e-d69e-4bf5-9341-ba998e8da243',
   date_trunc('week', now()) + interval '3 days 11 hours',
   45, 'scheduled', 'client', 'finedge-poc-demo',
   NULL, NULL,
   'Prepare demo environment with sample compliance data. Focus areas: audit logs, RLS, data export.'),
  ('a1b2c3d4-0004-4000-8000-000000000004',
   'Leadership Sync — Growth Strategy',
   'Weekly leadership alignment on growth targets, hiring pipeline, and product strategy.',
   'c4642966-5969-4d55-b3a6-ce850c1e2786',
   date_trunc('week', now()) + interval '4 days 9 hours',
   30, 'scheduled', 'internal', 'leadership-sync-growth',
   'Agreed to accelerate hiring for 2 senior engineers. Q1 revenue tracking 12% above forecast.',
   '["HR to post senior engineer roles by Monday", "CEO to finalize partnership term sheet with CloudNova", "PM to present PLG metrics dashboard next week"]',
   'Attendees: CEO, Admin/CTO, PM lead. Mood: optimistic.')
ON CONFLICT (id) DO NOTHING;

-- Add meeting participants (roles: organizer, presenter, attendee, optional)
INSERT INTO meeting_participants (meeting_id, user_id, role, rsvp_status) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', '78657387-d518-4b2e-88d8-eca802372ad5', 'organizer', 'accepted'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'd2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39', 'attendee', 'accepted'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'attendee', 'accepted'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'organizer', 'accepted'),
  ('a1b2c3d4-0002-4000-8000-000000000002', '78657387-d518-4b2e-88d8-eca802372ad5', 'attendee', 'accepted'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'c4642966-5969-4d55-b3a6-ce850c1e2786', 'optional', 'tentative'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'organizer', 'accepted'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'd2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39', 'attendee', 'accepted'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'c4642966-5969-4d55-b3a6-ce850c1e2786', 'organizer', 'accepted'),
  ('a1b2c3d4-0004-4000-8000-000000000004', '78657387-d518-4b2e-88d8-eca802372ad5', 'attendee', 'accepted'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'attendee', 'accepted')
ON CONFLICT DO NOTHING;

-- Seed AI digest logs
INSERT INTO ai_digest_logs (user_id, digest_type, subject, summary, was_read, sent_at) VALUES
  ('78657387-d518-4b2e-88d8-eca802372ad5', 'daily', 'Your Daily Digest — Feb 25',
   '{"highlights": ["Sprint Planning scheduled for tomorrow at 10 AM", "3 tasks in progress: SSO, Newsletter, Access Review", "Acme QBR on Wednesday"], "tasks_due": 3, "meetings_today": 1, "action_items": 2}'::jsonb,
   false, now() - interval '2 hours'),
  ('c4642966-5969-4d55-b3a6-ce850c1e2786', 'daily', 'CEO Daily Brief — Feb 25',
   '{"highlights": ["Q1 revenue tracking 12% above forecast", "Leadership Sync scheduled for Thursday", "2 pending decisions: Acme billing, quarterly review"], "tasks_due": 2, "meetings_today": 0, "action_items": 1}'::jsonb,
   false, now() - interval '2 hours'),
  ('e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'daily', 'PM Daily Digest — Feb 25',
   '{"highlights": ["Acme Corp onboarding in progress — 60% complete", "FinEdge POC demo on Thursday", "Case study draft due this week", "3 projects actively managed"], "tasks_due": 4, "meetings_today": 0, "action_items": 3}'::jsonb,
   false, now() - interval '2 hours'),
  ('d2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39', 'daily', 'Your Daily Digest — Feb 25',
   '{"highlights": ["SSO integration — in progress, targeting March 3", "Sprint Planning tomorrow at 10 AM", "FinEdge demo prep needed by Thursday", "6 tasks assigned, 1 in progress"], "tasks_due": 5, "meetings_today": 0, "action_items": 2}'::jsonb,
   false, now() - interval '2 hours');


-- 20260225044009_43923acb-311b-4af9-adef-732c175d8491.sql

-- Reassign tasks to IC user
UPDATE tasks SET assigned_to = 'd2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39' WHERE id IN (
  '616f770d-adbd-4d91-aee8-40829463537d',
  'bbfa70c6-1621-44ad-9b5e-4faf1ecf05e5',
  '5c72dc63-7668-4af7-a64b-9abd73692dc1',
  'ed8f7f79-db1f-4999-b812-8d13ce628617',
  'fa9982cd-804c-4826-93fe-c93f5695cb15',
  '0db6565f-a9f7-44bc-99f3-237bdf7b354e'
);

-- Reassign tasks to PM/demo user
UPDATE tasks SET assigned_to = 'e46a6d4e-d69e-4bf5-9341-ba998e8da243' WHERE id IN (
  '8cfd6ea6-1227-42a9-94ca-44c4f7b9ca7d',
  'bc075ebb-f1b6-413c-8c4d-db0030e0603a',
  '2cbdc06b-dcb7-427d-914c-ad533fa04905',
  '9cd857a6-041c-402e-be0b-c521c59d7dc2'
);

-- Reassign tasks to CEO user
UPDATE tasks SET assigned_to = 'c4642966-5969-4d55-b3a6-ce850c1e2786' WHERE id IN (
  '602a5bbb-359a-4dba-9f79-ea6f5b71be5a',
  'dad3e2f3-8e11-4a27-83d1-78e2320758f1'
);


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


