-- Migration: Auto-assign first user as admin
-- Merged into handle_new_user() to avoid creating triggers on auth.users (hosted Supabase restriction)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT COUNT(*) INTO user_count FROM auth.users;

  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill existing users without roles
DO $$
DECLARE
  total_users INTEGER;
  users_without_roles INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_users FROM auth.users;
  SELECT COUNT(*) INTO users_without_roles
  FROM auth.users u
  WHERE u.id NOT IN (SELECT user_id FROM public.user_roles);

  IF total_users = 1 AND users_without_roles = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT id, 'admin'::app_role
    FROM auth.users
    WHERE id NOT IN (SELECT user_id FROM public.user_roles)
    LIMIT 1;
  ELSIF users_without_roles > 0 THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT id, 'user'::app_role
    FROM auth.users
    WHERE id NOT IN (SELECT user_id FROM public.user_roles);
  END IF;
END $$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates profile and assigns admin to first user, user role to subsequent signups';
