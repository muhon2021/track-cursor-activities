-- ============================================================
-- SEED: Projects Module
-- Statuses, projects, members, milestones, comments, risks,
-- billing, invoices
-- ============================================================

DO $$
DECLARE
  u1 UUID := (SELECT id FROM auth.users ORDER BY created_at LIMIT 1);
  cl_acme UUID := (SELECT id FROM clients WHERE email = 'john.doe@example.com' LIMIT 1);
  cl_tech UUID := (SELECT id FROM clients WHERE email = 'jane.smith@techstart.io' LIMIT 1);
  cl_ent  UUID := (SELECT id FROM clients WHERE email = 'mjohnson@enterprise.com' LIMIT 1);
  cl_fin  UUID := (SELECT id FROM clients WHERE email = 'tom@finedge.io' LIMIT 1);
  st_active UUID;
  st_planning UUID;
  st_completed UUID;
  p1 UUID; p2 UUID; p3 UUID; p4 UUID;
BEGIN

-- 1. Project statuses
INSERT INTO project_statuses (name, slug, color, sort_order, is_active, is_default) VALUES
  ('Planning',    'planning',    '#8B5CF6', 1, true, false),
  ('Active',      'active',      '#3B82F6', 2, true, true),
  ('On Hold',     'on-hold',     '#F59E0B', 3, true, false),
  ('Completed',   'completed',   '#10B981', 4, true, false),
  ('Cancelled',   'cancelled',   '#EF4444', 5, true, false)
ON CONFLICT (slug) DO NOTHING;

SELECT id INTO st_active    FROM project_statuses WHERE slug = 'active'    LIMIT 1;
SELECT id INTO st_planning  FROM project_statuses WHERE slug = 'planning'  LIMIT 1;
SELECT id INTO st_completed FROM project_statuses WHERE slug = 'completed' LIMIT 1;

-- 2. Projects
INSERT INTO projects (name, slug, description, status_id, client_id, owner_id, start_date, end_date, budget, currency, created_by) VALUES
  ('Acme Corp — Platform Rollout', 'acme-platform-rollout',
   'Full platform deployment for Acme Corp including SSO, knowledge base, and EOS setup.',
   st_active, cl_acme, u1, '2026-01-06', '2026-03-31', 45000, 'USD', u1),

  ('TechStart AI Integration', 'techstart-ai-integration',
   'Custom AI agent configuration and knowledge base setup for TechStart team.',
   st_active, cl_tech, u1, '2026-01-20', '2026-02-28', 18000, 'USD', u1),

  ('Enterprise Solutions — QBR Prep', 'enterprise-qbr-prep',
   'Prepare quarterly business review materials and dashboards.',
   st_planning, cl_ent, u1, '2026-02-01', '2026-02-15', 5000, 'USD', u1),

  ('FinEdge — Proof of Concept', 'finedge-poc',
   'Build a proof-of-concept demo with productivity analytics for FinEdge.',
   st_planning, cl_fin, u1, '2026-02-10', '2026-03-10', 12000, 'USD', u1)
ON CONFLICT (slug) DO NOTHING;

SELECT id INTO p1 FROM projects WHERE slug = 'acme-platform-rollout' LIMIT 1;
SELECT id INTO p2 FROM projects WHERE slug = 'techstart-ai-integration' LIMIT 1;
SELECT id INTO p3 FROM projects WHERE slug = 'enterprise-qbr-prep' LIMIT 1;
SELECT id INTO p4 FROM projects WHERE slug = 'finedge-poc' LIMIT 1;

-- 3. Project members
IF p1 IS NOT NULL THEN
  INSERT INTO project_members (project_id, user_id, role) VALUES
    (p1, u1, 'owner') ON CONFLICT DO NOTHING;
END IF;
IF p2 IS NOT NULL THEN
  INSERT INTO project_members (project_id, user_id, role) VALUES
    (p2, u1, 'owner') ON CONFLICT DO NOTHING;
END IF;

-- 4. Milestones
IF p1 IS NOT NULL THEN
  INSERT INTO project_milestones (project_id, title, description, due_date, status, sort_order, created_by) VALUES
    (p1, 'SSO Configuration Complete',       'Microsoft Entra SSO live for Acme.',            '2026-01-31', 'in_progress', 1, u1),
    (p1, 'Knowledge Base Populated',         '50+ articles migrated from Acme wiki.',         '2026-02-14', 'pending',     2, u1),
    (p1, 'EOS Setup & Training',             'VTO, scorecards, and L10 configured.',          '2026-02-28', 'pending',     3, u1),
    (p1, 'Go-Live & Handoff',               'Full team onboarded, support transition.',       '2026-03-31', 'pending',     4, u1);
END IF;
IF p2 IS NOT NULL THEN
  INSERT INTO project_milestones (project_id, title, description, due_date, status, sort_order, created_by) VALUES
    (p2, 'Agent Configuration',              'Custom AI agents deployed and tested.',          '2026-02-07', 'pending', 1, u1),
    (p2, 'Knowledge Base Import',            'TechStart docs imported and embedded.',          '2026-02-14', 'pending', 2, u1),
    (p2, 'User Acceptance Testing',          'TechStart team validates all features.',         '2026-02-21', 'pending', 3, u1),
    (p2, 'Production Launch',                'Go live with TechStart team.',                   '2026-02-28', 'pending', 4, u1);
END IF;

-- 5. Project comments
IF p1 IS NOT NULL THEN
  INSERT INTO project_comments (project_id, user_id, content) VALUES
    (p1, u1, 'Kickoff call went well. Acme IT team is responsive. SSO should be straightforward.'),
    (p1, u1, 'Received Acme''s wiki export (142 articles). Will start migration next week.');
END IF;

-- 6. Project risks
IF p1 IS NOT NULL THEN
  INSERT INTO project_risks (project_id, title, description, severity, status, mitigation, reported_by) VALUES
    (p1, 'SSO certificate expiry', 'Acme''s SAML cert expires in 60 days. Need renewal process.', 'medium', 'open', 'Calendar reminder + auto-renewal setup.', u1),
    (p1, 'Wiki migration data quality', 'Some Acme wiki articles have broken formatting.', 'low', 'mitigated', 'Added markdown cleanup script to migration pipeline.', u1);
END IF;

-- 7. Project billing
IF p1 IS NOT NULL THEN
  INSERT INTO project_billing (project_id, billing_type, rate, total_budget, currency, payment_terms)
  VALUES (p1, 'fixed', NULL, 45000, 'USD', 'Net 30')
  ON CONFLICT (project_id) DO NOTHING;
END IF;
IF p2 IS NOT NULL THEN
  INSERT INTO project_billing (project_id, billing_type, rate, total_budget, currency, payment_terms)
  VALUES (p2, 'hourly', 150, 18000, 'USD', 'Net 15')
  ON CONFLICT (project_id) DO NOTHING;
END IF;

-- 8. Invoices
IF p1 IS NOT NULL THEN
  INSERT INTO project_invoices (project_id, invoice_number, amount, status, due_date, notes, created_by) VALUES
    (p1, 'INV-2026-001', 15000, 'paid',  '2026-01-31', 'Phase 1 deposit — SSO & setup.', u1),
    (p1, 'INV-2026-002', 15000, 'sent',  '2026-02-28', 'Phase 2 — Knowledge Base migration.', u1),
    (p1, 'INV-2026-003', 15000, 'draft', '2026-03-31', 'Phase 3 — EOS setup & go-live.', u1);
END IF;

END $$;
