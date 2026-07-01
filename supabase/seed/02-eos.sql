-- ============================================================
-- SEED: EOS Module
-- Pods, VTO, OKRs, key results, issues, scorecards,
-- accountability chart, GWC assessments
-- ============================================================

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
  kr1 UUID;
  kr2 UUID;
  sc1 UUID;
  chart_id UUID;
  resp_ceo UUID;
BEGIN

-- 1. Pods
INSERT INTO eos_pods (name, description, color, lead_id, is_active)
VALUES
  ('Engineering', 'Product development & infrastructure', '#3B82F6', u1, true),
  ('Sales & BD',  'Revenue generation & partnerships',    '#10B981', u1, true),
  ('Operations',  'HR, finance & internal processes',     '#F59E0B', u1, true)
ON CONFLICT DO NOTHING;

SELECT id INTO pod_eng  FROM eos_pods WHERE name = 'Engineering'  LIMIT 1;
SELECT id INTO pod_sales FROM eos_pods WHERE name = 'Sales & BD' LIMIT 1;
SELECT id INTO pod_ops  FROM eos_pods WHERE name = 'Operations'  LIMIT 1;

-- 2. VTO sections
INSERT INTO eos_vto (section, title, content, sort_order, updated_by) VALUES
  ('core_values', 'Core Values', '["Ownership","Transparency","Customer Obsession","Continuous Learning","Ship Fast"]'::jsonb, 1, u1),
  ('core_focus', 'Core Focus', '{"purpose":"Empower teams with intelligent operations management","niche":"Mid-market agencies & consultancies"}'::jsonb, 2, u1),
  ('ten_year_target', '10-Year Target', '{"target":"Become the #1 AI-powered operations platform for professional services firms globally."}'::jsonb, 3, u1),
  ('marketing_strategy', 'Marketing Strategy', '{"target_market":"Agencies, consultancies, and professional services firms with 20–200 employees","differentiators":["AI-native from day one","All-in-one ops platform","EOS built-in"],"proven_process":"Discover → Implement → Optimize → Scale"}'::jsonb, 4, u1),
  ('three_year_picture', '3-Year Picture', '{"revenue":"$5M ARR","employees":30,"capabilities":["Full EOS suite","Marketplace integrations","White-label option"]}'::jsonb, 5, u1),
  ('one_year_plan', '1-Year Plan', '{"revenue":"$500K ARR","goals":["Launch all 10 modules","50 paying customers","SOC 2 certification"]}'::jsonb, 6, u1),
  ('quarterly_rocks', 'Q1 2026 Rocks', '["Complete QA across all modules","Onboard 10 pilot customers","Ship AI agent marketplace","Achieve 99.9% uptime"]'::jsonb, 7, u1),
  ('issues_list', 'Issues List', '["Hiring senior backend engineer","Need SOC 2 readiness assessment","Meeting transcription accuracy below target"]'::jsonb, 8, u1)
ON CONFLICT (section) DO UPDATE SET content = EXCLUDED.content, updated_by = EXCLUDED.updated_by;

-- 3. OKRs (active Q2 2026)
INSERT INTO okrs (title, description, owner_id, status, quarter, start_date, end_date, progress, pod_id, created_by, okr_type, year, is_archived)
VALUES
  ('Ship all 10 modules to production', 'Complete development, QA, and data seeding for all platform modules.', u1, 'active', 'Q2 2026', '2026-04-01', '2026-06-30', 65, pod_eng, u1, 'company', 2026, false),
  ('Acquire 10 pilot customers', 'Sign paid pilot agreements with 10 mid-market agencies.', u1, 'active', 'Q2 2026', '2026-04-01', '2026-06-30', 20, pod_sales, u1, 'team', 2026, false),
  ('Establish operational excellence', 'Implement SOPs, OKR tracking, and team cadences.', u1, 'on_track', 'Q2 2026', '2026-04-01', '2026-06-30', 40, pod_ops, u1, 'team', 2026, false),
  ('Improve platform reliability to 99.9%', 'Reduce downtime, add monitoring, and fix top-10 bugs.', u1, 'at_risk', 'Q2 2026', '2026-04-01', '2026-06-30', 30, pod_eng, u1, 'company', 2026, false);

-- OKRs (closed / archived from Q1 2026)
INSERT INTO okrs (title, description, owner_id, status, quarter, start_date, end_date, progress, pod_id, created_by, okr_type, year, is_archived)
VALUES
  ('Launch MVP platform', 'Deliver core modules (auth, dashboard, CRM, meetings) to production.', u1, 'completed', 'Q1 2026', '2026-01-01', '2026-03-31', 100, pod_eng, u1, 'company', 2026, true),
  ('Close first 3 paying customers', 'Convert pilot users to paid subscriptions.', u1, 'completed', 'Q1 2026', '2026-01-01', '2026-03-31', 100, pod_sales, u1, 'team', 2026, true),
  ('Set up team cadences', 'Establish L10 meetings, scorecards, and weekly check-ins.', u1, 'closed', 'Q1 2026', '2026-01-01', '2026-03-31', 85, pod_ops, u1, 'team', 2026, true);

-- Personal OKRs
INSERT INTO okrs (title, description, owner_id, status, quarter, start_date, end_date, progress, pod_id, created_by, okr_type, year, is_archived)
VALUES
  ('Complete AI/ML certification', 'Finish Stanford online AI course and apply learnings to product.', u1, 'active', 'Q2 2026', '2026-04-01', '2026-06-30', 55, null, u1, 'personal', 2026, false);

SELECT id INTO okr1 FROM okrs WHERE title = 'Ship all 10 modules to production' LIMIT 1;
SELECT id INTO okr2 FROM okrs WHERE title = 'Acquire 10 pilot customers' LIMIT 1;
SELECT id INTO okr3 FROM okrs WHERE title = 'Establish operational excellence' LIMIT 1;
SELECT id INTO okr4 FROM okrs WHERE title = 'Improve platform reliability to 99.9%' LIMIT 1;
SELECT id INTO okr5 FROM okrs WHERE title = 'Launch MVP platform' LIMIT 1;
SELECT id INTO okr6 FROM okrs WHERE title = 'Close first 3 paying customers' LIMIT 1;
SELECT id INTO okr7 FROM okrs WHERE title = 'Complete AI/ML certification' LIMIT 1;

-- 4. Key Results
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
  -- Closed OKR key results
  (okr5, 'Core modules deployed',                 'number',     5,  5, 0, 'modules',   'completed',   u1, 1),
  (okr5, 'Auth & SSO working',                    'number',     1,  1, 0, 'milestone', 'completed',   u1, 2),
  (okr6, 'Customers converted',                   'number',     3,  3, 0, 'customers', 'completed',   u1, 1),
  (okr6, 'MRR achieved',                          'currency',   4500, 3000, 0, 'USD',  'completed',   u1, 2),
  -- Personal OKR key results
  (okr7, 'Course modules completed',              'number',     6,  12, 0, 'modules',  'on_track',    u1, 1),
  (okr7, 'AI features prototyped',                'number',     2,  4, 0, 'prototypes','on_track',    u1, 2);

-- 5. OKR check-ins
SELECT id INTO kr1 FROM okr_key_results WHERE title = 'Modules with development complete' LIMIT 1;
SELECT id INTO kr2 FROM okr_key_results WHERE title = 'Discovery calls completed' LIMIT 1;

IF kr1 IS NOT NULL THEN
  INSERT INTO okr_check_ins (okr_id, key_result_id, user_id, previous_value, new_value, confidence, notes) VALUES
    (okr1, kr1, u1, 6, 8, 'high', 'Completed Actions categories + Productivity charts this week.'),
    (okr1, kr1, u1, 5, 6, 'high', 'Knowledge Base modularization done. Projects finalized.');
END IF;

IF kr2 IS NOT NULL THEN
  INSERT INTO okr_check_ins (okr_id, key_result_id, user_id, previous_value, new_value, confidence, notes) VALUES
    (okr2, kr2, u1, 4, 6, 'medium', 'Two calls with healthcare SaaS prospects. Good pipeline.');
END IF;

-- 6. Issues
INSERT INTO eos_issues (title, description, status, priority, category, pod_id, assigned_to, reported_by, source) VALUES
  ('Need dedicated QA resource', 'Currently relying on Lovable QA. Need a human QA engineer for edge cases.', 'open', 'high', 'people', pod_eng, u1, u1, 'meeting'),
  ('Meeting transcript accuracy < 85%', 'Zoom transcript provider returning noisy text. Affects AI summary quality.', 'in_progress', 'medium', 'system', pod_eng, u1, u1, 'manual'),
  ('SOC 2 readiness assessment overdue', 'Was supposed to start in January. Need to hire auditor.', 'open', 'critical', 'process', pod_ops, u1, u1, 'manual'),
  ('Sales collateral not up to date', 'Pitch deck still references v1 features. Need refresh.', 'open', 'medium', 'process', pod_sales, u1, u1, 'meeting'),
  ('Onboarding flow too many steps', 'New users drop off at step 4 of 7. Simplify.', 'solved', 'high', 'process', pod_eng, u1, u1, 'ai');

-- 7. Scorecards
INSERT INTO eos_scorecards (name, description, owner_id, frequency, is_active, created_by)
VALUES ('Engineering Weekly Scorecard', 'Key engineering health metrics tracked weekly.', u1, 'weekly', true, u1)
RETURNING id INTO sc1;

INSERT INTO eos_scorecard_metrics (scorecard_id, name, description, metric_type, target_value, current_value, unit, goal_direction, week_of, status, sort_order) VALUES
  (sc1, 'Deploy frequency',    'Number of production deploys this week',  'number',     5,  4, 'deploys',  'higher_is_better', '2026-01-27', 'on_track',       1),
  (sc1, 'Build success rate',  'CI build pass percentage',                'percentage', 95, 97, '%',       'higher_is_better', '2026-01-27', 'on_track',       2),
  (sc1, 'Open bug count',      'Total unresolved bugs',                   'number',     10, 14, 'bugs',    'lower_is_better',  '2026-01-27', 'needs_attention', 3),
  (sc1, 'Sprint velocity',     'Story points completed',                  'number',     40, 38, 'points',  'higher_is_better', '2026-01-27', 'on_track',       4),
  (sc1, 'Code review turnaround', 'Average hours to first review',        'number',     4,  3, 'hours',    'lower_is_better',  '2026-01-27', 'on_track',       5);

-- 8. Accountability chart
INSERT INTO accountability_charts (name, description, is_current, version, published_by, created_by)
VALUES ('SJ Innovation Org Chart Q1 2026', 'Current accountability structure.', true, 1, u1, u1)
RETURNING id INTO chart_id;

INSERT INTO accountability_responsibilities (chart_id, user_id, role_title, department, responsibilities, sort_order) VALUES
  (chart_id, u1, 'CEO / Visionary',  'Leadership',   '["Set vision & strategy","Manage key relationships","Final sign-off on product direction"]'::jsonb, 1)
RETURNING id INTO resp_ceo;

INSERT INTO accountability_responsibilities (chart_id, user_id, role_title, department, reports_to, responsibilities, sort_order) VALUES
  (chart_id, u1, 'VP Engineering',   'Engineering',  resp_ceo, '["Technical architecture","Sprint planning","Code quality & reviews"]'::jsonb, 2),
  (chart_id, u1, 'VP Sales',         'Sales & BD',   resp_ceo, '["Pipeline management","Close deals","Customer success"]'::jsonb, 3),
  (chart_id, u1, 'VP Operations',    'Operations',   resp_ceo, '["HR & hiring","Finance & billing","Internal process optimization"]'::jsonb, 4);

-- 9. GWC assessment for CEO role
INSERT INTO gwc_assessments (responsibility_id, assessor_id, gets_it, wants_it, has_capacity, notes, assessment_date)
VALUES (resp_ceo, u1, true, true, true, 'Founder-led, fully aligned.', '2026-01-15');

END $$;
