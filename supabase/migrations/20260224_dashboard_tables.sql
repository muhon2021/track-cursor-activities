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
