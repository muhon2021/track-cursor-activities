-- Hackathon demo: ensure admin profile + role for demo account (Auth user must exist first).
-- Create in Supabase Dashboard → Authentication → Add user:
--   email: ceo@collabai.software, password: Demo@123, auto-confirm email

DO $$
DECLARE
  demo_user_id UUID;
BEGIN
  SELECT id INTO demo_user_id
  FROM auth.users
  WHERE email = 'ceo@collabai.software'
  LIMIT 1;

  IF demo_user_id IS NULL THEN
    RAISE NOTICE 'Hackathon seed skipped: create ceo@collabai.software in Supabase Auth first';
    RETURN;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, is_active)
  VALUES (demo_user_id, 'ceo@collabai.software', 'Demo Admin', true)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    is_active = true,
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (demo_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
