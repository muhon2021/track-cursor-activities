-- Migration: Verify and enhance RLS policies for user_roles table
-- Purpose: Ensure secure access control for user role management
-- Date: 2026-01-28
-- Related to: Admin panel visibility fix

-- =====================================================
-- VERIFICATION: Check existing policies
-- =====================================================

-- List all policies on user_roles table
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'user_roles';

  RAISE NOTICE 'Found % existing policies on user_roles table', policy_count;
END $$;

-- =====================================================
-- ENSURE: Service role has full access
-- =====================================================

-- Drop existing service role policy if exists (for clean re-creation)
DROP POLICY IF EXISTS "Service role can manage all user roles" ON public.user_roles;

-- Create policy for service role (used by edge functions)
CREATE POLICY "Service role can manage all user roles"
  ON public.user_roles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- VERIFY: Core RLS policies exist
-- =====================================================

-- These policies should already exist from the initial migration:
-- 1. "Users can view their own roles" - FOR SELECT (users see own role)
-- 2. "Admins can view all user roles" - FOR SELECT (admins see all roles)
-- 3. "Admins can manage user roles" - FOR ALL (admins can CRUD roles)

-- Verification query (comment out in production)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_roles'
ORDER BY policyname;

-- =====================================================
-- FUNCTION: Check if user is admin (helper)
-- =====================================================

-- Create or replace helper function for checking admin status
-- This is used throughout the application
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = COALESCE(_user_id, auth.uid())
      AND role IN ('admin', 'moderator')
  )
$$;

-- Add comment
COMMENT ON FUNCTION public.is_admin IS
  'Returns true if the given user (or current user) has admin or moderator role';

-- =====================================================
-- FUNCTION: Get user role (helper)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID DEFAULT auth.uid())
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = COALESCE(_user_id, auth.uid())
  LIMIT 1
$$;

-- Add comment
COMMENT ON FUNCTION public.get_user_role IS
  'Returns the role of the given user (or current user). Returns NULL if no role assigned.';

-- =====================================================
-- INDEX: Optimize role lookups
-- =====================================================

-- Create index on user_id for faster lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- Create index on role for faster admin queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles(user_id, role);

-- =====================================================
-- GRANT: Ensure proper permissions
-- =====================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

-- Grant select on user_roles to authenticated (RLS will filter)
GRANT SELECT ON public.user_roles TO authenticated;

-- Grant all operations to service role
GRANT ALL ON public.user_roles TO service_role;

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION public.has_role TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role TO authenticated, anon, service_role;

-- =====================================================
-- SECURITY AUDIT: Show all policies
-- =====================================================

-- Generate security audit report
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'USER_ROLES SECURITY AUDIT';
  RAISE NOTICE '========================================';

  RAISE NOTICE 'RLS Enabled: %', (
    SELECT relrowsecurity
    FROM pg_class
    WHERE relname = 'user_roles'
  );

  RAISE NOTICE '';
  RAISE NOTICE 'Active Policies:';
  FOR rec IN
    SELECT policyname, cmd, roles::text
    FROM pg_policies
    WHERE tablename = 'user_roles'
    ORDER BY policyname
  LOOP
    RAISE NOTICE '  - % (%, %)', rec.policyname, rec.cmd, rec.roles;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'Helper Functions:';
  RAISE NOTICE '  - has_role(UUID, app_role) -> BOOLEAN';
  RAISE NOTICE '  - is_admin(UUID) -> BOOLEAN';
  RAISE NOTICE '  - get_user_role(UUID) -> app_role';

  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.user_roles IS
  'Stores user role assignments. Protected by RLS policies. Only admins can modify.';

COMMENT ON COLUMN public.user_roles.user_id IS
  'Reference to auth.users. Cascades on delete.';

COMMENT ON COLUMN public.user_roles.role IS
  'User role: admin, moderator, or user. See app_role enum type.';

COMMENT ON POLICY "Users can view their own roles" ON public.user_roles IS
  'Allows authenticated users to see their own role assignment';

COMMENT ON POLICY "Admins can view all user roles" ON public.user_roles IS
  'Allows admins to see all user role assignments';

COMMENT ON POLICY "Admins can manage user roles" ON public.user_roles IS
  'Allows admins to INSERT/UPDATE/DELETE user role assignments';

COMMENT ON POLICY "Service role can manage all user roles" ON public.user_roles IS
  'Allows edge functions with service role key to manage roles programmatically';
