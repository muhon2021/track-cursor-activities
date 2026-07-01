
-- Add project members
INSERT INTO project_members (project_id, user_id, role) VALUES
  ('3ecefe6b-556a-4abf-ade5-6843c807f7ce', 'd2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39', 'member'),
  ('1c8ad1e2-8318-4b50-9e4b-47082dec46c5', 'd2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39', 'member'),
  ('3ecefe6b-556a-4abf-ade5-6843c807f7ce', 'e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'manager'),
  ('1c8ad1e2-8318-4b50-9e4b-47082dec46c5', 'e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'manager'),
  ('7dc6bd63-56ec-4697-87a7-f4cee514ceaa', 'e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'manager'),
  ('433fb262-7ab2-4a2c-b26d-c40a1eb70d76', 'c4642966-5969-4d55-b3a6-ce850c1e2786', 'viewer')
ON CONFLICT DO NOTHING;

-- Create current-week meetings
INSERT INTO meetings (id, title, description, organizer_id, scheduled_at, duration_minutes, status, meeting_type, slug, summary, action_items, notes) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001',
   'Sprint Planning — Platform V2',
   'Plan sprint deliverables for the next two weeks including SSO integration, CSV export, and monitoring setup.',
   '78657387-d518-4b2e-88d8-eca802372ad5',
   date_trunc('week', now()) + interval '1 day 10 hours',
   60, 'scheduled', 'internal', 'sprint-planning-platform-v2',
   'Team aligned on 3 key deliverables: SSO integration (IC lead), CSV export for productivity module, and monitoring alerts setup.',
   '["IC to complete SSO Entra integration by March 3", "PM to finalize CSV export requirements", "Admin to configure monitoring alerts in Datadog"]',
   'Sprint velocity target: 34 points. Carry-over from last sprint: 8 points.'),
  ('a1b2c3d4-0002-4000-8000-000000000002',
   'Acme Corp — Quarterly Business Review',
   'Review Q4 performance metrics, discuss renewal terms, and present roadmap for Q1.',
   'e46a6d4e-d69e-4bf5-9341-ba998e8da243',
   date_trunc('week', now()) + interval '2 days 14 hours',
   90, 'scheduled', 'client', 'acme-corp-qbr',
   'Acme expressed strong satisfaction with platform adoption (87% DAU). Renewal confirmed at +15% uplift.',
   '["Send updated pricing proposal by Friday", "Schedule technical deep-dive on SSO for Acme IT team", "Share Q1 product roadmap PDF"]',
   'Key stakeholders present: VP Engineering, Director of Product, IT Manager. NPS score: 9/10.'),
  ('a1b2c3d4-0003-4000-8000-000000000003',
   'FinEdge — Proof of Concept Demo',
   'Live demo of the platform for FinEdge evaluation team. Focus on compliance features and audit trail.',
   'e46a6d4e-d69e-4bf5-9341-ba998e8da243',
   date_trunc('week', now()) + interval '3 days 11 hours',
   45, 'scheduled', 'client', 'finedge-poc-demo',
   NULL, NULL,
   'Prepare demo environment with sample compliance data. Focus areas: audit logs, RLS, data export.'),
  ('a1b2c3d4-0004-4000-8000-000000000004',
   'Leadership Sync — Growth Strategy',
   'Weekly leadership alignment on growth targets, hiring pipeline, and product strategy.',
   'c4642966-5969-4d55-b3a6-ce850c1e2786',
   date_trunc('week', now()) + interval '4 days 9 hours',
   30, 'scheduled', 'internal', 'leadership-sync-growth',
   'Agreed to accelerate hiring for 2 senior engineers. Q1 revenue tracking 12% above forecast.',
   '["HR to post senior engineer roles by Monday", "CEO to finalize partnership term sheet with CloudNova", "PM to present PLG metrics dashboard next week"]',
   'Attendees: CEO, Admin/CTO, PM lead. Mood: optimistic.')
ON CONFLICT (id) DO NOTHING;

-- Add meeting participants (roles: organizer, presenter, attendee, optional)
INSERT INTO meeting_participants (meeting_id, user_id, role, rsvp_status) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', '78657387-d518-4b2e-88d8-eca802372ad5', 'organizer', 'accepted'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'd2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39', 'attendee', 'accepted'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'attendee', 'accepted'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'organizer', 'accepted'),
  ('a1b2c3d4-0002-4000-8000-000000000002', '78657387-d518-4b2e-88d8-eca802372ad5', 'attendee', 'accepted'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'c4642966-5969-4d55-b3a6-ce850c1e2786', 'optional', 'tentative'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'organizer', 'accepted'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'd2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39', 'attendee', 'accepted'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'c4642966-5969-4d55-b3a6-ce850c1e2786', 'organizer', 'accepted'),
  ('a1b2c3d4-0004-4000-8000-000000000004', '78657387-d518-4b2e-88d8-eca802372ad5', 'attendee', 'accepted'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'attendee', 'accepted')
ON CONFLICT DO NOTHING;

-- Seed AI digest logs
INSERT INTO ai_digest_logs (user_id, digest_type, subject, summary, was_read, sent_at) VALUES
  ('78657387-d518-4b2e-88d8-eca802372ad5', 'daily', 'Your Daily Digest — Feb 25',
   '{"highlights": ["Sprint Planning scheduled for tomorrow at 10 AM", "3 tasks in progress: SSO, Newsletter, Access Review", "Acme QBR on Wednesday"], "tasks_due": 3, "meetings_today": 1, "action_items": 2}'::jsonb,
   false, now() - interval '2 hours'),
  ('c4642966-5969-4d55-b3a6-ce850c1e2786', 'daily', 'CEO Daily Brief — Feb 25',
   '{"highlights": ["Q1 revenue tracking 12% above forecast", "Leadership Sync scheduled for Thursday", "2 pending decisions: Acme billing, quarterly review"], "tasks_due": 2, "meetings_today": 0, "action_items": 1}'::jsonb,
   false, now() - interval '2 hours'),
  ('e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'daily', 'PM Daily Digest — Feb 25',
   '{"highlights": ["Acme Corp onboarding in progress — 60% complete", "FinEdge POC demo on Thursday", "Case study draft due this week", "3 projects actively managed"], "tasks_due": 4, "meetings_today": 0, "action_items": 3}'::jsonb,
   false, now() - interval '2 hours'),
  ('d2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39', 'daily', 'Your Daily Digest — Feb 25',
   '{"highlights": ["SSO integration — in progress, targeting March 3", "Sprint Planning tomorrow at 10 AM", "FinEdge demo prep needed by Thursday", "6 tasks assigned, 1 in progress"], "tasks_due": 5, "meetings_today": 0, "action_items": 2}'::jsonb,
   false, now() - interval '2 hours');
