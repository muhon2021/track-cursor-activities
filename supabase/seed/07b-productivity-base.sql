-- ============================================================
-- SEED: Productivity Base Tables (Path B - EmployeeProductivity)
-- Populates Employee, ActionItem, EmployeeProductivity for demo
-- Run after 07-productivity.sql and after migration 20260203_productivity_base_tables.sql
-- Skips silently if Path B tables (public."Employee") do not exist.
-- ============================================================

DO $$
DECLARE
  u1 UUID := (SELECT id FROM auth.users ORDER BY created_at LIMIT 1);
  emp_email TEXT;
  emp_name TEXT;
  path_b_exists BOOLEAN;
BEGIN
  -- Only run if Path B migration has created public."Employee"
  SELECT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Employee'
  ) INTO path_b_exists;

  IF NOT path_b_exists THEN
    RAISE NOTICE 'Seed 07b-productivity-base: public."Employee" not found — run migration 20260203_productivity_base_tables.sql first. Skipping.';
    RETURN;
  END IF;

  -- Get first user's email and name for Employee
  SELECT email, COALESCE(raw_user_meta_data->>'full_name', 'Admin User')
    INTO emp_email, emp_name
    FROM auth.users WHERE id = u1 LIMIT 1;

  -- 1. Insert current user as Employee if not exists
  INSERT INTO public."Employee" (name, email, title, role, department, location, status)
  VALUES (emp_name, emp_email, 'Admin', 'admin', 'Engineering', 'New York, NY', 'active')
  ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    title = EXCLUDED.title,
    department = EXCLUDED.department,
    location = EXCLUDED.location;

  -- 2. Insert demo employees (must exist before EmployeeProductivity)
  INSERT INTO public."Employee" (name, email, title, role, department, location, status)
  VALUES
    ('Shahed Islam',   'shahed@sjinnovation.com',  'Senior Developer',      'developer', 'Engineering',    'New York, NY',      'active'),
    ('Abesh Rahman',   'abesh@sjinnovation.com',   'Full Stack Developer',  'developer', 'Engineering',    'Dhaka, BD',         'active'),
    ('Omkar',          'omkar@sjinnovation.com',   'Frontend Developer',    'developer', 'Engineering',    'Dhaka, BD',         'active'),
    ('Sarah Chen',     'sarah@sjinnovation.com',   'Business Development',  'developer', 'Sales & BD',     'San Francisco, CA', 'active'),
    ('Marcus Williams','marcus@sjinnovation.com',  'Operations Manager',    'manager',   'Operations',     'New York, NY',      'active')
  ON CONFLICT (email) DO NOTHING;

  -- 3. EmployeeProductivity (ISO week format YYYY-W##)
  INSERT INTO public."EmployeeProductivity" (id, week, email, name, department, location, productive_time_hr, productivity_percentage, present_days)
  VALUES
    (gen_random_uuid()::text, '2026-W02', 'shahed@sjinnovation.com',  'Shahed Islam',   'Engineering',    'New York, NY',      '36', 85.7, 5),
    (gen_random_uuid()::text, '2026-W02', 'abesh@sjinnovation.com',   'Abesh Rahman',   'Engineering',    'Dhaka, BD',         '34', 85.0, 5),
    (gen_random_uuid()::text, '2026-W02', 'omkar@sjinnovation.com',   'Omkar',          'Engineering',    'Dhaka, BD',         '30', 78.9, 5),
    (gen_random_uuid()::text, '2026-W02', 'sarah@sjinnovation.com',   'Sarah Chen',     'Sales & BD',     'San Francisco, CA', '32', 80.0, 5),
    (gen_random_uuid()::text, '2026-W02', 'marcus@sjinnovation.com',  'Marcus Williams','Operations',     'New York, NY',      '20', 50.0, 5),
    (gen_random_uuid()::text, '2026-W03', 'shahed@sjinnovation.com',  'Shahed Islam',   'Engineering',    'New York, NY',      '38', 86.4, 5),
    (gen_random_uuid()::text, '2026-W03', 'abesh@sjinnovation.com',   'Abesh Rahman',   'Engineering',    'Dhaka, BD',         '35', 87.5, 5),
    (gen_random_uuid()::text, '2026-W03', 'omkar@sjinnovation.com',   'Omkar',          'Engineering',    'Dhaka, BD',         '28', 77.8, 4),
    (gen_random_uuid()::text, '2026-W03', 'sarah@sjinnovation.com',   'Sarah Chen',     'Sales & BD',     'San Francisco, CA', '35', 83.3, 5),
    (gen_random_uuid()::text, '2026-W03', 'marcus@sjinnovation.com',  'Marcus Williams','Operations',     'New York, NY',      '22', 55.0, 5),
    (gen_random_uuid()::text, '2026-W04', 'shahed@sjinnovation.com',  'Shahed Islam',   'Engineering',    'New York, NY',      '40', 88.9, 5),
    (gen_random_uuid()::text, '2026-W04', 'abesh@sjinnovation.com',   'Abesh Rahman',   'Engineering',    'Dhaka, BD',         '36', 87.8, 5),
    (gen_random_uuid()::text, '2026-W04', 'omkar@sjinnovation.com',   'Omkar',          'Engineering',    'Dhaka, BD',         '33', 82.5, 5),
    (gen_random_uuid()::text, '2026-W04', 'sarah@sjinnovation.com',   'Sarah Chen',     'Sales & BD',     'San Francisco, CA', '30', 78.9, 5),
    (gen_random_uuid()::text, '2026-W04', 'marcus@sjinnovation.com',  'Marcus Williams','Operations',     'New York, NY',      '24', 60.0, 5),
    (gen_random_uuid()::text, '2026-W05', 'shahed@sjinnovation.com',  'Shahed Islam',   'Engineering',    'New York, NY',      '38', 88.4, 5),
    (gen_random_uuid()::text, '2026-W05', 'abesh@sjinnovation.com',   'Abesh Rahman',   'Engineering',    'Dhaka, BD',         '35', 87.5, 5),
    (gen_random_uuid()::text, '2026-W05', 'omkar@sjinnovation.com',   'Omkar',          'Engineering',    'Dhaka, BD',         '34', 85.0, 5),
    (gen_random_uuid()::text, '2026-W05', 'sarah@sjinnovation.com',   'Sarah Chen',     'Sales & BD',     'San Francisco, CA', '33', 82.5, 5)
  ON CONFLICT (email, week) DO NOTHING;

  -- 4. Action items (sample)
  INSERT INTO public."ActionItem" (id, email, summary, status, priority, week)
  VALUES
    ('act-1', 'omkar@sjinnovation.com', 'Complete onboarding docs', 'completed', 'medium', '2026-W03'),
    ('act-2', 'marcus@sjinnovation.com', 'Q1 planning session', 'pending', 'high', '2026-W05')
  ON CONFLICT (id) DO NOTHING;

END $$;
