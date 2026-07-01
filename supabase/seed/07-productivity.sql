-- ============================================================
-- SEED: Productivity Module
-- Departments, pods, pod members, employee profiles,
-- productivity records, leave events, process docs, alerts
-- ============================================================

DO $$
DECLARE
  u1 UUID := (SELECT id FROM auth.users ORDER BY created_at LIMIT 1);
  dept_eng UUID;
  dept_sales UUID;
  dept_ops UUID;
  pod_frontend UUID;
  pod_backend UUID;
  pod_growth UUID;
  cat_eng UUID;
  cat_hr UUID;
  cat_sales UUID;
BEGIN

-- 1. Departments
INSERT INTO departments (name, description, manager_id, is_active) VALUES
  ('Engineering',     'Software development and technical operations.',    u1, true),
  ('Sales & BD',      'Revenue generation, partnerships, and growth.',     u1, true),
  ('Operations & HR', 'People, finance, and internal processes.',          u1, true)
ON CONFLICT (name) DO NOTHING;

SELECT id INTO dept_eng   FROM departments WHERE name = 'Engineering' LIMIT 1;
SELECT id INTO dept_sales FROM departments WHERE name = 'Sales & BD' LIMIT 1;
SELECT id INTO dept_ops   FROM departments WHERE name = 'Operations & HR' LIMIT 1;

-- 2. Pods
INSERT INTO pods (name, department_id, description, lead_id, is_active) VALUES
  ('Frontend Pod',    dept_eng,   'React/TypeScript UI development.',   u1, true),
  ('Backend Pod',     dept_eng,   'Supabase, edge functions, API.',     u1, true),
  ('Growth Pod',      dept_sales, 'Lead gen, outreach, and demos.',     u1, true)
ON CONFLICT DO NOTHING;

SELECT id INTO pod_frontend FROM pods WHERE name = 'Frontend Pod' LIMIT 1;
SELECT id INTO pod_backend  FROM pods WHERE name = 'Backend Pod'  LIMIT 1;
SELECT id INTO pod_growth   FROM pods WHERE name = 'Growth Pod'   LIMIT 1;

-- 3. Pod members
INSERT INTO pod_members (pod_id, user_id, role) VALUES
  (pod_frontend, u1, 'lead'),
  (pod_backend,  u1, 'member')
ON CONFLICT DO NOTHING;

-- 4. Employee profiles (map first user + create placeholder entries)
INSERT INTO employee_profiles (user_id, email, full_name, department_id, title, hire_date, location, employment_type, is_active) VALUES
  (u1, (SELECT email FROM auth.users WHERE id = u1), (SELECT COALESCE(raw_user_meta_data->>'full_name', 'Admin User') FROM auth.users WHERE id = u1), dept_eng, 'CEO & Lead Developer', '2024-06-01', 'New York, NY', 'full-time', true)
ON CONFLICT (email) DO NOTHING;

-- Additional employee profiles (no auth.users mapping, for demo data display)
INSERT INTO employee_profiles (email, full_name, department_id, title, hire_date, location, employment_type, is_active) VALUES
  ('shahed@sjinnovation.com',  'Shahed Islam',   dept_eng,   'Senior Developer',      '2024-09-01', 'New York, NY', 'full-time', true),
  ('abesh@sjinnovation.com',   'Abesh Rahman',   dept_eng,   'Full Stack Developer',  '2024-11-01', 'Dhaka, BD',    'full-time', true),
  ('zia@sjinnovation.com',     'Zia Ahmed',      dept_eng,   'Frontend Developer',    '2025-01-15', 'Dhaka, BD',    'full-time', true),
  ('sarah@sjinnovation.com',   'Sarah Chen',     dept_sales, 'Business Development',  '2025-03-01', 'San Francisco, CA', 'full-time', true),
  ('marcus@sjinnovation.com',  'Marcus Williams', dept_ops,  'Operations Manager',    '2025-02-01', 'New York, NY', 'full-time', true)
ON CONFLICT (email) DO NOTHING;

-- 5. Productivity records (4 weeks of data for 5 employees) — idempotent: skip if row exists
INSERT INTO productivity_records (employee_email, week_start, week_number, year, total_hours, billable_hours, tasks_completed, tasks_assigned, meetings_attended, utilization_pct, efficiency_score, attendance_status, department, location) VALUES
  -- Week of Jan 6
  ('shahed@sjinnovation.com',  '2026-01-05', 2, 2026, 42, 36, 8, 10, 4, 85.7, 80.0, 'present', 'Engineering', 'New York, NY'),
  ('abesh@sjinnovation.com',   '2026-01-05', 2, 2026, 40, 34, 7,  9, 3, 85.0, 77.8, 'present', 'Engineering', 'Dhaka, BD'),
  ('zia@sjinnovation.com',     '2026-01-05', 2, 2026, 38, 30, 6,  8, 2, 78.9, 75.0, 'present', 'Engineering', 'Dhaka, BD'),
  ('sarah@sjinnovation.com',   '2026-01-05', 2, 2026, 40, 32, 5,  6, 8, 80.0, 83.3, 'present', 'Sales & BD',  'San Francisco, CA'),
  ('marcus@sjinnovation.com',  '2026-01-05', 2, 2026, 40, 20, 4,  5, 6, 50.0, 80.0, 'present', 'Operations & HR', 'New York, NY'),

  -- Week of Jan 13
  ('shahed@sjinnovation.com',  '2026-01-12', 3, 2026, 44, 38, 9, 11, 5, 86.4, 81.8, 'present', 'Engineering', 'New York, NY'),
  ('abesh@sjinnovation.com',   '2026-01-12', 3, 2026, 40, 35, 8, 10, 3, 87.5, 80.0, 'present', 'Engineering', 'Dhaka, BD'),
  ('zia@sjinnovation.com',     '2026-01-12', 3, 2026, 36, 28, 5,  7, 2, 77.8, 71.4, 'partial', 'Engineering', 'Dhaka, BD'),
  ('sarah@sjinnovation.com',   '2026-01-12', 3, 2026, 42, 35, 6,  7, 9, 83.3, 85.7, 'present', 'Sales & BD',  'San Francisco, CA'),
  ('marcus@sjinnovation.com',  '2026-01-12', 3, 2026, 40, 22, 5,  6, 7, 55.0, 83.3, 'present', 'Operations & HR', 'New York, NY'),

  -- Week of Jan 20
  ('shahed@sjinnovation.com',  '2026-01-19', 4, 2026, 45, 40, 10, 12, 4, 88.9, 83.3, 'present', 'Engineering', 'New York, NY'),
  ('abesh@sjinnovation.com',   '2026-01-19', 4, 2026, 41, 36, 9, 10, 4, 87.8, 90.0, 'present', 'Engineering', 'Dhaka, BD'),
  ('zia@sjinnovation.com',     '2026-01-19', 4, 2026, 40, 33, 7,  9, 3, 82.5, 77.8, 'present', 'Engineering', 'Dhaka, BD'),
  ('sarah@sjinnovation.com',   '2026-01-19', 4, 2026, 38, 30, 4,  5, 7, 78.9, 80.0, 'present', 'Sales & BD',  'San Francisco, CA'),
  ('marcus@sjinnovation.com',  '2026-01-19', 4, 2026, 40, 24, 6,  7, 5, 60.0, 85.7, 'present', 'Operations & HR', 'New York, NY'),

  -- Week of Jan 27
  ('shahed@sjinnovation.com',  '2026-01-26', 5, 2026, 43, 38, 11, 13, 5, 88.4, 84.6, 'present', 'Engineering', 'New York, NY'),
  ('abesh@sjinnovation.com',   '2026-01-26', 5, 2026, 40, 35, 8,  9, 3, 87.5, 88.9, 'present', 'Engineering', 'Dhaka, BD'),
  ('zia@sjinnovation.com',     '2026-01-26', 5, 2026, 40, 34, 8, 10, 3, 85.0, 80.0, 'present', 'Engineering', 'Dhaka, BD'),
  ('sarah@sjinnovation.com',   '2026-01-26', 5, 2026, 40, 33, 5,  6, 8, 82.5, 83.3, 'present', 'Sales & BD',  'San Francisco, CA'),
  ('marcus@sjinnovation.com',  '2026-01-26', 5, 2026, 0,  0,  0,  0, 0, 0.0,   0.0, 'leave',   'Operations & HR', 'New York, NY')
ON CONFLICT (employee_email, week_start) DO NOTHING;

-- 6. Leave events
INSERT INTO leave_events (employee_email, leave_type, start_date, end_date, is_half_day, notes, approved_by, status) VALUES
  ('marcus@sjinnovation.com',  'pto',     '2026-01-26', '2026-01-30', false, 'Family vacation.',           'admin@sjinnovation.com', 'approved'),
  ('zia@sjinnovation.com',     'sick',    '2026-01-14', '2026-01-14', true,  'Felt unwell, half day off.', 'admin@sjinnovation.com', 'approved'),
  ('sarah@sjinnovation.com',   'personal','2026-02-14', '2026-02-14', false, 'Personal appointment.',      'admin@sjinnovation.com', 'approved'),
  ('abesh@sjinnovation.com',   'holiday', '2026-02-21', '2026-02-21', false, 'National holiday (Shahid Day).', NULL, 'approved');

-- 7. Process categories
INSERT INTO process_categories (name, slug, description, icon, sort_order, is_active) VALUES
  ('Engineering Processes', 'engineering-processes', 'Software development workflows and standards.', 'Code',    1, true),
  ('HR & People',           'hr-people',            'Hiring, onboarding, and people management.',    'Users',   2, true),
  ('Sales Processes',       'sales-processes',       'Sales workflows, qualification, and closing.',  'Target',  3, true),
  ('Client Delivery',       'client-delivery',       'Client project delivery workflows.',            'Package', 4, true)
ON CONFLICT (slug) DO NOTHING;

SELECT id INTO cat_eng   FROM process_categories WHERE slug = 'engineering-processes' LIMIT 1;
SELECT id INTO cat_hr    FROM process_categories WHERE slug = 'hr-people' LIMIT 1;
SELECT id INTO cat_sales FROM process_categories WHERE slug = 'sales-processes' LIMIT 1;

-- 8. Process documents — idempotent: skip if (category_id, slug) exists
INSERT INTO process_documents (category_id, title, slug, content, version, status, tags, created_by, updated_by) VALUES
  (cat_eng, 'Code Review Process', 'code-review-process',
   E'# Code Review Process\n\n## Steps\n1. Developer creates PR with description.\n2. Assign reviewer within 2 hours.\n3. Reviewer provides feedback within 4 hours.\n4. Address comments, re-request review.\n5. Merge after approval.\n\n## Standards\n- Max 400 lines per PR.\n- Include tests for new features.\n- No console.log in production code.',
   1, 'published', ARRAY['engineering','code-review'], u1, u1),

  (cat_eng, 'Deployment Checklist', 'deployment-checklist',
   E'# Deployment Checklist\n\n- [ ] All tests pass locally\n- [ ] PR approved and merged to develop\n- [ ] Staging deploy verified\n- [ ] Database migration reviewed\n- [ ] Feature flags configured\n- [ ] Monitoring alerts verified\n- [ ] Release notes updated',
   1, 'published', ARRAY['engineering','deployment'], u1, u1),

  (cat_hr, 'New Hire Onboarding', 'new-hire-onboarding',
   E'# New Hire Onboarding\n\n## Day 1\n- IT setup (laptop, accounts, Slack)\n- Meet the team\n- Review company handbook\n\n## Week 1\n- Shadow senior team member\n- Complete security training\n- Set up development environment\n\n## Month 1\n- Complete first assigned task\n- First 1:1 with manager\n- 30-day feedback session',
   1, 'published', ARRAY['hr','onboarding'], u1, u1),

  (cat_sales, 'Lead Qualification Framework', 'lead-qualification',
   E'# Lead Qualification Framework (BANT)\n\n## Budget\n- Can they afford our solution?\n- Budget range: $20K–$100K annually.\n\n## Authority\n- Are we talking to the decision-maker?\n- Identify economic buyer vs. champion.\n\n## Need\n- Pain points alignment with our modules.\n- Current tools and gaps.\n\n## Timeline\n- When do they need a solution?\n- Buying cycle length.',
   1, 'published', ARRAY['sales','qualification'], u1, u1)
ON CONFLICT (category_id, slug) DO NOTHING;

-- 9. Productivity alerts
INSERT INTO productivity_alerts (employee_email, alert_type, severity, title, description, week_start, is_read) VALUES
  ('marcus@sjinnovation.com', 'absence_pattern',    'medium', 'Extended Leave',           'Marcus has been on leave for the full week. Ensure handoff is covered.', '2026-01-26', false),
  ('zia@sjinnovation.com',    'declining_trend',    'low',    'Utilization Dip',          'Zia''s utilization dropped from 82.5% to 77.8% last week. Monitor.',   '2026-01-12', true),
  ('shahed@sjinnovation.com', 'high_performer',     'low',    'Consistently High Output', 'Shahed has maintained 85%+ utilization for 4 consecutive weeks.',       '2026-01-26', false),
  ('abesh@sjinnovation.com',  'high_performer',     'low',    'Task Completion Improving','Abesh''s task completion rate improved from 77% to 89% over 4 weeks.', '2026-01-26', false);

END $$;
