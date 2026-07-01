DO $$
DECLARE
  v_tenant UUID := '00000000-0000-0000-0000-000000000001';
  v_role RECORD;
BEGIN
  INSERT INTO public.tenants (id, name, slug)
  VALUES (v_tenant, 'Default', 'default')
  ON CONFLICT (id) DO NOTHING;

  FOR v_role IN
    SELECT * FROM (VALUES
      ('owner', 'Owner', 'Full ownership with billing and destructive actions'),
      ('admin', 'Administrator', 'Manage users, roles and platform settings'),
      ('member', 'Member', 'Standard team member access'),
      ('viewer', 'Viewer', 'Read-only access')
    ) AS t(slug, name, description)
  LOOP
    IF EXISTS (SELECT 1 FROM public.roles WHERE tenant_id = v_tenant AND slug = v_role.slug) THEN
      UPDATE public.roles
        SET is_system = true,
            name = v_role.name,
            description = COALESCE(public.roles.description, v_role.description),
            updated_at = now()
        WHERE tenant_id = v_tenant AND slug = v_role.slug;
    ELSE
      INSERT INTO public.roles (tenant_id, slug, name, description, is_system)
      VALUES (v_tenant, v_role.slug, v_role.name, v_role.description, true);
    END IF;
  END LOOP;
END $$;