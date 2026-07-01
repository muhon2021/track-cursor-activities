-- Prevent removing or reassigning the last remaining user holding the
-- system "owner" role, mirroring the last-admin guard enforced in the
-- rbac-manage edge function but at the data layer so it holds regardless
-- of which code path mutates user_roles.

CREATE OR REPLACE FUNCTION public.prevent_last_owner_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_role_id UUID;
  v_owner_count INTEGER;
BEGIN
  SELECT id INTO v_owner_role_id FROM public.roles WHERE slug = 'owner';

  IF v_owner_role_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Only act when the row being removed/changed was actually an owner assignment
  IF OLD.role_id IS DISTINCT FROM v_owner_role_id THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- On UPDATE, allow no-op or remaining-as-owner changes
  IF TG_OP = 'UPDATE' AND NEW.role_id = v_owner_role_id THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_owner_count
  FROM public.user_roles
  WHERE role_id = v_owner_role_id;

  IF v_owner_count <= 1 THEN
    RAISE EXCEPTION 'Cannot remove or reassign the last remaining Owner'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_owner_removal_update ON public.user_roles;
CREATE TRIGGER trg_prevent_last_owner_removal_update
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  WHEN (OLD.role_id IS NOT NULL)
  EXECUTE FUNCTION public.prevent_last_owner_removal();

DROP TRIGGER IF EXISTS trg_prevent_last_owner_removal_delete ON public.user_roles;
CREATE TRIGGER trg_prevent_last_owner_removal_delete
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW
  WHEN (OLD.role_id IS NOT NULL)
  EXECUTE FUNCTION public.prevent_last_owner_removal();
