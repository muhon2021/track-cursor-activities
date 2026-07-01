-- ============================================================
-- SEED: Business Development Module
-- Contacts, deals, deal activities, deal comments,
-- lead follow-ups, contact communications, scheduled emails
-- ============================================================

DO $$
DECLARE
  u1 UUID := (SELECT id FROM auth.users ORDER BY created_at LIMIT 1);
  cl_acme UUID := (SELECT id FROM clients WHERE email = 'john.doe@example.com' LIMIT 1);
  cl_tech UUID := (SELECT id FROM clients WHERE email = 'jane.smith@techstart.io' LIMIT 1);
  cl_fin  UUID := (SELECT id FROM clients WHERE email = 'tom@finedge.io' LIMIT 1);
  cl_health UUID := (SELECT id FROM clients WHERE email = 'lisa@healthsync.com' LIMIT 1);
  ct1 UUID; ct2 UUID; ct3 UUID; ct4 UUID; ct5 UUID; ct6 UUID;
  d1 UUID; d2 UUID; d3 UUID; d4 UUID; d5 UUID;
BEGIN

-- 1. Contacts
INSERT INTO contacts (first_name, last_name, email, phone, company, title, linkedin_url, client_id, source, tags, notes, created_by) VALUES
  ('John',    'Doe',     'john.doe@example.com',       '+1-555-0101', 'Acme Corp',            'CTO',             'https://linkedin.com/in/johndoe',       cl_acme,  'referral',  ARRAY['vip','technical'], 'Primary technical contact.',     u1),
  ('Jane',    'Smith',   'jane.smith@techstart.io',    '+1-555-0102', 'TechStart Inc',        'CEO',             'https://linkedin.com/in/janesmith',     cl_tech,  'inbound',   ARRAY['decision-maker'],  'Very interested in AI features.', u1),
  ('Michael', 'Johnson', 'mjohnson@enterprise.com',    '+1-555-0103', 'Enterprise Solutions',  'VP Operations',   'https://linkedin.com/in/mjohnson',      NULL,     'conference', ARRAY['enterprise'],     'Met at SaaStr 2025.',            u1),
  ('Tom',     'Bradley', 'tom@finedge.io',             '+1-555-0202', 'FinEdge Solutions',     'Head of Product', 'https://linkedin.com/in/tombradley',    cl_fin,   'cold',      ARRAY['fintech'],        'Fintech startup, Series A.',      u1),
  ('Lisa',    'Nguyen',  'lisa@healthsync.com',        '+1-555-0203', 'HealthSync Inc',        'COO',             'https://linkedin.com/in/lisanguyen',    cl_health,'cold',      ARRAY['healthcare'],     'Healthcare SaaS, evaluating.',    u1),
  ('David',   'Kim',     'david.kim@cloudbase.dev',    '+1-555-0301', 'CloudBase',             'Engineering Lead','https://linkedin.com/in/davidkim',      NULL,     'linkedin',  ARRAY['saas','devtools'],'Responded to LinkedIn outreach.', u1)
ON CONFLICT DO NOTHING;

SELECT id INTO ct1 FROM contacts WHERE email = 'john.doe@example.com' LIMIT 1;
SELECT id INTO ct2 FROM contacts WHERE email = 'jane.smith@techstart.io' LIMIT 1;
SELECT id INTO ct3 FROM contacts WHERE email = 'mjohnson@enterprise.com' LIMIT 1;
SELECT id INTO ct4 FROM contacts WHERE email = 'tom@finedge.io' LIMIT 1;
SELECT id INTO ct5 FROM contacts WHERE email = 'lisa@healthsync.com' LIMIT 1;
SELECT id INTO ct6 FROM contacts WHERE email = 'david.kim@cloudbase.dev' LIMIT 1;

-- 2. Deals
INSERT INTO deals (title, slug, description, stage, value, currency, probability, client_id, contact_id, owner_id, expected_close_date, source, tags, created_by) VALUES
  ('Acme Corp — Annual License',     'acme-annual-license',
   'Annual platform license renewal for Acme Corp.',
   'won', 54000, 'USD', 100, cl_acme, ct1, u1, '2026-01-15', 'renewal', ARRAY['enterprise','annual'], u1),

  ('TechStart — AI Package',         'techstart-ai-package',
   'AI agent setup + knowledge base + 6-month support.',
   'proposal', 36000, 'USD', 70, cl_tech, ct2, u1, '2026-02-28', 'inbound', ARRAY['ai','startup'], u1),

  ('FinEdge — POC Engagement',       'finedge-poc',
   'Paid proof-of-concept to evaluate productivity analytics.',
   'discovery', 12000, 'USD', 40, cl_fin, ct4, u1, '2026-03-15', 'outbound', ARRAY['fintech','poc'], u1),

  ('HealthSync — Platform Evaluation', 'healthsync-eval',
   'HealthSync evaluating platform for operations management.',
   'lead', 48000, 'USD', 15, cl_health, ct5, u1, '2026-04-30', 'cold', ARRAY['healthcare'], u1),

  ('CloudBase — DevTools Integration', 'cloudbase-devtools',
   'Potential integration partnership with CloudBase.',
   'discovery', 24000, 'USD', 30, NULL, ct6, u1, '2026-03-31', 'linkedin', ARRAY['partnership','devtools'], u1)
ON CONFLICT (slug) DO NOTHING;

SELECT id INTO d1 FROM deals WHERE slug = 'acme-annual-license' LIMIT 1;
SELECT id INTO d2 FROM deals WHERE slug = 'techstart-ai-package' LIMIT 1;
SELECT id INTO d3 FROM deals WHERE slug = 'finedge-poc' LIMIT 1;
SELECT id INTO d4 FROM deals WHERE slug = 'healthsync-eval' LIMIT 1;
SELECT id INTO d5 FROM deals WHERE slug = 'cloudbase-devtools' LIMIT 1;

-- 3. Deal activities
IF d1 IS NOT NULL THEN
  INSERT INTO deal_activities (deal_id, user_id, activity_type, content, metadata) VALUES
    (d1, u1, 'stage_change', 'Moved from proposal to won.',          '{"from":"proposal","to":"won"}'::jsonb),
    (d1, u1, 'note',         'Contract signed. License starts Jan 1.', '{}'::jsonb);
END IF;
IF d2 IS NOT NULL THEN
  INSERT INTO deal_activities (deal_id, user_id, activity_type, content, metadata) VALUES
    (d2, u1, 'meeting',      'Product demo with Jane Smith.',         '{"meeting_type":"demo"}'::jsonb),
    (d2, u1, 'email',        'Sent proposal PDF and pricing sheet.', '{}'::jsonb),
    (d2, u1, 'stage_change', 'Moved from discovery to proposal.',   '{"from":"discovery","to":"proposal"}'::jsonb);
END IF;
IF d3 IS NOT NULL THEN
  INSERT INTO deal_activities (deal_id, user_id, activity_type, content, metadata) VALUES
    (d3, u1, 'call',         'Intro call with Tom Bradley. Interested in productivity analytics.', '{"duration_minutes":30}'::jsonb),
    (d3, u1, 'stage_change', 'Moved from lead to discovery.',       '{"from":"lead","to":"discovery"}'::jsonb);
END IF;

-- 4. Deal comments
IF d2 IS NOT NULL THEN
  INSERT INTO deal_comments (deal_id, user_id, content) VALUES
    (d2, u1, 'Jane wants a custom agent for their API docs. Should be straightforward with our framework.'),
    (d2, u1, 'Pricing approved internally. Waiting for TechStart legal review.');
END IF;

-- 5. Lead follow-up contacts
INSERT INTO lead_followup_contacts (contact_id, status, priority, next_follow_up, follow_up_notes, assigned_to) VALUES
  (ct5, 'contacted', 'high',   '2026-02-05', 'Sent intro email. Schedule discovery call.', u1),
  (ct6, 'interested', 'medium', '2026-02-10', 'Responded positively. Wants to see demo.', u1),
  (ct3, 'not_interested', 'low', NULL, 'Not evaluating new tools this quarter. Revisit Q2.', u1)
ON CONFLICT (contact_id) DO NOTHING;

-- 6. Contact communications
INSERT INTO contact_communications (contact_id, channel, direction, subject, content, user_id) VALUES
  (ct2, 'email',    'outbound', 'Proposal: TechStart AI Package',      'Hi Jane, please find attached our proposal for the AI agent setup...', u1),
  (ct2, 'meeting',  'outbound', 'Product Demo',                        'Walked through knowledge base, AI agents, and productivity module.', u1),
  (ct4, 'phone',    'outbound', 'Intro Call',                          'Discussed FinEdge needs around productivity analytics and team metrics.', u1),
  (ct5, 'email',    'outbound', 'Introduction: SJ Innovation Platform', 'Hi Lisa, I wanted to introduce our AI-powered operations platform...', u1),
  (ct5, 'email',    'inbound',  'Re: Introduction',                    'Thanks for reaching out. We are evaluating solutions for Q2. Let us schedule a call.', u1),
  (ct6, 'linkedin', 'outbound', 'LinkedIn connection request',         'Hi David, I noticed CloudBase and thought there might be synergy...', u1),
  (ct6, 'linkedin', 'inbound',  'Re: Connection',                      'Thanks! Would love to learn more. Can you send a demo link?', u1);

-- 7. Scheduled emails
INSERT INTO scheduled_emails (to_email, subject, body, scheduled_for, status, deal_id, contact_id, created_by) VALUES
  ('tom@finedge.io', 'Follow-up: POC Next Steps',
   'Hi Tom, following up on our call. I have put together a POC scope document...',
   NOW() + INTERVAL '1 day', 'pending', d3, ct4, u1),
  ('lisa@healthsync.com', 'Discovery Call Scheduling',
   'Hi Lisa, great to hear you are interested. Here are some available times...',
   NOW() + INTERVAL '2 days', 'pending', d4, ct5, u1);

END $$;
