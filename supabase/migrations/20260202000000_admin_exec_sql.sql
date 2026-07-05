-- ============================================================================
-- Admin Seed SQL Executor
-- ============================================================================
-- Provides a SECURITY DEFINER function that admins can call (via edge function)
-- to execute seed SQL scripts from the admin UI.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_exec_sql(sql_content TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $fn$
DECLARE
  err_detail TEXT;
  err_hint   TEXT;
BEGIN
  EXECUTE sql_content;
  RETURN jsonb_build_object('success', true, 'message', 'SQL executed successfully');
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS
    err_detail = PG_EXCEPTION_DETAIL,
    err_hint   = PG_EXCEPTION_HINT;
  RETURN jsonb_build_object(
    'success', false,
    'error',   SQLERRM,
    'state',   SQLSTATE,
    'detail',  COALESCE(err_detail, ''),
    'hint',    COALESCE(err_hint, '')
  );
END;
$fn$;

-- Restrict: only callable via service-role (edge functions), not via anon/authenticated
REVOKE ALL ON FUNCTION public.admin_exec_sql(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_exec_sql(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.admin_exec_sql(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_exec_sql(TEXT) TO service_role;
