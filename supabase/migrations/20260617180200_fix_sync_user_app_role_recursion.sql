-- Fix infinite recursion in sync_user_app_role trigger
-- Superseded by 20260617180300_fix_sync_user_app_role_duplicate.sql for function body
-- Kept for migration history; applies trigger-only fixes if needed

CREATE OR REPLACE FUNCTION public.trg_sync_user_app_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM public.sync_user_app_role(COALESCE(NEW.user_id, OLD.user_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_user_app_role_on_change ON public.user_roles;
CREATE TRIGGER sync_user_app_role_on_change
  AFTER INSERT OR UPDATE OF role_id ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_user_app_role();
