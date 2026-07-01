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

