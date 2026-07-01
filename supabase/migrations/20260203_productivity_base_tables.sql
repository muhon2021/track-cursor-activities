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
