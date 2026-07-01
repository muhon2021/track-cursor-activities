-- Insert agency role preferences for all 4 accounts
-- Using 'user' as default app_role for accounts without explicit user_roles entries
INSERT INTO public.user_role_preferences (user_id, role, agency_role, is_eos_user)
VALUES
  ('78657387-d518-4b2e-88d8-eca802372ad5', 'admin', 'owner', true),
  ('c4642966-5969-4d55-b3a6-ce850c1e2786', 'user',  'owner', true),
  ('e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'user',  'pm',    false),
  ('d2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39', 'user',  'ic',    false)
ON CONFLICT (user_id, role) DO UPDATE SET
  agency_role = EXCLUDED.agency_role,
  is_eos_user = EXCLUDED.is_eos_user;