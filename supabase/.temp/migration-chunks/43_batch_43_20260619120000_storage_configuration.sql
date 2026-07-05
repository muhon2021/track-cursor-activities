-- 20260617180300_fix_sync_user_app_role_duplicate.sql
-- Fix duplicate key on user_roles_user_id_role_key during sync_user_app_role backfill
-- Consolidates multiple enum rows per user into a single canonical row

CREATE OR REPLACE FUNCTION public.sync_user_app_role(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug TEXT;
  v_role_id UUID;
  v_app_role public.app_role;
  v_default_tenant UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  SELECT r.slug, r.id INTO v_slug, v_role_id
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = _user_id
  ORDER BY CASE r.slug
    WHEN 'owner' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'manager' THEN 3
    WHEN 'member' THEN 4
    WHEN 'viewer' THEN 5
    ELSE 6
  END
  LIMIT 1;

  IF v_slug IS NULL THEN
    SELECT ur.role INTO v_app_role
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    ORDER BY CASE ur.role
      WHEN 'admin' THEN 1
      WHEN 'moderator' THEN 2
      WHEN 'user' THEN 3
    END
    LIMIT 1;

    IF v_app_role IS NULL THEN
      RETURN;
    END IF;

    SELECT r.id INTO v_role_id
    FROM public.roles r
    WHERE r.tenant_id = v_default_tenant
      AND r.slug = CASE v_app_role
        WHEN 'admin' THEN 'admin'
        WHEN 'moderator' THEN 'manager'
        ELSE 'member'
      END
    LIMIT 1;
  ELSE
    v_app_role := CASE v_slug
      WHEN 'owner' THEN 'admin'::public.app_role
      WHEN 'admin' THEN 'admin'::public.app_role
      WHEN 'manager' THEN 'moderator'::public.app_role
      ELSE 'user'::public.app_role
    END;
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = _user_id
    AND role IS DISTINCT FROM v_app_role;

  INSERT INTO public.user_roles (user_id, role, role_id)
  VALUES (_user_id, v_app_role, v_role_id)
  ON CONFLICT (user_id, role)
  DO UPDATE SET role_id = COALESCE(EXCLUDED.role_id, public.user_roles.role_id);
END;
$$;

ALTER TABLE public.user_roles DISABLE TRIGGER sync_user_app_role_on_change;
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.user_roles LOOP
    PERFORM public.sync_user_app_role(r.user_id);
  END LOOP;
END $$;
ALTER TABLE public.user_roles ENABLE TRIGGER sync_user_app_role_on_change;


-- 20260618120000_user_space_preferences.sql
-- User space preferences for Four Spaces IA (favorites, recents, default space)
CREATE TABLE IF NOT EXISTS public.user_space_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  default_space TEXT NOT NULL DEFAULT 'sales'
    CHECK (default_space IN ('sales', 'knowledge', 'operations', 'eos')),
  favorites JSONB NOT NULL DEFAULT '[]'::jsonb,
  recent_pages JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_space_preferences_user_id
  ON public.user_space_preferences(user_id);

ALTER TABLE public.user_space_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own space preferences"
  ON public.user_space_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own space preferences"
  ON public.user_space_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own space preferences"
  ON public.user_space_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.user_space_preferences IS 'Per-user Four Spaces navigation preferences';


-- 20260619120000_eos_revamp.sql
-- ============================================================================
-- EOS Revamp Migration
-- Multi-tenant support, rock extensions, new EOS tables, RBAC RLS
-- ============================================================================

-- Default tenant (matches enterprise RBAC seed)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = '00000000-0000-0000-0000-000000000001') THEN
    INSERT INTO public.tenants (id, name, slug)
    VALUES ('00000000-0000-0000-0000-000000000001', 'Default Organization', 'default');
  END IF;
END $$;

-- ========================
-- Helper: get_user_tenant_id
-- ========================
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT r.tenant_id
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      ORDER BY CASE r.slug
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'manager' THEN 3
        WHEN 'member' THEN 4
        WHEN 'viewer' THEN 5
        ELSE 6
      END
      LIMIT 1
    ),
    '00000000-0000-0000-0000-000000000001'::UUID
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_user_tenant_id() TO authenticated;

-- ========================
-- tenant_id on existing EOS tables
-- ========================
ALTER TABLE public.eos_pods
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

ALTER TABLE public.eos_vto
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

ALTER TABLE public.okrs
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

ALTER TABLE public.okr_key_results
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

ALTER TABLE public.okr_check_ins
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

ALTER TABLE public.eos_issues
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

ALTER TABLE public.eos_issue_suggestions
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

ALTER TABLE public.eos_scorecards
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

ALTER TABLE public.eos_scorecard_metrics
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

ALTER TABLE public.accountability_charts
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

ALTER TABLE public.accountability_responsibilities
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

ALTER TABLE public.gwc_assessments
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

-- key_result_history and eos_sla_targets are from optional follow-on migrations;
-- create/alter only when the table exists (or create eos_sla_targets if missing).
DO $$ BEGIN
  IF to_regclass('public.key_result_history') IS NOT NULL THEN
    ALTER TABLE public.key_result_history
      ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
      REFERENCES public.tenants(id);
  END IF;
END $$;

-- Ensure eos_sla_targets exists (may be missing if 20260217_eos_sla_targets was not applied)
CREATE TABLE IF NOT EXISTS public.eos_sla_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID REFERENCES public.eos_pods(id) ON DELETE CASCADE,
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_eos_sla_targets_entity_unique
  ON public.eos_sla_targets (pod_id, role_name) NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS idx_eos_sla_targets_pod ON public.eos_sla_targets (pod_id);
CREATE INDEX IF NOT EXISTS idx_eos_sla_targets_role ON public.eos_sla_targets (role_name);

ALTER TABLE public.eos_sla_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view SLA targets" ON public.eos_sla_targets;
CREATE POLICY "Authenticated users can view SLA targets" ON public.eos_sla_targets
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can manage SLA targets" ON public.eos_sla_targets;
CREATE POLICY "Authenticated users can manage SLA targets" ON public.eos_sla_targets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.eos_sla_targets (pod_id, role_name, approval_rate_pct, cycle_time_days)
SELECT NULL, NULL, 90, 5
WHERE NOT EXISTS (
  SELECT 1 FROM public.eos_sla_targets WHERE pod_id IS NULL AND role_name IS NULL
);

ALTER TABLE public.eos_sla_targets
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

-- ========================
-- OKR / Rock extensions
-- ========================
ALTER TABLE public.okrs
  ADD COLUMN IF NOT EXISTS rock_status TEXT
    CHECK (rock_status IS NULL OR rock_status IN ('on_track', 'at_risk', 'off_track', 'completed'));

ALTER TABLE public.okrs
  ADD COLUMN IF NOT EXISTS progress_pct INTEGER DEFAULT 0
    CHECK (progress_pct >= 0 AND progress_pct <= 100);

DO $$ BEGIN
  IF to_regclass('public.departments') IS NOT NULL THEN
    ALTER TABLE public.okrs
      ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_okrs_tenant_rock_status ON public.okrs(tenant_id, rock_status);

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'okrs' AND column_name = 'department_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_okrs_department ON public.okrs(department_id);
  END IF;
END $$;

-- Sync progress_pct from progress for existing rows
UPDATE public.okrs SET progress_pct = COALESCE(progress::INTEGER, 0) WHERE progress_pct = 0 AND progress > 0;

-- Map existing OKR status to rock_status where applicable
UPDATE public.okrs SET rock_status = 'on_track' WHERE rock_status IS NULL AND status = 'on_track';
UPDATE public.okrs SET rock_status = 'at_risk' WHERE rock_status IS NULL AND status IN ('at_risk', 'behind');
UPDATE public.okrs SET rock_status = 'completed' WHERE rock_status IS NULL AND status IN ('completed', 'closed');

-- ========================
-- Issues extensions
-- ========================
ALTER TABLE public.eos_issues
  ADD COLUMN IF NOT EXISTS root_cause JSONB DEFAULT NULL;

ALTER TABLE public.eos_issues
  ADD COLUMN IF NOT EXISTS resolution_history JSONB DEFAULT '[]'::JSONB;

-- Add FK for meeting_id if meetings table exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'eos_issues_meeting_id_fkey'
  ) THEN
    ALTER TABLE public.eos_issues
      ADD CONSTRAINT eos_issues_meeting_id_fkey
      FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_eos_issues_tenant_status ON public.eos_issues(tenant_id, status);

-- ========================
-- Tasks EOS source linking
-- ========================
DO $$ BEGIN
  IF to_regclass('public.tasks') IS NOT NULL THEN
    ALTER TABLE public.tasks
      ADD COLUMN IF NOT EXISTS eos_source_type TEXT
        CHECK (eos_source_type IS NULL OR eos_source_type IN ('meeting', 'ids', 'rock'));
    ALTER TABLE public.tasks
      ADD COLUMN IF NOT EXISTS eos_source_id UUID;
    CREATE INDEX IF NOT EXISTS idx_tasks_eos_source ON public.tasks(eos_source_type, eos_source_id);
  END IF;
END $$;

-- ========================
-- Meetings L10 timer state
-- ========================
DO $$ BEGIN
  IF to_regclass('public.meetings') IS NOT NULL THEN
    ALTER TABLE public.meetings
      ADD COLUMN IF NOT EXISTS l10_timer_state JSONB DEFAULT NULL;
  END IF;
END $$;

-- ========================
-- Accountability department FK
-- ========================
DO $$ BEGIN
  IF to_regclass('public.departments') IS NOT NULL THEN
    ALTER TABLE public.accountability_responsibilities
      ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ========================
-- eos_vto_versions
-- ========================
CREATE TABLE IF NOT EXISTS public.eos_vto_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vto_id UUID NOT NULL REFERENCES public.eos_vto(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eos_vto_versions_vto ON public.eos_vto_versions(vto_id, version DESC);

-- ========================
-- eos_issue_comments
-- ========================
CREATE TABLE IF NOT EXISTS public.eos_issue_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.eos_issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eos_issue_comments_issue ON public.eos_issue_comments(issue_id);

-- ========================
-- Rock supporting tables
-- ========================
CREATE TABLE IF NOT EXISTS public.eos_rock_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rock_id UUID NOT NULL REFERENCES public.okrs(id) ON DELETE CASCADE,
  depends_on_rock_id UUID NOT NULL REFERENCES public.okrs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(rock_id, depends_on_rock_id)
);

CREATE TABLE IF NOT EXISTS public.eos_rock_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rock_id UUID NOT NULL REFERENCES public.okrs(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.eos_rock_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rock_id UUID NOT NULL REFERENCES public.okrs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- eos_l10_meeting_sections
-- ========================
DO $$ BEGIN
  IF to_regclass('public.meetings') IS NOT NULL THEN
    CREATE TABLE IF NOT EXISTS public.eos_l10_meeting_sections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
      section_key TEXT NOT NULL
        CHECK (section_key IN (
          'segue', 'scorecard_review', 'rock_review', 'customer_headlines',
          'employee_headlines', 'todo_review', 'ids', 'conclusion'
        )),
      duration_minutes INTEGER DEFAULT 5,
      notes TEXT,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
        REFERENCES public.tenants(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(meeting_id, section_key)
    );
    CREATE INDEX IF NOT EXISTS idx_eos_l10_sections_meeting ON public.eos_l10_meeting_sections(meeting_id);
  END IF;
END $$;

-- ========================
-- eos_people_reviews
-- ========================
CREATE TABLE IF NOT EXISTS public.eos_people_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  review_period TEXT NOT NULL,
  core_values_scores JSONB NOT NULL DEFAULT '{}',
  gwc_gets_it BOOLEAN,
  gwc_wants_it BOOLEAN,
  gwc_has_capacity BOOLEAN,
  overall_score TEXT NOT NULL DEFAULT 'good'
    CHECK (overall_score IN ('excellent', 'good', 'needs_attention')),
  notes TEXT,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eos_people_reviews_user ON public.eos_people_reviews(user_id, review_period);

-- ========================
-- eos_notification_preferences
-- ========================
CREATE TABLE IF NOT EXISTS public.eos_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'rock_overdue', 'meeting_reminder', 'todo_assigned',
      'issue_escalated', 'scorecard_missed'
    )),
  in_app BOOLEAN NOT NULL DEFAULT true,
  email BOOLEAN NOT NULL DEFAULT false,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_type)
);

-- ========================
-- VTO version trigger
-- ========================
CREATE OR REPLACE FUNCTION public.eos_vto_version_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
  FROM public.eos_vto_versions WHERE vto_id = OLD.id;

  INSERT INTO public.eos_vto_versions (vto_id, section, content, version, updated_by, tenant_id)
  VALUES (OLD.id, OLD.section, OLD.content, v_next_version, auth.uid(), OLD.tenant_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS eos_vto_version_on_update ON public.eos_vto;
CREATE TRIGGER eos_vto_version_on_update
  BEFORE UPDATE ON public.eos_vto
  FOR EACH ROW
  WHEN (OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION public.eos_vto_version_snapshot();

-- ========================
-- Migrate VTO quarterly_rocks JSONB to okrs (idempotent)
-- ========================
DO $$
DECLARE
  v_content JSONB;
  v_rock JSONB;
  v_quarter TEXT;
BEGIN
  SELECT content INTO v_content FROM public.eos_vto WHERE section = 'quarterly_rocks' LIMIT 1;
  IF v_content IS NULL THEN RETURN; END IF;

  v_quarter := COALESCE(v_content->>'quarter', 'Q1 ' || EXTRACT(YEAR FROM now())::TEXT);

  FOR v_rock IN SELECT * FROM jsonb_array_elements(COALESCE(v_content->'rocks', '[]'::JSONB))
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.okrs
      WHERE title = v_rock->>'title'
        AND quarter = v_quarter
        AND okr_type = 'rock'
    ) THEN
      INSERT INTO public.okrs (
        title, quarter, status, okr_type, rock_status, progress_pct, tenant_id
      ) VALUES (
        COALESCE(v_rock->>'title', 'Untitled Rock'),
        v_quarter,
        'active',
        'rock',
        'on_track',
        0,
        '00000000-0000-0000-0000-000000000001'
      );
    END IF;
  END LOOP;
EXCEPTION WHEN undefined_column THEN
  -- okr_type may not exist on older schemas; insert without it
  NULL;
END $$;

-- ========================
-- Extended EOS permissions
-- ========================
DO $$ BEGIN
  IF to_regclass('public.permissions') IS NOT NULL THEN
    INSERT INTO public.permissions (key, name, category, resource, action, description) VALUES
      ('eos.manage_rocks', 'Manage EOS Rocks', 'eos', 'rocks', 'manage', 'Create and edit quarterly rocks'),
      ('eos.manage_meetings', 'Manage EOS Meetings', 'eos', 'meetings', 'manage', 'Run and manage L10 meetings'),
      ('eos.manage_scorecards', 'Manage EOS Scorecards', 'eos', 'scorecards', 'manage', 'Edit scorecard metrics'),
      ('eos.manage_ids', 'Manage EOS IDS', 'eos', 'issues', 'manage', 'Manage IDS issues')
    ON CONFLICT (key) DO NOTHING;
  END IF;
END $$;

-- Grant manage permissions to owner/admin/manager roles
DO $$ BEGIN
  IF to_regclass('public.role_permissions') IS NOT NULL
     AND to_regclass('public.roles') IS NOT NULL
     AND to_regclass('public.permissions') IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM public.roles r
    CROSS JOIN public.permissions p
    WHERE r.slug IN ('owner', 'admin', 'manager')
      AND p.key IN ('eos.manage_rocks', 'eos.manage_meetings', 'eos.manage_scorecards', 'eos.manage_ids')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Member gets view/create/edit only (already seeded); viewer gets view only

-- ========================
-- RLS: Enable on new tables
-- ========================
ALTER TABLE public.eos_vto_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eos_issue_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eos_rock_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eos_rock_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eos_rock_comments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.eos_l10_meeting_sections') IS NOT NULL THEN
    ALTER TABLE public.eos_l10_meeting_sections ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
ALTER TABLE public.eos_people_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eos_notification_preferences ENABLE ROW LEVEL SECURITY;

-- ========================
-- RLS policies for new tables (tenant + permission)
-- ========================
DO $$ DECLARE t TEXT; BEGIN
  IF to_regprocedure('public.has_permission(uuid,text)') IS NULL THEN
    RETURN;
  END IF;

  FOREACH t IN ARRAY ARRAY[
    'eos_vto_versions', 'eos_issue_comments', 'eos_rock_dependencies',
    'eos_rock_attachments', 'eos_rock_comments', 'eos_l10_meeting_sections',
    'eos_people_reviews'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS "eos_tenant_select" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "eos_tenant_select" ON public.%I FOR SELECT TO authenticated
       USING (tenant_id = public.get_user_tenant_id() AND public.has_permission(auth.uid(), ''eos.view''))',
      t
    );
    EXECUTE format('DROP POLICY IF EXISTS "eos_tenant_insert" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "eos_tenant_insert" ON public.%I FOR INSERT TO authenticated
       WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.has_permission(auth.uid(), ''eos.create''))',
      t
    );
    EXECUTE format('DROP POLICY IF EXISTS "eos_tenant_update" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "eos_tenant_update" ON public.%I FOR UPDATE TO authenticated
       USING (tenant_id = public.get_user_tenant_id() AND public.has_permission(auth.uid(), ''eos.edit''))
       WITH CHECK (tenant_id = public.get_user_tenant_id())',
      t
    );
    EXECUTE format('DROP POLICY IF EXISTS "eos_tenant_delete" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "eos_tenant_delete" ON public.%I FOR DELETE TO authenticated
       USING (tenant_id = public.get_user_tenant_id() AND public.has_permission(auth.uid(), ''eos.delete''))',
      t
    );
  END LOOP;
END $$;

-- Notification preferences: users manage own
DROP POLICY IF EXISTS "users_manage_own_eos_notif_prefs" ON public.eos_notification_preferences;
CREATE POLICY "users_manage_own_eos_notif_prefs" ON public.eos_notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ========================
-- Tighten eos_issues RLS (additive — keep existing policies, add tenant guard)
-- ========================
DO $$ BEGIN
  IF to_regprocedure('public.has_permission(uuid,text)') IS NOT NULL THEN
    DROP POLICY IF EXISTS "eos_issues_tenant_view" ON public.eos_issues;
    CREATE POLICY "eos_issues_tenant_view" ON public.eos_issues
      FOR SELECT TO authenticated
      USING (
        tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'eos.view')
      );

    DROP POLICY IF EXISTS "eos_issues_tenant_write" ON public.eos_issues;
    CREATE POLICY "eos_issues_tenant_write" ON public.eos_issues
      FOR ALL TO authenticated
      USING (
        tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'eos.edit')
      )
      WITH CHECK (
        tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'eos.create')
      );
  END IF;
END $$;

-- ========================
-- Tighten okrs RLS
-- ========================
DO $$ BEGIN
  IF to_regprocedure('public.has_permission(uuid,text)') IS NOT NULL THEN
    DROP POLICY IF EXISTS "okrs_tenant_view" ON public.okrs;
    CREATE POLICY "okrs_tenant_view" ON public.okrs
      FOR SELECT TO authenticated
      USING (
        tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'eos.view')
      );

    DROP POLICY IF EXISTS "okrs_tenant_write" ON public.okrs;
    CREATE POLICY "okrs_tenant_write" ON public.okrs
      FOR ALL TO authenticated
      USING (
        tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'eos.edit')
      )
      WITH CHECK (
        tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'eos.create')
      );
  END IF;
END $$;


-- 20260619120000_storage_configuration.sql
-- Storage configuration singleton + files table extensions for multi-provider support.

CREATE TABLE IF NOT EXISTS public.storage_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_type TEXT NOT NULL DEFAULT 'local' CHECK (storage_type IN ('local', 's3', 'supabase')),
  aws_access_key_id TEXT,
  aws_secret_access_key TEXT,
  aws_region TEXT NOT NULL DEFAULT 'us-east-1',
  s3_bucket_name TEXT,
  supabase_storage_bucket TEXT NOT NULL DEFAULT 'knowledgebase',
  supabase_storage_public BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_config_single ON public.storage_config ((1));

ALTER TABLE public.storage_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read storage config" ON public.storage_config;
CREATE POLICY "Admins can read storage config"
ON public.storage_config FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage storage config" ON public.storage_config;
CREATE POLICY "Admins can manage storage config"
ON public.storage_config FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_or_create_storage_config()
RETURNS public.storage_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config public.storage_config;
BEGIN
  SELECT * INTO config FROM public.storage_config LIMIT 1;

  IF config IS NULL THEN
    INSERT INTO public.storage_config (
      storage_type,
      aws_region,
      supabase_storage_bucket,
      supabase_storage_public
    ) VALUES (
      'local',
      'us-east-1',
      'knowledgebase',
      true
    )
    RETURNING * INTO config;
  END IF;

  RETURN config;
END;
$$;

DO $$
BEGIN
  PERFORM public.get_or_create_storage_config();
END $$;

-- Extend files table for supabase provider
ALTER TABLE public.files
  DROP CONSTRAINT IF EXISTS files_storage_type_check;

ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

ALTER TABLE public.files
  ADD CONSTRAINT files_storage_type_check
  CHECK (storage_type IN ('local', 's3', 'supabase'));

CREATE INDEX IF NOT EXISTS idx_files_storage_path
ON public.files (storage_path)
WHERE storage_path IS NOT NULL;

-- Authenticated users can read active storage type (non-secret fields only via view)
CREATE OR REPLACE VIEW public.storage_config_public
WITH (security_invoker = true)
AS
SELECT
  storage_type,
  aws_region,
  supabase_storage_bucket,
  supabase_storage_public,
  updated_at
FROM public.storage_config
LIMIT 1;

GRANT SELECT ON public.storage_config_public TO authenticated;


