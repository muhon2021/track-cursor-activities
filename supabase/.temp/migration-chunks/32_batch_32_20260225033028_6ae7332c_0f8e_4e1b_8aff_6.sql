-- 20260220103807_b4c439a4-8143-40e9-8c0f-698b190bacfc.sql

-- RPC: vector similarity search with optional context and filters
CREATE OR REPLACE FUNCTION match_embeddings_admin(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_entity_type text DEFAULT NULL,
  filter_user_id uuid DEFAULT NULL,
  filter_project_name text DEFAULT NULL,
  filter_project_manager text DEFAULT NULL,
  filter_client_name text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  entity_type text,
  entity_id text,
  content text,
  metadata jsonb,
  user_id uuid,
  similarity float,
  unified_document_id uuid,
  project_name text,
  project_manager text,
  client_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      e.id,
      e.entity_type,
      e.entity_id::text,
      e.content,
      e.metadata,
      e.user_id,
      (1 - (e.embedding <=> query_embedding))::float AS sim,
      e.unified_document_id
    FROM public.embeddings e
    WHERE (1 - (e.embedding <=> query_embedding)) > match_threshold
      AND (filter_entity_type IS NULL OR e.entity_type = filter_entity_type)
      AND (filter_user_id IS NULL OR e.user_id = filter_user_id)
    ORDER BY e.embedding <=> query_embedding
    LIMIT CASE
      WHEN filter_project_name IS NOT NULL AND filter_project_name != ''
        OR filter_project_manager IS NOT NULL AND filter_project_manager != ''
        OR filter_client_name IS NOT NULL AND filter_client_name != ''
      THEN LEAST(500, match_count * 10)
      ELSE match_count
    END
  ),
  ctx AS (
    SELECT
      b.id,
      b.entity_type,
      b.entity_id,
      b.content,
      b.metadata,
      b.user_id,
      b.sim,
      b.unified_document_id,
      p.name AS proj_name,
      prof.full_name AS proj_manager,
      c.name AS cli_name
    FROM base b
    LEFT JOIN public.meeting_transcripts mt
      ON b.entity_type = 'meeting_transcript' AND b.entity_id::uuid = mt.id
    LEFT JOIN public.meetings m ON mt.meeting_id = m.id
    LEFT JOIN public.clients c ON m.client_id = c.id
    LEFT JOIN public.meeting_assignments ma
      ON ma.meeting_id = m.id AND ma.entity_type = 'project'
    LEFT JOIN public.projects p ON ma.entity_id = p.id
    LEFT JOIN public.profiles prof ON p.owner_id = prof.id
  )
  SELECT
    ctx.id,
    ctx.entity_type,
    ctx.entity_id,
    ctx.content,
    ctx.metadata,
    ctx.user_id,
    ctx.sim,
    ctx.unified_document_id,
    ctx.proj_name,
    ctx.proj_manager,
    ctx.cli_name
  FROM ctx
  WHERE
    (filter_project_name IS NULL OR filter_project_name = '' OR ctx.proj_name ILIKE '%' || filter_project_name || '%')
    AND (filter_project_manager IS NULL OR filter_project_manager = '' OR ctx.proj_manager ILIKE '%' || filter_project_manager || '%')
    AND (filter_client_name IS NULL OR filter_client_name = '' OR ctx.cli_name ILIKE '%' || filter_client_name || '%')
  ORDER BY ctx.sim DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_embeddings_admin IS 'Admin semantic search with optional entity_type and meeting context filters (project_name, project_manager, client_name). Returns similarity and optional project/client/manager for meeting transcripts.';

-- Ensure embeddings has index for vector search (may already exist)
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_cosine
  ON public.embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);


-- 20260220_skills_management.sql
-- ============================================================================
-- Skills Management Migration
-- ============================================================================
-- Creates tables for:
-- - Skills (skill definitions)
-- - Employee Skills (employee-skill associations)
-- ============================================================================

-- ========================
-- Skills Table
-- ========================
CREATE TABLE IF NOT EXISTS public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========================
-- Employee Skills Table
-- ========================
-- Links employees to their skills
CREATE TABLE IF NOT EXISTS public.employee_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL, -- References Employee or employee_profiles
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  proficiency_level TEXT DEFAULT 'intermediate'
    CHECK (proficiency_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (employee_id, skill_id)
);

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_skills_category ON public.skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_name ON public.skills(name);
CREATE INDEX IF NOT EXISTS idx_employee_skills_employee_id ON public.employee_skills(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_skills_skill_id ON public.employee_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_employee_skills_proficiency ON public.employee_skills(proficiency_level);

-- ========================
-- RLS Policies
-- ========================

-- Skills
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view skills" ON public.skills
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage skills" ON public.skills
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Employee Skills
ALTER TABLE public.employee_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view employee skills" ON public.employee_skills
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage employee skills" ON public.employee_skills
  FOR ALL TO authenticated USING (true) WITH CHECK (true);



-- 20260224190624_7e669a9e-5371-4ad0-9a6d-0cf831036dcd.sql
BEGIN;

ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS module TEXT;

-- Refresh PostgREST cache
NOTIFY pgrst, 'reload schema';

COMMIT;

-- 20260224193813_e9368551-0cbd-4d10-bc2e-e1165b1ac3d0.sql
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS module TEXT;

-- 20260224_dashboard_tables.sql
-- ============================================================================
-- MIGRATION: Agency-First Dashboard Foundation
-- Date: 2026-02-24
-- Purpose: Add role-specific dashboard tables, views, and column additions
--          to support Owner / PM / IC dashboard rebuild.
-- ============================================================================

-- 1. user_role_preferences
--    Stores each user's agency role (owner/pm/ic) and dashboard preferences.
--    agency_role is separate from the auth app_role (admin/moderator/user).
CREATE TABLE IF NOT EXISTS public.user_role_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  -- Agency-level role used for dashboard routing
  agency_role text CHECK (agency_role IN ('owner', 'pm', 'ic')),
  -- EOS flag: when true, Owner gets OwnerDashboardWithEOS
  is_eos_user boolean NOT NULL DEFAULT false,
  -- Dashboard layout customisation (reserved for future card ordering)
  dashboard_layout jsonb DEFAULT '{}',
  -- Primary pod this user manages (PM context)
  primary_pod_id uuid REFERENCES public.pods(id) ON DELETE SET NULL,
  -- AI digest preferences
  ai_digest_enabled boolean NOT NULL DEFAULT true,
  ai_digest_frequency text NOT NULL DEFAULT 'weekly',
  -- Task display preferences
  hide_completed_tasks boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_role_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_role_prefs"
  ON public.user_role_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can read all preferences (for user management)
CREATE POLICY "admins_read_all_role_prefs"
  ON public.user_role_preferences
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_user_role_preferences_user_id
  ON public.user_role_preferences(user_id);


-- 2. dashboard_widgets
--    Registry of available dashboard widget components.
--    agency_roles controls which role dashboards show each widget.
CREATE TABLE IF NOT EXISTS public.dashboard_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  component_name text NOT NULL,
  agency_roles text[] NOT NULL DEFAULT '{}', -- owner, pm, ic
  is_enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Public read access (no sensitive data)
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_widgets"
  ON public.dashboard_widgets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admins_manage_widgets"
  ON public.dashboard_widgets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

-- Seed initial widget registry
INSERT INTO public.dashboard_widgets
  (widget_slug, display_name, description, component_name, agency_roles, sort_order)
VALUES
  ('health_metrics',  'Health Metrics',        'Revenue, utilization, project on-track %',     'HealthMetricsCard',    ARRAY['owner'],           1),
  ('watch_list',      'Watch List',             'At-risk projects, over-capacity teams, alerts', 'WatchListCard',        ARRAY['owner'],           2),
  ('team_capacity',   'Team Capacity',          'Utilization by pod member',                    'TeamCapacityCard',     ARRAY['pm'],              3),
  ('ai_digest',       'AI Weekly Digest',       'AI-generated week-in-review summary',          'AIWeeklyDigestCard',   ARRAY['owner','pm','ic'], 10)
ON CONFLICT (widget_slug) DO NOTHING;


-- 3. project_at_risk_flags
--    Event log tracking why a project is at risk. One flag per type per project.
CREATE TABLE IF NOT EXISTS public.project_at_risk_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  flag_type text NOT NULL,   -- deadline_approaching | blocked | over_budget | no_activity | feedback_pending
  description text,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, flag_type)
);

ALTER TABLE public.project_at_risk_flags ENABLE ROW LEVEL SECURITY;

-- Users can read flags for projects they own or created
CREATE POLICY "project_owners_read_risk_flags"
  ON public.project_at_risk_flags
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_at_risk_flags.project_id
        AND (p.owner_id = auth.uid() OR p.created_by = auth.uid())
    )
  );

CREATE POLICY "admins_manage_risk_flags"
  ON public.project_at_risk_flags
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'moderator')
    )
  );

CREATE INDEX IF NOT EXISTS idx_project_at_risk_flags_project_id
  ON public.project_at_risk_flags(project_id);

CREATE INDEX IF NOT EXISTS idx_project_at_risk_flags_resolved
  ON public.project_at_risk_flags(resolved_at)
  WHERE resolved_at IS NULL;


-- 4. ai_digest_logs
--    Stores AI-generated weekly/daily digests per user.
CREATE TABLE IF NOT EXISTS public.ai_digest_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  digest_type text NOT NULL DEFAULT 'weekly', -- weekly | daily | alert
  subject text NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}',
  was_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_digest_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_digests"
  ON public.ai_digest_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users_update_own_digests"
  ON public.ai_digest_logs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ai_digest_logs_user_id
  ON public.ai_digest_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_digest_logs_sent_at
  ON public.ai_digest_logs(sent_at DESC);


-- ============================================================================
-- COLUMN ADDITIONS
-- ============================================================================

-- 5. projects: risk tracking columns
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_at_risk boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS risk_flags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS owner_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS expected_completion_date date;

CREATE INDEX IF NOT EXISTS idx_projects_is_at_risk
  ON public.projects(is_at_risk)
  WHERE is_at_risk = true;


-- 6. meetings: AI summary status columns
--    meetings.ai_summary already exists (text); add status + timestamps
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS ai_summary_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ai_summary_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS action_items_extracted_at timestamptz;


-- ============================================================================
-- VIEWS
-- ============================================================================

-- 7. owner_dashboard_metrics
--    Single-row aggregate view for the Owner dashboard health card.
--    Note: tasks/meetings lack project_id FK — metrics use client-level proxies.
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

  -- Projects in progress (not archived)
  (
    SELECT COUNT(*)
    FROM public.projects p
    JOIN public.project_statuses ps ON ps.id = p.status_id
    WHERE p.is_archived = false
      AND ps.slug = 'in_progress'
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


-- 8. project_risk_summary
--    Per-project risk data for the Watch List card.
--    Approximates task/meeting counts via client_id bridge
--    (tasks and meetings lack a direct project_id FK in the current schema).
CREATE OR REPLACE VIEW public.project_risk_summary AS
SELECT
  p.id,
  p.name,
  p.slug,
  c.name AS client_name,
  p.end_date,
  p.expected_completion_date,
  p.is_at_risk,
  string_agg(DISTINCT prf.flag_type, ', ') AS risk_flags,
  -- Open tasks approximated via shared client_id
  (
    SELECT COUNT(*)
    FROM public.tasks t
    WHERE t.client_id = p.client_id
      AND t.status NOT IN ('done', 'cancelled')
  ) AS open_tasks,
  -- Last meeting with this client
  (
    SELECT MAX(m.scheduled_at)
    FROM public.meetings m
    WHERE m.client_id = p.client_id
  ) AS last_client_meeting,
  -- Last task activity for this client
  (
    SELECT MAX(t.updated_at)
    FROM public.tasks t
    WHERE t.client_id = p.client_id
  ) AS last_activity
FROM public.projects p
LEFT JOIN public.clients c ON c.id = p.client_id
LEFT JOIN public.project_at_risk_flags prf
  ON prf.project_id = p.id
  AND prf.resolved_at IS NULL
WHERE p.is_archived = false
GROUP BY
  p.id, p.name, p.slug, c.name,
  p.end_date, p.expected_completion_date, p.is_at_risk;


-- 9. pm_team_capacity
--    Per-pod capacity rollup for the Team Capacity card.
--    Joins productivity_records (email-keyed) → profiles → pod_members.
CREATE OR REPLACE VIEW public.pm_team_capacity AS
SELECT
  pm.pod_id,
  COUNT(DISTINCT pr.employee_email)                                   AS total_team_members,
  SUM(CASE WHEN pr.utilization_pct >= 90 THEN 1 ELSE 0 END)          AS at_capacity,
  SUM(CASE WHEN pr.utilization_pct < 50  THEN 1 ELSE 0 END)          AS available,
  ROUND(AVG(pr.utilization_pct)::numeric, 1)                         AS avg_utilization,
  date_trunc('week', now())::date                                     AS week_start
FROM public.productivity_records pr
JOIN public.profiles prof ON prof.email = pr.employee_email
JOIN public.pod_members pm  ON pm.user_id = prof.id
WHERE pr.week_start = date_trunc('week', now())::date
GROUP BY pm.pod_id;


-- 20260225004648_53f219c4-6df6-4913-8079-a5a7844c1dfc.sql
-- ============================================================================
-- MIGRATION: Agency-First Dashboard Foundation
-- Date: 2026-02-24
-- Purpose: Add role-specific dashboard tables, views, and column additions
--          to support Owner / PM / IC dashboard rebuild.
-- ============================================================================

-- 1. user_role_preferences
CREATE TABLE IF NOT EXISTS public.user_role_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  agency_role text CHECK (agency_role IN ('owner', 'pm', 'ic')),
  is_eos_user boolean NOT NULL DEFAULT false,
  dashboard_layout jsonb DEFAULT '{}',
  primary_pod_id uuid REFERENCES public.pods(id) ON DELETE SET NULL,
  ai_digest_enabled boolean NOT NULL DEFAULT true,
  ai_digest_frequency text NOT NULL DEFAULT 'weekly',
  hide_completed_tasks boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_role_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_role_prefs"
  ON public.user_role_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admins_read_all_role_prefs"
  ON public.user_role_preferences
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_user_role_preferences_user_id
  ON public.user_role_preferences(user_id);


-- 2. dashboard_widgets
CREATE TABLE IF NOT EXISTS public.dashboard_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  component_name text NOT NULL,
  agency_roles text[] NOT NULL DEFAULT '{}',
  is_enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_widgets"
  ON public.dashboard_widgets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admins_manage_widgets"
  ON public.dashboard_widgets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

-- Seed initial widget registry
INSERT INTO public.dashboard_widgets
  (widget_slug, display_name, description, component_name, agency_roles, sort_order)
VALUES
  ('health_metrics',  'Health Metrics',        'Revenue, utilization, project on-track %',     'HealthMetricsCard',    ARRAY['owner'],           1),
  ('watch_list',      'Watch List',             'At-risk projects, over-capacity teams, alerts', 'WatchListCard',        ARRAY['owner'],           2),
  ('team_capacity',   'Team Capacity',          'Utilization by pod member',                    'TeamCapacityCard',     ARRAY['pm'],              3),
  ('ai_digest',       'AI Weekly Digest',       'AI-generated week-in-review summary',          'AIWeeklyDigestCard',   ARRAY['owner','pm','ic'], 10)
ON CONFLICT (widget_slug) DO NOTHING;


-- 3. project_at_risk_flags
CREATE TABLE IF NOT EXISTS public.project_at_risk_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  flag_type text NOT NULL,
  description text,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, flag_type)
);

ALTER TABLE public.project_at_risk_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_owners_read_risk_flags"
  ON public.project_at_risk_flags
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_at_risk_flags.project_id
        AND (p.owner_id = auth.uid() OR p.created_by = auth.uid())
    )
  );

CREATE POLICY "admins_manage_risk_flags"
  ON public.project_at_risk_flags
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'moderator')
    )
  );

CREATE INDEX IF NOT EXISTS idx_project_at_risk_flags_project_id
  ON public.project_at_risk_flags(project_id);

CREATE INDEX IF NOT EXISTS idx_project_at_risk_flags_resolved
  ON public.project_at_risk_flags(resolved_at)
  WHERE resolved_at IS NULL;


-- 4. ai_digest_logs
CREATE TABLE IF NOT EXISTS public.ai_digest_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  digest_type text NOT NULL DEFAULT 'weekly',
  subject text NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}',
  was_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_digest_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_digests"
  ON public.ai_digest_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users_update_own_digests"
  ON public.ai_digest_logs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ai_digest_logs_user_id
  ON public.ai_digest_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_digest_logs_sent_at
  ON public.ai_digest_logs(sent_at DESC);


-- ============================================================================
-- COLUMN ADDITIONS
-- ============================================================================

-- 5. projects: risk tracking columns
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_at_risk boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS risk_flags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS owner_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS expected_completion_date date;

CREATE INDEX IF NOT EXISTS idx_projects_is_at_risk
  ON public.projects(is_at_risk)
  WHERE is_at_risk = true;


-- 6. meetings: AI summary status columns
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS ai_summary_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ai_summary_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS action_items_extracted_at timestamptz;


-- ============================================================================
-- VIEWS
-- ============================================================================

-- 7. owner_dashboard_metrics
CREATE OR REPLACE VIEW public.owner_dashboard_metrics AS
SELECT
  (
    SELECT COALESCE(SUM(value), 0)::numeric
    FROM public.deals
    WHERE closed_at >= now() - interval '7 days'
  ) AS revenue_this_week,
  (
    SELECT COALESCE(ROUND(AVG(utilization_pct)::numeric, 1), 0)
    FROM public.productivity_records
    WHERE week_start = date_trunc('week', now())::date
  ) AS team_utilization,
  (
    SELECT COUNT(*)
    FROM public.projects p
    JOIN public.project_statuses ps ON ps.id = p.status_id
    WHERE p.is_archived = false
      AND ps.slug = 'in_progress'
  ) AS projects_in_progress,
  (
    SELECT COUNT(*)
    FROM public.projects
    WHERE is_at_risk = true
      AND is_archived = false
  ) AS projects_at_risk,
  (
    SELECT COUNT(*)
    FROM public.clients
    WHERE status = 'active'
  ) AS active_clients,
  (
    SELECT COUNT(*)
    FROM public.profiles
    WHERE is_active = true
  ) AS active_team_members,
  now() AS generated_at;


-- 8. project_risk_summary
CREATE OR REPLACE VIEW public.project_risk_summary AS
SELECT
  p.id,
  p.name,
  p.slug,
  c.name AS client_name,
  p.end_date,
  p.expected_completion_date,
  p.is_at_risk,
  string_agg(DISTINCT prf.flag_type, ', ') AS risk_flags,
  (
    SELECT COUNT(*)
    FROM public.tasks t
    WHERE t.client_id = p.client_id
      AND t.status NOT IN ('done', 'cancelled')
  ) AS open_tasks,
  (
    SELECT MAX(m.scheduled_at)
    FROM public.meetings m
    WHERE m.client_id = p.client_id
  ) AS last_client_meeting,
  (
    SELECT MAX(t.updated_at)
    FROM public.tasks t
    WHERE t.client_id = p.client_id
  ) AS last_activity
FROM public.projects p
LEFT JOIN public.clients c ON c.id = p.client_id
LEFT JOIN public.project_at_risk_flags prf
  ON prf.project_id = p.id
  AND prf.resolved_at IS NULL
WHERE p.is_archived = false
GROUP BY
  p.id, p.name, p.slug, c.name,
  p.end_date, p.expected_completion_date, p.is_at_risk;


-- 9. pm_team_capacity
CREATE OR REPLACE VIEW public.pm_team_capacity AS
SELECT
  pm.pod_id,
  COUNT(DISTINCT pr.employee_email)                                   AS total_team_members,
  SUM(CASE WHEN pr.utilization_pct >= 90 THEN 1 ELSE 0 END)          AS at_capacity,
  SUM(CASE WHEN pr.utilization_pct < 50  THEN 1 ELSE 0 END)          AS available,
  ROUND(AVG(pr.utilization_pct)::numeric, 1)                         AS avg_utilization,
  date_trunc('week', now())::date                                     AS week_start
FROM public.productivity_records pr
JOIN public.profiles prof ON prof.email = pr.employee_email
JOIN public.pod_members pm  ON pm.user_id = prof.id
WHERE pr.week_start = date_trunc('week', now())::date
GROUP BY pm.pod_id;

-- 20260225004718_3d22a04b-faf4-4763-81b8-8ca7e7354b33.sql
-- Insert agency role preferences for all 4 accounts
-- Using 'user' as default app_role for accounts without explicit user_roles entries
INSERT INTO public.user_role_preferences (user_id, role, agency_role, is_eos_user)
VALUES
  ('78657387-d518-4b2e-88d8-eca802372ad5', 'admin', 'owner', true),
  ('c4642966-5969-4d55-b3a6-ce850c1e2786', 'user',  'owner', true),
  ('e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'user',  'pm',    false),
  ('d2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39', 'user',  'ic',    false)
ON CONFLICT (user_id, role) DO UPDATE SET
  agency_role = EXCLUDED.agency_role,
  is_eos_user = EXCLUDED.is_eos_user;

-- 20260225005227_6e386ac0-ee55-4342-8d8b-ddf54561c490.sql
-- Set a default chat model (GPT-4o mini is cheapest/fastest)
UPDATE ai_models SET is_default = true WHERE id = '25b7d4ba-06a3-4ead-9229-0ec15b7fa0ba';

-- 20260225033028_6ae7332c-0f8e-4e1b-8aff-6a78dee25abf.sql

-- Add data source tracking columns to clients table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- Add data source tracking columns to contacts table
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- Add data source tracking columns to deals table
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- Create indexes for filtering by data source
CREATE INDEX IF NOT EXISTS idx_clients_data_source ON public.clients(data_source);
CREATE INDEX IF NOT EXISTS idx_contacts_data_source ON public.contacts(data_source);
CREATE INDEX IF NOT EXISTS idx_deals_data_source ON public.deals(data_source);


