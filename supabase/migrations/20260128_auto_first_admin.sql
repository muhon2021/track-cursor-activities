-- Migration: Auto-assign first user as admin
-- Purpose: Automatically grant admin role to the first user who signs up
-- Date: 2026-01-28
-- Solves: Admin panel visibility issue - chicken-and-egg problem

-- =====================================================
-- FUNCTION: Auto-assign admin to first user
-- =====================================================

CREATE OR REPLACE FUNCTION public.auto_assign_first_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Count existing users (including the one being inserted)
  SELECT COUNT(*) INTO user_count
  FROM auth.users;

  -- Log for debugging
  RAISE NOTICE 'User signup detected: % (Total users: %)', NEW.email, user_count;

  -- If this is the first user (count = 1 after insert), make them admin
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    RAISE NOTICE 'First user % automatically granted admin role', NEW.email;
  ELSE
    -- For subsequent users, assign default 'user' role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;

    RAISE NOTICE 'User % assigned default user role', NEW.email;
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- TRIGGER: Execute on user creation
-- =====================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;

-- Create trigger on auth.users table
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_first_admin();

-- =====================================================
-- BACKFILL: Assign roles to existing users
-- =====================================================

-- First, count existing users
DO $$
DECLARE
  existing_user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO existing_user_count
  FROM auth.users;

  RAISE NOTICE 'Found % existing users', existing_user_count;
END $$;

-- Backfill existing users without roles
-- If only one user exists and has no role, make them admin
DO $$
DECLARE
  total_users INTEGER;
  users_without_roles INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_users FROM auth.users;
  SELECT COUNT(*) INTO users_without_roles
  FROM auth.users u
  WHERE u.id NOT IN (SELECT user_id FROM public.user_roles);

  RAISE NOTICE 'Total users: %, Users without roles: %', total_users, users_without_roles;

  -- If there's only one user and they have no role, make them admin
  IF total_users = 1 AND users_without_roles = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT id, 'admin'::app_role
    FROM auth.users
    WHERE id NOT IN (SELECT user_id FROM public.user_roles)
    LIMIT 1;

    RAISE NOTICE 'Granted admin role to the only existing user';
  ELSE
    -- Otherwise, give all users without roles the default 'user' role
    INSERT INTO public.user_roles (user_id, role)
    SELECT id, 'user'::app_role
    FROM auth.users
    WHERE id NOT IN (SELECT user_id FROM public.user_roles);

    RAISE NOTICE 'Granted user role to % existing users', users_without_roles;
  END IF;
END $$;

-- =====================================================
-- VERIFICATION QUERY (comment out in production)
-- =====================================================

-- Show all users and their roles
SELECT
  u.id,
  u.email,
  ur.role,
  u.created_at,
  CASE
    WHEN ur.role IS NULL THEN '⚠️  NO ROLE'
    WHEN ur.role = 'admin' THEN '✅ ADMIN'
    WHEN ur.role = 'moderator' THEN '✅ MODERATOR'
    ELSE '👤 USER'
  END as status
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
ORDER BY u.created_at ASC;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION public.auto_assign_first_admin() IS
  'Automatically assigns admin role to first user, user role to subsequent users';

COMMENT ON TRIGGER on_auth_user_created_assign_role ON auth.users IS
  'Triggers role assignment when new user signs up';
