-- ============================================================
-- Migration: refresh_demo_data() function
-- Fixes: owner_dashboard_metrics view slug (in_progress → in-progress)
-- Creates: refresh_demo_data() SECURITY DEFINER function
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Fix the owner_dashboard_metrics view — slug was 'in_progress'
--    but actual project_statuses slug is 'in-progress' (hyphenated)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.owner_dashboard_metrics AS
SELECT
  -- Revenue: sum of deal values closed in the last 7 days
  (
    SELECT COALESCE(SUM(value), 0)::numeric
    FROM public.deals
    WHERE closed_at >= now() - interval '7 days'
  ) AS revenue_this_week,

  -- Team utilization: average across current week's records
  (
    SELECT COALESCE(ROUND(AVG(utilization_pct)::numeric, 1), 0)
    FROM public.productivity_records
    WHERE week_start = date_trunc('week', now())::date
  ) AS team_utilization,

  -- Projects in progress (not archived) — FIXED: 'in-progress' not 'in_progress'
  (
    SELECT COUNT(*)
    FROM public.projects p
    JOIN public.project_statuses ps ON ps.id = p.status_id
    WHERE p.is_archived = false
      AND ps.slug = 'in-progress'
  ) AS projects_in_progress,

  -- At-risk projects
  (
    SELECT COUNT(*)
    FROM public.projects
    WHERE is_at_risk = true
      AND is_archived = false
  ) AS projects_at_risk,

  -- Active clients
  (
    SELECT COUNT(*)
    FROM public.clients
    WHERE status = 'active'
  ) AS active_clients,

  -- Active team members
  (
    SELECT COUNT(*)
    FROM public.profiles
    WHERE is_active = true
  ) AS active_team_members,

  now() AS generated_at;


-- ─────────────────────────────────────────────────────────────
-- 2. refresh_demo_data() — idempotent function that inserts
--    relative-date demo data so dashboards always show content.
--    Tagged rows are cleaned up and re-inserted each call.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_demo_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_client_id UUID;
  v_in_progress_status UUID;
  v_today DATE := CURRENT_DATE;
  v_week_start DATE := date_trunc('week', now())::date;
  v_result jsonb := '{}'::jsonb;
BEGIN
  -- ── Resolve owner user (first admin, or first user) ──
  SELECT ur.user_id INTO v_owner_id
  FROM user_roles ur
  WHERE ur.role = 'admin'
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    SELECT id INTO v_owner_id FROM auth.users LIMIT 1;
  END IF;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No users found in auth.users');
  END IF;

  -- ── Resolve first active client ──
  SELECT id INTO v_client_id FROM clients WHERE status = 'active' LIMIT 1;

  -- ── Resolve 'in-progress' status id ──
  SELECT id INTO v_in_progress_status FROM project_statuses WHERE slug = 'in-progress' LIMIT 1;

  -- ═══════════════════════════════════════════════════════
  -- A. DEALS — delete old demo-refresh deals, insert 2 new
  -- ═══════════════════════════════════════════════════════
  DELETE FROM deals WHERE data_source = 'demo_refresh';

  INSERT INTO deals (title, slug, stage, value, currency, probability, closed_at, client_id, owner_id, data_source, created_by)
  VALUES
    (
      'Enterprise Platform License',
      'demo-refresh-deal-1-' || to_char(v_today, 'YYYYMMDD'),
      'won', 35000.00, 'USD', 100,
      (now() - interval '2 days'),
      v_client_id, v_owner_id, 'demo_refresh', v_owner_id
    ),
    (
      'Professional Services Engagement',
      'demo-refresh-deal-2-' || to_char(v_today, 'YYYYMMDD'),
      'won', 25000.00, 'USD', 100,
      (now() - interval '4 days'),
      v_client_id, v_owner_id, 'demo_refresh', v_owner_id
    )
  ON CONFLICT (slug) DO UPDATE SET
    closed_at = EXCLUDED.closed_at,
    updated_at = now();

  v_result := v_result || jsonb_build_object('deals_inserted', 2);

  -- ═══════════════════════════════════════════════════════
  -- B. PRODUCTIVITY RECORDS — delete old, insert 5 for current week
  -- ═══════════════════════════════════════════════════════
  DELETE FROM productivity_records
  WHERE employee_email LIKE 'demo-refresh-%';

  INSERT INTO productivity_records
    (employee_email, week_start, week_number, year, total_hours, billable_hours,
     tasks_completed, tasks_assigned, meetings_attended, utilization_pct, efficiency_score,
     attendance_status, department)
  VALUES
    ('demo-refresh-alice@example.com', v_week_start, EXTRACT(WEEK FROM v_week_start)::int, EXTRACT(YEAR FROM v_week_start)::int,
     40, 35, 12, 14, 5, 87.5, 85.0, 'present', 'Engineering'),
    ('demo-refresh-bob@example.com', v_week_start, EXTRACT(WEEK FROM v_week_start)::int, EXTRACT(YEAR FROM v_week_start)::int,
     38, 30, 8, 10, 4, 78.9, 80.0, 'present', 'Engineering'),
    ('demo-refresh-carol@example.com', v_week_start, EXTRACT(WEEK FROM v_week_start)::int, EXTRACT(YEAR FROM v_week_start)::int,
     42, 37, 15, 16, 6, 88.1, 93.0, 'present', 'Design'),
    ('demo-refresh-dave@example.com', v_week_start, EXTRACT(WEEK FROM v_week_start)::int, EXTRACT(YEAR FROM v_week_start)::int,
     36, 28, 7, 9, 3, 77.8, 78.0, 'present', 'Product'),
    ('demo-refresh-eve@example.com', v_week_start, EXTRACT(WEEK FROM v_week_start)::int, EXTRACT(YEAR FROM v_week_start)::int,
     40, 34, 10, 12, 5, 85.0, 88.0, 'present', 'Engineering')
  ON CONFLICT (employee_email, week_start) DO UPDATE SET
    utilization_pct = EXCLUDED.utilization_pct,
    total_hours = EXCLUDED.total_hours,
    billable_hours = EXCLUDED.billable_hours,
    updated_at = now();

  v_result := v_result || jsonb_build_object('productivity_records_inserted', 5);

  -- ═══════════════════════════════════════════════════════
  -- C. MEETINGS — delete old demo-refresh, insert 4 for current week
  -- ═══════════════════════════════════════════════════════
  DELETE FROM meetings WHERE description LIKE '%[demo-refresh]%';

  INSERT INTO meetings (title, description, organizer_id, client_id, scheduled_at, duration_minutes, status, meeting_type)
  VALUES
    (
      'Weekly Team Standup',
      'Regular team sync to review progress and blockers. [demo-refresh]',
      v_owner_id, v_client_id,
      (v_week_start + interval '1 day' + interval '9 hours'),  -- Monday 9 AM
      30, 'scheduled', 'virtual'
    ),
    (
      'Client Strategy Review',
      'Quarterly strategy alignment with stakeholders. [demo-refresh]',
      v_owner_id, v_client_id,
      (v_week_start + interval '2 days' + interval '14 hours'),  -- Tuesday 2 PM
      60, 'scheduled', 'virtual'
    ),
    (
      'Sprint Planning',
      'Plan next sprint backlog and capacity. [demo-refresh]',
      v_owner_id, NULL,
      (v_week_start + interval '3 days' + interval '10 hours'),  -- Wednesday 10 AM
      45, 'scheduled', 'virtual'
    ),
    (
      'Product Demo & Feedback',
      'Demo latest features to internal stakeholders. [demo-refresh]',
      v_owner_id, v_client_id,
      (v_week_start + interval '4 days' + interval '15 hours'),  -- Thursday 3 PM
      60, 'scheduled', 'virtual'
    );

  v_result := v_result || jsonb_build_object('meetings_inserted', 4);

  -- ═══════════════════════════════════════════════════════
  -- D. PROJECTS — set 3 projects to 'in-progress', 1 at-risk
  -- ═══════════════════════════════════════════════════════
  IF v_in_progress_status IS NOT NULL THEN
    UPDATE projects
    SET status_id = v_in_progress_status,
        is_archived = false,
        updated_at = now()
    WHERE slug IN ('acme-platform-rollout', 'techstart-ai-integration', 'enterprise-qbr-prep')
      AND is_archived = false;

    -- Mark one project at-risk
    UPDATE projects
    SET is_at_risk = true,
        updated_at = now()
    WHERE slug = 'enterprise-qbr-prep'
      AND is_archived = false;

    v_result := v_result || jsonb_build_object('projects_updated', 3, 'projects_at_risk', 1);
  ELSE
    v_result := v_result || jsonb_build_object('projects_warning', 'in-progress status not found');
  END IF;

  v_result := v_result || jsonb_build_object('success', true, 'refreshed_at', now()::text);

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users (admin check can happen in app layer)
GRANT EXECUTE ON FUNCTION public.refresh_demo_data() TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Optional: pg_cron schedule (uncomment to auto-refresh weekly)
-- ─────────────────────────────────────────────────────────────
-- SELECT cron.schedule(
--   'refresh-demo-data-weekly',
--   '0 1 * * 1',  -- Every Monday at 1 AM UTC
--   $$SELECT public.refresh_demo_data()$$
-- );
