-- ============================================================
-- SEED: Platform Core
-- Profiles, roles, app_modules, system_settings, notifications
-- Run FIRST — other seeds reference clients & modules.
-- ============================================================

-- 0. Guard: skip everything when no auth users exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users LIMIT 1) THEN
    RAISE EXCEPTION 'No auth.users rows — sign up at least one user before seeding.';
  END IF;
END $$;

-- 0.5 Grant admin role to designated admin email (if user exists in auth.users)
-- Create this user in Supabase Dashboard → Authentication → Users → Add user, then run seeds.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'zia.khan@sjinnovation.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 1. Clients (5 already exist from test-data migration; add 3 more)
-- Guard: clients table has no UNIQUE on email, so use conditional inserts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM clients WHERE email = 'rachel@designstudio.co') THEN
    INSERT INTO public.clients (name, email, company, phone, status, metadata) VALUES
      ('Rachel Green', 'rachel@designstudio.co', 'Design Studio Co', '+1-555-0201', 'active',
       '{"notes":"Creative agency, monthly retainer","industry":"design"}');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM clients WHERE email = 'tom@finedge.io') THEN
    INSERT INTO public.clients (name, email, company, phone, status, metadata) VALUES
      ('Tom Bradley', 'tom@finedge.io', 'FinEdge Solutions', '+1-555-0202', 'active',
       '{"notes":"Fintech startup, Series A","industry":"finance"}');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM clients WHERE email = 'lisa@healthsync.com') THEN
    INSERT INTO public.clients (name, email, company, phone, status, metadata) VALUES
      ('Lisa Nguyen', 'lisa@healthsync.com', 'HealthSync Inc', '+1-555-0203', 'prospect',
       '{"notes":"Healthcare SaaS, evaluating platform","industry":"healthcare"}');
  END IF;
END $$;

-- 2. App modules (enable all 10 modules for demo)
INSERT INTO public.app_modules (name, slug, description, icon, category, is_core, is_active, sort_order) VALUES
  ('Platform Core',    'platform',      'Auth, profiles, navigation, shared infra',       'Shield',       'core',          true,  true, 1),
  ('Actions',          'actions',       'Task management with streams & categories',      'CheckSquare',  'operations',    false, true, 2),
  ('EOS',              'eos',           'Entrepreneurial Operating System toolkit',        'Target',       'operations',    false, true, 3),
  ('Meetings',         'meetings',      'Meeting scheduling, agendas & takeaways',        'Calendar',     'operations',    false, true, 4),
  ('Knowledge Base',   'knowledge',     'Company knowledge, docs & vector search',        'BookOpen',     'intelligence',  false, true, 5),
  ('Projects',         'projects',      'Project tracking, milestones & billing',         'FolderKanban', 'business',      false, true, 6),
  ('Business Dev',     'business-dev',  'Deals pipeline, contacts & communications',      'TrendingUp',   'business',      false, true, 7),
  ('Productivity',     'productivity',  'Team productivity metrics & process docs',       'BarChart3',    'operations',    false, true, 8),
  ('Admin',            'admin',         'Platform administration & configuration',        'Settings',     'core',          true,  true, 9),
  ('AI Agents',        'ai-agents',     'AI agents, chat, and usage tracking',            'Bot',          'intelligence',  false, true, 10)
ON CONFLICT (slug) DO NOTHING;

-- 3. System settings
INSERT INTO public.system_settings (category, key, value, description) VALUES
  ('general',  'company_name',       '"SJ Innovation"',                      'Organization display name'),
  ('general',  'timezone',           '"America/New_York"',                   'Default timezone'),
  ('general',  'fiscal_year_start',  '"01-01"',                              'Fiscal year start MM-DD'),
  ('eos',      'current_quarter',    '"Q1 2026"',                            'Active EOS quarter'),
  ('eos',      'vto_version',        '1',                                    'VTO document version'),
  ('meetings', 'default_duration',   '30',                                   'Default meeting duration minutes'),
  ('meetings', 'auto_create_tasks',  'true',                                 'Auto-convert action-item takeaways to tasks')
ON CONFLICT (category, key) DO NOTHING;

-- 4. Feature flags (ensure all demo flags enabled)
INSERT INTO public.app_config (key, value, category, description) VALUES
  ('features.enableEOS',              'true', 'features', 'Enable EOS module'),
  ('features.enableMeetings',         'true', 'features', 'Enable Meetings module'),
  ('features.enableProjects',         'true', 'features', 'Enable Projects module'),
  ('features.enableBusinessDev',      'true', 'features', 'Enable Business Development module'),
  ('features.enableProductivity',     'true', 'features', 'Enable Productivity module'),
  ('features.enableActions',          'true', 'features', 'Enable Actions module')
ON CONFLICT (key) DO NOTHING;

-- 5. Sample notifications for first user
-- Note: type must be one of: info, success, warning, error
INSERT INTO public.notifications (user_id, title, message, type, link, is_read) VALUES
  ((SELECT id FROM auth.users ORDER BY created_at LIMIT 1),
   'Welcome to Control Tower', 'Your platform is ready. Explore the modules from the sidebar.',
   'info', '/dashboard', false),
  ((SELECT id FROM auth.users ORDER BY created_at LIMIT 1),
   'New EOS Quarter Started', 'Q1 2026 is now active. Review your OKRs and rocks.',
   'info', '/eos/okrs', false),
  ((SELECT id FROM auth.users ORDER BY created_at LIMIT 1),
   'Task Due Tomorrow', 'Client onboarding checklist is due Jan 28.',
   'warning', '/actions/tasks', false);

-- 6. Sample activity logs
-- Note: Uses COALESCE to handle missing clients gracefully
INSERT INTO public.activity_logs (user_id, action, resource_type, resource_id, details) VALUES
  ((SELECT id FROM auth.users ORDER BY created_at LIMIT 1),
   'login', 'session', gen_random_uuid(), '{"method":"email"}'),
  ((SELECT id FROM auth.users ORDER BY created_at LIMIT 1),
   'create', 'client', (SELECT id::text FROM clients WHERE email = 'john.doe@example.com' LIMIT 1),
   '{"client_name":"Acme Corp"}'),
  ((SELECT id FROM auth.users ORDER BY created_at LIMIT 1),
   'update', 'deal', gen_random_uuid(), '{"field":"stage","from":"lead","to":"discovery"}');

-- 7. Sample feedback
-- Note: status must be one of: pending, reviewed, resolved, closed
INSERT INTO public.feedback (user_id, type, subject, message, rating, status) VALUES
  ((SELECT id FROM auth.users ORDER BY created_at LIMIT 1),
   'feature', 'Dark mode support', 'Would love a dark mode toggle in settings.', 4, 'pending'),
  ((SELECT id FROM auth.users ORDER BY created_at LIMIT 1),
   'bug', 'Calendar not loading on Safari', 'Meetings calendar blank on Safari 18.', 2, 'pending');
