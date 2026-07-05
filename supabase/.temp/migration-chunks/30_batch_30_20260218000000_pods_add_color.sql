-- 20260215_meetings_v2_standalone.sql
-- ============================================================================
-- Meetings Module V2 Standalone Implementation
-- ============================================================================
-- Creates meetings_v2 table and supporting tables as specified in the
-- standalone implementation plan. This is a complete, self-contained schema.
-- ============================================================================

-- ========================
-- Enums
-- ========================
CREATE TYPE meeting_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE meeting_type AS ENUM ('internal', 'client', 'project', 'l10', 'one_on_one');

-- ========================
-- Table: meetings_v2
-- ========================
CREATE TABLE IF NOT EXISTS meetings_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type meeting_type NOT NULL DEFAULT 'internal',
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  location TEXT,
  timezone TEXT DEFAULT 'UTC',
  status meeting_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  notify_participants BOOLEAN DEFAULT false,
  -- Recurrence
  recurrence_pattern TEXT,          -- 'daily', 'weekly', 'biweekly', 'monthly', 'none'
  recurrence_interval INTEGER DEFAULT 1,
  recurrence_days_of_week INTEGER[],
  recurrence_day_of_month INTEGER,
  recurrence_end_date DATE,
  parent_meeting_id UUID REFERENCES meetings_v2(id),
  -- Relationships
  client_id UUID,                   -- FK to clients
  project_id UUID,                  -- FK to projects
  deal_id UUID,                     -- FK to deals
  -- Content
  recording_url TEXT,
  transcript_content JSONB,
  transcript_text TEXT,
  ai_summary JSONB,
  categorization_confidence NUMERIC,
  is_categorized BOOLEAN DEFAULT false,
  -- Metadata
  slug TEXT UNIQUE,
  created_by UUID,                  -- FK to auth.users
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- Table: meeting_participants_v2
-- ========================
CREATE TABLE IF NOT EXISTS meeting_participants_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings_v2(id) ON DELETE CASCADE,
  user_id UUID,                     -- FK to profiles (NULL for external)
  external_email TEXT,              -- For non-system participants
  external_name TEXT,
  role TEXT NOT NULL DEFAULT 'required',  -- 'organizer', 'required', 'optional'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'tentative'
  attended BOOLEAN DEFAULT false,
  notes TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Table: meeting_agenda_items
-- ========================
CREATE TABLE IF NOT EXISTS meeting_agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings_v2(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Table: meeting_takeaways
-- ========================
CREATE TABLE IF NOT EXISTS meeting_takeaways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings_v2(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  assigned_to UUID,
  due_date DATE,
  status TEXT DEFAULT 'open',      -- 'open', 'in_progress', 'completed'
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Table: meeting_categorizations
-- ========================
CREATE TABLE IF NOT EXISTS meeting_categorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_file_id UUID REFERENCES meeting_files(id),
  category TEXT,
  confidence NUMERIC,
  is_verified BOOLEAN DEFAULT false,
  verified_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_meetings_v2_slug ON meetings_v2(slug);
CREATE INDEX IF NOT EXISTS idx_meetings_v2_scheduled ON meetings_v2(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meetings_v2_status ON meetings_v2(status);
CREATE INDEX IF NOT EXISTS idx_meetings_v2_type ON meetings_v2(type);
CREATE INDEX IF NOT EXISTS idx_meetings_v2_client ON meetings_v2(client_id);
CREATE INDEX IF NOT EXISTS idx_meetings_v2_project ON meetings_v2(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_v2_created_by ON meetings_v2(created_by);
CREATE INDEX IF NOT EXISTS idx_meetings_v2_parent ON meetings_v2(parent_meeting_id);

CREATE INDEX IF NOT EXISTS idx_participants_v2_meeting ON meeting_participants_v2(meeting_id);
CREATE INDEX IF NOT EXISTS idx_participants_v2_user ON meeting_participants_v2(user_id);

-- Add attended column if it doesn't exist (for existing installations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meeting_participants_v2' AND column_name = 'attended'
  ) THEN
    ALTER TABLE meeting_participants_v2 ADD COLUMN attended BOOLEAN DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agenda_items_meeting ON meeting_agenda_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_agenda_items_order ON meeting_agenda_items(meeting_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_takeaways_meeting ON meeting_takeaways(meeting_id);
CREATE INDEX IF NOT EXISTS idx_takeaways_assigned ON meeting_takeaways(assigned_to);

CREATE INDEX IF NOT EXISTS idx_categorizations_file ON meeting_categorizations(meeting_file_id);

-- ========================
-- RLS Policies
-- ========================
ALTER TABLE meetings_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all meetings" ON meetings_v2
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create meetings" ON meetings_v2
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own meetings" ON meetings_v2
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own meetings" ON meetings_v2
  FOR DELETE USING (auth.uid() = created_by);

ALTER TABLE meeting_participants_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all participants" ON meeting_participants_v2
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage participants" ON meeting_participants_v2
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE meeting_agenda_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all agenda items" ON meeting_agenda_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage agenda items" ON meeting_agenda_items
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE meeting_takeaways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all takeaways" ON meeting_takeaways
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage takeaways" ON meeting_takeaways
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE meeting_categorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all categorizations" ON meeting_categorizations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage categorizations" ON meeting_categorizations
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ========================
-- Update meeting_files table (add missing columns if needed)
-- ========================
DO $$
BEGIN
  -- Add columns to meeting_files if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'slug') THEN
    ALTER TABLE meeting_files ADD COLUMN slug TEXT UNIQUE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'zoom_meeting_id') THEN
    ALTER TABLE meeting_files ADD COLUMN zoom_meeting_id BIGINT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'zoom_meeting_uuid') THEN
    ALTER TABLE meeting_files ADD COLUMN zoom_meeting_uuid TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'meeting_topic') THEN
    ALTER TABLE meeting_files ADD COLUMN meeting_topic TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'meeting_start_time') THEN
    ALTER TABLE meeting_files ADD COLUMN meeting_start_time TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'host_email') THEN
    ALTER TABLE meeting_files ADD COLUMN host_email TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'host_name') THEN
    ALTER TABLE meeting_files ADD COLUMN host_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'participants_count') THEN
    ALTER TABLE meeting_files ADD COLUMN participants_count INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'duration_minutes') THEN
    ALTER TABLE meeting_files ADD COLUMN duration_minutes INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'meeting_category') THEN
    ALTER TABLE meeting_files ADD COLUMN meeting_category TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'categorization_status') THEN
    ALTER TABLE meeting_files ADD COLUMN categorization_status TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'categorization_confidence') THEN
    ALTER TABLE meeting_files ADD COLUMN categorization_confidence NUMERIC;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'categorized_at') THEN
    ALTER TABLE meeting_files ADD COLUMN categorized_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'transcript_summary') THEN
    ALTER TABLE meeting_files ADD COLUMN transcript_summary TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'summary_overview') THEN
    ALTER TABLE meeting_files ADD COLUMN summary_overview TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'next_steps') THEN
    ALTER TABLE meeting_files ADD COLUMN next_steps TEXT[];
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'ai_processing_status') THEN
    ALTER TABLE meeting_files ADD COLUMN ai_processing_status TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'ai_suggestions') THEN
    ALTER TABLE meeting_files ADD COLUMN ai_suggestions JSONB;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'processing_error') THEN
    ALTER TABLE meeting_files ADD COLUMN processing_error TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'last_processed_at') THEN
    ALTER TABLE meeting_files ADD COLUMN last_processed_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'project_id') THEN
    ALTER TABLE meeting_files ADD COLUMN project_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'project_name') THEN
    ALTER TABLE meeting_files ADD COLUMN project_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'project_manager') THEN
    ALTER TABLE meeting_files ADD COLUMN project_manager TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'client_name') THEN
    ALTER TABLE meeting_files ADD COLUMN client_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'client_id') THEN
    ALTER TABLE meeting_files ADD COLUMN client_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'project_match_confidence') THEN
    ALTER TABLE meeting_files ADD COLUMN project_match_confidence NUMERIC;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'assignment_status') THEN
    ALTER TABLE meeting_files ADD COLUMN assignment_status TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'assignment_confidence') THEN
    ALTER TABLE meeting_files ADD COLUMN assignment_confidence NUMERIC;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'suggested_client_id') THEN
    ALTER TABLE meeting_files ADD COLUMN suggested_client_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'suggested_project_id') THEN
    ALTER TABLE meeting_files ADD COLUMN suggested_project_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'assignment_reasoning') THEN
    ALTER TABLE meeting_files ADD COLUMN assignment_reasoning TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'reviewed_by') THEN
    ALTER TABLE meeting_files ADD COLUMN reviewed_by UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'reviewed_at') THEN
    ALTER TABLE meeting_files ADD COLUMN reviewed_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'embedding_status') THEN
    ALTER TABLE meeting_files ADD COLUMN embedding_status TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'embedding_generated_at') THEN
    ALTER TABLE meeting_files ADD COLUMN embedding_generated_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'embedding_chunks_count') THEN
    ALTER TABLE meeting_files ADD COLUMN embedding_chunks_count INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'meeting_id_v2') THEN
    ALTER TABLE meeting_files ADD COLUMN meeting_id_v2 UUID REFERENCES meetings_v2(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'meeting_type') THEN
    ALTER TABLE meeting_files ADD COLUMN meeting_type TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'zoom_account_name') THEN
    ALTER TABLE meeting_files ADD COLUMN zoom_account_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'zoom_account_id') THEN
    ALTER TABLE meeting_files ADD COLUMN zoom_account_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'deleted_at') THEN
    ALTER TABLE meeting_files ADD COLUMN deleted_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add indexes for meeting_files new columns
CREATE INDEX IF NOT EXISTS idx_meeting_files_slug ON meeting_files(slug);
CREATE INDEX IF NOT EXISTS idx_meeting_files_zoom_meeting_id ON meeting_files(zoom_meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_files_meeting_id_v2 ON meeting_files(meeting_id_v2);
CREATE INDEX IF NOT EXISTS idx_meeting_files_category ON meeting_files(meeting_category);
CREATE INDEX IF NOT EXISTS idx_meeting_files_categorization_status ON meeting_files(categorization_status);
CREATE INDEX IF NOT EXISTS idx_meeting_files_assignment_status ON meeting_files(assignment_status);
CREATE INDEX IF NOT EXISTS idx_meeting_files_embedding_status ON meeting_files(embedding_status);

-- Ensure meeting_files RLS allows authenticated users to read all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'meeting_files' 
    AND policyname = 'Users can read all transcripts'
  ) THEN
    ALTER TABLE meeting_files ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can read all transcripts" ON meeting_files
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;



-- 20260216114709_9470ab13-0ee0-4d61-8ead-551910e96c07.sql
ALTER TABLE public.sendgrid_config ADD COLUMN IF NOT EXISTS api_key TEXT;

-- 20260216115418_ab283c64-6f78-42fa-ba02-77f2d6857b8a.sql
UPDATE public.sendgrid_config SET is_enabled = true WHERE id = '37fc656d-d24f-467d-9d6f-4f129797bf0d';

-- 20260216120000_sendgrid_admin_integration.sql
-- ============================================================================
-- SendGrid Admin Integration
-- integrations table for status tracking, sendgrid_config cleanup (no API key in DB)
-- ============================================================================

-- Simple integrations table for status (slug, name, status, last_sync)
-- Used by dedicated SendGrid admin page - not the generic Integration Hub
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('connected', 'disconnected', 'error')),
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integrations_slug ON integrations(slug);

CREATE TRIGGER set_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view integrations"
  ON integrations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage integrations"
  ON integrations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed SendGrid integration row
INSERT INTO integrations (slug, name, status)
VALUES ('sendgrid', 'SendGrid', 'disconnected')
ON CONFLICT (slug) DO NOTHING;

-- API key: support UI submission for now (optional; also supports Supabase secrets)
-- Remove old encrypted column if present, add plain api_key for UI
ALTER TABLE sendgrid_config DROP COLUMN IF EXISTS api_key_encrypted;
ALTER TABLE sendgrid_config ADD COLUMN IF NOT EXISTS api_key TEXT;

-- Update get_or_create_sendgrid_config
CREATE OR REPLACE FUNCTION get_or_create_sendgrid_config()
RETURNS sendgrid_config AS $$
DECLARE config sendgrid_config;
BEGIN
  SELECT * INTO config FROM sendgrid_config LIMIT 1;
  IF config IS NULL THEN
    INSERT INTO sendgrid_config (from_email, from_name, is_enabled, webhook_url, webhook_secret, enable_open_tracking, enable_click_tracking)
    VALUES ('noreply@sjinnovation.com', 'SJ Innovation', false, NULL, NULL, true, true)
    RETURNING * INTO config;
  END IF;
  RETURN config;
END;
$$ LANGUAGE plpgsql;


-- 20260216140000_feedback_community_view.sql
-- Migration: Allow all authenticated users to view all feedback (community view)
-- Also adds module, priority, and assigned_to columns for admin controls

-- Step 1: Drop existing SELECT policies
DROP POLICY IF EXISTS "Users can view their own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback;

-- Step 2: Create new unified SELECT policy for all authenticated users
CREATE POLICY "All authenticated users can view feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (true);

-- Step 3: Add new columns for admin controls and detail page
ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS module text,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);

-- Step 4: Index new columns
CREATE INDEX IF NOT EXISTS idx_feedback_module ON public.feedback(module);
CREATE INDEX IF NOT EXISTS idx_feedback_priority ON public.feedback(priority);
CREATE INDEX IF NOT EXISTS idx_feedback_assigned_to ON public.feedback(assigned_to);


-- 20260217_admin_eos_scorecards.sql
-- ============================================================================
-- Admin EOS Scorecards — RLS, pod linkage, triggers
-- ============================================================================
-- Implements admin-only management for scorecards per implementation plan.
-- - Admin-only INSERT/UPDATE/DELETE on scorecards and scorecard_metrics
-- - Add pod_id to eos_scorecards for template–pod linkage
-- - Add updated_at triggers
-- ============================================================================

-- Add pod_id to eos_scorecards (optional template–pod linkage)
ALTER TABLE eos_scorecards
  ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES eos_pods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_eos_scorecards_pod_id ON eos_scorecards(pod_id);

-- Triggers for updated_at (uses update_updated_at_column from earlier migrations)
DROP TRIGGER IF EXISTS update_eos_scorecards_updated_at ON eos_scorecards;
CREATE TRIGGER update_eos_scorecards_updated_at
  BEFORE UPDATE ON eos_scorecards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_eos_scorecard_metrics_updated_at ON eos_scorecard_metrics;
CREATE TRIGGER update_eos_scorecard_metrics_updated_at
  BEFORE UPDATE ON eos_scorecard_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- RLS: Admin-only management for scorecards
-- ============================================================================

-- Drop permissive "authenticated can manage" policies
DROP POLICY IF EXISTS "Authenticated users can manage scorecards" ON eos_scorecards;
DROP POLICY IF EXISTS "Authenticated users can manage metrics" ON eos_scorecard_metrics;

-- Scorecards: SELECT for authenticated; INSERT/UPDATE/DELETE for admins only
CREATE POLICY "Admins can manage scorecards"
  ON eos_scorecards
  FOR ALL
  TO authenticated
  USING (
    (auth.uid() IS NOT NULL)
    AND (
      -- SELECT: any authenticated user
      (TG_OP IS NULL OR current_setting('request.jwt.claim.role', true) IS NOT NULL)
      OR public.is_admin()
    )
  )
  WITH CHECK (public.is_admin());

-- Simpler approach: separate SELECT (authenticated) from INSERT/UPDATE/DELETE (admin)
-- Re-create: SELECT for authenticated (keep existing)
-- The existing "Authenticated users can view scorecards" handles SELECT.
-- We only need to replace the "manage" with admin-only for INSERT/UPDATE/DELETE.

-- Drop the complex policy we just created and do it properly:
DROP POLICY IF EXISTS "Admins can manage scorecards" ON eos_scorecards;

CREATE POLICY "Admins can insert scorecards"
  ON eos_scorecards FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update scorecards"
  ON eos_scorecards FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete scorecards"
  ON eos_scorecards FOR DELETE TO authenticated
  USING (public.is_admin());

-- Scorecard metrics: SELECT for authenticated; INSERT/UPDATE/DELETE for admins
CREATE POLICY "Admins can insert scorecard metrics"
  ON eos_scorecard_metrics FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update scorecard metrics"
  ON eos_scorecard_metrics FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete scorecard metrics"
  ON eos_scorecard_metrics FOR DELETE TO authenticated
  USING (public.is_admin());


-- 20260217_eos_scorecard_metrics_notes.sql
-- Add notes column to eos_scorecard_metrics for pod/role/commentary (JSON string)
ALTER TABLE eos_scorecard_metrics
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN eos_scorecard_metrics.notes IS 'JSON string: { podId?, role?, commentary? }';


-- 20260217_eos_sla_targets.sql
-- ============================================================================
-- EOS SLA Targets — Approval rate and cycle time targets by pod/role
-- ============================================================================
-- Used by Admin EOS Accountability: SLA targets configuration and analytics.
-- One fallback row (pod_id and role_name both null); per-pod and per-role rows.
-- ============================================================================

CREATE TABLE IF NOT EXISTS eos_sla_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID REFERENCES eos_pods(id) ON DELETE CASCADE,
  role_name TEXT,
  approval_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 90 CHECK (approval_rate_pct >= 0 AND approval_rate_pct <= 100),
  cycle_time_days NUMERIC(5,2) NOT NULL DEFAULT 5 CHECK (cycle_time_days >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT eos_sla_targets_pod_or_role_or_fallback CHECK (
    (pod_id IS NOT NULL AND role_name IS NULL) OR
    (pod_id IS NULL AND role_name IS NOT NULL) OR
    (pod_id IS NULL AND role_name IS NULL)
  )
);

-- One fallback (null,null), one row per pod (pod_id, null), one per role (null, role_name)
CREATE UNIQUE INDEX IF NOT EXISTS idx_eos_sla_targets_entity_unique
  ON eos_sla_targets (pod_id, role_name) NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS idx_eos_sla_targets_pod ON eos_sla_targets (pod_id);
CREATE INDEX IF NOT EXISTS idx_eos_sla_targets_role ON eos_sla_targets (role_name);

ALTER TABLE eos_sla_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view SLA targets" ON eos_sla_targets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage SLA targets" ON eos_sla_targets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed single fallback row if none exists
INSERT INTO eos_sla_targets (pod_id, role_name, approval_rate_pct, cycle_time_days)
SELECT NULL, NULL, 90, 5
WHERE NOT EXISTS (SELECT 1 FROM eos_sla_targets WHERE pod_id IS NULL AND role_name IS NULL);


-- 20260218000000_pods_add_color.sql
-- Add color to pods for POD Management UI (Create/Edit POD)
ALTER TABLE public.pods
ADD COLUMN IF NOT EXISTS color TEXT;

COMMENT ON COLUMN public.pods.color IS 'Hex or preset color key for POD display (e.g. #3b82f6 or blue)';


