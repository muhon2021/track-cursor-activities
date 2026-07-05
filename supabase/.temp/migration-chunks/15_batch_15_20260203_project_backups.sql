-- 20260202110100_match_embeddings_filters.sql
-- Extend match_embeddings to support optional entity_type and user_id filters
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_entity_type text DEFAULT NULL,
  filter_user_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL  -- alias for filter_user_id for backward compatibility
)
RETURNS TABLE (
  id uuid,
  entity_type text,
  entity_id text,
  content text,
  metadata jsonb,
  user_id uuid,
  similarity float,
  unified_document_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.entity_type,
    e.entity_id::text,
    e.content,
    e.metadata,
    e.user_id,
    (1 - (e.embedding <=> query_embedding))::float as similarity,
    e.unified_document_id
  FROM public.embeddings e
  WHERE (1 - (e.embedding <=> query_embedding)) > match_threshold
    AND (filter_entity_type IS NULL OR e.entity_type = filter_entity_type)
    AND (COALESCE(filter_user_id, p_user_id) IS NULL OR e.user_id = COALESCE(filter_user_id, p_user_id))
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_embeddings IS 'Vector similarity search with optional entity_type and user_id filters';


-- 20260202120000_seed_knowledge_dummy_data.sql
-- ============================================================================
-- Seed Knowledge Base with Demo Data
-- ============================================================================
-- Adds sample categories, sources, entries, and files so the Knowledge
-- module has meaningful data out of the box for demos.
-- This migration is idempotent via ON CONFLICT on slugs.
-- ============================================================================

DO $$
BEGIN
  INSERT INTO public.knowledge_categories (name, slug, description, icon, color, sort_order, metadata)
  VALUES (
    'General Knowledge',
    'general-knowledge',
    'High-level internal documentation, FAQs, and onboarding guides.',
    'BookOpen',
    'blue',
    10,
    jsonb_build_object('demo', true)
  )
  ON CONFLICT (slug) DO UPDATE
    SET description = EXCLUDED.description,
        icon = EXCLUDED.icon,
        color = EXCLUDED.color;

  INSERT INTO public.knowledge_categories (name, slug, description, icon, color, sort_order, metadata)
  VALUES (
    'Client Playbooks',
    'client-playbooks',
    'Playbooks, SOPs, and templates for working with clients.',
    'FolderTree',
    'green',
    20,
    jsonb_build_object('demo', true)
  )
  ON CONFLICT (slug) DO UPDATE
    SET description = EXCLUDED.description,
        icon = EXCLUDED.icon,
        color = EXCLUDED.color;

  INSERT INTO public.knowledge_categories (name, slug, description, icon, color, sort_order, metadata)
  VALUES (
    'Meeting Notes',
    'meeting-notes',
    'Important meeting summaries and decision logs.',
    'Calendar',
    'purple',
    30,
    jsonb_build_object('demo', true)
  )
  ON CONFLICT (slug) DO UPDATE
    SET description = EXCLUDED.description,
        icon = EXCLUDED.icon,
        color = EXCLUDED.color;
END $$;

-- 2) Seed knowledge_sources (admin-managed) – schema has no slug; use name + WHERE NOT EXISTS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.knowledge_sources WHERE name = 'Internal Handbook') THEN
    INSERT INTO public.knowledge_sources (name, source_type, config, is_active, last_synced_at, created_at, updated_at)
    VALUES (
      'Internal Handbook',
      'url',
      jsonb_build_object('demo', true, 'url', 'https://example.com/docs/handbook', 'description', 'Core internal handbook and company policies.'),
      true,
      NULL,
      now(),
      now()
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.knowledge_sources WHERE name = 'Client Templates') THEN
    INSERT INTO public.knowledge_sources (name, source_type, config, is_active, last_synced_at, created_at, updated_at)
    VALUES (
      'Client Templates',
      'google_drive',
      jsonb_build_object('demo', true, 'url', 'https://drive.google.com/demo-client-templates', 'description', 'Proposal, SOW, and onboarding templates.'),
      true,
      NULL,
      now(),
      now()
    );
  END IF;
END $$;

-- 3) Seed knowledge_entries (article-style KB)
SELECT
  1
WHERE NOT EXISTS (
  SELECT 1 FROM public.knowledge_entries WHERE slug = 'getting-started-control-tower'
);

DO $$
DECLARE
  v_cat_general UUID;
  v_author UUID;
BEGIN
  SELECT id INTO v_cat_general
  FROM public.knowledge_categories
  WHERE slug = 'general-knowledge';

  -- Use an existing user as author (auth.uid() is null in migration context)
  SELECT id INTO v_author
  FROM auth.users
  ORDER BY created_at
  LIMIT 1;

  IF v_cat_general IS NOT NULL AND v_author IS NOT NULL THEN
    INSERT INTO public.knowledge_entries (
      title,
      slug,
      content,
      summary,
      category_id,
      author_id,
      status,
      tags,
      metadata
    )
    VALUES (
      'Getting Started with the Control Tower',
      'getting-started-control-tower',
      'This article walks through the end-to-end flow of logging in, connecting integrations, and using the Control Tower dashboard for daily operations.',
      'End-to-end overview of how to use the Control Tower for daily work, including modules, navigation, and integrations.',
      v_cat_general,
      v_author,
      'published',
      ARRAY['onboarding', 'overview'],
      jsonb_build_object('demo', true)
    )
    ON CONFLICT (slug) DO NOTHING;
  END IF;
END $$;

-- 4) Seed knowledge_files (document-level KB)
DO $$
DECLARE
  v_cat_general UUID;
  v_cat_clients UUID;
  v_src_internal UUID;
  v_src_client_templates UUID;
BEGIN
  SELECT id INTO v_cat_general FROM public.knowledge_categories WHERE slug = 'general-knowledge';
  SELECT id INTO v_cat_clients FROM public.knowledge_categories WHERE slug = 'client-playbooks';
  SELECT id INTO v_src_internal FROM public.knowledge_sources WHERE name = 'Internal Handbook';
  SELECT id INTO v_src_client_templates FROM public.knowledge_sources WHERE name = 'Client Templates';

  IF v_cat_general IS NOT NULL AND v_src_internal IS NOT NULL THEN
    INSERT INTO public.knowledge_files (
      category_id,
      source_id,
      title,
      file_name,
      file_type,
      file_size,
      storage_path,
      processing_status,
      chunk_count,
      embedding_model,
      metadata,
      uploaded_by,
      processed_at
    )
    VALUES (
      v_cat_general,
      v_src_internal,
      'Control Tower Overview (PDF)',
      'control-tower-overview.pdf',
      'application/pdf',
      123456,
      'demo/knowledge/control-tower-overview.pdf',
      'completed',
      8,
      'text-embedding-3-small',
      jsonb_build_object('demo', true, 'description', 'High-level product overview PDF for demos.'),
      auth.uid(),
      now()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_cat_clients IS NOT NULL AND v_src_client_templates IS NOT NULL THEN
    INSERT INTO public.knowledge_files (
      category_id,
      source_id,
      title,
      file_name,
      file_type,
      file_size,
      storage_path,
      processing_status,
      chunk_count,
      embedding_model,
      metadata,
      uploaded_by,
      processed_at
    )
    VALUES (
      v_cat_clients,
      v_src_client_templates,
      'Client Onboarding Checklist',
      'client-onboarding-checklist.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      45678,
      'demo/knowledge/client-onboarding-checklist.docx',
      'completed',
      5,
      'text-embedding-3-small',
      jsonb_build_object('demo', true, 'description', 'Checklist template for onboarding new clients.'),
      auth.uid(),
      now()
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;



-- 20260202164131_2bfd5f09-737a-4e6c-986b-ce138afe7811.sql
-- Add required OAuth configuration fields for Zoom provider
INSERT INTO integration_fields (provider_id, field_key, label, field_type, is_required, is_sensitive, help_text, display_order)
SELECT 
  ip.id,
  'client_id',
  'Client ID',
  'text',
  true,
  false,
  'Your Zoom OAuth App Client ID from the Zoom Marketplace',
  1
FROM integration_providers ip WHERE ip.slug = 'zoom';

INSERT INTO integration_fields (provider_id, field_key, label, field_type, is_required, is_sensitive, help_text, display_order)
SELECT 
  ip.id,
  'client_secret',
  'Client Secret',
  'password',
  true,
  true,
  'Your Zoom OAuth App Client Secret from the Zoom Marketplace',
  2
FROM integration_providers ip WHERE ip.slug = 'zoom';

-- Also update the oauth_config with proper Zoom OAuth settings
UPDATE integration_providers
SET oauth_config = jsonb_build_object(
  'authorization_url', 'https://zoom.us/oauth/authorize',
  'token_url', 'https://zoom.us/oauth/token',
  'scopes', ARRAY['meeting:read', 'recording:read', 'user:read']
)
WHERE slug = 'zoom';

-- 20260202173537_b1cc1c71-6709-496f-b3b1-c8dc3a2855f1.sql
-- OAuth States table for CSRF protection during OAuth authorization
CREATE TABLE public.oauth_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  redirect_uri TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- RLS Policies for oauth_states
CREATE POLICY "Users can view their own oauth states"
  ON public.oauth_states FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own oauth states"
  ON public.oauth_states FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own oauth states"
  ON public.oauth_states FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster state lookups
CREATE INDEX idx_oauth_states_state ON public.oauth_states(state);
CREATE INDEX idx_oauth_states_expires_at ON public.oauth_states(expires_at);

-- User OAuth Tokens table for storing user credentials
CREATE TABLE public.user_oauth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider_slug TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  scopes TEXT[] DEFAULT '{}',
  account_email TEXT,
  account_name TEXT,
  account_id TEXT,
  account_avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ,
  error_message TEXT,
  error_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider_slug)
);

-- Enable RLS
ALTER TABLE public.user_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_oauth_tokens
CREATE POLICY "Users can view their own oauth tokens"
  ON public.user_oauth_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own oauth tokens"
  ON public.user_oauth_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own oauth tokens"
  ON public.user_oauth_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own oauth tokens"
  ON public.user_oauth_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for user_oauth_tokens
CREATE INDEX idx_user_oauth_tokens_user_id ON public.user_oauth_tokens(user_id);
CREATE INDEX idx_user_oauth_tokens_provider ON public.user_oauth_tokens(provider_slug);
CREATE INDEX idx_user_oauth_tokens_active ON public.user_oauth_tokens(is_active);

-- Trigger for updated_at
CREATE TRIGGER update_user_oauth_tokens_updated_at
  BEFORE UPDATE ON public.user_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 20260202200000_work_types.sql
-- Work Types for project billing and resource planning
CREATE TABLE IF NOT EXISTS work_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'services' CHECK (category IN ('services', 'support', 'admin', 'internal', 'other')),
  is_billable BOOLEAN DEFAULT true,
  default_rate NUMERIC(10, 2),
  color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE work_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read work types"
  ON work_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can manage work types"
  ON work_types FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed default work types
INSERT INTO work_types (name, slug, category, is_billable, default_rate, color, sort_order)
VALUES
  ('Discovery', 'discovery', 'services', true, 150.00, '#8b5cf6', 0),
  ('Development', 'development', 'services', true, 175.00, '#3b82f6', 1),
  ('Design', 'design', 'services', true, 160.00, '#ec4899', 2),
  ('QA / Testing', 'qa-testing', 'services', true, 125.00, '#22c55e', 3),
  ('Project Management', 'project-management', 'services', true, 140.00, '#f59e0b', 4),
  ('Support', 'support', 'support', true, 100.00, '#14b8a6', 5),
  ('Internal Meeting', 'internal-meeting', 'internal', false, NULL, '#6b7280', 6),
  ('Admin / Overhead', 'admin-overhead', 'admin', false, NULL, '#9ca3af', 7)
ON CONFLICT (slug) DO NOTHING;


-- 20260202_admin_exec_sql.sql
-- ============================================================================
-- Admin Seed SQL Executor
-- ============================================================================
-- Provides a SECURITY DEFINER function that admins can call (via edge function)
-- to execute seed SQL scripts from the admin UI.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_exec_sql(sql_content TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $fn$
DECLARE
  err_detail TEXT;
  err_hint   TEXT;
BEGIN
  EXECUTE sql_content;
  RETURN jsonb_build_object('success', true, 'message', 'SQL executed successfully');
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS
    err_detail = PG_EXCEPTION_DETAIL,
    err_hint   = PG_EXCEPTION_HINT;
  RETURN jsonb_build_object(
    'success', false,
    'error',   SQLERRM,
    'state',   SQLSTATE,
    'detail',  COALESCE(err_detail, ''),
    'hint',    COALESCE(err_hint, '')
  );
END;
$fn$;

-- Restrict: only callable via service-role (edge functions), not via anon/authenticated
REVOKE ALL ON FUNCTION public.admin_exec_sql(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_exec_sql(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.admin_exec_sql(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_exec_sql(TEXT) TO service_role;


-- 20260203_productivity_base_tables.sql
-- ============================================================================
-- Path B: Base Project Productivity Tables
-- Migration: 20260203_productivity_base_tables
-- Purpose: Employee productivity tracking (EmployeeProductivity, ActionItem)
--          for parity with sj-control-main. Coexists with existing
--          productivity_records, employee_profiles.
-- ============================================================================

-- ============================================================================
-- HELPER: get_current_user_title for RLS
-- Framework profiles may not have title; use user_roles.role as proxy.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_current_user_title()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM user_roles WHERE user_id = auth.uid() LIMIT 1),
    (SELECT title FROM profiles WHERE id = auth.uid() LIMIT 1),
    'user'
  );
$$;

-- Add title to profiles if missing (for get_current_user_title compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'title'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN title TEXT;
  END IF;
END $$;

-- ============================================================================
-- EMPLOYEE TABLE (base project - PascalCase)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public."Employee" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  title TEXT,
  role TEXT,
  "reportingManagerId" UUID REFERENCES public."Employee"(id) ON DELETE SET NULL,
  "reportingManagerEmail" TEXT,
  "reportingManagerName" TEXT,
  "dottedLineManagerEmail" TEXT,
  location TEXT,
  department TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- ACTION ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public."ActionItem" (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  summary TEXT,
  status TEXT,
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
  week TEXT,
  "excludeFromScoring" BOOLEAN DEFAULT false,
  "createdDate" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT fk_actionitem_employee_email FOREIGN KEY (email)
    REFERENCES public."Employee"(email) ON DELETE CASCADE
);

-- ============================================================================
-- EMPLOYEE PRODUCTIVITY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public."EmployeeProductivity" (
  id TEXT PRIMARY KEY,
  week TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  employee_code JSONB,
  location TEXT,
  department TEXT,
  computer_name TEXT,
  computer_activities_hr TEXT,
  productive_time_hr TEXT,
  productivity_percentage DOUBLE PRECISION,
  unproductive_time_hr TEXT,
  unproductivity_percentage TEXT,
  neutral_time_hr TEXT,
  present_days BIGINT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_employee_productivity_email FOREIGN KEY (email)
    REFERENCES public."Employee"(email) ON DELETE CASCADE,
  CONSTRAINT employee_productivity_week_format_check CHECK (week ~ '^[0-9]{4}-W[0-9]{2}$'),
  CONSTRAINT employee_productivity_email_week_key UNIQUE (email, week)
);

-- ============================================================================
-- MONTHWISE EMPLOYEE PRODUCTIVITY DETAILS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public."MonthwiseEmployeeProductivityDetails" (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  month TEXT NOT NULL,
  "teamMember" TEXT,
  "capacityHrs" DOUBLE PRECISION,
  "presentDays" BIGINT,
  "billableHrs" DOUBLE PRECISION,
  "billableUtilization" DOUBLE PRECISION,
  "nonBillableHrs" DOUBLE PRECISION,
  "totalUtilization" DOUBLE PRECISION,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_monthwise_productivity_email FOREIGN KEY (email)
    REFERENCES public."Employee"(email) ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_employee_email ON public."Employee"(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_employee_department ON public."Employee"(department) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_employee_location ON public."Employee"(location) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_employee_status ON public."Employee"(status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_actionitem_email ON public."ActionItem"(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_actionitem_week ON public."ActionItem"(week) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ep_email ON public."EmployeeProductivity"(email);
CREATE INDEX IF NOT EXISTS idx_ep_week ON public."EmployeeProductivity"(week);
CREATE INDEX IF NOT EXISTS idx_ep_department ON public."EmployeeProductivity"(department);
CREATE INDEX IF NOT EXISTS idx_ep_productivity_pct ON public."EmployeeProductivity"(productivity_percentage);

CREATE INDEX IF NOT EXISTS idx_monthwise_email ON public."MonthwiseEmployeeProductivityDetails"(email);
CREATE INDEX IF NOT EXISTS idx_monthwise_month ON public."MonthwiseEmployeeProductivityDetails"(month);

-- ============================================================================
-- UPDATED_AT TRIGGER (camelCase columns)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_camelcase()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_employee_updated_at ON public."Employee";
CREATE TRIGGER update_employee_updated_at
  BEFORE UPDATE ON public."Employee"
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_camelcase();

DROP TRIGGER IF EXISTS update_actionitem_updated_at ON public."ActionItem";
CREATE TRIGGER update_actionitem_updated_at
  BEFORE UPDATE ON public."ActionItem"
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_camelcase();

DROP TRIGGER IF EXISTS update_employee_productivity_updated_at ON public."EmployeeProductivity";
CREATE TRIGGER update_employee_productivity_updated_at
  BEFORE UPDATE ON public."EmployeeProductivity"
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_camelcase();

DROP TRIGGER IF EXISTS update_monthwise_productivity_updated_at ON public."MonthwiseEmployeeProductivityDetails";
CREATE TRIGGER update_monthwise_productivity_updated_at
  BEFORE UPDATE ON public."MonthwiseEmployeeProductivityDetails"
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_camelcase();

-- ============================================================================
-- RLS (permissive for demo; tighten per client)
-- ============================================================================
ALTER TABLE public."Employee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ActionItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EmployeeProductivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MonthwiseEmployeeProductivityDetails" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employee_select" ON public."Employee";
CREATE POLICY "Employee_select" ON public."Employee" FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Employee_insert" ON public."Employee";
CREATE POLICY "Employee_insert" ON public."Employee" FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Employee_update" ON public."Employee";
CREATE POLICY "Employee_update" ON public."Employee" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ActionItem_select" ON public."ActionItem";
CREATE POLICY "ActionItem_select" ON public."ActionItem" FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "ActionItem_all" ON public."ActionItem";
CREATE POLICY "ActionItem_all" ON public."ActionItem" FOR ALL TO authenticated
  USING (deleted_at IS NULL) WITH CHECK (deleted_at IS NULL);

DROP POLICY IF EXISTS "EmployeeProductivity_select" ON public."EmployeeProductivity";
CREATE POLICY "EmployeeProductivity_select" ON public."EmployeeProductivity" FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "EmployeeProductivity_insert" ON public."EmployeeProductivity";
CREATE POLICY "EmployeeProductivity_insert" ON public."EmployeeProductivity" FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Monthwise_select" ON public."MonthwiseEmployeeProductivityDetails";
CREATE POLICY "Monthwise_select" ON public."MonthwiseEmployeeProductivityDetails" FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Monthwise_insert" ON public."MonthwiseEmployeeProductivityDetails";
CREATE POLICY "Monthwise_insert" ON public."MonthwiseEmployeeProductivityDetails" FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================================
-- RPC: Helper functions for productivity
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_latest_productivity_week()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT week
    FROM public."EmployeeProductivity"
    ORDER BY "createdAt" DESC
    LIMIT 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_productivity_metrics(target_week TEXT DEFAULT NULL)
RETURNS TABLE (
  average_productivity DOUBLE PRECISION,
  total_employees BIGINT,
  high_performers BIGINT,
  average_performers BIGINT,
  low_performers BIGINT,
  week TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  latest_week TEXT;
BEGIN
  IF target_week IS NULL THEN
    latest_week := get_latest_productivity_week();
  ELSE
    latest_week := target_week;
  END IF;

  RETURN QUERY
  SELECT
    AVG(ep.productivity_percentage)::DOUBLE PRECISION AS average_productivity,
    COUNT(DISTINCT ep.email)::BIGINT AS total_employees,
    COUNT(DISTINCT CASE WHEN ep.productivity_percentage >= 75 THEN ep.email END)::BIGINT AS high_performers,
    COUNT(DISTINCT CASE WHEN ep.productivity_percentage >= 50 AND ep.productivity_percentage < 75 THEN ep.email END)::BIGINT AS average_performers,
    COUNT(DISTINCT CASE WHEN ep.productivity_percentage < 50 THEN ep.email END)::BIGINT AS low_performers,
    latest_week AS week
  FROM public."EmployeeProductivity" ep
  WHERE ep.week = latest_week
    AND NOT EXISTS (
      SELECT 1 FROM public."ActionItem" ai
      WHERE ai.email = ep.email AND ai.week = ep.week AND ai."excludeFromScoring" = true
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_reports(manager_email TEXT)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  employee_email TEXT,
  department TEXT,
  location TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id AS employee_id,
    e.name AS employee_name,
    e.email AS employee_email,
    e.department,
    e.location
  FROM public."Employee" e
  WHERE e."reportingManagerEmail" = manager_email
    AND e.deleted_at IS NULL;
END;
$$;

-- ============================================================================
-- VIEWS
-- ============================================================================
CREATE OR REPLACE VIEW productivity_overview AS
SELECT
  ep.department,
  COUNT(DISTINCT ep.email) AS employee_count,
  AVG(ep.productivity_percentage) AS avg_productivity,
  SUM(ep.present_days) AS total_present_days,
  ep.week
FROM public."EmployeeProductivity" ep
GROUP BY ep.department, ep.week;

CREATE OR REPLACE VIEW department_productivity_summary AS
SELECT
  department,
  COUNT(DISTINCT email) AS total_employees,
  AVG(productivity_percentage) AS avg_productivity_percentage,
  SUM(present_days) AS total_present_days
FROM public."EmployeeProductivity"
GROUP BY department;


-- 20260203_project_backups.sql
-- ============================================================================
-- Project Backups - minimal schema for backup/restore UI
-- ============================================================================
-- This table stores snapshot metadata for project-level backups. The actual
-- snapshot format is intentionally generic (JSONB) so that different backup
-- strategies can be implemented by Edge Functions.
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  backup_type TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'completed',
  notes TEXT,
  snapshot JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_backups_project ON project_backups(project_id);
CREATE INDEX IF NOT EXISTS idx_project_backups_created_at ON project_backups(created_at DESC);

ALTER TABLE project_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view project backups" ON project_backups;
CREATE POLICY "Authenticated users can view project backups"
  ON project_backups
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage project backups" ON project_backups;
CREATE POLICY "Authenticated users can manage project backups"
  ON project_backups
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);



