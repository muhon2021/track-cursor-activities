-- ============================================================
-- SEED: Actions Module
-- Task streams, categories, tasks, comments, contributors
-- ============================================================

-- 1. Task streams
INSERT INTO public.task_streams (name, slug, description, color, is_archived, created_by) VALUES
  ('Engineering',    'engineering',    'Software development & technical tasks',  '#3B82F6', false, (SELECT id FROM auth.users ORDER BY created_at LIMIT 1)),
  ('Marketing',      'marketing',     'Marketing campaigns & content',           '#10B981', false, (SELECT id FROM auth.users ORDER BY created_at LIMIT 1)),
  ('Operations',     'operations',    'Day-to-day operational tasks',            '#F59E0B', false, (SELECT id FROM auth.users ORDER BY created_at LIMIT 1)),
  ('Client Success', 'client-success','Client onboarding & support',             '#8B5CF6', false, (SELECT id FROM auth.users ORDER BY created_at LIMIT 1)),
  ('Sales',          'sales',         'Sales pipeline & outreach',               '#EF4444', false, (SELECT id FROM auth.users ORDER BY created_at LIMIT 1))
ON CONFLICT (slug) DO NOTHING;

-- 2. Task categories
INSERT INTO public.task_categories (name, slug, color, sort_order) VALUES
  ('Bug Fix',       'bug-fix',       '#EF4444', 1),
  ('Feature',       'feature',       '#3B82F6', 2),
  ('Improvement',   'improvement',   '#10B981', 3),
  ('Documentation', 'documentation', '#F59E0B', 4),
  ('Research',      'research',      '#8B5CF6', 5),
  ('Admin',         'admin-task',    '#6B7280', 6)
ON CONFLICT (slug) DO NOTHING;

-- 3. Tasks (20 sample tasks across streams)
DO $$
DECLARE
  u1 UUID := (SELECT id FROM auth.users ORDER BY created_at LIMIT 1);
  s_eng UUID := (SELECT id FROM task_streams WHERE slug = 'engineering');
  s_mkt UUID := (SELECT id FROM task_streams WHERE slug = 'marketing');
  s_ops UUID := (SELECT id FROM task_streams WHERE slug = 'operations');
  s_cs  UUID := (SELECT id FROM task_streams WHERE slug = 'client-success');
  s_sal UUID := (SELECT id FROM task_streams WHERE slug = 'sales');
  c_bug UUID := (SELECT id FROM task_categories WHERE slug = 'bug-fix');
  c_feat UUID := (SELECT id FROM task_categories WHERE slug = 'feature');
  c_imp UUID := (SELECT id FROM task_categories WHERE slug = 'improvement');
  c_doc UUID := (SELECT id FROM task_categories WHERE slug = 'documentation');
  c_res UUID := (SELECT id FROM task_categories WHERE slug = 'research');
  c_adm UUID := (SELECT id FROM task_categories WHERE slug = 'admin-task');
  cl_acme UUID := (SELECT id FROM clients WHERE email = 'john.doe@example.com' LIMIT 1);
  cl_tech UUID := (SELECT id FROM clients WHERE email = 'jane.smith@techstart.io' LIMIT 1);
BEGIN
  -- Guard: skip if tasks already seeded
  IF EXISTS (SELECT 1 FROM tasks WHERE slug = 'implement-sso-entra') THEN
    RAISE NOTICE 'Tasks already seeded — skipping.';
    RETURN;
  END IF;

  INSERT INTO tasks (title, slug, description, status, priority, due_date, assigned_to, created_by, stream_id, category_id, client_id, position) VALUES
    -- Engineering stream
    ('Implement SSO with Microsoft Entra', 'implement-sso-entra', 'Set up SAML/OIDC flow for enterprise clients.', 'in_progress', 'high', NOW() + INTERVAL '7 days', u1, u1, s_eng, c_feat, NULL, 1),
    ('Fix date picker timezone bug', 'fix-datepicker-tz', 'Dates shift by 1 day in UTC-negative timezones.', 'todo', 'urgent', NOW() + INTERVAL '2 days', u1, u1, s_eng, c_bug, NULL, 2),
    ('Upgrade React Router to v7', 'upgrade-react-router-v7', 'Migrate from v6 to v7 for improved type safety.', 'todo', 'medium', NOW() + INTERVAL '14 days', u1, u1, s_eng, c_imp, NULL, 3),
    ('Add CSV export to productivity', 'csv-export-productivity', 'Users need to export weekly reports as CSV.', 'todo', 'medium', NOW() + INTERVAL '10 days', u1, u1, s_eng, c_feat, NULL, 4),
    ('Write API rate-limit documentation', 'api-rate-limit-docs', 'Document the edge function rate limits.', 'completed', 'low', NOW() - INTERVAL '3 days', u1, u1, s_eng, c_doc, NULL, 5),

    -- Marketing stream
    ('Draft Q1 newsletter', 'draft-q1-newsletter', 'Product updates newsletter for Q1 2026.', 'in_progress', 'medium', NOW() + INTERVAL '5 days', u1, u1, s_mkt, c_doc, NULL, 1),
    ('Update landing page copy', 'update-landing-copy', 'Refresh hero section with new value props.', 'todo', 'low', NOW() + INTERVAL '12 days', u1, u1, s_mkt, c_imp, NULL, 2),
    ('Research competitor pricing', 'research-competitor-pricing', 'Compare pricing tiers of top 5 competitors.', 'completed', 'medium', NOW() - INTERVAL '5 days', u1, u1, s_mkt, c_res, NULL, 3),

    -- Operations stream
    ('Set up monitoring alerts', 'setup-monitoring-alerts', 'Configure Supabase alerts for DB and edge function errors.', 'todo', 'high', NOW() + INTERVAL '3 days', u1, u1, s_ops, c_adm, NULL, 1),
    ('Review and renew SSL certificates', 'renew-ssl-certs', 'Custom domain SSL certs expire Feb 15.', 'todo', 'urgent', NOW() + INTERVAL '14 days', u1, u1, s_ops, c_adm, NULL, 2),
    ('Quarterly access review', 'quarterly-access-review', 'Audit user roles and module permissions.', 'in_progress', 'medium', NOW() + INTERVAL '7 days', u1, u1, s_ops, c_adm, NULL, 3),
    ('Update disaster recovery plan', 'update-dr-plan', 'Document RTO/RPO for all modules.', 'todo', 'low', NOW() + INTERVAL '21 days', u1, u1, s_ops, c_doc, NULL, 4),

    -- Client Success stream
    ('Onboard Acme Corp', 'onboard-acme-corp', 'Complete onboarding checklist for Acme Corp.', 'in_progress', 'high', NOW() + INTERVAL '4 days', u1, u1, s_cs, c_adm, cl_acme, 1),
    ('Prepare TechStart training materials', 'techstart-training', 'Build slide deck and walkthrough for TechStart team.', 'todo', 'medium', NOW() + INTERVAL '8 days', u1, u1, s_cs, c_doc, cl_tech, 2),
    ('Schedule quarterly review — Enterprise Solutions', 'qbr-enterprise-solutions', 'Set up QBR meeting and prepare metrics.', 'todo', 'medium', NOW() + INTERVAL '14 days', u1, u1, s_cs, c_adm, NULL, 3),
    ('Resolve Acme billing discrepancy', 'acme-billing-fix', 'Invoice #1042 shows wrong hours. Reconcile.', 'todo', 'high', NOW() + INTERVAL '2 days', u1, u1, s_cs, c_bug, cl_acme, 4),

    -- Sales stream
    ('Follow up with FinEdge after demo', 'followup-finedge', 'Send proposal and ROI calculator.', 'todo', 'high', NOW() + INTERVAL '1 day', u1, u1, s_sal, c_adm, NULL, 1),
    ('Prepare case study — Acme Corp', 'case-study-acme', 'Write up success story for marketing.', 'in_progress', 'medium', NOW() + INTERVAL '10 days', u1, u1, s_sal, c_doc, cl_acme, 2),
    ('Cold outreach list — Healthcare SaaS', 'outreach-healthcare', 'Build prospect list of 50 healthcare SaaS companies.', 'todo', 'low', NOW() + INTERVAL '14 days', u1, u1, s_sal, c_res, NULL, 3),
    ('Update CRM deal stages', 'update-crm-stages', 'Align internal deal stages with HubSpot pipeline.', 'completed', 'low', NOW() - INTERVAL '7 days', u1, u1, s_sal, c_adm, NULL, 4);
END $$;

-- 4. Task comments
DO $$
DECLARE
  u1 UUID := (SELECT id FROM auth.users ORDER BY created_at LIMIT 1);
  t_sso UUID := (SELECT id FROM tasks WHERE slug = 'implement-sso-entra' LIMIT 1);
  t_onboard UUID := (SELECT id FROM tasks WHERE slug = 'onboard-acme-corp' LIMIT 1);
BEGIN
  IF t_sso IS NOT NULL THEN
    INSERT INTO task_comments (task_id, user_id, content) VALUES
      (t_sso, u1, 'Microsoft Entra docs: https://learn.microsoft.com/en-us/entra/identity/. Need to register app first.'),
      (t_sso, u1, 'App registration done. Client ID is in Vault. Moving to SAML config next.');
  END IF;
  IF t_onboard IS NOT NULL THEN
    INSERT INTO task_comments (task_id, user_id, content) VALUES
      (t_onboard, u1, 'Sent welcome email. Awaiting user list from Acme IT team.'),
      (t_onboard, u1, 'Received 12 users. Creating accounts now.');
  END IF;
END $$;

-- 5. Stream members (first user owns all streams)
INSERT INTO public.task_stream_members (stream_id, user_id, role)
SELECT s.id, u.id, 'owner'
FROM task_streams s
CROSS JOIN (SELECT id FROM auth.users ORDER BY created_at LIMIT 1) u
ON CONFLICT DO NOTHING;
