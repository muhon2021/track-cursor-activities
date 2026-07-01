-- ============================================================
-- MASTER SEED RUNNER
-- Execute in Supabase SQL Editor or via psql.
--
-- Usage (SQL Editor):
--   Paste each file in order (00 → 05c, then 06 → 09) and run.
--
-- Usage (psql):
--   psql "$DATABASE_URL" \
--     -f supabase/seed/00-platform-core.sql \
--     -f supabase/seed/01-actions.sql \
--     -f supabase/seed/02-eos.sql \
--     -f supabase/seed/03-meetings.sql \
--     -f supabase/seed/03b-meetings-extended.sql \
--     -f supabase/seed/04-knowledge.sql \
--     -f supabase/seed/05-projects.sql \
--     -f supabase/seed/05b-project-client-access.sql \
--     -f supabase/seed/05c-project-module-settings.sql \
--     -f supabase/seed/06-business-dev.sql \
--     -f supabase/seed/07-productivity.sql \
--     -f supabase/seed/08-ai-agents.sql \
--     -f supabase/seed/09-feedback-bugs.sql
--
-- Prerequisites:
--   1. At least one user in auth.users (sign up via the app).
--   2. All migrations applied (supabase db reset or manual).
--   3. The existing test-data migration (20251231183500) has run
--      (provides 5 clients, 5 knowledge categories, 3 AI agents).
--   4. 05b and 05c run after 05-projects.sql (05b needs seeded projects).
--   5. 03b-meetings-extended.sql runs AFTER 03-meetings.sql and 06-business-dev.sql
--      (needs contacts, deals, and base meetings to exist).
--   6. 09-feedback-bugs.sql seeds three Sales & CRM bug reports for the Feedback dashboard.
--
-- Notes:
--   - All INSERTs use ON CONFLICT DO NOTHING for idempotency.
--   - Safe to re-run — will not duplicate data.
--   - Foreign keys reference the first auth.users row via subquery.
--   - For multi-user scenarios, create additional auth users first,
--     then update assigned_to / owner_id fields as needed.
-- ============================================================

-- Verify prerequisites
DO $$
DECLARE
  user_count INT;
  client_count INT;
  module_count INT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users;
  SELECT COUNT(*) INTO client_count FROM public.clients;

  IF user_count = 0 THEN
    RAISE EXCEPTION 'SEED ABORTED: No users in auth.users. Sign up at least one user first.';
  END IF;

  RAISE NOTICE '=== Seed Prerequisites ===';
  RAISE NOTICE 'Auth users: %', user_count;
  RAISE NOTICE 'Existing clients: %', client_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Run seed files 00-05c, then 06-09 in order.';
  RAISE NOTICE 'Each file is idempotent (safe to re-run).';
END $$;
