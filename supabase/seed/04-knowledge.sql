-- ============================================================
-- SEED: Knowledge Base Module
-- Categories (extend existing), entries, sources, files,
-- common knowledge
-- ============================================================

-- 1. Additional knowledge categories (5 already exist from test-data)
INSERT INTO public.knowledge_categories (name, slug, description, icon, color, sort_order) VALUES
  ('Company Policies',   'company-policies',   'HR policies, code of conduct, benefits',    '📋', '#6366F1', 6),
  ('Client Playbooks',   'client-playbooks',   'Client onboarding and engagement guides',   '🤝', '#EC4899', 7),
  ('Technical Standards', 'technical-standards', 'Coding standards, architecture decisions',  '⚙️', '#14B8A6', 8),
  ('Templates',          'templates',          'Reusable document and email templates',      '📄', '#F97316', 9)
ON CONFLICT (slug) DO NOTHING;

-- 2. Additional knowledge entries
DO $$
DECLARE
  u1 UUID := (SELECT id FROM auth.users ORDER BY created_at LIMIT 1);
  cat_policy UUID := (SELECT id FROM knowledge_categories WHERE slug = 'company-policies' LIMIT 1);
  cat_playbook UUID := (SELECT id FROM knowledge_categories WHERE slug = 'client-playbooks' LIMIT 1);
  cat_tech UUID := (SELECT id FROM knowledge_categories WHERE slug = 'technical-standards' LIMIT 1);
  cat_template UUID := (SELECT id FROM knowledge_categories WHERE slug = 'templates' LIMIT 1);
  cat_bp UUID := (SELECT id FROM knowledge_categories WHERE slug = 'best-practices' LIMIT 1);
BEGIN
  INSERT INTO knowledge_entries (title, slug, content, summary, category_id, author_id, status, tags, view_count) VALUES
    -- Company Policies
    ('Remote Work Policy', 'remote-work-policy',
     E'# Remote Work Policy\n\n## Overview\nAll team members may work remotely. Core hours are 10 AM – 2 PM ET.\n\n## Equipment\n- Company provides laptop, monitor, and headset.\n- $500 annual stipend for home office.\n\n## Communication\n- Slack for async, Zoom for sync.\n- Camera on for client calls.\n\n## Time Tracking\n- Log hours in Productivity module weekly.',
     'Guidelines for remote work including core hours, equipment, and communication.', cat_policy, u1, 'published', ARRAY['policy','remote','hr'], 42),

    ('PTO & Leave Policy', 'pto-leave-policy',
     E'# PTO & Leave Policy\n\n## Allowances\n- 20 days PTO per year (accrued monthly)\n- 5 sick days\n- 10 public holidays\n\n## Process\n1. Submit leave request via Productivity module.\n2. Manager approves within 48 hours.\n3. Handoff notes required for absences > 3 days.',
     'Paid time off allowances and request process.', cat_policy, u1, 'published', ARRAY['policy','pto','leave','hr'], 38),

    -- Client Playbooks
    ('Client Onboarding Playbook', 'client-onboarding-playbook',
     E'# Client Onboarding Playbook\n\n## Phase 1: Discovery (Week 1)\n- Kickoff call with stakeholders\n- Document requirements\n- Set up project in Projects module\n\n## Phase 2: Setup (Week 2)\n- Create client account\n- Configure modules\n- Invite client users\n\n## Phase 3: Training (Week 3-4)\n- Live training sessions\n- Share knowledge base articles\n- First QBR scheduled',
     'Step-by-step guide for onboarding new clients.', cat_playbook, u1, 'published', ARRAY['client','onboarding','process'], 67),

    ('Quarterly Business Review Template', 'qbr-template',
     E'# QBR Template\n\n## Agenda\n1. Recap of deliverables (10 min)\n2. KPI review (15 min)\n3. Wins & challenges (10 min)\n4. Roadmap & next quarter (15 min)\n5. Open discussion (10 min)\n\n## Preparation\n- Pull metrics from Productivity module\n- Gather client feedback\n- Prepare case study highlights',
     'Template for running quarterly business reviews with clients.', cat_template, u1, 'published', ARRAY['template','qbr','client'], 29),

    -- Technical Standards
    ('Git Branching Strategy', 'git-branching-strategy',
     E'# Git Branching Strategy\n\n## Branch Types\n- `main` — production, protected\n- `develop` — integration branch\n- `feature/*` — new features\n- `fix/*` — bug fixes\n- `release/*` — release prep\n\n## Rules\n1. All PRs require 1 approval.\n2. Squash merge to develop.\n3. Release branches merge to main with tag.',
     'Git workflow and branching conventions for the team.', cat_tech, u1, 'published', ARRAY['git','engineering','standards'], 55),

    ('Database Migration Standards', 'database-migration-standards',
     E'# Database Migration Standards\n\n## Naming\n`YYYYMMDD_description.sql`\n\n## Rules\n1. Always use `IF NOT EXISTS` / `ON CONFLICT`.\n2. Include rollback comments.\n3. Never drop columns in production — mark deprecated.\n4. Add RLS policies for every new table.\n5. Test locally with `supabase db reset`.',
     'Standards for writing Supabase migrations.', cat_tech, u1, 'published', ARRAY['database','migration','standards'], 31),

    -- Best Practices
    ('Effective Meeting Guidelines', 'effective-meeting-guidelines',
     E'# Effective Meeting Guidelines\n\n## Before\n- Define purpose & agenda\n- Share materials 24h in advance\n- Invite only necessary participants\n\n## During\n- Start on time, end 5 min early\n- Assign a note-taker\n- Use the IDS framework for issues\n\n## After\n- Send takeaways within 2 hours\n- Convert action items to tasks',
     'Best practices for productive meetings.', cat_bp, u1, 'published', ARRAY['meetings','productivity','best-practices'], 48)
  ON CONFLICT (slug) DO NOTHING;
END $$;

-- 3. Knowledge sources
INSERT INTO public.knowledge_sources (name, source_type, config, is_active, created_by) VALUES
  ('Manual Uploads',    'upload',        '{"max_size_mb":50,"allowed_types":["pdf","docx","md","txt"]}'::jsonb, true,  (SELECT id FROM auth.users ORDER BY created_at LIMIT 1)),
  ('Google Drive Sync', 'google_drive',  '{"folder_id":"","auto_sync":false}'::jsonb,                          false, (SELECT id FROM auth.users ORDER BY created_at LIMIT 1)),
  ('Meeting Transcripts', 'meeting',     '{"auto_import":true,"min_duration_minutes":15}'::jsonb,              true,  (SELECT id FROM auth.users ORDER BY created_at LIMIT 1))
ON CONFLICT DO NOTHING;

-- 4. Common knowledge items
INSERT INTO public.common_knowledge (title, content, category, tags, is_active, created_by) VALUES
  ('Company elevator pitch',
   'SJ Innovation builds an AI-powered operations platform for mid-market agencies and consultancies. We help teams manage strategy, execution, and knowledge in one place.',
   'general', ARRAY['pitch','company'], true, (SELECT id FROM auth.users ORDER BY created_at LIMIT 1)),
  ('Support hours',
   'Support is available Monday through Friday, 9 AM to 6 PM Eastern. Emergency issues: page the on-call engineer via PagerDuty.',
   'support', ARRAY['support','hours'], true, (SELECT id FROM auth.users ORDER BY created_at LIMIT 1)),
  ('Product positioning',
   'Control Tower is the only platform that combines EOS tools, project management, business development CRM, and AI agents in a single interface purpose-built for professional services firms.',
   'product', ARRAY['positioning','product'], true, (SELECT id FROM auth.users ORDER BY created_at LIMIT 1))
ON CONFLICT DO NOTHING;
