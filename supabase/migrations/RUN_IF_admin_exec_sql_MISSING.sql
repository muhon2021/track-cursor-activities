-- ============================================================================
-- ONE-TIME FIX: Create admin_exec_sql if you see PGRST202 / "function not in schema cache"
-- ============================================================================
-- Run this in Supabase Dashboard → SQL Editor → New query → Run
-- (Same as migration 20260202_admin_exec_sql.sql)
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

REVOKE ALL ON FUNCTION public.admin_exec_sql(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_exec_sql(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.admin_exec_sql(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_exec_sql(TEXT) TO service_role;
