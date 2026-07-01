-- ============================================================================
-- Department Users + Drop Obsolete Skills Tables
-- ============================================================================

-- Drop obsolete skills management tables (SkillManagement page removed)
DROP TABLE IF EXISTS public.employee_skills CASCADE;
DROP TABLE IF EXISTS public.skills CASCADE;

-- ========================
-- Department Users Junction
-- ========================
CREATE TABLE IF NOT EXISTS public.department_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (department_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_department_users_department ON public.department_users(department_id);
CREATE INDEX IF NOT EXISTS idx_department_users_user ON public.department_users(user_id);

ALTER TABLE public.department_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view department users" ON public.department_users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage department users" ON public.department_users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Backfill from existing employee_profiles assignments
INSERT INTO public.department_users (department_id, user_id)
SELECT DISTINCT department_id, user_id
FROM public.employee_profiles
WHERE department_id IS NOT NULL AND user_id IS NOT NULL
ON CONFLICT (department_id, user_id) DO NOTHING;
