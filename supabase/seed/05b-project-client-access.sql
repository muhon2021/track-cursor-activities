-- ============================================================
-- SEED: Project Client Access (client portal demo)
-- One demo access for Acme Corp — Platform Rollout.
-- Password: Demo123!
-- ============================================================

DO $$
DECLARE
  u1 UUID := (SELECT id FROM auth.users ORDER BY created_at LIMIT 1);
  p_acme UUID := (SELECT id FROM projects WHERE slug = 'acme-platform-rollout' LIMIT 1);
  m1 UUID;
  acc_id UUID;
  -- Precomputed PBKDF2-SHA256 hash for password "Demo123!" (salt: a1b2c3d4e5f607182930a1b2c3d4e5f6, 100k iterations)
  demo_hash TEXT := 'a1b2c3d4e5f607182930a1b2c3d4e5f6:04b49d1335f5cc6ccb452a9f37512021c48dc40337a5241fc85866cde14c33a7';
  -- Fixed token for stable demo URL: /projects/acme-platform-rollout/client-portal/<token>
  demo_token UUID := 'a1b2c3d4-e5f6-4111-a111-111111111111';
BEGIN

IF p_acme IS NULL THEN
  RAISE NOTICE '05b-project-client-access: No project acme-platform-rollout found. Run 05-projects.sql first.';
  RETURN;
END IF;

-- 1. project_client_access (idempotent: one row per project+email)
INSERT INTO project_client_access (
  project_id, client_email, client_name, password_hash, access_token,
  project_slug, is_active, created_by
) VALUES (
  p_acme,
  'john.doe@example.com',
  'John Doe',
  demo_hash,
  demo_token,
  'acme-platform-rollout',
  true,
  u1
)
ON CONFLICT (project_id, client_email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  access_token = EXCLUDED.access_token,
  project_slug = EXCLUDED.project_slug,
  is_active = true,
  updated_at = NOW();

SELECT id INTO acc_id FROM project_client_access WHERE project_id = p_acme AND client_email = 'john.doe@example.com' LIMIT 1;

-- 2. project_client_comments (PM comments visible to client) — insert only if none exist
SELECT id INTO m1 FROM project_milestones WHERE project_id = p_acme ORDER BY sort_order LIMIT 1;
IF m1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM project_client_comments WHERE project_id = p_acme LIMIT 1) THEN
  INSERT INTO project_client_comments (project_id, milestone_id, comment_text, is_visible, created_by) VALUES
    (p_acme, m1, 'SSO configuration is on track. We will complete Entra setup by end of month.', true, u1),
    (p_acme, NULL, 'Kickoff summary: Timeline agreed with Acme IT. Next sync Tuesday.', true, u1);
END IF;

-- 3. client_feedback (client-submitted feedback) — insert only if none exist for this project
IF acc_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM client_feedback WHERE project_id = p_acme LIMIT 1) THEN
  INSERT INTO client_feedback (project_id, client_access_id, rating, feedback_text, week_number, year) VALUES
    (p_acme, acc_id, 5, 'Smooth kickoff and clear communication. Looking forward to SSO go-live.', 5, 2026),
    (p_acme, acc_id, 4, 'Milestone updates are helpful. Would be great to see more detail on wiki migration.', 6, 2026);
END IF;

RAISE NOTICE '05b-project-client-access: Demo client portal ready. Password: Demo123!';
END $$;
