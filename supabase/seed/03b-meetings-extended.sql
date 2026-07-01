-- ============================================================
-- SEED: Meetings Module (Extended V2)
-- Comprehensive mock data for all V2 meetings tables:
--   meetings, meeting_series, meeting_participants,
--   meeting_external_participants, meeting_agenda_items,
--   meeting_takeaways, meeting_transcripts, meeting_files,
--   meeting_categorizations, meeting_assignments,
--   meeting_action_items, meeting_assignment_suggestions,
--   client_meetings, contact_meeting_links
--
-- Run AFTER 03-meetings.sql and 06-business-dev.sql
-- ============================================================

DO $$
DECLARE
  u1 UUID := (SELECT id FROM auth.users ORDER BY created_at LIMIT 1);
  -- Clients
  cl_acme    UUID := (SELECT id FROM clients WHERE email = 'john.doe@example.com' LIMIT 1);
  cl_tech    UUID := (SELECT id FROM clients WHERE email = 'jane.smith@techstart.io' LIMIT 1);
  cl_fin     UUID := (SELECT id FROM clients WHERE email = 'tom@finedge.io' LIMIT 1);
  cl_health  UUID := (SELECT id FROM clients WHERE email = 'lisa@healthsync.com' LIMIT 1);
  cl_design  UUID := (SELECT id FROM clients WHERE email = 'rachel@designstudio.co' LIMIT 1);
  -- Contacts
  ct_john    UUID := (SELECT id FROM contacts WHERE email = 'john.doe@example.com' LIMIT 1);
  ct_jane    UUID := (SELECT id FROM contacts WHERE email = 'jane.smith@techstart.io' LIMIT 1);
  ct_michael UUID := (SELECT id FROM contacts WHERE email = 'mjohnson@enterprise.com' LIMIT 1);
  ct_tom     UUID := (SELECT id FROM contacts WHERE email = 'tom@finedge.io' LIMIT 1);
  ct_lisa    UUID := (SELECT id FROM contacts WHERE email = 'lisa@healthsync.com' LIMIT 1);
  ct_david   UUID := (SELECT id FROM contacts WHERE email = 'david.kim@cloudbase.dev' LIMIT 1);
  -- Deals
  dl_acme    UUID := (SELECT id FROM deals WHERE slug = 'acme-annual-license' LIMIT 1);
  dl_tech    UUID := (SELECT id FROM deals WHERE slug = 'techstart-ai-package' LIMIT 1);
  dl_fin     UUID := (SELECT id FROM deals WHERE slug = 'finedge-poc' LIMIT 1);
  dl_health  UUID := (SELECT id FROM deals WHERE slug = 'healthsync-eval' LIMIT 1);
  -- Projects (if seeded)
  prj1       UUID := (SELECT id FROM projects LIMIT 1);
  -- Existing series
  series_l10     UUID := (SELECT id FROM meeting_series WHERE title = 'Weekly L10 Meeting' LIMIT 1);
  series_standup UUID := (SELECT id FROM meeting_series WHERE title = 'Daily Standup' LIMIT 1);
  -- New series
  series_retro UUID;
  series_client UUID;
  -- Meetings
  m10 UUID; m11 UUID; m12 UUID; m13 UUID; m14 UUID; m15 UUID;
  m16 UUID; m17 UUID; m18 UUID; m19 UUID; m20 UUID; m21 UUID;
  m22 UUID; m23 UUID; m24 UUID; m25 UUID; m26 UUID; m27 UUID;
  m28 UUID; m29 UUID; m30 UUID;
  -- Agenda items
  ag10 UUID; ag11 UUID; ag12 UUID; ag13 UUID; ag14 UUID; ag15 UUID;
  ag16 UUID; ag17 UUID; ag18 UUID; ag19 UUID; ag20 UUID;
  -- Action items
  ai1 UUID; ai2 UUID; ai3 UUID;
BEGIN

-- =========================
-- 1. Additional Meeting Series
-- =========================
INSERT INTO meeting_series (title, description, recurrence_rule, duration_minutes, organizer_id, default_agenda, is_active) VALUES
  ('Sprint Retrospective', 'Bi-weekly sprint retrospective for engineering.', 'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=FR', 60, u1,
   '[{"title":"What went well","duration":15},{"title":"What could improve","duration":15},{"title":"Action items","duration":20},{"title":"Shoutouts","duration":10}]'::jsonb, true),
  ('Monthly Client Check-in', 'Monthly account health review with each active client.', 'RRULE:FREQ=MONTHLY;BYDAY=1TH', 45, u1,
   '[{"title":"Account health","duration":10},{"title":"Project updates","duration":15},{"title":"Upcoming needs","duration":10},{"title":"Open items","duration":10}]'::jsonb, true)
ON CONFLICT DO NOTHING;

SELECT id INTO series_retro  FROM meeting_series WHERE title = 'Sprint Retrospective' LIMIT 1;
SELECT id INTO series_client FROM meeting_series WHERE title = 'Monthly Client Check-in' LIMIT 1;

-- =========================
-- 2. Meetings (30 total: mix of past completed, current in-progress, future scheduled, one cancelled, one no-show)
-- =========================
INSERT INTO meetings (title, description, scheduled_at, duration_minutes, provider, status, organizer_id, client_id, meeting_type, series_id, is_recurring, slug, deal_id, timezone, recurrence_pattern, ai_summary, notes, is_external, efficiency_score) VALUES
  -- Sprint retros (past)
  ('Sprint 21 Retro', 'Sprint 21 retrospective.', '2025-12-19 15:00:00-05', 60, 'google_meet', 'completed', u1, NULL, 'retro', series_retro, true, 'sprint-21-retro', NULL, 'America/New_York', 'biweekly', 'Team velocity improved 15%. CI pipeline issues flagged.', 'Good energy. Team aligned on next sprint goals.', false, 78),
  ('Sprint 22 Retro', 'Sprint 22 retrospective.', '2026-01-02 15:00:00-05', 60, 'google_meet', 'completed', u1, NULL, 'retro', series_retro, true, 'sprint-22-retro', NULL, 'America/New_York', 'biweekly', 'Deployment frequency up. Need better PR review turnaround.', NULL, false, 82),
  ('Sprint 23 Retro', 'Sprint 23 retrospective.', '2026-01-16 15:00:00-05', 60, 'google_meet', 'completed', u1, NULL, 'retro', series_retro, true, 'sprint-23-retro', NULL, 'America/New_York', 'biweekly', 'Record velocity. QA bottleneck resolved.', 'Best sprint of Q1.', false, 91),
  ('Sprint 24 Retro', 'Sprint 24 retrospective — upcoming.', '2026-02-14 15:00:00-05', 60, 'google_meet', 'scheduled', u1, NULL, 'retro', series_retro, true, 'sprint-24-retro', NULL, 'America/New_York', 'biweekly', NULL, NULL, false, NULL),

  -- Client meetings (Acme)
  ('Acme Corp — Kickoff', 'Annual license kickoff and roadmap review.', '2026-01-06 10:00:00-05', 60, 'zoom', 'completed', u1, cl_acme, 'client_review', NULL, false, 'acme-kickoff-jan', dl_acme, 'America/New_York', NULL, 'Reviewed 2026 roadmap. Acme excited about AI features. Agreed on quarterly business reviews.', 'Strong relationship. John wants early access to new features.', false, 85),
  ('Acme Corp — Jan Check-in', 'Monthly check-in with Acme team.', '2026-01-30 14:00:00-05', 45, 'zoom', 'completed', u1, cl_acme, 'client_review', series_client, true, 'acme-checkin-jan', dl_acme, 'America/New_York', 'monthly', 'Usage metrics growing. 3 support tickets resolved. Feature request for advanced reporting.', NULL, false, 88),

  -- Client meetings (TechStart)
  ('TechStart — Discovery Call', 'Initial discovery call with TechStart CEO.', '2025-12-15 11:00:00-05', 30, 'zoom', 'completed', u1, cl_tech, 'discovery', NULL, false, 'techstart-discovery', dl_tech, 'America/New_York', NULL, 'Jane wants AI agent framework for their API docs. Budget approved for Q1.', 'Great call. Jane is technically savvy and understands the value prop.', false, 90),
  ('TechStart — Technical Deep Dive', 'Deep dive into AI agent and knowledge base architecture.', '2026-01-10 13:00:00-05', 90, 'zoom', 'completed', u1, cl_tech, 'demo', NULL, false, 'techstart-deep-dive', dl_tech, 'America/New_York', NULL, 'Walked through embedding pipeline, agent system prompts, and RAG architecture. Jane wants custom fine-tuning.', 'Need to follow up with pricing for custom agent training.', false, 92),
  ('TechStart — Proposal Review', 'Review AI package proposal with TechStart.', '2026-02-12 10:00:00-05', 45, 'zoom', 'scheduled', u1, cl_tech, 'proposal', NULL, false, 'techstart-proposal', dl_tech, 'America/New_York', NULL, NULL, NULL, false, NULL),

  -- Client meetings (FinEdge)
  ('FinEdge — Intro Call', 'Introduction call with FinEdge head of product.', '2026-01-08 16:00:00-05', 30, 'microsoft_teams', 'completed', u1, cl_fin, 'discovery', NULL, false, 'finedge-intro', dl_fin, 'America/New_York', NULL, 'Tom interested in productivity analytics. Wants POC with 10-person team.', NULL, false, 75),
  ('FinEdge — POC Planning', 'Plan the proof-of-concept engagement.', '2026-01-22 15:00:00-05', 45, 'microsoft_teams', 'completed', u1, cl_fin, 'planning', NULL, false, 'finedge-poc-planning', dl_fin, 'America/New_York', NULL, 'Agreed on 4-week POC. FinEdge will provide test data next week. Monthly progress check-ins.', NULL, false, 80),
  ('FinEdge — POC Review', 'Mid-point POC review.', '2026-02-19 15:00:00-05', 45, 'microsoft_teams', 'scheduled', u1, cl_fin, 'review', NULL, false, 'finedge-poc-review', dl_fin, 'America/New_York', NULL, NULL, NULL, false, NULL),

  -- Client meetings (HealthSync)
  ('HealthSync — Cold Outreach Call', 'First call with HealthSync COO.', '2026-01-15 09:00:00-05', 20, 'zoom', 'completed', u1, cl_health, 'discovery', NULL, false, 'healthsync-outreach', dl_health, 'America/New_York', NULL, 'Lisa evaluating platforms for Q2. Interested in operations management. Need to send one-pager.', NULL, true, 65),
  ('HealthSync — Platform Demo', 'Demo of the full platform for HealthSync.', '2026-02-20 11:00:00-05', 60, 'zoom', 'scheduled', u1, cl_health, 'demo', NULL, false, 'healthsync-demo', dl_health, 'America/New_York', NULL, NULL, NULL, true, NULL),

  -- Client meetings (Design Studio)
  ('Design Studio — Creative Review', 'Monthly creative deliverables review.', '2026-01-23 10:00:00-05', 30, 'google_meet', 'completed', u1, cl_design, 'client_review', NULL, false, 'designstudio-review-jan', NULL, 'America/New_York', NULL, 'Reviewed January deliverables. All milestones met. Rachel happy with quality.', 'Consider upselling analytics package.', false, 88),
  ('Design Studio — Feb Review', 'February creative review.', '2026-02-20 10:00:00-05', 30, 'google_meet', 'scheduled', u1, cl_design, 'client_review', NULL, false, 'designstudio-review-feb', NULL, 'America/New_York', NULL, NULL, NULL, false, NULL),

  -- Internal meetings
  ('All-Hands Q1 Kickoff', 'Company-wide Q1 kickoff meeting.', '2026-01-03 09:00:00-05', 90, 'zoom', 'completed', u1, NULL, 'all_hands', NULL, false, 'allhands-q1-kickoff', NULL, 'America/New_York', NULL, 'CEO shared vision for 2026. Revenue targets, product roadmap, and hiring plans. Team Q&A session.', 'Great energy from the team. Several good questions about AI roadmap.', false, 85),
  ('Product Roadmap Workshop', 'Cross-functional roadmap planning session.', '2026-01-14 13:00:00-05', 120, 'google_meet', 'completed', u1, NULL, 'workshop', NULL, false, 'roadmap-workshop-q1', NULL, 'America/New_York', NULL, 'Prioritized 12 features for Q1. AI agents and knowledge base top priorities. Design system refresh deferred to Q2.', 'Good alignment across product, engineering, and design.', false, 90),
  ('Engineering Sync', 'Weekly engineering team sync.', '2026-02-10 09:30:00-05', 30, 'google_meet', 'in_progress', u1, NULL, 'standup', NULL, false, 'eng-sync-feb10', NULL, 'America/New_York', 'weekly', NULL, NULL, false, NULL),

  -- Cancelled / No-show
  ('Enterprise Solutions — Intro', 'Introduction call with Enterprise Solutions VP.', '2026-01-20 14:00:00-05', 30, 'zoom', 'cancelled', u1, NULL, 'discovery', NULL, false, 'enterprise-intro-cancelled', NULL, 'America/New_York', NULL, NULL, 'Michael cancelled — not evaluating tools this quarter.', true, NULL),
  ('CloudBase — Demo', 'Product demo for CloudBase engineering lead.', '2026-02-03 16:00:00-05', 45, 'zoom', 'no_show', u1, NULL, 'demo', NULL, false, 'cloudbase-demo-noshow', NULL, 'America/New_York', NULL, NULL, 'David did not show up. Need to reschedule.', true, NULL)
ON CONFLICT DO NOTHING;

-- Retrieve meeting IDs
SELECT id INTO m10 FROM meetings WHERE slug = 'sprint-21-retro' LIMIT 1;
SELECT id INTO m11 FROM meetings WHERE slug = 'sprint-22-retro' LIMIT 1;
SELECT id INTO m12 FROM meetings WHERE slug = 'sprint-23-retro' LIMIT 1;
SELECT id INTO m13 FROM meetings WHERE slug = 'sprint-24-retro' LIMIT 1;
SELECT id INTO m14 FROM meetings WHERE slug = 'acme-kickoff-jan' LIMIT 1;
SELECT id INTO m15 FROM meetings WHERE slug = 'acme-checkin-jan' LIMIT 1;
SELECT id INTO m16 FROM meetings WHERE slug = 'techstart-discovery' LIMIT 1;
SELECT id INTO m17 FROM meetings WHERE slug = 'techstart-deep-dive' LIMIT 1;
SELECT id INTO m18 FROM meetings WHERE slug = 'techstart-proposal' LIMIT 1;
SELECT id INTO m19 FROM meetings WHERE slug = 'finedge-intro' LIMIT 1;
SELECT id INTO m20 FROM meetings WHERE slug = 'finedge-poc-planning' LIMIT 1;
SELECT id INTO m21 FROM meetings WHERE slug = 'finedge-poc-review' LIMIT 1;
SELECT id INTO m22 FROM meetings WHERE slug = 'healthsync-outreach' LIMIT 1;
SELECT id INTO m23 FROM meetings WHERE slug = 'healthsync-demo' LIMIT 1;
SELECT id INTO m24 FROM meetings WHERE slug = 'designstudio-review-jan' LIMIT 1;
SELECT id INTO m25 FROM meetings WHERE slug = 'designstudio-review-feb' LIMIT 1;
SELECT id INTO m26 FROM meetings WHERE slug = 'allhands-q1-kickoff' LIMIT 1;
SELECT id INTO m27 FROM meetings WHERE slug = 'roadmap-workshop-q1' LIMIT 1;
SELECT id INTO m28 FROM meetings WHERE slug = 'eng-sync-feb10' LIMIT 1;
SELECT id INTO m29 FROM meetings WHERE slug = 'enterprise-intro-cancelled' LIMIT 1;
SELECT id INTO m30 FROM meetings WHERE slug = 'cloudbase-demo-noshow' LIMIT 1;

-- =========================
-- 3. Meeting Participants (internal)
-- =========================
IF m14 IS NOT NULL THEN
  INSERT INTO meeting_participants (meeting_id, user_id, role, rsvp_status, attended, response_at) VALUES
    (m14, u1, 'organizer', 'accepted', true, '2026-01-05 08:00:00-05')
  ON CONFLICT (meeting_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END IF;
IF m15 IS NOT NULL THEN
  INSERT INTO meeting_participants (meeting_id, user_id, role, rsvp_status, attended, response_at) VALUES
    (m15, u1, 'organizer', 'accepted', true, '2026-01-29 09:00:00-05')
  ON CONFLICT (meeting_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END IF;
IF m16 IS NOT NULL THEN
  INSERT INTO meeting_participants (meeting_id, user_id, role, rsvp_status, attended, response_at) VALUES
    (m16, u1, 'organizer', 'accepted', true, '2025-12-14 10:00:00-05')
  ON CONFLICT (meeting_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END IF;
IF m17 IS NOT NULL THEN
  INSERT INTO meeting_participants (meeting_id, user_id, role, rsvp_status, attended, response_at) VALUES
    (m17, u1, 'presenter', 'accepted', true, '2026-01-09 08:00:00-05')
  ON CONFLICT (meeting_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END IF;
IF m19 IS NOT NULL THEN
  INSERT INTO meeting_participants (meeting_id, user_id, role, rsvp_status, attended, response_at) VALUES
    (m19, u1, 'organizer', 'accepted', true, '2026-01-07 12:00:00-05')
  ON CONFLICT (meeting_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END IF;
IF m20 IS NOT NULL THEN
  INSERT INTO meeting_participants (meeting_id, user_id, role, rsvp_status, attended, response_at) VALUES
    (m20, u1, 'organizer', 'accepted', true, '2026-01-21 10:00:00-05')
  ON CONFLICT (meeting_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END IF;
IF m22 IS NOT NULL THEN
  INSERT INTO meeting_participants (meeting_id, user_id, role, rsvp_status, attended, response_at) VALUES
    (m22, u1, 'organizer', 'accepted', true, '2026-01-14 14:00:00-05')
  ON CONFLICT (meeting_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END IF;
IF m24 IS NOT NULL THEN
  INSERT INTO meeting_participants (meeting_id, user_id, role, rsvp_status, attended, response_at) VALUES
    (m24, u1, 'organizer', 'accepted', true, '2026-01-22 08:00:00-05')
  ON CONFLICT (meeting_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END IF;
IF m26 IS NOT NULL THEN
  INSERT INTO meeting_participants (meeting_id, user_id, role, rsvp_status, attended, response_at) VALUES
    (m26, u1, 'presenter', 'accepted', true, '2026-01-02 10:00:00-05')
  ON CONFLICT (meeting_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END IF;
IF m27 IS NOT NULL THEN
  INSERT INTO meeting_participants (meeting_id, user_id, role, rsvp_status, attended, response_at) VALUES
    (m27, u1, 'organizer', 'accepted', true, '2026-01-13 09:00:00-05')
  ON CONFLICT (meeting_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END IF;

-- =========================
-- 4. External Participants
-- =========================
IF m14 IS NOT NULL THEN
  INSERT INTO meeting_external_participants (meeting_id, external_email, external_name, role, status) VALUES
    (m14, 'john.doe@example.com', 'John Doe', 'required', 'accepted'),
    (m14, 'sarah.chen@acmecorp.com', 'Sarah Chen', 'optional', 'accepted')
  ON CONFLICT DO NOTHING;
END IF;
IF m15 IS NOT NULL THEN
  INSERT INTO meeting_external_participants (meeting_id, external_email, external_name, role, status) VALUES
    (m15, 'john.doe@example.com', 'John Doe', 'required', 'accepted')
  ON CONFLICT DO NOTHING;
END IF;
IF m16 IS NOT NULL THEN
  INSERT INTO meeting_external_participants (meeting_id, external_email, external_name, role, status) VALUES
    (m16, 'jane.smith@techstart.io', 'Jane Smith', 'required', 'accepted')
  ON CONFLICT DO NOTHING;
END IF;
IF m17 IS NOT NULL THEN
  INSERT INTO meeting_external_participants (meeting_id, external_email, external_name, role, status) VALUES
    (m17, 'jane.smith@techstart.io', 'Jane Smith', 'required', 'accepted'),
    (m17, 'dev.lead@techstart.io', 'Alex Rivera', 'optional', 'accepted')
  ON CONFLICT DO NOTHING;
END IF;
IF m19 IS NOT NULL THEN
  INSERT INTO meeting_external_participants (meeting_id, external_email, external_name, role, status) VALUES
    (m19, 'tom@finedge.io', 'Tom Bradley', 'required', 'accepted')
  ON CONFLICT DO NOTHING;
END IF;
IF m20 IS NOT NULL THEN
  INSERT INTO meeting_external_participants (meeting_id, external_email, external_name, role, status) VALUES
    (m20, 'tom@finedge.io', 'Tom Bradley', 'required', 'accepted'),
    (m20, 'ops@finedge.io', 'Karen Lee', 'optional', 'accepted')
  ON CONFLICT DO NOTHING;
END IF;
IF m22 IS NOT NULL THEN
  INSERT INTO meeting_external_participants (meeting_id, external_email, external_name, role, status) VALUES
    (m22, 'lisa@healthsync.com', 'Lisa Nguyen', 'required', 'accepted')
  ON CONFLICT DO NOTHING;
END IF;
IF m24 IS NOT NULL THEN
  INSERT INTO meeting_external_participants (meeting_id, external_email, external_name, role, status) VALUES
    (m24, 'rachel@designstudio.co', 'Rachel Green', 'required', 'accepted')
  ON CONFLICT DO NOTHING;
END IF;
IF m29 IS NOT NULL THEN
  INSERT INTO meeting_external_participants (meeting_id, external_email, external_name, role, status) VALUES
    (m29, 'mjohnson@enterprise.com', 'Michael Johnson', 'required', 'declined')
  ON CONFLICT DO NOTHING;
END IF;
IF m30 IS NOT NULL THEN
  INSERT INTO meeting_external_participants (meeting_id, external_email, external_name, role, status) VALUES
    (m30, 'david.kim@cloudbase.dev', 'David Kim', 'required', 'pending')
  ON CONFLICT DO NOTHING;
END IF;

-- =========================
-- 5. Agenda Items (for completed meetings)
-- =========================

-- Acme Kickoff agenda
IF m14 IS NOT NULL THEN
  INSERT INTO meeting_agenda_items (meeting_id, title, description, duration_minutes, presenter_id, sort_order, is_completed, created_by, assigned_to) VALUES
    (m14, '2026 Roadmap Overview', 'Present product roadmap highlights for 2026.', 20, u1, 1, true, u1, u1),
    (m14, 'Account Health Review', 'Review current usage metrics and satisfaction.', 15, u1, 2, true, u1, NULL),
    (m14, 'Feature Requests', 'Discuss Acme priority feature requests.', 15, u1, 3, true, u1, NULL),
    (m14, 'Action Items & Next Steps', 'Agree on Q1 deliverables and cadence.', 10, u1, 4, true, u1, u1)
  ON CONFLICT DO NOTHING;
  SELECT id INTO ag10 FROM meeting_agenda_items WHERE meeting_id = m14 AND sort_order = 1 LIMIT 1;
  SELECT id INTO ag11 FROM meeting_agenda_items WHERE meeting_id = m14 AND sort_order = 3 LIMIT 1;
  SELECT id INTO ag12 FROM meeting_agenda_items WHERE meeting_id = m14 AND sort_order = 4 LIMIT 1;
END IF;

-- TechStart Deep Dive agenda
IF m17 IS NOT NULL THEN
  INSERT INTO meeting_agenda_items (meeting_id, title, description, duration_minutes, presenter_id, sort_order, is_completed, created_by) VALUES
    (m17, 'Architecture Overview', 'High-level system architecture walkthrough.', 20, u1, 1, true, u1),
    (m17, 'AI Agent Framework Demo', 'Live demo of agent creation and execution.', 25, u1, 2, true, u1),
    (m17, 'Knowledge Base & RAG', 'Embedding pipeline and semantic search demo.', 25, u1, 3, true, u1),
    (m17, 'Q&A and Integration Discussion', 'Technical questions and integration points.', 20, u1, 4, true, u1)
  ON CONFLICT DO NOTHING;
  SELECT id INTO ag13 FROM meeting_agenda_items WHERE meeting_id = m17 AND sort_order = 2 LIMIT 1;
  SELECT id INTO ag14 FROM meeting_agenda_items WHERE meeting_id = m17 AND sort_order = 3 LIMIT 1;
END IF;

-- Sprint 23 Retro agenda
IF m12 IS NOT NULL THEN
  INSERT INTO meeting_agenda_items (meeting_id, title, description, duration_minutes, presenter_id, sort_order, is_completed, created_by) VALUES
    (m12, 'What Went Well', 'Celebrate wins from Sprint 23.', 15, u1, 1, true, u1),
    (m12, 'What Could Improve', 'Identify areas for improvement.', 15, u1, 2, true, u1),
    (m12, 'Action Items', 'Commit to specific improvements.', 20, u1, 3, true, u1),
    (m12, 'Shoutouts', 'Recognize team contributions.', 10, u1, 4, true, u1)
  ON CONFLICT DO NOTHING;
  SELECT id INTO ag15 FROM meeting_agenda_items WHERE meeting_id = m12 AND sort_order = 1 LIMIT 1;
  SELECT id INTO ag16 FROM meeting_agenda_items WHERE meeting_id = m12 AND sort_order = 2 LIMIT 1;
  SELECT id INTO ag17 FROM meeting_agenda_items WHERE meeting_id = m12 AND sort_order = 3 LIMIT 1;
END IF;

-- All-Hands agenda
IF m26 IS NOT NULL THEN
  INSERT INTO meeting_agenda_items (meeting_id, title, description, duration_minutes, presenter_id, sort_order, is_completed, created_by) VALUES
    (m26, 'CEO Vision for 2026', 'Company direction, mission, and goals.', 25, u1, 1, true, u1),
    (m26, 'Revenue & Growth Targets', 'Financial targets and growth strategy.', 20, u1, 2, true, u1),
    (m26, 'Product Roadmap Highlights', 'Key product initiatives for Q1-Q2.', 20, u1, 3, true, u1),
    (m26, 'Hiring & Team Growth', 'Planned hires and team structure changes.', 10, u1, 4, true, u1),
    (m26, 'Q&A', 'Open floor for questions.', 15, u1, 5, true, u1)
  ON CONFLICT DO NOTHING;
  SELECT id INTO ag18 FROM meeting_agenda_items WHERE meeting_id = m26 AND sort_order = 3 LIMIT 1;
END IF;

-- =========================
-- 6. Takeaways
-- =========================

-- Acme Kickoff takeaways
IF m14 IS NOT NULL AND ag10 IS NOT NULL THEN
  INSERT INTO meeting_takeaways (meeting_id, agenda_item_id, content, takeaway_type, assigned_to, due_date, is_completed, priority, status, created_by) VALUES
    (m14, ag10,  'Acme gets early access to AI agent beta in February.',       'decision',    NULL, NULL,         false, 'high',   'open',        u1),
    (m14, ag11,  'Advanced reporting feature prioritized for Q1 sprint 3.',    'decision',    NULL, NULL,         false, 'high',   'open',        u1),
    (m14, ag11,  'Send Acme the feature request form for tracking.',           'action_item', u1,   '2026-01-10', true,  'medium', 'completed',   u1),
    (m14, ag12,  'Schedule quarterly business reviews — next one March 15.',   'action_item', u1,   '2026-03-15', false, 'medium', 'open',        u1),
    (m14, NULL,  'John mentioned potential referral to sister company.',        'note',        NULL, NULL,         false, 'low',    'open',        u1)
  ON CONFLICT DO NOTHING;
END IF;

-- TechStart Deep Dive takeaways
IF m17 IS NOT NULL AND ag13 IS NOT NULL THEN
  INSERT INTO meeting_takeaways (meeting_id, agenda_item_id, content, takeaway_type, assigned_to, due_date, is_completed, priority, status, created_by) VALUES
    (m17, ag13,  'Jane wants custom agent for TechStart API documentation.',   'action_item', u1,   '2026-01-20', false, 'high',   'in_progress', u1),
    (m17, ag14,  'TechStart to provide sample docs for embedding test.',       'follow_up',   NULL, '2026-01-17', true,  'high',   'completed',   u1),
    (m17, ag14,  'Semantic search accuracy exceeds TechStart requirements.',   'note',        NULL, NULL,         false, 'low',    'open',        u1),
    (m17, NULL,  'Approved: Proceed with AI package proposal.',                'decision',    NULL, NULL,         false, 'high',   'open',        u1)
  ON CONFLICT DO NOTHING;
END IF;

-- Sprint 23 Retro takeaways
IF m12 IS NOT NULL AND ag15 IS NOT NULL THEN
  INSERT INTO meeting_takeaways (meeting_id, agenda_item_id, content, takeaway_type, assigned_to, due_date, is_completed, priority, status, created_by) VALUES
    (m12, ag15,  'CI pipeline speed improved 40% after Docker layer caching.', 'note',        NULL, NULL,         false, 'low',    'open',        u1),
    (m12, ag16,  'PR review turnaround still averaging 18 hours.',             'note',        NULL, NULL,         false, 'medium', 'open',        u1),
    (m12, ag17,  'Implement PR review SLA: 4-hour response, 24-hour merge.',  'action_item', u1,   '2026-01-23', true,  'high',   'completed',   u1),
    (m12, ag17,  'Set up automated Slack reminder for stale PRs.',             'action_item', u1,   '2026-01-20', true,  'medium', 'completed',   u1),
    (m12, NULL,  'Shoutout to engineering for record sprint velocity.',        'note',        NULL, NULL,         false, 'low',    'open',        u1)
  ON CONFLICT DO NOTHING;
END IF;

-- All-Hands takeaways
IF m26 IS NOT NULL AND ag18 IS NOT NULL THEN
  INSERT INTO meeting_takeaways (meeting_id, agenda_item_id, content, takeaway_type, assigned_to, due_date, is_completed, priority, status, created_by) VALUES
    (m26, ag18,  'AI agents and knowledge base are top product priorities.',   'decision',    NULL, NULL,         false, 'high',   'open',        u1),
    (m26, ag18,  'Design system refresh deferred to Q2.',                      'decision',    NULL, NULL,         false, 'medium', 'open',        u1),
    (m26, NULL,  'Hiring 3 engineers and 1 designer in Q1.',                   'note',        NULL, NULL,         false, 'medium', 'open',        u1),
    (m26, NULL,  'Revenue target: $2M ARR by end of Q2.',                      'note',        NULL, NULL,         false, 'high',   'open',        u1)
  ON CONFLICT DO NOTHING;
END IF;

-- =========================
-- 7. Transcripts (for key meetings)
-- =========================
IF m14 IS NOT NULL THEN
  BEGIN
    INSERT INTO meeting_transcripts (meeting_id, content, source, word_count, duration_seconds, ai_summary) VALUES
      (m14,
       'Organizer: Good morning John, Sarah! Happy New Year. Let us kick off 2026 with a review of what we have planned. John: Thanks, happy new year to you too. We are excited about the AI features you teased last quarter. Organizer: Absolutely. Let me share the roadmap. First, our AI Agent framework is going into beta in February. You will get early access. Second, we are shipping a redesigned knowledge base with semantic search. John: That sounds great. We have been wanting better search for our internal docs. Sarah: Can we also get advanced reporting? Our VP has been asking for custom dashboards. Organizer: Noted. I will prioritize that for Sprint 3. John: Perfect. Also, I might have a referral for you — our sister company is looking for a similar platform.',
       'zoom', 450, 3600,
       'Reviewed 2026 product roadmap with Acme team. AI agent beta access confirmed for February. Advanced reporting prioritized for Q1. Potential referral to Acme sister company.');
  EXCEPTION WHEN undefined_column THEN
    RAISE NOTICE 'meeting_transcripts schema mismatch — skipping Acme kickoff transcript.';
  END;
END IF;

IF m17 IS NOT NULL THEN
  BEGIN
    INSERT INTO meeting_transcripts (meeting_id, content, source, word_count, duration_seconds, ai_summary) VALUES
      (m17,
       'Presenter: Welcome Jane and Alex. Today we will deep dive into our AI architecture. Let me start with the high-level system design. We use a microservices approach with Supabase edge functions for AI orchestration. Jane: How do you handle multi-provider support? Presenter: Great question. We have an AI provider routing layer that supports OpenAI, Anthropic, Google Gemini, and Perplexity. Each agent can be configured with a primary and fallback provider. Alex: What about latency? Presenter: Typical response time is under 2 seconds for chat completions. For embedding generation, we batch process and can handle thousands of documents. Jane: Impressive. Can we create custom agents for our API documentation? Presenter: Absolutely. You define a system prompt, choose data sources, and configure the model. The agent gets RAG context from your uploaded documents automatically. Alex: What about the semantic search accuracy? Presenter: Our embedding pipeline uses OpenAI text-embedding-3-small with 1536 dimensions. In our tests, relevance scores above 0.7 consistently return high-quality results. Jane: This exceeds our requirements. Let us proceed with a proposal.',
       'zoom', 680, 5400,
       'Deep technical walkthrough of AI agent framework and knowledge base architecture. TechStart team (Jane Smith CEO, Alex Rivera Dev Lead) impressed with multi-provider support, custom agent creation, and semantic search accuracy. Proceeding to proposal stage.');
  EXCEPTION WHEN undefined_column THEN
    RAISE NOTICE 'meeting_transcripts schema mismatch — skipping TechStart deep-dive transcript.';
  END;
END IF;

IF m26 IS NOT NULL THEN
  BEGIN
    INSERT INTO meeting_transcripts (meeting_id, content, source, word_count, duration_seconds, ai_summary) VALUES
      (m26,
       'CEO: Good morning everyone. Welcome to our Q1 2026 kickoff. This year is going to be transformative. Our vision is clear: become the leading AI-powered business operations platform. Let me walk through our targets. Revenue goal: $2M ARR by end of Q2. We are currently at $1.2M. Product priorities for Q1: AI agents and knowledge base are number one. We will ship the agent framework beta in February and GA in March. Design system refresh moves to Q2 — we need to focus. On the team side, we are hiring 3 engineers and 1 designer this quarter. Questions? Employee1: What about the EOS module updates? CEO: EOS improvements are in the Q1 roadmap but secondary to AI features. Employee2: Will we have budget for attending conferences? CEO: Yes, we have allocated $50K for conferences and events in H1. Focus on AI and SaaS conferences.',
       'zoom', 520, 5400,
       'Q1 2026 all-hands kickoff. Revenue target $2M ARR by Q2 end (currently $1.2M). AI agents and knowledge base are top product priorities. Hiring 3 engineers + 1 designer. Design system refresh deferred to Q2. $50K conference budget for H1.');
  EXCEPTION WHEN undefined_column THEN
    RAISE NOTICE 'meeting_transcripts schema mismatch — skipping all-hands transcript.';
  END;
END IF;

-- =========================
-- 8. Meeting Categorizations
-- =========================
IF m14 IS NOT NULL THEN
  INSERT INTO meeting_categorizations (meeting_id, category, meeting_type, confidence, source, created_by, related_clients, tags) VALUES
    (m14, 'client_engagement', 'kickoff',         0.95, 'ai', u1, ('[{"client_id":"' || cl_acme || '","confidence":0.98}]')::jsonb, '["enterprise","renewal","roadmap"]'::jsonb),
    (m14, 'strategic',         'business_review',  0.85, 'ai', u1, NULL, '["quarterly","strategy"]'::jsonb)
  ON CONFLICT (meeting_id, category) DO UPDATE SET meeting_type = EXCLUDED.meeting_type, confidence = EXCLUDED.confidence;
END IF;
IF m17 IS NOT NULL THEN
  INSERT INTO meeting_categorizations (meeting_id, category, meeting_type, confidence, source, created_by, related_clients, tags) VALUES
    (m17, 'sales',             'technical_demo',   0.92, 'ai', u1, ('[{"client_id":"' || cl_tech || '","confidence":0.95}]')::jsonb, '["ai","demo","technical"]'::jsonb),
    (m17, 'client_engagement', 'deep_dive',        0.88, 'ai', u1, NULL, '["architecture","knowledge-base"]'::jsonb)
  ON CONFLICT (meeting_id, category) DO UPDATE SET meeting_type = EXCLUDED.meeting_type, confidence = EXCLUDED.confidence;
END IF;
IF m12 IS NOT NULL THEN
  INSERT INTO meeting_categorizations (meeting_id, category, meeting_type, confidence, source, created_by, tags) VALUES
    (m12, 'internal',          'retrospective',    0.98, 'ai', u1, '["agile","engineering","sprint"]'::jsonb)
  ON CONFLICT (meeting_id, category) DO UPDATE SET meeting_type = EXCLUDED.meeting_type;
END IF;
IF m26 IS NOT NULL THEN
  INSERT INTO meeting_categorizations (meeting_id, category, meeting_type, confidence, source, created_by, tags) VALUES
    (m26, 'internal',          'all_hands',        0.99, 'ai', u1, '["company","strategy","q1"]'::jsonb),
    (m26, 'strategic',         'planning',         0.90, 'ai', u1, '["roadmap","hiring","revenue"]'::jsonb)
  ON CONFLICT (meeting_id, category) DO UPDATE SET meeting_type = EXCLUDED.meeting_type;
END IF;
IF m22 IS NOT NULL THEN
  INSERT INTO meeting_categorizations (meeting_id, category, meeting_type, confidence, source, created_by, related_clients, tags) VALUES
    (m22, 'sales',             'cold_outreach',    0.88, 'ai', u1, ('[{"client_id":"' || cl_health || '","confidence":0.90}]')::jsonb, '["healthcare","outbound"]'::jsonb)
  ON CONFLICT (meeting_id, category) DO UPDATE SET meeting_type = EXCLUDED.meeting_type;
END IF;

-- =========================
-- 9. Meeting Assignments
-- =========================
IF m14 IS NOT NULL AND cl_acme IS NOT NULL THEN
  INSERT INTO meeting_assignments (meeting_id, entity_type, entity_id, assigned_by) VALUES
    (m14, 'client', cl_acme, u1)
  ON CONFLICT (meeting_id, entity_type, entity_id) DO NOTHING;
END IF;
IF m14 IS NOT NULL AND dl_acme IS NOT NULL THEN
  INSERT INTO meeting_assignments (meeting_id, entity_type, entity_id, assigned_by) VALUES
    (m14, 'deal', dl_acme, u1)
  ON CONFLICT (meeting_id, entity_type, entity_id) DO NOTHING;
END IF;
IF m17 IS NOT NULL AND cl_tech IS NOT NULL THEN
  INSERT INTO meeting_assignments (meeting_id, entity_type, entity_id, assigned_by) VALUES
    (m17, 'client', cl_tech, u1)
  ON CONFLICT (meeting_id, entity_type, entity_id) DO NOTHING;
END IF;
IF m17 IS NOT NULL AND dl_tech IS NOT NULL THEN
  INSERT INTO meeting_assignments (meeting_id, entity_type, entity_id, assigned_by) VALUES
    (m17, 'deal', dl_tech, u1)
  ON CONFLICT (meeting_id, entity_type, entity_id) DO NOTHING;
END IF;
IF m19 IS NOT NULL AND cl_fin IS NOT NULL THEN
  INSERT INTO meeting_assignments (meeting_id, entity_type, entity_id, assigned_by) VALUES
    (m19, 'client', cl_fin, u1)
  ON CONFLICT (meeting_id, entity_type, entity_id) DO NOTHING;
END IF;
IF m20 IS NOT NULL AND cl_fin IS NOT NULL THEN
  INSERT INTO meeting_assignments (meeting_id, entity_type, entity_id, assigned_by) VALUES
    (m20, 'client', cl_fin, u1)
  ON CONFLICT (meeting_id, entity_type, entity_id) DO NOTHING;
END IF;
IF m22 IS NOT NULL AND cl_health IS NOT NULL THEN
  INSERT INTO meeting_assignments (meeting_id, entity_type, entity_id, assigned_by) VALUES
    (m22, 'client', cl_health, u1)
  ON CONFLICT (meeting_id, entity_type, entity_id) DO NOTHING;
END IF;
IF m27 IS NOT NULL AND prj1 IS NOT NULL THEN
  INSERT INTO meeting_assignments (meeting_id, entity_type, entity_id, assigned_by) VALUES
    (m27, 'project', prj1, u1)
  ON CONFLICT (meeting_id, entity_type, entity_id) DO NOTHING;
END IF;

-- =========================
-- 10. Client Meetings (many-to-many)
-- =========================
IF m14 IS NOT NULL AND cl_acme IS NOT NULL THEN
  INSERT INTO client_meetings (client_id, meeting_id) VALUES (cl_acme, m14) ON CONFLICT (client_id, meeting_id) DO NOTHING;
END IF;
IF m15 IS NOT NULL AND cl_acme IS NOT NULL THEN
  INSERT INTO client_meetings (client_id, meeting_id) VALUES (cl_acme, m15) ON CONFLICT (client_id, meeting_id) DO NOTHING;
END IF;
IF m16 IS NOT NULL AND cl_tech IS NOT NULL THEN
  INSERT INTO client_meetings (client_id, meeting_id) VALUES (cl_tech, m16) ON CONFLICT (client_id, meeting_id) DO NOTHING;
END IF;
IF m17 IS NOT NULL AND cl_tech IS NOT NULL THEN
  INSERT INTO client_meetings (client_id, meeting_id) VALUES (cl_tech, m17) ON CONFLICT (client_id, meeting_id) DO NOTHING;
END IF;
IF m18 IS NOT NULL AND cl_tech IS NOT NULL THEN
  INSERT INTO client_meetings (client_id, meeting_id) VALUES (cl_tech, m18) ON CONFLICT (client_id, meeting_id) DO NOTHING;
END IF;
IF m19 IS NOT NULL AND cl_fin IS NOT NULL THEN
  INSERT INTO client_meetings (client_id, meeting_id) VALUES (cl_fin, m19) ON CONFLICT (client_id, meeting_id) DO NOTHING;
END IF;
IF m20 IS NOT NULL AND cl_fin IS NOT NULL THEN
  INSERT INTO client_meetings (client_id, meeting_id) VALUES (cl_fin, m20) ON CONFLICT (client_id, meeting_id) DO NOTHING;
END IF;
IF m21 IS NOT NULL AND cl_fin IS NOT NULL THEN
  INSERT INTO client_meetings (client_id, meeting_id) VALUES (cl_fin, m21) ON CONFLICT (client_id, meeting_id) DO NOTHING;
END IF;
IF m22 IS NOT NULL AND cl_health IS NOT NULL THEN
  INSERT INTO client_meetings (client_id, meeting_id) VALUES (cl_health, m22) ON CONFLICT (client_id, meeting_id) DO NOTHING;
END IF;
IF m23 IS NOT NULL AND cl_health IS NOT NULL THEN
  INSERT INTO client_meetings (client_id, meeting_id) VALUES (cl_health, m23) ON CONFLICT (client_id, meeting_id) DO NOTHING;
END IF;
IF m24 IS NOT NULL AND cl_design IS NOT NULL THEN
  INSERT INTO client_meetings (client_id, meeting_id) VALUES (cl_design, m24) ON CONFLICT (client_id, meeting_id) DO NOTHING;
END IF;
IF m25 IS NOT NULL AND cl_design IS NOT NULL THEN
  INSERT INTO client_meetings (client_id, meeting_id) VALUES (cl_design, m25) ON CONFLICT (client_id, meeting_id) DO NOTHING;
END IF;

-- =========================
-- 11. Contact Meeting Links
-- =========================
IF m14 IS NOT NULL AND ct_john IS NOT NULL THEN
  INSERT INTO contact_meeting_links (contact_id, meeting_id) VALUES (ct_john, m14) ON CONFLICT (contact_id, meeting_id) DO NOTHING;
END IF;
IF m15 IS NOT NULL AND ct_john IS NOT NULL THEN
  INSERT INTO contact_meeting_links (contact_id, meeting_id) VALUES (ct_john, m15) ON CONFLICT (contact_id, meeting_id) DO NOTHING;
END IF;
IF m16 IS NOT NULL AND ct_jane IS NOT NULL THEN
  INSERT INTO contact_meeting_links (contact_id, meeting_id) VALUES (ct_jane, m16) ON CONFLICT (contact_id, meeting_id) DO NOTHING;
END IF;
IF m17 IS NOT NULL AND ct_jane IS NOT NULL THEN
  INSERT INTO contact_meeting_links (contact_id, meeting_id) VALUES (ct_jane, m17) ON CONFLICT (contact_id, meeting_id) DO NOTHING;
END IF;
IF m18 IS NOT NULL AND ct_jane IS NOT NULL THEN
  INSERT INTO contact_meeting_links (contact_id, meeting_id) VALUES (ct_jane, m18) ON CONFLICT (contact_id, meeting_id) DO NOTHING;
END IF;
IF m19 IS NOT NULL AND ct_tom IS NOT NULL THEN
  INSERT INTO contact_meeting_links (contact_id, meeting_id) VALUES (ct_tom, m19) ON CONFLICT (contact_id, meeting_id) DO NOTHING;
END IF;
IF m20 IS NOT NULL AND ct_tom IS NOT NULL THEN
  INSERT INTO contact_meeting_links (contact_id, meeting_id) VALUES (ct_tom, m20) ON CONFLICT (contact_id, meeting_id) DO NOTHING;
END IF;
IF m22 IS NOT NULL AND ct_lisa IS NOT NULL THEN
  INSERT INTO contact_meeting_links (contact_id, meeting_id) VALUES (ct_lisa, m22) ON CONFLICT (contact_id, meeting_id) DO NOTHING;
END IF;
IF m29 IS NOT NULL AND ct_michael IS NOT NULL THEN
  INSERT INTO contact_meeting_links (contact_id, meeting_id) VALUES (ct_michael, m29) ON CONFLICT (contact_id, meeting_id) DO NOTHING;
END IF;
IF m30 IS NOT NULL AND ct_david IS NOT NULL THEN
  INSERT INTO contact_meeting_links (contact_id, meeting_id) VALUES (ct_david, m30) ON CONFLICT (contact_id, meeting_id) DO NOTHING;
END IF;

-- =========================
-- 12. Meeting Action Items (extracted from transcripts)
-- =========================
IF m14 IS NOT NULL THEN
  INSERT INTO meeting_action_items (meeting_id, text, assignee_id, due_date, priority, status, extracted_from_transcript, extraction_confidence) VALUES
    (m14, 'Grant Acme early access to AI agent beta by February 1.',       u1, '2026-02-01', 'high',   'pending',     true,  0.92),
    (m14, 'Prioritize advanced reporting feature for Sprint 3.',           u1, '2026-02-15', 'high',   'in_progress', true,  0.88),
    (m14, 'Send feature request form to John Doe at Acme.',                u1, '2026-01-10', 'medium', 'completed',   true,  0.95),
    (m14, 'Follow up on Acme sister company referral.',                    u1, '2026-01-20', 'medium', 'pending',     true,  0.72)
  ON CONFLICT DO NOTHING;
END IF;
IF m17 IS NOT NULL THEN
  INSERT INTO meeting_action_items (meeting_id, text, assignee_id, assignee_email, due_date, priority, status, extracted_from_transcript, extraction_confidence) VALUES
    (m17, 'Create custom AI agent prototype for TechStart API docs.',      u1, NULL,                    '2026-01-20', 'high',   'in_progress', true,  0.90),
    (m17, 'TechStart to provide sample documentation for embedding test.', NULL, 'jane.smith@techstart.io', '2026-01-17', 'high',   'completed',   true,  0.85),
    (m17, 'Prepare AI package proposal with pricing.',                     u1, NULL,                    '2026-01-25', 'high',   'pending',     true,  0.93)
  ON CONFLICT DO NOTHING;
END IF;
IF m26 IS NOT NULL THEN
  INSERT INTO meeting_action_items (meeting_id, text, assignee_id, due_date, priority, status, extracted_from_transcript, extraction_confidence) VALUES
    (m26, 'Publish job postings for 3 engineering and 1 design role.',     u1, '2026-01-15', 'high',   'completed',   true,  0.88),
    (m26, 'Finalize Q1 product sprint plan with AI agent priorities.',     u1, '2026-01-10', 'high',   'completed',   true,  0.91),
    (m26, 'Allocate conference budget across AI and SaaS events.',         u1, '2026-01-20', 'medium', 'pending',     true,  0.78)
  ON CONFLICT DO NOTHING;
END IF;

-- =========================
-- 13. Assignment Suggestions (AI-generated, for review)
-- =========================
IF m22 IS NOT NULL AND cl_health IS NOT NULL THEN
  INSERT INTO meeting_assignment_suggestions (meeting_id, suggested_type, suggested_id, confidence, reasoning, review_status) VALUES
    (m22, 'client',  cl_health, 0.92, 'Meeting title mentions HealthSync and participant Lisa Nguyen matches HealthSync COO contact.', 'approved'),
    (m22, 'project', COALESCE(prj1, gen_random_uuid()), 0.45, 'Low confidence: meeting discusses platform evaluation which may relate to onboarding project.', 'pending')
  ON CONFLICT DO NOTHING;
END IF;
IF m29 IS NOT NULL THEN
  INSERT INTO meeting_assignment_suggestions (meeting_id, suggested_type, suggested_id, confidence, reasoning, review_status) VALUES
    (m29, 'client', COALESCE((SELECT id FROM clients WHERE company = 'Enterprise Solutions' LIMIT 1), gen_random_uuid()), 0.78, 'Participant Michael Johnson from Enterprise Solutions matches client record.', 'rejected')
  ON CONFLICT DO NOTHING;
END IF;
IF m24 IS NOT NULL AND cl_design IS NOT NULL THEN
  INSERT INTO meeting_assignment_suggestions (meeting_id, suggested_type, suggested_id, confidence, reasoning, review_status) VALUES
    (m24, 'client', cl_design, 0.96, 'Meeting title "Design Studio — Creative Review" strongly matches Design Studio Co client.', 'approved')
  ON CONFLICT DO NOTHING;
END IF;
IF m19 IS NOT NULL AND dl_fin IS NOT NULL THEN
  INSERT INTO meeting_assignment_suggestions (meeting_id, suggested_type, suggested_id, confidence, reasoning, review_status) VALUES
    (m19, 'client', cl_fin, 0.94, 'FinEdge mentioned in title. Tom Bradley confirmed as FinEdge contact.', 'approved')
  ON CONFLICT DO NOTHING;
END IF;
-- Pending suggestions for upcoming meetings
IF m18 IS NOT NULL AND cl_tech IS NOT NULL THEN
  INSERT INTO meeting_assignment_suggestions (meeting_id, suggested_type, suggested_id, confidence, reasoning, review_status) VALUES
    (m18, 'client', cl_tech, 0.97, 'TechStart in meeting title. Jane Smith is scheduled participant from TechStart.', 'pending')
  ON CONFLICT DO NOTHING;
END IF;
IF m21 IS NOT NULL AND cl_fin IS NOT NULL THEN
  INSERT INTO meeting_assignment_suggestions (meeting_id, suggested_type, suggested_id, confidence, reasoning, review_status) VALUES
    (m21, 'client', cl_fin, 0.95, 'FinEdge POC Review — direct match to FinEdge client.', 'pending')
  ON CONFLICT DO NOTHING;
END IF;
IF m23 IS NOT NULL AND cl_health IS NOT NULL THEN
  INSERT INTO meeting_assignment_suggestions (meeting_id, suggested_type, suggested_id, confidence, reasoning, review_status) VALUES
    (m23, 'client', cl_health, 0.93, 'HealthSync Platform Demo — matches HealthSync Inc client.', 'pending')
  ON CONFLICT DO NOTHING;
END IF;

-- =========================
-- 14. Meeting Files
-- =========================
IF m14 IS NOT NULL THEN
  INSERT INTO meeting_files (meeting_id, provider, file_type, file_name, file_size, is_processed, has_embeddings, processing_status, assignment_status, assignment_confidence, suggested_client_id, assignment_reasoning, metadata) VALUES
    (m14, 'zoom', 'recording',  'acme-kickoff-recording.mp4',     524288000, true,  false, 'completed',   'assigned',       0.95, cl_acme, 'Recording clearly associated with Acme Corp kickoff.',                    '{"duration_seconds":3600,"resolution":"720p"}'::jsonb),
    (m14, 'zoom', 'transcript', 'acme-kickoff-transcript.vtt',    45000,     true,  true,  'completed',   'assigned',       0.95, cl_acme, 'Transcript from Acme Corp kickoff meeting.',                              '{"format":"vtt","language":"en"}'::jsonb),
    (m14, 'zoom', 'chat',       'acme-kickoff-chat.txt',          2300,      true,  false, 'completed',   'assigned',       0.90, cl_acme, 'Chat log from Acme meeting.',                                             '{}'::jsonb)
  ON CONFLICT DO NOTHING;
END IF;
IF m17 IS NOT NULL THEN
  INSERT INTO meeting_files (meeting_id, provider, file_type, file_name, file_size, is_processed, has_embeddings, processing_status, assignment_status, assignment_confidence, suggested_client_id, assignment_reasoning, metadata) VALUES
    (m17, 'zoom', 'recording',  'techstart-deepdive-recording.mp4', 786432000, true,  false, 'completed', 'assigned',       0.93, cl_tech, 'TechStart technical deep dive recording.',                                '{"duration_seconds":5400,"resolution":"1080p"}'::jsonb),
    (m17, 'zoom', 'transcript', 'techstart-deepdive-transcript.vtt', 82000,    true,  true,  'completed', 'assigned',       0.93, cl_tech, 'Transcript from TechStart architecture deep dive.',                       '{"format":"vtt","language":"en"}'::jsonb)
  ON CONFLICT DO NOTHING;
END IF;
-- Unreviewed files (for pending assignments testing)
IF m22 IS NOT NULL THEN
  INSERT INTO meeting_files (meeting_id, provider, file_type, file_name, file_size, is_processed, has_embeddings, processing_status, assignment_status, assignment_confidence, suggested_client_id, assignment_reasoning, metadata) VALUES
    (m22, 'zoom', 'recording',  'healthsync-outreach-recording.mp4', 209715200, true,  false, 'completed', 'pending_review', 0.82, cl_health, 'AI suggests HealthSync based on participant email match.', '{"duration_seconds":1200,"resolution":"720p"}'::jsonb)
  ON CONFLICT DO NOTHING;
END IF;

RAISE NOTICE 'Meetings extended seed completed successfully.';

END $$;
