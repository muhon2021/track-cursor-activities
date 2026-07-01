-- Fix duplicate key on user_roles_user_id_role_key during sync_user_app_role backfill
-- Consolidates multiple enum rows per user into a single canonical row

CREATE OR REPLACE FUNCTION public.sync_user_app_role(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug TEXT;
  v_role_id UUID;
  v_app_role public.app_role;
  v_default_tenant UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  SELECT r.slug, r.id INTO v_slug, v_role_id
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = _user_id
  ORDER BY CASE r.slug
    WHEN 'owner' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'manager' THEN 3
    WHEN 'member' THEN 4
    WHEN 'viewer' THEN 5
    ELSE 6
  END
  LIMIT 1;

  IF v_slug IS NULL THEN
    SELECT ur.role INTO v_app_role
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    ORDER BY CASE ur.role
      WHEN 'admin' THEN 1
      WHEN 'moderator' THEN 2
      WHEN 'user' THEN 3
    END
    LIMIT 1;

    IF v_app_role IS NULL THEN
      RETURN;
    END IF;

    SELECT r.id INTO v_role_id
    FROM public.roles r
    WHERE r.tenant_id = v_default_tenant
      AND r.slug = CASE v_app_role
        WHEN 'admin' THEN 'admin'
        WHEN 'moderator' THEN 'manager'
        ELSE 'member'
      END
    LIMIT 1;
  ELSE
    v_app_role := CASE v_slug
      WHEN 'owner' THEN 'admin'::public.app_role
      WHEN 'admin' THEN 'admin'::public.app_role
      WHEN 'manager' THEN 'moderator'::public.app_role
      ELSE 'user'::public.app_role
    END;
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = _user_id
    AND role IS DISTINCT FROM v_app_role;

  INSERT INTO public.user_roles (user_id, role, role_id)
  VALUES (_user_id, v_app_role, v_role_id)
  ON CONFLICT (user_id, role)
  DO UPDATE SET role_id = COALESCE(EXCLUDED.role_id, public.user_roles.role_id);
END;
$$;

ALTER TABLE public.user_roles DISABLE TRIGGER sync_user_app_role_on_change;
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.user_roles LOOP
    PERFORM public.sync_user_app_role(r.user_id);
  END LOOP;
END $$;
ALTER TABLE public.user_roles ENABLE TRIGGER sync_user_app_role_on_change;
