-- Demo CRM/meeting/knowledge seed data requires a bootstrap auth user.
-- Skipped on fresh project installs; use seed-template-data or add users first.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = '2d711b86-45bf-43ae-b216-7eb917668b58'::uuid
  ) THEN
    RAISE NOTICE 'Skipping demo seed migration: bootstrap user not present';
    RETURN;
  END IF;
END $$;
