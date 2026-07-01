
DO $$
DECLARE
  u1 UUID := (SELECT id FROM auth.users ORDER BY created_at LIMIT 1);
  pod_eng UUID;
  pod_sales UUID;
  pod_ops UUID;
  okr1 UUID;
  okr2 UUID;
  okr3 UUID;
  okr4 UUID;
  okr5 UUID;
  okr6 UUID;
  okr7 UUID;
  okr8 UUID;
  kr1 UUID;
  kr2 UUID;
BEGIN
  IF u1 IS NULL THEN RAISE NOTICE 'No users — skipping.'; RETURN; END IF;

  SELECT id INTO pod_eng  FROM eos_pods WHERE name = 'Engineering'  LIMIT 1;
  SELECT id INTO pod_sales FROM eos_pods WHERE name = 'Sales & BD' LIMIT 1;
  SELECT id INTO pod_ops  FROM eos_pods WHERE name = 'Operations'  LIMIT 1;

  -- Clean all existing OKR data
  DELETE FROM okr_check_ins WHERE user_id = u1;
  DELETE FROM okr_key_results WHERE owner_id = u1;
  DELETE FROM okrs WHERE created_by = u1;

  -- Active Q2 2026 — Company OKRs
  INSERT INTO okrs (title, description, owner_id, status, quarter, start_date, end_date, progress, pod_id, created_by, okr_type, year, is_archived)
  VALUES ('Ship all 10 modules to production', 'Complete development, QA, and data seeding for all platform modules.', u1, 'active', 'Q2 2026', '2026-04-01', '2026-06-30', 65, pod_eng, u1, 'company', 2026, false)
  RETURNING id INTO okr1;

  INSERT INTO okrs (title, description, owner_id, status, quarter, start_date, end_date, progress, pod_id, created_by, okr_type, year, is_archived)
  VALUES ('Improve platform reliability to 99.9%', 'Reduce downtime, add monitoring, and fix top-10 bugs.', u1, 'at_risk', 'Q2 2026', '2026-04-01', '2026-06-30', 30, pod_eng, u1, 'company', 2026, false)
  RETURNING id INTO okr4;

  -- Active Q2 2026 — Team OKRs
  INSERT INTO okrs (title, description, owner_id, status, quarter, start_date, end_date, progress, pod_id, created_by, okr_type, year, is_archived)
  VALUES ('Acquire 10 pilot customers', 'Sign paid pilot agreements with 10 mid-market agencies.', u1, 'active', 'Q2 2026', '2026-04-01', '2026-06-30', 20, pod_sales, u1, 'team', 2026, false)
  RETURNING id INTO okr2;

  INSERT INTO okrs (title, description, owner_id, status, quarter, start_date, end_date, progress, pod_id, created_by, okr_type, year, is_archived)
  VALUES ('Establish operational excellence', 'Implement SOPs, OKR tracking, and team cadences.', u1, 'on_track', 'Q2 2026', '2026-04-01', '2026-06-30', 40, pod_ops, u1, 'team', 2026, false)
  RETURNING id INTO okr3;

  -- Active Q2 2026 — Personal OKR
  INSERT INTO okrs (title, description, owner_id, status, quarter, start_date, end_date, progress, pod_id, created_by, okr_type, year, is_archived)
  VALUES ('Complete AI/ML certification', 'Finish Stanford online AI course and apply learnings to product.', u1, 'active', 'Q2 2026', '2026-04-01', '2026-06-30', 55, null, u1, 'personal', 2026, false)
  RETURNING id INTO okr7;

  -- Closed/Archived Q1 2026
  INSERT INTO okrs (title, description, owner_id, status, quarter, start_date, end_date, progress, pod_id, created_by, okr_type, year, is_archived)
  VALUES ('Launch MVP platform', 'Deliver core modules to production.', u1, 'completed', 'Q1 2026', '2026-01-01', '2026-03-31', 100, pod_eng, u1, 'company', 2026, true)
  RETURNING id INTO okr5;

  INSERT INTO okrs (title, description, owner_id, status, quarter, start_date, end_date, progress, pod_id, created_by, okr_type, year, is_archived)
  VALUES ('Close first 3 paying customers', 'Convert pilot users to paid subscriptions.', u1, 'completed', 'Q1 2026', '2026-01-01', '2026-03-31', 100, pod_sales, u1, 'team', 2026, true)
  RETURNING id INTO okr6;

  INSERT INTO okrs (title, description, owner_id, status, quarter, start_date, end_date, progress, pod_id, created_by, okr_type, year, is_archived)
  VALUES ('Set up team cadences', 'Establish L10 meetings, scorecards, and weekly check-ins.', u1, 'completed', 'Q1 2026', '2026-01-01', '2026-03-31', 85, pod_ops, u1, 'team', 2026, true)
  RETURNING id INTO okr8;

  -- Key Results (using valid statuses: not_started, on_track, at_risk, behind, completed)
  INSERT INTO okr_key_results (okr_id, title, metric_type, current_value, target_value, start_value, unit, status, owner_id, sort_order) VALUES
    (okr1, 'Modules with development complete',     'number',     8,  10, 0, 'modules',  'on_track',    u1, 1),
    (okr1, 'QA checklist items tested',             'number',     45, 85, 0, 'items',    'behind',      u1, 2),
    (okr1, 'Demo seed data coverage',               'percentage', 60, 100, 0, '%',       'on_track',    u1, 3),
    (okr2, 'Discovery calls completed',             'number',     6,  30, 0, 'calls',    'on_track',    u1, 1),
    (okr2, 'Proposals sent',                        'number',     2,  15, 0, 'proposals','behind',      u1, 2),
    (okr2, 'Signed pilot agreements',               'number',     0,  10, 0, 'pilots',   'not_started', u1, 3),
    (okr3, 'SOPs documented',                       'number',     4,  12, 0, 'SOPs',     'on_track',    u1, 1),
    (okr3, 'Weekly L10 completion rate',             'percentage', 80, 95, 0, '%',        'on_track',    u1, 2),
    (okr3, 'Team NPS score',                        'number',     72, 80, 0, 'NPS',      'on_track',    u1, 3),
    (okr4, 'P0 bugs resolved',                      'number',     3,  10, 0, 'bugs',     'at_risk',     u1, 1),
    (okr4, 'Uptime percentage',                     'percentage', 99.2, 99.9, 98, '%',   'behind',      u1, 2),
    (okr4, 'Monitoring alerts configured',           'number',     5,  20, 0, 'alerts',   'on_track',    u1, 3),
    (okr5, 'Core modules deployed',                 'number',     5,  5, 0, 'modules',   'completed',   u1, 1),
    (okr5, 'Auth & SSO working',                    'number',     1,  1, 0, 'milestone', 'completed',   u1, 2),
    (okr6, 'Customers converted',                   'number',     3,  3, 0, 'customers', 'completed',   u1, 1),
    (okr6, 'MRR achieved',                          'currency',   4500, 3000, 0, 'USD',  'completed',   u1, 2),
    (okr7, 'Course modules completed',              'number',     6,  12, 0, 'modules',  'on_track',    u1, 1),
    (okr7, 'AI features prototyped',                'number',     2,  4, 0, 'prototypes','on_track',    u1, 2);

  -- Check-ins
  SELECT id INTO kr1 FROM okr_key_results WHERE okr_id = okr1 AND title = 'Modules with development complete' LIMIT 1;
  SELECT id INTO kr2 FROM okr_key_results WHERE okr_id = okr2 AND title = 'Discovery calls completed' LIMIT 1;

  IF kr1 IS NOT NULL THEN
    INSERT INTO okr_check_ins (okr_id, key_result_id, user_id, previous_value, new_value, confidence, notes) VALUES
      (okr1, kr1, u1, 6, 8, 'high', 'Completed Actions categories + Productivity charts this week.'),
      (okr1, kr1, u1, 5, 6, 'high', 'Knowledge Base modularization done. Projects finalized.');
  END IF;

  IF kr2 IS NOT NULL THEN
    INSERT INTO okr_check_ins (okr_id, key_result_id, user_id, previous_value, new_value, confidence, notes) VALUES
      (okr2, kr2, u1, 4, 6, 'medium', 'Two calls with healthcare SaaS prospects. Good pipeline.');
  END IF;

  RAISE NOTICE 'OKR seed data cleaned and re-inserted successfully.';
END $$;
