-- ============================================================
-- SEED: Project module settings (project_modules)
-- Enables project detail tabs: Tasks, Integrations, Client Portal,
-- Checklist, Risks, Docs & Meetings, Billing.
-- ============================================================

INSERT INTO public.system_settings (category, key, value, description) VALUES
  ('project_modules', 'tasks',           'true'::jsonb, 'Toggle for project detail tab: tasks'),
  ('project_modules', 'integrations',   'true'::jsonb, 'Toggle for project detail tab: integrations'),
  ('project_modules', 'client_portal',  'true'::jsonb, 'Toggle for project detail tab: client_portal'),
  ('project_modules', 'checklist',      'true'::jsonb, 'Toggle for project detail tab: checklist'),
  ('project_modules', 'risks',         'true'::jsonb, 'Toggle for project detail tab: risks'),
  ('project_modules', 'files',         'true'::jsonb, 'Toggle for project detail tab: files'),
  ('project_modules', 'finance',       'true'::jsonb, 'Toggle for project detail tab: finance')
ON CONFLICT (category, key) DO NOTHING;
