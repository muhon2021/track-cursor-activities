-- ============================================================
-- SEED: Meetings Module
-- Series, meetings, participants, agenda items, takeaways
-- ============================================================

DO $$
DECLARE
  u1 UUID := (SELECT id FROM auth.users ORDER BY created_at LIMIT 1);
  cl_acme UUID := (SELECT id FROM clients WHERE email = 'john.doe@example.com' LIMIT 1);
  cl_tech UUID := (SELECT id FROM clients WHERE email = 'jane.smith@techstart.io' LIMIT 1);
  series_l10 UUID;
  series_standup UUID;
  m1 UUID; m2 UUID; m3 UUID; m4 UUID; m5 UUID; m6 UUID;
  ag1 UUID; ag2 UUID;
BEGIN

-- 1. Meeting series
INSERT INTO meeting_series (title, description, recurrence_rule, duration_minutes, organizer_id, default_agenda, is_active)
VALUES
  ('Weekly L10 Meeting', 'EOS Level 10 leadership meeting every Monday at 9 AM.', 'RRULE:FREQ=WEEKLY;BYDAY=MO', 90, u1,
   '[{"title":"Segue (good news)","duration":5},{"title":"Scorecard review","duration":10},{"title":"Rock review","duration":10},{"title":"Customer/employee headlines","duration":5},{"title":"To-do review","duration":5},{"title":"IDS (issues)","duration":50},{"title":"Conclude","duration":5}]'::jsonb, true),
  ('Daily Standup', 'Quick daily sync for engineering team.', 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', 15, u1,
   '[{"title":"Yesterday","duration":5},{"title":"Today","duration":5},{"title":"Blockers","duration":5}]'::jsonb, true);

SELECT id INTO series_l10   FROM meeting_series WHERE title = 'Weekly L10 Meeting' LIMIT 1;
SELECT id INTO series_standup FROM meeting_series WHERE title = 'Daily Standup' LIMIT 1;

-- 2. Meetings (mix of past + upcoming)
INSERT INTO meetings (title, description, scheduled_at, duration_minutes, provider, status, organizer_id, client_id, meeting_type, series_id, is_recurring) VALUES
  -- Past L10 meetings
  ('L10 Meeting — Jan 13', 'Weekly leadership meeting.', '2026-01-13 09:00:00-05', 90, 'zoom', 'completed', u1, NULL, 'l10', series_l10, true),
  ('L10 Meeting — Jan 20', 'Weekly leadership meeting.', '2026-01-20 09:00:00-05', 90, 'zoom', 'completed', u1, NULL, 'l10', series_l10, true),
  ('L10 Meeting — Jan 27', 'Weekly leadership meeting.', '2026-01-27 09:00:00-05', 90, 'zoom', 'completed', u1, NULL, 'l10', series_l10, true),
  -- Upcoming L10
  ('L10 Meeting — Feb 3', 'Weekly leadership meeting.',  '2026-02-03 09:00:00-05', 90, 'zoom', 'scheduled', u1, NULL, 'l10', series_l10, true),
  -- Client meetings
  ('Acme Corp — Quarterly Review', 'Q1 business review with Acme leadership.', '2026-02-05 14:00:00-05', 60, 'google_meet', 'scheduled', u1, cl_acme, 'client_review', NULL, false),
  ('TechStart — Product Demo', 'Demo of new AI features for TechStart team.', '2026-01-28 11:00:00-05', 45, 'zoom', 'completed', u1, cl_tech, 'demo', NULL, false);

SELECT id INTO m1 FROM meetings WHERE title = 'L10 Meeting — Jan 13' LIMIT 1;
SELECT id INTO m2 FROM meetings WHERE title = 'L10 Meeting — Jan 20' LIMIT 1;
SELECT id INTO m3 FROM meetings WHERE title = 'L10 Meeting — Jan 27' LIMIT 1;
SELECT id INTO m4 FROM meetings WHERE title = 'L10 Meeting — Feb 3' LIMIT 1;
SELECT id INTO m5 FROM meetings WHERE title = 'Acme Corp — Quarterly Review' LIMIT 1;
SELECT id INTO m6 FROM meetings WHERE title = 'TechStart — Product Demo' LIMIT 1;

-- 3. Participants (upsert to avoid duplicate key on re-seed)
IF m3 IS NOT NULL THEN
  INSERT INTO meeting_participants (meeting_id, user_id, role, rsvp_status, attended)
  VALUES (m3, u1, 'organizer', 'accepted', true)
  ON CONFLICT (meeting_id, user_id) DO UPDATE SET
    role = EXCLUDED.role, rsvp_status = EXCLUDED.rsvp_status, attended = EXCLUDED.attended;
END IF;
IF m5 IS NOT NULL THEN
  INSERT INTO meeting_participants (meeting_id, user_id, email, name, role, rsvp_status)
  VALUES
    (m5, u1, NULL, NULL, 'organizer', 'accepted'),
    (m5, NULL, 'john.doe@example.com', 'John Doe', 'attendee', 'accepted')
  ON CONFLICT (meeting_id, user_id) DO UPDATE SET
    email = EXCLUDED.email, name = EXCLUDED.name, role = EXCLUDED.role, rsvp_status = EXCLUDED.rsvp_status;
END IF;
IF m6 IS NOT NULL THEN
  INSERT INTO meeting_participants (meeting_id, user_id, email, name, role, rsvp_status, attended)
  VALUES
    (m6, u1, NULL, NULL, 'presenter', 'accepted', true),
    (m6, NULL, 'jane.smith@techstart.io', 'Jane Smith', 'attendee', 'accepted', true)
  ON CONFLICT (meeting_id, user_id) DO UPDATE SET
    email = EXCLUDED.email, name = EXCLUDED.name, role = EXCLUDED.role, rsvp_status = EXCLUDED.rsvp_status, attended = EXCLUDED.attended;
END IF;

-- 4. Agenda items (L10 Jan 27 meeting)
IF m3 IS NOT NULL THEN
  INSERT INTO meeting_agenda_items (meeting_id, title, description, duration_minutes, presenter_id, sort_order, is_completed, created_by) VALUES
    (m3, 'Segue — Good News',      'Share personal/professional wins.',            5,  u1, 1, true, u1),
    (m3, 'Scorecard Review',        'Review weekly KPIs.',                          10, u1, 2, true, u1),
    (m3, 'Rock Review',             'Status update on Q1 rocks.',                   10, u1, 3, true, u1),
    (m3, 'Customer Headlines',      'Notable customer events this week.',           5,  u1, 4, true, u1),
    (m3, 'To-Do Review',            'Check off completed to-dos from last week.',   5,  u1, 5, true, u1),
    (m3, 'IDS — Issues',            'Identify, Discuss, Solve.',                    50, u1, 6, true, u1),
    (m3, 'Conclude',                'Rate meeting 1-10, review to-dos.',            5,  u1, 7, true, u1);

  SELECT id INTO ag1 FROM meeting_agenda_items WHERE meeting_id = m3 AND title = 'IDS — Issues' LIMIT 1;
  SELECT id INTO ag2 FROM meeting_agenda_items WHERE meeting_id = m3 AND title = 'To-Do Review' LIMIT 1;
END IF;

-- 5. Takeaways
IF m3 IS NOT NULL THEN
  INSERT INTO meeting_takeaways (meeting_id, agenda_item_id, content, takeaway_type, assigned_to, due_date, is_completed, created_by) VALUES
    (m3, ag1, 'Hire QA contractor for February sprint.',                  'action_item', u1, '2026-02-07', false, u1),
    (m3, ag1, 'Approved: Move to Anthropic Claude as primary AI model.',  'decision',    NULL, NULL, false, u1),
    (m3, ag1, 'Need to scope SOC 2 assessment before end of Q1.',        'follow_up',   u1, '2026-03-15', false, u1),
    (m3, ag2, 'All 5 to-dos from last week completed.',                  'note',        NULL, NULL, false, u1);
END IF;

-- 6. Transcript for TechStart demo
-- Note: meeting_transcripts has two possible schemas depending on migration order:
--   V1 (20260101): full_transcript, summary, speaker_count, etc.
--   V2 (20260201): content, ai_summary, source, duration_seconds, etc.
-- We try V2 first (module-level), then V1 (legacy), to support both.
IF m6 IS NOT NULL THEN
  BEGIN
    INSERT INTO meeting_transcripts (meeting_id, content, source, word_count, duration_seconds, ai_summary) VALUES
      (m6,
       'Presenter: Welcome everyone to the product demo. Today I will walk you through our new AI features including the knowledge base semantic search and the agent framework. Jane: Thanks, we are excited to see what you have built. Presenter: Let me start with the knowledge base. You can upload documents and our system automatically chunks and embeds them for semantic search...',
       'zoom', 280, 2700,
       'Demo covered AI knowledge base with semantic search, agent framework with custom system prompts, and productivity analytics. TechStart expressed strong interest in the knowledge base feature. Action: Send pricing proposal by Friday.');
  EXCEPTION WHEN undefined_column THEN
    BEGIN
      INSERT INTO meeting_transcripts (meeting_id, full_transcript, word_count, summary) VALUES
        (m6,
         'Presenter: Welcome everyone to the product demo. Today I will walk you through our new AI features including the knowledge base semantic search and the agent framework. Jane: Thanks, we are excited to see what you have built. Presenter: Let me start with the knowledge base. You can upload documents and our system automatically chunks and embeds them for semantic search...',
         280,
         'Demo covered AI knowledge base with semantic search, agent framework with custom system prompts, and productivity analytics. TechStart expressed strong interest in the knowledge base feature. Action: Send pricing proposal by Friday.');
    EXCEPTION WHEN undefined_column THEN
      RAISE NOTICE 'meeting_transcripts: schema mismatch — skipping transcript seed.';
    END;
  END;
END IF;

-- 7. Meeting assignments
IF m5 IS NOT NULL AND cl_acme IS NOT NULL THEN
  INSERT INTO meeting_assignments (meeting_id, entity_type, entity_id, assigned_by) VALUES
    (m5, 'client', cl_acme, u1);
END IF;

END $$;
