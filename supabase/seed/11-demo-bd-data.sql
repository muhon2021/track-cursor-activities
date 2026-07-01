-- ============================================================
-- SEED: Demo BD Role Data — Business Development dashboard
-- Creates a BD user role preference and assigns deals/contacts
-- so the BD dashboard shows data out of the box.
-- ============================================================

DO $$
DECLARE
  u_bd UUID := (SELECT id FROM auth.users WHERE email = 'bd@collabai.software' LIMIT 1);
  u_fallback UUID := (SELECT id FROM auth.users ORDER BY created_at LIMIT 1);
  u_target UUID;
  ct_hot1 UUID; ct_hot2 UUID; ct_hot3 UUID;
BEGIN
  -- Use BD-specific user if exists, otherwise fall back to first user
  u_target := COALESCE(u_bd, u_fallback);

  IF u_target IS NULL THEN
    RAISE NOTICE 'No users found — skipping BD seed.';
    RETURN;
  END IF;

  -- ───────────────────────────────────────────────
  -- 1. Set agency_role = 'bd' for the BD user
  -- ───────────────────────────────────────────────
  INSERT INTO user_role_preferences (user_id, role, agency_role, is_eos_user)
  VALUES (u_target, 'user', 'bd', false)
  ON CONFLICT (user_id, role) DO UPDATE SET agency_role = 'bd';

  -- ───────────────────────────────────────────────
  -- 2. Assign existing deals to BD user as owner
  -- ───────────────────────────────────────────────
  UPDATE deals SET owner_id = u_target
  WHERE slug IN (
    'techstart-ai-package',
    'finedge-poc',
    'healthsync-eval',
    'cloudbase-devtools'
  );

  -- ───────────────────────────────────────────────
  -- 3. Mark key contacts as lead follow-ups
  -- ───────────────────────────────────────────────
  UPDATE contacts SET
    is_lead_follow_up = true,
    lead_temperature = 'hot',
    lead_score = 78,
    engagement_score = 30,
    deal_potential_score = 25,
    followup_status = 'active',
    followup_interval_days = 5,
    last_contact_date = now() - interval '3 days',
    next_followup_date = now() + interval '2 days'
  WHERE email = 'jane.smith@techstart.io';

  UPDATE contacts SET
    is_lead_follow_up = true,
    lead_temperature = 'warm',
    lead_score = 52,
    engagement_score = 15,
    deal_potential_score = 20,
    followup_status = 'active',
    followup_interval_days = 7,
    last_contact_date = now() - interval '6 days',
    next_followup_date = now() + interval '1 day'
  WHERE email = 'tom@finedge.io';

  UPDATE contacts SET
    is_lead_follow_up = true,
    lead_temperature = 'warm',
    lead_score = 45,
    engagement_score = 10,
    deal_potential_score = 15,
    followup_status = 'pending',
    followup_interval_days = 14,
    last_contact_date = now() - interval '10 days',
    next_followup_date = now() + interval '4 days'
  WHERE email = 'lisa@healthsync.com';

  UPDATE contacts SET
    is_lead_follow_up = true,
    lead_temperature = 'hot',
    lead_score = 65,
    engagement_score = 25,
    deal_potential_score = 20,
    followup_status = 'active',
    followup_interval_days = 3,
    last_contact_date = now() - interval '1 day',
    next_followup_date = now() + interval '2 days'
  WHERE email = 'david.kim@cloudbase.dev';

  -- ───────────────────────────────────────────────
  -- 4. Add more deal activities for recent context
  -- ───────────────────────────────────────────────
  INSERT INTO deal_activities (deal_id, user_id, activity_type, content, created_at)
  SELECT d.id, u_target, 'note', 'BD follow-up: Sent proposal deck and scheduling demo call.', now() - interval '2 days'
  FROM deals d WHERE d.slug = 'techstart-ai-package'
  ON CONFLICT DO NOTHING;

  INSERT INTO deal_activities (deal_id, user_id, activity_type, content, created_at)
  SELECT d.id, u_target, 'call', 'Discovery call completed — positive feedback on analytics module.', now() - interval '4 days'
  FROM deals d WHERE d.slug = 'finedge-poc'
  ON CONFLICT DO NOTHING;

  INSERT INTO deal_activities (deal_id, user_id, activity_type, content, created_at)
  SELECT d.id, u_target, 'email', 'Intro email sent with product overview and case studies.', now() - interval '8 days'
  FROM deals d WHERE d.slug = 'healthsync-eval'
  ON CONFLICT DO NOTHING;

  INSERT INTO deal_activities (deal_id, user_id, activity_type, content, created_at)
  SELECT d.id, u_target, 'meeting', 'Partnership exploration meeting — alignment on integration goals.', now() - interval '1 day'
  FROM deals d WHERE d.slug = 'cloudbase-devtools'
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'BD demo data seeded for user %', u_target;
END $$;
