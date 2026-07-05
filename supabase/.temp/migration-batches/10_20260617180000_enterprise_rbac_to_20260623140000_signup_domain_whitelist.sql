-- 20260617180000_enterprise_rbac.sql
-- ============================================================================
-- Enterprise RBAC + User Onboarding
-- Tenants, permissions, role_permissions, onboarding, SSO group mappings
-- ============================================================================

-- ========================
-- 1. Tenants
-- ========================
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tenants"
  ON public.tenants FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage tenants"
  ON public.tenants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.tenants (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Organization', 'default')
ON CONFLICT (slug) DO NOTHING;

-- ========================
-- 2. Permissions catalog
-- ========================
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permissions_category ON public.permissions(category);
CREATE INDEX IF NOT EXISTS idx_permissions_key ON public.permissions(key);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view permissions"
  ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage permissions"
  ON public.permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed permissions by category
INSERT INTO public.permissions (key, name, category, resource, action, description) VALUES
  -- Users
  ('users.view', 'View Users', 'Users', 'users', 'view', 'View user list and profiles'),
  ('users.create', 'Create Users', 'Users', 'users', 'create', 'Invite and create users'),
  ('users.edit', 'Edit Users', 'Users', 'users', 'edit', 'Edit user profiles and roles'),
  ('users.delete', 'Delete Users', 'Users', 'users', 'delete', 'Deactivate or delete users'),
  ('users.export', 'Export Users', 'Users', 'users', 'export', 'Export user data'),
  ('users.admin', 'Administer Users', 'Users', 'users', 'admin', 'Full user administration'),
  -- Departments
  ('departments.view', 'View Departments', 'Departments', 'departments', 'view', 'View departments and teams'),
  ('departments.create', 'Create Departments', 'Departments', 'departments', 'create', 'Create departments'),
  ('departments.edit', 'Edit Departments', 'Departments', 'departments', 'edit', 'Edit departments and assignments'),
  ('departments.delete', 'Delete Departments', 'Departments', 'departments', 'delete', 'Delete departments'),
  ('departments.export', 'Export Departments', 'Departments', 'departments', 'export', 'Export department data'),
  ('departments.admin', 'Administer Departments', 'Departments', 'departments', 'admin', 'Full department administration'),
  -- Knowledge Base
  ('knowledge.view', 'View Knowledge', 'Knowledge Base', 'knowledge', 'view', 'View knowledge base content'),
  ('knowledge.create', 'Create Knowledge', 'Knowledge Base', 'knowledge', 'create', 'Create knowledge entries'),
  ('knowledge.edit', 'Edit Knowledge', 'Knowledge Base', 'knowledge', 'edit', 'Edit knowledge entries'),
  ('knowledge.delete', 'Delete Knowledge', 'Knowledge Base', 'knowledge', 'delete', 'Delete knowledge entries'),
  ('knowledge.export', 'Export Knowledge', 'Knowledge Base', 'knowledge', 'export', 'Export knowledge data'),
  ('knowledge.admin', 'Administer Knowledge', 'Knowledge Base', 'knowledge', 'admin', 'Full knowledge administration'),
  -- AI Hub
  ('ai_hub.view', 'View AI Hub', 'AI Hub', 'ai_hub', 'view', 'View AI agents and chat'),
  ('ai_hub.create', 'Create AI Resources', 'AI Hub', 'ai_hub', 'create', 'Create AI agents'),
  ('ai_hub.edit', 'Edit AI Resources', 'AI Hub', 'ai_hub', 'edit', 'Edit AI configuration'),
  ('ai_hub.delete', 'Delete AI Resources', 'AI Hub', 'ai_hub', 'delete', 'Delete AI resources'),
  ('ai_hub.export', 'Export AI Data', 'AI Hub', 'ai_hub', 'export', 'Export AI analytics'),
  ('ai_hub.admin', 'Administer AI Hub', 'AI Hub', 'ai_hub', 'admin', 'Full AI hub administration'),
  -- Integrations
  ('integrations.view', 'View Integrations', 'Integrations', 'integrations', 'view', 'View integrations'),
  ('integrations.create', 'Create Integrations', 'Integrations', 'integrations', 'create', 'Connect integrations'),
  ('integrations.edit', 'Edit Integrations', 'Integrations', 'integrations', 'edit', 'Configure integrations'),
  ('integrations.delete', 'Delete Integrations', 'Integrations', 'integrations', 'delete', 'Disconnect integrations'),
  ('integrations.export', 'Export Integration Data', 'Integrations', 'integrations', 'export', 'Export integration logs'),
  ('integrations.admin', 'Administer Integrations', 'Integrations', 'integrations', 'admin', 'Full integration administration'),
  -- Settings
  ('settings.view', 'View Settings', 'Settings', 'settings', 'view', 'View system settings'),
  ('settings.create', 'Create Settings', 'Settings', 'settings', 'create', 'Create configuration'),
  ('settings.edit', 'Edit Settings', 'Settings', 'settings', 'edit', 'Edit system settings'),
  ('settings.delete', 'Delete Settings', 'Settings', 'settings', 'delete', 'Remove configuration'),
  ('settings.export', 'Export Settings', 'Settings', 'settings', 'export', 'Export configuration'),
  ('settings.admin', 'Administer Settings', 'Settings', 'settings', 'admin', 'Access admin panel and settings'),
  -- Analytics
  ('analytics.view', 'View Analytics', 'Analytics', 'analytics', 'view', 'View analytics dashboards'),
  ('analytics.create', 'Create Analytics', 'Analytics', 'analytics', 'create', 'Create reports'),
  ('analytics.edit', 'Edit Analytics', 'Analytics', 'analytics', 'edit', 'Edit reports'),
  ('analytics.delete', 'Delete Analytics', 'Analytics', 'analytics', 'delete', 'Delete reports'),
  ('analytics.export', 'Export Analytics', 'Analytics', 'analytics', 'export', 'Export analytics data'),
  ('analytics.admin', 'Administer Analytics', 'Analytics', 'analytics', 'admin', 'Full analytics administration'),
  -- EOS
  ('eos.view', 'View EOS', 'EOS', 'eos', 'view', 'View EOS data'),
  ('eos.create', 'Create EOS', 'EOS', 'eos', 'create', 'Create EOS items'),
  ('eos.edit', 'Edit EOS', 'EOS', 'eos', 'edit', 'Edit EOS data'),
  ('eos.delete', 'Delete EOS', 'EOS', 'eos', 'delete', 'Delete EOS items'),
  ('eos.export', 'Export EOS', 'EOS', 'eos', 'export', 'Export EOS data'),
  ('eos.admin', 'Administer EOS', 'EOS', 'eos', 'admin', 'Full EOS administration'),
  -- Automation
  ('automation.view', 'View Automation', 'Automation', 'automation', 'view', 'View automation rules'),
  ('automation.create', 'Create Automation', 'Automation', 'automation', 'create', 'Create automation rules'),
  ('automation.edit', 'Edit Automation', 'Automation', 'automation', 'edit', 'Edit automation rules'),
  ('automation.delete', 'Delete Automation', 'Automation', 'automation', 'delete', 'Delete automation rules'),
  ('automation.export', 'Export Automation', 'Automation', 'automation', 'export', 'Export automation data'),
  ('automation.admin', 'Administer Automation', 'Automation', 'automation', 'admin', 'Full automation administration'),
  -- Memory
  ('memory.view', 'View Memory', 'Memory', 'memory', 'view', 'View memory and embeddings'),
  ('memory.create', 'Create Memory', 'Memory', 'memory', 'create', 'Create memory entries'),
  ('memory.edit', 'Edit Memory', 'Memory', 'memory', 'edit', 'Edit memory data'),
  ('memory.delete', 'Delete Memory', 'Memory', 'memory', 'delete', 'Delete memory entries'),
  ('memory.export', 'Export Memory', 'Memory', 'memory', 'export', 'Export memory data'),
  ('memory.admin', 'Administer Memory', 'Memory', 'memory', 'admin', 'Full memory administration'),
  -- MCP
  ('mcp.view', 'View MCP', 'MCP', 'mcp', 'view', 'View MCP servers'),
  ('mcp.create', 'Create MCP', 'MCP', 'mcp', 'create', 'Add MCP servers'),
  ('mcp.edit', 'Edit MCP', 'MCP', 'mcp', 'edit', 'Configure MCP servers'),
  ('mcp.delete', 'Delete MCP', 'MCP', 'mcp', 'delete', 'Remove MCP servers'),
  ('mcp.export', 'Export MCP', 'MCP', 'mcp', 'export', 'Export MCP configuration'),
  ('mcp.admin', 'Administer MCP', 'MCP', 'mcp', 'admin', 'Full MCP administration'),
  -- Notifications
  ('notifications.view', 'View Notifications', 'Notifications', 'notifications', 'view', 'View notifications'),
  ('notifications.create', 'Create Notifications', 'Notifications', 'notifications', 'create', 'Send notifications'),
  ('notifications.edit', 'Edit Notifications', 'Notifications', 'notifications', 'edit', 'Edit notification settings'),
  ('notifications.delete', 'Delete Notifications', 'Notifications', 'notifications', 'delete', 'Delete notifications'),
  ('notifications.export', 'Export Notifications', 'Notifications', 'notifications', 'export', 'Export notification logs'),
  ('notifications.admin', 'Administer Notifications', 'Notifications', 'notifications', 'admin', 'Full notification administration')
ON CONFLICT (key) DO NOTHING;

-- ========================
-- 3. Extend roles table
-- ========================
ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cloned_from_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.roles SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- Migrate legacy role names to new system roles
UPDATE public.roles SET
  name = 'Admin',
  slug = 'admin',
  description = 'Administrative access to platform settings and user management',
  is_system = true
WHERE LOWER(name) = 'admin' AND slug IS NULL;

UPDATE public.roles SET
  name = 'Manager',
  slug = 'manager',
  description = 'Department and team management with limited admin access',
  is_system = true
WHERE LOWER(name) = 'moderator' AND slug IS NULL;

UPDATE public.roles SET
  name = 'Member',
  slug = 'member',
  description = 'Standard user with module access',
  is_system = true
WHERE LOWER(name) = 'user' AND slug IS NULL;

INSERT INTO public.roles (tenant_id, name, slug, description, is_system)
SELECT '00000000-0000-0000-0000-000000000001', 'Owner', 'owner', 'Full access to all platform features', true
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE slug = 'owner');

INSERT INTO public.roles (tenant_id, name, slug, description, is_system)
SELECT '00000000-0000-0000-0000-000000000001', 'Viewer', 'viewer', 'Read-only access across modules', true
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE slug = 'viewer');

-- Ensure slugs exist for any remaining roles
UPDATE public.roles SET slug = LOWER(REPLACE(name, ' ', '_')) WHERE slug IS NULL;

ALTER TABLE public.roles DROP CONSTRAINT IF EXISTS roles_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_tenant_slug ON public.roles(tenant_id, slug);

-- ========================
-- 4. Role permissions junction
-- ========================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON public.role_permissions(permission_id);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view role permissions"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage role permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed role permissions
DO $$
DECLARE
  v_owner_id UUID;
  v_admin_id UUID;
  v_manager_id UUID;
  v_member_id UUID;
  v_viewer_id UUID;
  v_perm RECORD;
BEGIN
  SELECT id INTO v_owner_id FROM public.roles WHERE slug = 'owner' AND tenant_id = '00000000-0000-0000-0000-000000000001';
  SELECT id INTO v_admin_id FROM public.roles WHERE slug = 'admin' AND tenant_id = '00000000-0000-0000-0000-000000000001';
  SELECT id INTO v_manager_id FROM public.roles WHERE slug = 'manager' AND tenant_id = '00000000-0000-0000-0000-000000000001';
  SELECT id INTO v_member_id FROM public.roles WHERE slug = 'member' AND tenant_id = '00000000-0000-0000-0000-000000000001';
  SELECT id INTO v_viewer_id FROM public.roles WHERE slug = 'viewer' AND tenant_id = '00000000-0000-0000-0000-000000000001';

  -- Owner: all permissions
  IF v_owner_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_owner_id, p.id FROM public.permissions p
    ON CONFLICT DO NOTHING;
  END IF;

  -- Admin: all except nothing (full admin)
  IF v_admin_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_admin_id, p.id FROM public.permissions p
    ON CONFLICT DO NOTHING;
  END IF;

  -- Manager: view all, edit/create on most, departments admin, limited settings
  IF v_manager_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_manager_id, p.id FROM public.permissions p
    WHERE p.action IN ('view', 'create', 'edit', 'export')
       OR (p.category IN ('Departments', 'Knowledge Base', 'EOS', 'Analytics') AND p.action = 'admin')
       OR p.key IN ('settings.view', 'users.view', 'users.edit')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Member: view + create/edit on operational modules, no admin/delete on sensitive
  IF v_member_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_member_id, p.id FROM public.permissions p
    WHERE p.action IN ('view', 'create', 'edit')
      AND p.category NOT IN ('Settings', 'Integrations', 'MCP')
      AND p.key NOT IN ('users.delete', 'users.admin', 'departments.delete', 'departments.admin')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Viewer: view only
  IF v_viewer_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_viewer_id, p.id FROM public.permissions p
    WHERE p.action = 'view'
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ========================
-- 5. Extend user_roles with role_id FK
-- ========================
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);

-- Link existing user_roles to role catalog by app_role enum
UPDATE public.user_roles ur SET role_id = r.id
FROM public.roles r
WHERE ur.role_id IS NULL
  AND r.tenant_id = '00000000-0000-0000-0000-000000000001'
  AND (
    (ur.role = 'admin' AND r.slug = 'admin') OR
    (ur.role = 'moderator' AND r.slug = 'manager') OR
    (ur.role = 'user' AND r.slug = 'member')
  );

-- ========================
-- 6. Extend user_invites
-- ========================
ALTER TABLE public.user_invites
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS welcome_message TEXT,
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

UPDATE public.user_invites SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

UPDATE public.user_invites ui SET role_id = r.id
FROM public.roles r
WHERE ui.role_id IS NULL
  AND r.tenant_id = '00000000-0000-0000-0000-000000000001'
  AND (
    (ui.role = 'admin' AND r.slug = 'admin') OR
    (ui.role = 'moderator' AND r.slug = 'manager') OR
    (ui.role = 'user' AND r.slug = 'member')
  );

UPDATE public.user_invites SET status = 'accepted' WHERE used_at IS NOT NULL AND status = 'pending';
UPDATE public.user_invites SET status = 'expired' WHERE expires_at < now() AND used_at IS NULL AND status = 'pending';
UPDATE public.user_invites SET status = 'cancelled' WHERE cancelled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_invites_status ON public.user_invites(status);
CREATE INDEX IF NOT EXISTS idx_user_invites_role_id ON public.user_invites(role_id);

-- ========================
-- 7. Onboarding progress
-- ========================
CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  current_step INTEGER NOT NULL DEFAULT 1,
  steps_completed JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user ON public.onboarding_progress(user_id);

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own onboarding progress"
  ON public.onboarding_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own onboarding progress"
  ON public.onboarding_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all onboarding progress"
  ON public.onboarding_progress FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ========================
-- 8. SSO (ensure base table exists, then group mappings)
-- ========================

-- sso_configurations may be missing if 20260105_sso_configurations.sql was never applied
CREATE TABLE IF NOT EXISTS public.sso_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  is_primary BOOLEAN DEFAULT false,
  client_id TEXT,
  tenant_id TEXT,
  domain_restrictions TEXT[] DEFAULT '{}',
  auto_provision_role TEXT DEFAULT 'user',
  auto_create_users BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  org_tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  okta_domain TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider_type)
);

ALTER TABLE public.sso_configurations ENABLE ROW LEVEL SECURITY;

-- Extend existing sso_configurations (tenant_id TEXT = Azure AD directory id; org_tenant_id = RBAC tenant)
ALTER TABLE public.sso_configurations
  ADD COLUMN IF NOT EXISTS org_tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS okta_domain TEXT;

UPDATE public.sso_configurations
SET org_tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE org_tenant_id IS NULL;

ALTER TABLE public.sso_configurations DROP CONSTRAINT IF EXISTS sso_configurations_provider_type_check;
ALTER TABLE public.sso_configurations ADD CONSTRAINT sso_configurations_provider_type_check
  CHECK (provider_type IN ('google_workspace', 'azure_ad', 'saml', 'oidc', 'okta'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sso_configurations'
      AND policyname = 'Admins can manage SSO configs'
  ) THEN
    CREATE POLICY "Admins can manage SSO configs"
      ON public.sso_configurations FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sso_configurations'
      AND policyname = 'Public can view enabled SSO providers'
  ) THEN
    CREATE POLICY "Public can view enabled SSO providers"
      ON public.sso_configurations FOR SELECT TO anon
      USING (is_enabled = true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sso_configurations_provider_type
  ON public.sso_configurations(provider_type);

CREATE TABLE IF NOT EXISTS public.sso_group_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sso_config_id UUID NOT NULL REFERENCES public.sso_configurations(id) ON DELETE CASCADE,
  external_group_id TEXT NOT NULL,
  external_group_name TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sso_config_id, external_group_id)
);

CREATE INDEX IF NOT EXISTS idx_sso_group_mappings_config ON public.sso_group_mappings(sso_config_id);
CREATE INDEX IF NOT EXISTS idx_sso_group_mappings_role ON public.sso_group_mappings(role_id);

ALTER TABLE public.sso_group_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage SSO group mappings" ON public.sso_group_mappings;
CREATE POLICY "Admins can manage SSO group mappings"
  ON public.sso_group_mappings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can view SSO group mappings" ON public.sso_group_mappings;
CREATE POLICY "Authenticated users can view SSO group mappings"
  ON public.sso_group_mappings FOR SELECT TO authenticated USING (true);

-- ========================
-- 9. RBAC helper functions
-- ========================
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id UUID)
RETURNS SETOF TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.key
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_id = ur.role_id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = _user_id
    AND ur.role_id IS NOT NULL
  UNION
  -- Fallback: legacy enum-based permissions via role slug mapping
  SELECT DISTINCT p.key
  FROM public.user_roles ur
  JOIN public.roles r ON (
    (ur.role = 'admin' AND r.slug = 'admin') OR
    (ur.role = 'moderator' AND r.slug = 'manager') OR
    (ur.role = 'user' AND r.slug = 'member')
  )
  JOIN public.role_permissions rp ON rp.role_id = r.id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = _user_id
    AND ur.role_id IS NULL
    AND r.tenant_id = '00000000-0000-0000-0000-000000000001';
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.get_user_permissions(_user_id) AS perm
    WHERE perm = _permission_key
  );
$$;

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
  -- Prefer highest catalog role when role_id is set
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
    -- Legacy enum rows: pick highest app_role
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

  -- Consolidate to one row per user: remove lower/duplicate enum rows
  DELETE FROM public.user_roles
  WHERE user_id = _user_id
    AND role IS DISTINCT FROM v_app_role;

  INSERT INTO public.user_roles (user_id, role, role_id)
  VALUES (_user_id, v_app_role, v_role_id)
  ON CONFLICT (user_id, role)
  DO UPDATE SET role_id = COALESCE(EXCLUDED.role_id, public.user_roles.role_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.user_in_department(_user_id UUID, _department_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.department_users du
    WHERE du.user_id = _user_id AND du.department_id = _department_id
  );
$$;

-- Trigger to sync app_role when role_id changes (NOT on role column — avoids infinite loop)
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

-- Sync all existing users (disable trigger during bulk backfill)
ALTER TABLE public.user_roles DISABLE TRIGGER sync_user_app_role_on_change;
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.user_roles LOOP
    PERFORM public.sync_user_app_role(r.user_id);
  END LOOP;
END $$;
ALTER TABLE public.user_roles ENABLE TRIGGER sync_user_app_role_on_change;

-- ========================
-- 10. Tighten department_users RLS
-- ========================
DROP POLICY IF EXISTS "Authenticated users can manage department users" ON public.department_users;

CREATE POLICY "Users with permission can manage department users"
  ON public.department_users FOR ALL TO authenticated
  USING (
    public.has_permission(auth.uid(), 'departments.edit')
    OR public.has_permission(auth.uid(), 'departments.admin')
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.has_permission(auth.uid(), 'departments.edit')
    OR public.has_permission(auth.uid(), 'departments.admin')
    OR public.has_role(auth.uid(), 'admin')
  );

-- ========================
-- 11. Role stats RPC
-- ========================
CREATE OR REPLACE FUNCTION public.get_role_stats()
RETURNS TABLE (
  role_id UUID,
  permission_count BIGINT,
  assigned_user_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id AS role_id,
    COUNT(DISTINCT rp.permission_id) AS permission_count,
    COUNT(DISTINCT ur.user_id) AS assigned_user_count
  FROM public.roles r
  LEFT JOIN public.role_permissions rp ON rp.role_id = r.id
  LEFT JOIN public.user_roles ur ON ur.role_id = r.id
  GROUP BY r.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_permissions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_role_stats() TO authenticated;


-- 20260617180200_fix_sync_user_app_role_recursion.sql
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


-- 20260617180300_fix_sync_user_app_role_duplicate.sql
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


-- 20260618120000_user_space_preferences.sql
-- User space preferences for Four Spaces IA (favorites, recents, default space)
CREATE TABLE IF NOT EXISTS public.user_space_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  default_space TEXT NOT NULL DEFAULT 'sales'
    CHECK (default_space IN ('sales', 'knowledge', 'operations', 'eos')),
  favorites JSONB NOT NULL DEFAULT '[]'::jsonb,
  recent_pages JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_space_preferences_user_id
  ON public.user_space_preferences(user_id);

ALTER TABLE public.user_space_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own space preferences"
  ON public.user_space_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own space preferences"
  ON public.user_space_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own space preferences"
  ON public.user_space_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.user_space_preferences IS 'Per-user Four Spaces navigation preferences';


-- 20260619120000_eos_revamp.sql
-- ============================================================================
-- EOS Revamp Migration
-- Multi-tenant support, rock extensions, new EOS tables, RBAC RLS
-- ============================================================================

-- Default tenant (matches enterprise RBAC seed)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = '00000000-0000-0000-0000-000000000001') THEN
    INSERT INTO public.tenants (id, name, slug)
    VALUES ('00000000-0000-0000-0000-000000000001', 'Default Organization', 'default');
  END IF;
END $$;

-- ========================
-- Helper: get_user_tenant_id
-- ========================
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT r.tenant_id
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      ORDER BY CASE r.slug
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'manager' THEN 3
        WHEN 'member' THEN 4
        WHEN 'viewer' THEN 5
        ELSE 6
      END
      LIMIT 1
    ),
    '00000000-0000-0000-0000-000000000001'::UUID
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_user_tenant_id() TO authenticated;

-- ========================
-- tenant_id on existing EOS tables
-- ========================
ALTER TABLE public.eos_pods
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

ALTER TABLE public.eos_vto
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

ALTER TABLE public.okrs
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

ALTER TABLE public.okr_key_results
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

ALTER TABLE public.okr_check_ins
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

ALTER TABLE public.eos_issues
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

ALTER TABLE public.eos_issue_suggestions
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

ALTER TABLE public.eos_scorecards
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

ALTER TABLE public.eos_scorecard_metrics
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

ALTER TABLE public.accountability_charts
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

ALTER TABLE public.accountability_responsibilities
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

ALTER TABLE public.gwc_assessments
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

-- key_result_history and eos_sla_targets are from optional follow-on migrations;
-- create/alter only when the table exists (or create eos_sla_targets if missing).
DO $$ BEGIN
  IF to_regclass('public.key_result_history') IS NOT NULL THEN
    ALTER TABLE public.key_result_history
      ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
      REFERENCES public.tenants(id);
  END IF;
END $$;

-- Ensure eos_sla_targets exists (may be missing if 20260217_eos_sla_targets was not applied)
CREATE TABLE IF NOT EXISTS public.eos_sla_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID REFERENCES public.eos_pods(id) ON DELETE CASCADE,
  role_name TEXT,
  approval_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 90 CHECK (approval_rate_pct >= 0 AND approval_rate_pct <= 100),
  cycle_time_days NUMERIC(5,2) NOT NULL DEFAULT 5 CHECK (cycle_time_days >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT eos_sla_targets_pod_or_role_or_fallback CHECK (
    (pod_id IS NOT NULL AND role_name IS NULL) OR
    (pod_id IS NULL AND role_name IS NOT NULL) OR
    (pod_id IS NULL AND role_name IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_eos_sla_targets_entity_unique
  ON public.eos_sla_targets (pod_id, role_name) NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS idx_eos_sla_targets_pod ON public.eos_sla_targets (pod_id);
CREATE INDEX IF NOT EXISTS idx_eos_sla_targets_role ON public.eos_sla_targets (role_name);

ALTER TABLE public.eos_sla_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view SLA targets" ON public.eos_sla_targets;
CREATE POLICY "Authenticated users can view SLA targets" ON public.eos_sla_targets
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can manage SLA targets" ON public.eos_sla_targets;
CREATE POLICY "Authenticated users can manage SLA targets" ON public.eos_sla_targets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.eos_sla_targets (pod_id, role_name, approval_rate_pct, cycle_time_days)
SELECT NULL, NULL, 90, 5
WHERE NOT EXISTS (
  SELECT 1 FROM public.eos_sla_targets WHERE pod_id IS NULL AND role_name IS NULL
);

ALTER TABLE public.eos_sla_targets
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES public.tenants(id);

-- ========================
-- OKR / Rock extensions
-- ========================
ALTER TABLE public.okrs
  ADD COLUMN IF NOT EXISTS rock_status TEXT
    CHECK (rock_status IS NULL OR rock_status IN ('on_track', 'at_risk', 'off_track', 'completed'));

ALTER TABLE public.okrs
  ADD COLUMN IF NOT EXISTS progress_pct INTEGER DEFAULT 0
    CHECK (progress_pct >= 0 AND progress_pct <= 100);

DO $$ BEGIN
  IF to_regclass('public.departments') IS NOT NULL THEN
    ALTER TABLE public.okrs
      ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_okrs_tenant_rock_status ON public.okrs(tenant_id, rock_status);

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'okrs' AND column_name = 'department_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_okrs_department ON public.okrs(department_id);
  END IF;
END $$;

-- Sync progress_pct from progress for existing rows
UPDATE public.okrs SET progress_pct = COALESCE(progress::INTEGER, 0) WHERE progress_pct = 0 AND progress > 0;

-- Map existing OKR status to rock_status where applicable
UPDATE public.okrs SET rock_status = 'on_track' WHERE rock_status IS NULL AND status = 'on_track';
UPDATE public.okrs SET rock_status = 'at_risk' WHERE rock_status IS NULL AND status IN ('at_risk', 'behind');
UPDATE public.okrs SET rock_status = 'completed' WHERE rock_status IS NULL AND status IN ('completed', 'closed');

-- ========================
-- Issues extensions
-- ========================
ALTER TABLE public.eos_issues
  ADD COLUMN IF NOT EXISTS root_cause JSONB DEFAULT NULL;

ALTER TABLE public.eos_issues
  ADD COLUMN IF NOT EXISTS resolution_history JSONB DEFAULT '[]'::JSONB;

-- Add FK for meeting_id if meetings table exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'eos_issues_meeting_id_fkey'
  ) THEN
    ALTER TABLE public.eos_issues
      ADD CONSTRAINT eos_issues_meeting_id_fkey
      FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_eos_issues_tenant_status ON public.eos_issues(tenant_id, status);

-- ========================
-- Tasks EOS source linking
-- ========================
DO $$ BEGIN
  IF to_regclass('public.tasks') IS NOT NULL THEN
    ALTER TABLE public.tasks
      ADD COLUMN IF NOT EXISTS eos_source_type TEXT
        CHECK (eos_source_type IS NULL OR eos_source_type IN ('meeting', 'ids', 'rock'));
    ALTER TABLE public.tasks
      ADD COLUMN IF NOT EXISTS eos_source_id UUID;
    CREATE INDEX IF NOT EXISTS idx_tasks_eos_source ON public.tasks(eos_source_type, eos_source_id);
  END IF;
END $$;

-- ========================
-- Meetings L10 timer state
-- ========================
DO $$ BEGIN
  IF to_regclass('public.meetings') IS NOT NULL THEN
    ALTER TABLE public.meetings
      ADD COLUMN IF NOT EXISTS l10_timer_state JSONB DEFAULT NULL;
  END IF;
END $$;

-- ========================
-- Accountability department FK
-- ========================
DO $$ BEGIN
  IF to_regclass('public.departments') IS NOT NULL THEN
    ALTER TABLE public.accountability_responsibilities
      ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ========================
-- eos_vto_versions
-- ========================
CREATE TABLE IF NOT EXISTS public.eos_vto_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vto_id UUID NOT NULL REFERENCES public.eos_vto(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eos_vto_versions_vto ON public.eos_vto_versions(vto_id, version DESC);

-- ========================
-- eos_issue_comments
-- ========================
CREATE TABLE IF NOT EXISTS public.eos_issue_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.eos_issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eos_issue_comments_issue ON public.eos_issue_comments(issue_id);

-- ========================
-- Rock supporting tables
-- ========================
CREATE TABLE IF NOT EXISTS public.eos_rock_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rock_id UUID NOT NULL REFERENCES public.okrs(id) ON DELETE CASCADE,
  depends_on_rock_id UUID NOT NULL REFERENCES public.okrs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(rock_id, depends_on_rock_id)
);

CREATE TABLE IF NOT EXISTS public.eos_rock_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rock_id UUID NOT NULL REFERENCES public.okrs(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.eos_rock_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rock_id UUID NOT NULL REFERENCES public.okrs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- eos_l10_meeting_sections
-- ========================
DO $$ BEGIN
  IF to_regclass('public.meetings') IS NOT NULL THEN
    CREATE TABLE IF NOT EXISTS public.eos_l10_meeting_sections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
      section_key TEXT NOT NULL
        CHECK (section_key IN (
          'segue', 'scorecard_review', 'rock_review', 'customer_headlines',
          'employee_headlines', 'todo_review', 'ids', 'conclusion'
        )),
      duration_minutes INTEGER DEFAULT 5,
      notes TEXT,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
        REFERENCES public.tenants(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(meeting_id, section_key)
    );
    CREATE INDEX IF NOT EXISTS idx_eos_l10_sections_meeting ON public.eos_l10_meeting_sections(meeting_id);
  END IF;
END $$;

-- ========================
-- eos_people_reviews
-- ========================
CREATE TABLE IF NOT EXISTS public.eos_people_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  review_period TEXT NOT NULL,
  core_values_scores JSONB NOT NULL DEFAULT '{}',
  gwc_gets_it BOOLEAN,
  gwc_wants_it BOOLEAN,
  gwc_has_capacity BOOLEAN,
  overall_score TEXT NOT NULL DEFAULT 'good'
    CHECK (overall_score IN ('excellent', 'good', 'needs_attention')),
  notes TEXT,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eos_people_reviews_user ON public.eos_people_reviews(user_id, review_period);

-- ========================
-- eos_notification_preferences
-- ========================
CREATE TABLE IF NOT EXISTS public.eos_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'rock_overdue', 'meeting_reminder', 'todo_assigned',
      'issue_escalated', 'scorecard_missed'
    )),
  in_app BOOLEAN NOT NULL DEFAULT true,
  email BOOLEAN NOT NULL DEFAULT false,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_type)
);

-- ========================
-- VTO version trigger
-- ========================
CREATE OR REPLACE FUNCTION public.eos_vto_version_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
  FROM public.eos_vto_versions WHERE vto_id = OLD.id;

  INSERT INTO public.eos_vto_versions (vto_id, section, content, version, updated_by, tenant_id)
  VALUES (OLD.id, OLD.section, OLD.content, v_next_version, auth.uid(), OLD.tenant_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS eos_vto_version_on_update ON public.eos_vto;
CREATE TRIGGER eos_vto_version_on_update
  BEFORE UPDATE ON public.eos_vto
  FOR EACH ROW
  WHEN (OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION public.eos_vto_version_snapshot();

-- ========================
-- Migrate VTO quarterly_rocks JSONB to okrs (idempotent)
-- ========================
DO $$
DECLARE
  v_content JSONB;
  v_rock JSONB;
  v_quarter TEXT;
BEGIN
  SELECT content INTO v_content FROM public.eos_vto WHERE section = 'quarterly_rocks' LIMIT 1;
  IF v_content IS NULL THEN RETURN; END IF;

  v_quarter := COALESCE(v_content->>'quarter', 'Q1 ' || EXTRACT(YEAR FROM now())::TEXT);

  FOR v_rock IN SELECT * FROM jsonb_array_elements(COALESCE(v_content->'rocks', '[]'::JSONB))
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.okrs
      WHERE title = v_rock->>'title'
        AND quarter = v_quarter
        AND okr_type = 'rock'
    ) THEN
      INSERT INTO public.okrs (
        title, quarter, status, okr_type, rock_status, progress_pct, tenant_id
      ) VALUES (
        COALESCE(v_rock->>'title', 'Untitled Rock'),
        v_quarter,
        'active',
        'rock',
        'on_track',
        0,
        '00000000-0000-0000-0000-000000000001'
      );
    END IF;
  END LOOP;
EXCEPTION WHEN undefined_column THEN
  -- okr_type may not exist on older schemas; insert without it
  NULL;
END $$;

-- ========================
-- Extended EOS permissions
-- ========================
DO $$ BEGIN
  IF to_regclass('public.permissions') IS NOT NULL THEN
    INSERT INTO public.permissions (key, name, category, resource, action, description) VALUES
      ('eos.manage_rocks', 'Manage EOS Rocks', 'eos', 'rocks', 'manage', 'Create and edit quarterly rocks'),
      ('eos.manage_meetings', 'Manage EOS Meetings', 'eos', 'meetings', 'manage', 'Run and manage L10 meetings'),
      ('eos.manage_scorecards', 'Manage EOS Scorecards', 'eos', 'scorecards', 'manage', 'Edit scorecard metrics'),
      ('eos.manage_ids', 'Manage EOS IDS', 'eos', 'issues', 'manage', 'Manage IDS issues')
    ON CONFLICT (key) DO NOTHING;
  END IF;
END $$;

-- Grant manage permissions to owner/admin/manager roles
DO $$ BEGIN
  IF to_regclass('public.role_permissions') IS NOT NULL
     AND to_regclass('public.roles') IS NOT NULL
     AND to_regclass('public.permissions') IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM public.roles r
    CROSS JOIN public.permissions p
    WHERE r.slug IN ('owner', 'admin', 'manager')
      AND p.key IN ('eos.manage_rocks', 'eos.manage_meetings', 'eos.manage_scorecards', 'eos.manage_ids')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Member gets view/create/edit only (already seeded); viewer gets view only

-- ========================
-- RLS: Enable on new tables
-- ========================
ALTER TABLE public.eos_vto_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eos_issue_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eos_rock_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eos_rock_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eos_rock_comments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.eos_l10_meeting_sections') IS NOT NULL THEN
    ALTER TABLE public.eos_l10_meeting_sections ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
ALTER TABLE public.eos_people_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eos_notification_preferences ENABLE ROW LEVEL SECURITY;

-- ========================
-- RLS policies for new tables (tenant + permission)
-- ========================
DO $$ DECLARE t TEXT; BEGIN
  IF to_regprocedure('public.has_permission(uuid,text)') IS NULL THEN
    RETURN;
  END IF;

  FOREACH t IN ARRAY ARRAY[
    'eos_vto_versions', 'eos_issue_comments', 'eos_rock_dependencies',
    'eos_rock_attachments', 'eos_rock_comments', 'eos_l10_meeting_sections',
    'eos_people_reviews'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS "eos_tenant_select" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "eos_tenant_select" ON public.%I FOR SELECT TO authenticated
       USING (tenant_id = public.get_user_tenant_id() AND public.has_permission(auth.uid(), ''eos.view''))',
      t
    );
    EXECUTE format('DROP POLICY IF EXISTS "eos_tenant_insert" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "eos_tenant_insert" ON public.%I FOR INSERT TO authenticated
       WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.has_permission(auth.uid(), ''eos.create''))',
      t
    );
    EXECUTE format('DROP POLICY IF EXISTS "eos_tenant_update" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "eos_tenant_update" ON public.%I FOR UPDATE TO authenticated
       USING (tenant_id = public.get_user_tenant_id() AND public.has_permission(auth.uid(), ''eos.edit''))
       WITH CHECK (tenant_id = public.get_user_tenant_id())',
      t
    );
    EXECUTE format('DROP POLICY IF EXISTS "eos_tenant_delete" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "eos_tenant_delete" ON public.%I FOR DELETE TO authenticated
       USING (tenant_id = public.get_user_tenant_id() AND public.has_permission(auth.uid(), ''eos.delete''))',
      t
    );
  END LOOP;
END $$;

-- Notification preferences: users manage own
DROP POLICY IF EXISTS "users_manage_own_eos_notif_prefs" ON public.eos_notification_preferences;
CREATE POLICY "users_manage_own_eos_notif_prefs" ON public.eos_notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ========================
-- Tighten eos_issues RLS (additive — keep existing policies, add tenant guard)
-- ========================
DO $$ BEGIN
  IF to_regprocedure('public.has_permission(uuid,text)') IS NOT NULL THEN
    DROP POLICY IF EXISTS "eos_issues_tenant_view" ON public.eos_issues;
    CREATE POLICY "eos_issues_tenant_view" ON public.eos_issues
      FOR SELECT TO authenticated
      USING (
        tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'eos.view')
      );

    DROP POLICY IF EXISTS "eos_issues_tenant_write" ON public.eos_issues;
    CREATE POLICY "eos_issues_tenant_write" ON public.eos_issues
      FOR ALL TO authenticated
      USING (
        tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'eos.edit')
      )
      WITH CHECK (
        tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'eos.create')
      );
  END IF;
END $$;

-- ========================
-- Tighten okrs RLS
-- ========================
DO $$ BEGIN
  IF to_regprocedure('public.has_permission(uuid,text)') IS NOT NULL THEN
    DROP POLICY IF EXISTS "okrs_tenant_view" ON public.okrs;
    CREATE POLICY "okrs_tenant_view" ON public.okrs
      FOR SELECT TO authenticated
      USING (
        tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'eos.view')
      );

    DROP POLICY IF EXISTS "okrs_tenant_write" ON public.okrs;
    CREATE POLICY "okrs_tenant_write" ON public.okrs
      FOR ALL TO authenticated
      USING (
        tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'eos.edit')
      )
      WITH CHECK (
        tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'eos.create')
      );
  END IF;
END $$;


-- 20260619120000_storage_configuration.sql
-- Storage configuration singleton + files table extensions for multi-provider support.

CREATE TABLE IF NOT EXISTS public.storage_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_type TEXT NOT NULL DEFAULT 'local' CHECK (storage_type IN ('local', 's3', 'supabase')),
  aws_access_key_id TEXT,
  aws_secret_access_key TEXT,
  aws_region TEXT NOT NULL DEFAULT 'us-east-1',
  s3_bucket_name TEXT,
  supabase_storage_bucket TEXT NOT NULL DEFAULT 'knowledgebase',
  supabase_storage_public BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_config_single ON public.storage_config ((1));

ALTER TABLE public.storage_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read storage config" ON public.storage_config;
CREATE POLICY "Admins can read storage config"
ON public.storage_config FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage storage config" ON public.storage_config;
CREATE POLICY "Admins can manage storage config"
ON public.storage_config FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_or_create_storage_config()
RETURNS public.storage_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config public.storage_config;
BEGIN
  SELECT * INTO config FROM public.storage_config LIMIT 1;

  IF config IS NULL THEN
    INSERT INTO public.storage_config (
      storage_type,
      aws_region,
      supabase_storage_bucket,
      supabase_storage_public
    ) VALUES (
      'local',
      'us-east-1',
      'knowledgebase',
      true
    )
    RETURNING * INTO config;
  END IF;

  RETURN config;
END;
$$;

DO $$
BEGIN
  PERFORM public.get_or_create_storage_config();
END $$;

-- Extend files table for supabase provider
ALTER TABLE public.files
  DROP CONSTRAINT IF EXISTS files_storage_type_check;

ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

ALTER TABLE public.files
  ADD CONSTRAINT files_storage_type_check
  CHECK (storage_type IN ('local', 's3', 'supabase'));

CREATE INDEX IF NOT EXISTS idx_files_storage_path
ON public.files (storage_path)
WHERE storage_path IS NOT NULL;

-- Authenticated users can read active storage type (non-secret fields only via view)
CREATE OR REPLACE VIEW public.storage_config_public
WITH (security_invoker = true)
AS
SELECT
  storage_type,
  aws_region,
  supabase_storage_bucket,
  supabase_storage_public,
  updated_at
FROM public.storage_config
LIMIT 1;

GRANT SELECT ON public.storage_config_public TO authenticated;


-- 20260619163000_storage_metrics_rpc.sql
-- Admin-only RPC to compute storage usage metrics across all files.

CREATE OR REPLACE FUNCTION public.get_storage_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB := '{}'::jsonb;
  provider TEXT;
  used_bytes BIGINT;
  now_iso TEXT := to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  FOREACH provider IN ARRAY ARRAY['local', 's3', 'supabase'] LOOP
    SELECT COALESCE(SUM(size), 0)
    INTO used_bytes
    FROM public.files
    WHERE storage_type = provider
      AND deleted_at IS NULL;

    result := result || jsonb_build_object(
      CASE WHEN provider = 'local' THEN 'root' ELSE provider END,
      jsonb_build_object(
        'provider', provider,
        'usedBytes', used_bytes,
        'totalBytes', NULL,
        'lastUpdated', now_iso,
        'isStale', false
      )
    );
  END LOOP;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_storage_metrics() TO authenticated;


-- 20260620120000_notifications_module.sql
-- Enterprise Notifications Module
-- Extends existing notifications table; adds event catalog, preferences, rules, logs, digest queue.

-- ========================
-- Event catalog
-- ========================
CREATE TABLE IF NOT EXISTS public.notification_events (
  event_key TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN (
    'tasks', 'meetings', 'eos', 'system', 'integrations', 'ai', 'mentions', 'users', 'departments'
  )),
  description TEXT NOT NULL DEFAULT '',
  default_severity TEXT NOT NULL DEFAULT 'info'
    CHECK (default_severity IN ('info', 'success', 'warning', 'error', 'critical')),
  default_priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (default_priority IN ('low', 'medium', 'high', 'urgent')),
  default_channels TEXT[] NOT NULL DEFAULT ARRAY['in_app']::TEXT[],
  is_subscribable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- Extend notifications (backward compatible)
-- ========================
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)
    DEFAULT '00000000-0000-0000-0000-000000000001',
  ADD COLUMN IF NOT EXISTS event_key TEXT REFERENCES public.notification_events(event_key),
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info'
    CHECK (severity IN ('info', 'success', 'warning', 'error', 'critical')),
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Sync severity from legacy type column
UPDATE public.notifications
SET severity = type
WHERE severity IS NULL OR severity = 'info' AND type IS DISTINCT FROM 'info';

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_category
  ON public.notifications(user_id, category);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_event
  ON public.notifications(tenant_id, event_key);
CREATE INDEX IF NOT EXISTS idx_notifications_active
  ON public.notifications(user_id) WHERE archived_at IS NULL;

-- ========================
-- User global preferences
-- ========================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  digest_mode TEXT NOT NULL DEFAULT 'instant'
    CHECK (digest_mode IN ('instant', 'hourly', 'daily', 'weekly')),
  mute_until TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  language TEXT NOT NULL DEFAULT 'en',
  working_hours JSONB NOT NULL DEFAULT '{"start":"09:00","end":"17:00","days":[1,2,3,4,5]}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- ========================
-- Per-event subscriptions
-- ========================
CREATE TABLE IF NOT EXISTS public.notification_event_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL REFERENCES public.notification_events(event_key) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  in_app BOOLEAN NOT NULL DEFAULT true,
  email BOOLEAN NOT NULL DEFAULT false,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_key, department_id)
);

-- ========================
-- Role-based defaults
-- ========================
CREATE TABLE IF NOT EXISTS public.notification_role_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  role_slug TEXT NOT NULL,
  event_key TEXT NOT NULL REFERENCES public.notification_events(event_key) ON DELETE CASCADE,
  in_app BOOLEAN NOT NULL DEFAULT true,
  email BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, role_slug, event_key)
);

-- ========================
-- Admin routing rules
-- ========================
CREATE TABLE IF NOT EXISTS public.notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  channels TEXT[] NOT NULL DEFAULT ARRAY['in_app']::TEXT[],
  target_roles TEXT[] DEFAULT ARRAY[]::TEXT[],
  target_departments UUID[] DEFAULT ARRAY[]::UUID[],
  escalation JSONB DEFAULT '{}'::jsonb,
  priority_override TEXT CHECK (priority_override IN ('low', 'medium', 'high', 'urgent')),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_rules_tenant_active
  ON public.notification_rules(tenant_id, is_active, sort_order);

-- ========================
-- Templates
-- ========================
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  event_key TEXT NOT NULL REFERENCES public.notification_events(event_key) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'slack', 'teams', 'sms', 'webhook', 'push')),
  subject TEXT,
  body TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_lookup
  ON public.notification_templates(tenant_id, event_key, channel, locale, is_active);

-- ========================
-- Delivery logs
-- ========================
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.notifications(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  event_key TEXT REFERENCES public.notification_events(event_key),
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'slack', 'teams', 'sms', 'webhook', 'push')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'delivered', 'read', 'failed', 'expired')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_user
  ON public.notification_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status
  ON public.notification_logs(tenant_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_logs_idempotency
  ON public.notification_logs(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ========================
-- Digest queue
-- ========================
CREATE TABLE IF NOT EXISTS public.notification_digest_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  event_key TEXT REFERENCES public.notification_events(event_key),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  digest_mode TEXT NOT NULL CHECK (digest_mode IN ('hourly', 'daily', 'weekly')),
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digest_queue_pending
  ON public.notification_digest_queue(user_id, digest_mode, scheduled_for)
  WHERE processed_at IS NULL;

-- ========================
-- Seed event catalog
-- ========================
INSERT INTO public.notification_events (event_key, category, description, default_severity, default_priority, default_channels, is_subscribable)
VALUES
  ('user.invited', 'users', 'User invited to workspace', 'info', 'medium', ARRAY['in_app','email'], true),
  ('task.assigned', 'tasks', 'Task assigned to user', 'info', 'high', ARRAY['in_app','email'], true),
  ('task.completed', 'tasks', 'Task marked complete', 'success', 'low', ARRAY['in_app'], true),
  ('meeting.scheduled', 'meetings', 'Meeting scheduled', 'info', 'medium', ARRAY['in_app','email'], true),
  ('meeting.reminder', 'meetings', 'Meeting reminder', 'info', 'high', ARRAY['in_app','email'], true),
  ('rock.overdue', 'eos', 'Rock past due date', 'warning', 'high', ARRAY['in_app','email'], true),
  ('issue.escalated', 'eos', 'Issue escalated', 'error', 'urgent', ARRAY['in_app','email'], true),
  ('comment.added', 'mentions', 'Comment added on entity', 'info', 'medium', ARRAY['in_app'], true),
  ('mention.added', 'mentions', 'User mentioned', 'info', 'high', ARRAY['in_app','email'], true),
  ('document.synced', 'integrations', 'Document synced successfully', 'success', 'low', ARRAY['in_app'], true),
  ('sync.failed', 'integrations', 'Sync operation failed', 'error', 'high', ARRAY['in_app','email'], true),
  ('ai.agent.completed', 'ai', 'AI agent run completed', 'info', 'medium', ARRAY['in_app'], true),
  ('memory.updated', 'ai', 'Agent memory updated', 'info', 'low', ARRAY['in_app'], false),
  ('integration.error', 'integrations', 'Integration error', 'error', 'urgent', ARRAY['in_app','email'], true),
  ('permission.changed', 'system', 'User permission changed', 'warning', 'high', ARRAY['in_app','email'], true),
  ('role.updated', 'system', 'User role updated', 'warning', 'high', ARRAY['in_app','email'], true),
  ('department.created', 'departments', 'Department created', 'info', 'low', ARRAY['in_app'], true),
  ('system.alert', 'system', 'System alert', 'warning', 'medium', ARRAY['in_app'], true),
  ('scorecard.missed', 'eos', 'Scorecard metric off track', 'warning', 'medium', ARRAY['in_app'], true),
  ('todo.assigned', 'eos', 'EOS todo assigned', 'info', 'medium', ARRAY['in_app'], true)
ON CONFLICT (event_key) DO NOTHING;

-- Map EOS legacy event types
INSERT INTO public.notification_event_subscriptions (user_id, event_key, in_app, email, tenant_id)
SELECT
  p.user_id,
  CASE p.event_type
    WHEN 'rock_overdue' THEN 'rock.overdue'
    WHEN 'meeting_reminder' THEN 'meeting.reminder'
    WHEN 'todo_assigned' THEN 'todo.assigned'
    WHEN 'issue_escalated' THEN 'issue.escalated'
    WHEN 'scorecard_missed' THEN 'scorecard.missed'
    ELSE p.event_type
  END,
  p.in_app,
  p.email,
  p.tenant_id
FROM public.eos_notification_preferences p
WHERE to_regclass('public.eos_notification_preferences') IS NOT NULL
ON CONFLICT (user_id, event_key, department_id) DO NOTHING;

-- Backfill category/event_key on existing notifications from metadata
UPDATE public.notifications n
SET
  category = COALESCE(n.category, n.metadata->>'module', 'system'),
  event_key = COALESCE(n.event_key, CASE n.metadata->>'module'
    WHEN 'eos' THEN 'system.alert'
    ELSE NULL
  END),
  severity = COALESCE(n.severity, n.type, 'info')
WHERE n.category IS NULL OR n.severity IS NULL;

-- ========================
-- RLS
-- ========================
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_event_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_role_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_digest_queue ENABLE ROW LEVEL SECURITY;

-- Event catalog: readable by all authenticated
DROP POLICY IF EXISTS "notif_events_select" ON public.notification_events;
CREATE POLICY "notif_events_select" ON public.notification_events
  FOR SELECT TO authenticated USING (true);

-- Preferences: own rows
DROP POLICY IF EXISTS "notif_prefs_own" ON public.notification_preferences;
CREATE POLICY "notif_prefs_own" ON public.notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Subscriptions: own rows
DROP POLICY IF EXISTS "notif_subs_own" ON public.notification_event_subscriptions;
CREATE POLICY "notif_subs_own" ON public.notification_event_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Role defaults: view all; manage admin
DROP POLICY IF EXISTS "notif_role_defaults_select" ON public.notification_role_defaults;
CREATE POLICY "notif_role_defaults_select" ON public.notification_role_defaults
  FOR SELECT TO authenticated USING (true);

-- Rules, templates: admin only (with has_permission when available)
DO $$ BEGIN
  IF to_regprocedure('public.has_permission(uuid,text)') IS NOT NULL THEN
    DROP POLICY IF EXISTS "notif_rules_admin" ON public.notification_rules;
    CREATE POLICY "notif_rules_admin" ON public.notification_rules
      FOR ALL TO authenticated
      USING (
        tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'notifications.admin')
      )
      WITH CHECK (
        tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'notifications.admin')
      );

    DROP POLICY IF EXISTS "notif_templates_admin" ON public.notification_templates;
    CREATE POLICY "notif_templates_admin" ON public.notification_templates
      FOR ALL TO authenticated
      USING (
        tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'notifications.admin')
      )
      WITH CHECK (
        tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'notifications.admin')
      );

    DROP POLICY IF EXISTS "notif_role_defaults_admin" ON public.notification_role_defaults;
    CREATE POLICY "notif_role_defaults_admin" ON public.notification_role_defaults
      FOR ALL TO authenticated
      USING (public.has_permission(auth.uid(), 'notifications.admin'))
      WITH CHECK (public.has_permission(auth.uid(), 'notifications.admin'));

    -- Tighten notifications policies
    DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
    CREATE POLICY "Users can view their own notifications" ON public.notifications
      FOR SELECT TO authenticated
      USING (
        auth.uid() = user_id
        AND public.has_permission(auth.uid(), 'notifications.view')
      );

    DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
    CREATE POLICY "Users can update their own notifications" ON public.notifications
      FOR UPDATE TO authenticated
      USING (
        auth.uid() = user_id
        AND public.has_permission(auth.uid(), 'notifications.edit')
      )
      WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
    CREATE POLICY "Users can delete their own notifications" ON public.notifications
      FOR DELETE TO authenticated
      USING (
        auth.uid() = user_id
        AND public.has_permission(auth.uid(), 'notifications.edit')
      );

    DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
    CREATE POLICY "Users can create notifications" ON public.notifications
      FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'notifications.create'));

    -- Delivery logs
    DROP POLICY IF EXISTS "notif_logs_own" ON public.notification_logs;
    CREATE POLICY "notif_logs_own" ON public.notification_logs
      FOR SELECT TO authenticated
      USING (
        user_id = auth.uid()
        OR public.has_permission(auth.uid(), 'notifications.export')
      );

    DROP POLICY IF EXISTS "notif_digest_own" ON public.notification_digest_queue;
    CREATE POLICY "notif_digest_own" ON public.notification_digest_queue
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  ELSE
    -- Fallback without has_permission
    DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
    CREATE POLICY "Users can delete their own notifications" ON public.notifications
      FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- Service role bypasses RLS for edge functions

-- updated_at trigger for preferences
CREATE OR REPLACE FUNCTION public.notification_preferences_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_preferences_updated ON public.notification_preferences;
CREATE TRIGGER trg_notification_preferences_updated
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.notification_preferences_updated_at();

-- EOS compat view
CREATE OR REPLACE VIEW public.eos_notification_preferences_compat AS
SELECT
  s.id,
  s.user_id,
  CASE s.event_key
    WHEN 'rock.overdue' THEN 'rock_overdue'
    WHEN 'meeting.reminder' THEN 'meeting_reminder'
    WHEN 'todo.assigned' THEN 'todo_assigned'
    WHEN 'issue.escalated' THEN 'issue_escalated'
    WHEN 'scorecard.missed' THEN 'scorecard_missed'
    ELSE s.event_key
  END AS event_type,
  s.in_app,
  s.email,
  s.tenant_id,
  s.created_at
FROM public.notification_event_subscriptions s
WHERE s.department_id IS NULL
  AND s.event_key IN ('rock.overdue','meeting.reminder','todo.assigned','issue.escalated','scorecard.missed');


-- 20260622120100_enhance_departments.sql
-- Add head_user_id, color, and parent_department_id to departments
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS head_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS parent_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- Backfill head_user_id from the existing manager_id once
UPDATE public.departments
SET head_user_id = manager_id
WHERE head_user_id IS NULL AND manager_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_departments_parent_department_id ON public.departments(parent_department_id);


-- 20260622120200_last_owner_guard.sql
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


-- 20260622145648_1ed1e153-9faa-46fa-a8a0-470687120577.sql
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

-- 20260622145907_f6713beb-7ce3-499e-a0a0-f5a7482709f9.sql
ALTER TABLE public.user_invites DROP CONSTRAINT IF EXISTS user_invites_status_check;
ALTER TABLE public.user_invites ADD CONSTRAINT user_invites_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'cancelled'::text, 'revoked'::text]));

-- 20260623120000_automation_engine.sql
-- ============================================================================
-- Enterprise Automation Engine
-- Workflows, executions, templates, outbox, schedules, webhooks, approvals
-- ============================================================================

-- ========================
-- automation_workflows
-- ========================
CREATE TABLE IF NOT EXISTS public.automation_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT false,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  definition JSONB NOT NULL DEFAULT '{"version":1,"nodes":[],"edges":[]}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_workflows_tenant_enabled
  ON public.automation_workflows(tenant_id, enabled);
CREATE INDEX IF NOT EXISTS idx_automation_workflows_trigger_type
  ON public.automation_workflows(trigger_type) WHERE enabled = true;

-- ========================
-- automation_steps
-- ========================
CREATE TABLE IF NOT EXISTS public.automation_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN (
    'trigger', 'condition', 'action', 'delay', 'approval', 'loop', 'branch'
  )),
  position INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  depends_on TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_automation_steps_workflow
  ON public.automation_steps(workflow_id, position);

-- ========================
-- automation_executions
-- ========================
CREATE TABLE IF NOT EXISTS public.automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'cancelled', 'paused'
  )),
  trigger_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT,
  current_step_key TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  paused_until TIMESTAMPTZ,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_executions_idempotency
  ON public.automation_executions(workflow_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_automation_executions_status
  ON public.automation_executions(status, created_at)
  WHERE status IN ('pending', 'paused');

CREATE INDEX IF NOT EXISTS idx_automation_executions_workflow
  ON public.automation_executions(workflow_id, created_at DESC);

-- ========================
-- automation_execution_logs
-- ========================
CREATE TABLE IF NOT EXISTS public.automation_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES public.automation_executions(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.automation_steps(id) ON DELETE SET NULL,
  step_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'skipped', 'waiting'
  )),
  input JSONB DEFAULT '{}'::jsonb,
  output JSONB DEFAULT '{}'::jsonb,
  error TEXT,
  duration_ms INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_execution_logs_execution
  ON public.automation_execution_logs(execution_id, created_at);

-- ========================
-- automation_templates
-- ========================
CREATE TABLE IF NOT EXISTS public.automation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  definition JSONB NOT NULL DEFAULT '{"version":1,"nodes":[],"edges":[]}'::jsonb,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  is_published BOOLEAN NOT NULL DEFAULT false,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_templates_category
  ON public.automation_templates(category, is_published);

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_templates_system_name
  ON public.automation_templates(name) WHERE is_system = true;

-- ========================
-- automation_event_outbox
-- ========================
CREATE TABLE IF NOT EXISTS public.automation_event_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_event_outbox_unprocessed
  ON public.automation_event_outbox(created_at)
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_automation_event_outbox_event
  ON public.automation_event_outbox(event_key, processed_at);

-- ========================
-- automation_schedules
-- ========================
CREATE TABLE IF NOT EXISTS public.automation_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
  cron_expression TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workflow_id)
);

CREATE INDEX IF NOT EXISTS idx_automation_schedules_next_run
  ON public.automation_schedules(next_run_at)
  WHERE enabled = true;

-- ========================
-- automation_webhooks
-- ========================
CREATE TABLE IF NOT EXISTS public.automation_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  path_slug TEXT NOT NULL,
  secret TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'hmac' CHECK (auth_type IN ('none', 'hmac', 'bearer')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, path_slug)
);

-- ========================
-- automation_approvals
-- ========================
CREATE TABLE IF NOT EXISTS public.automation_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES public.automation_executions(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.automation_steps(id) ON DELETE SET NULL,
  step_key TEXT NOT NULL,
  approver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approval_group TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'cancelled'
  )),
  comment TEXT,
  decided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_approvals_pending
  ON public.automation_approvals(approver_id, status)
  WHERE status = 'pending';

-- ========================
-- automation_dead_letter
-- ========================
CREATE TABLE IF NOT EXISTS public.automation_dead_letter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES public.automation_executions(id) ON DELETE SET NULL,
  workflow_id UUID REFERENCES public.automation_workflows(id) ON DELETE SET NULL,
  error TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- updated_at triggers
-- ========================
CREATE OR REPLACE FUNCTION public.automation_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_automation_workflows_updated ON public.automation_workflows;
CREATE TRIGGER trg_automation_workflows_updated
  BEFORE UPDATE ON public.automation_workflows
  FOR EACH ROW EXECUTE FUNCTION public.automation_set_updated_at();

DROP TRIGGER IF EXISTS trg_automation_executions_updated ON public.automation_executions;
CREATE TRIGGER trg_automation_executions_updated
  BEFORE UPDATE ON public.automation_executions
  FOR EACH ROW EXECUTE FUNCTION public.automation_set_updated_at();

-- ========================
-- RLS
-- ========================
ALTER TABLE public.automation_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_event_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_dead_letter ENABLE ROW LEVEL SECURITY;

-- Workflows: tenant-scoped with department visibility
CREATE POLICY "automation_workflows_select"
  ON public.automation_workflows FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (
      department_id IS NULL
      OR public.user_in_department(auth.uid(), department_id)
      OR public.has_permission(auth.uid(), 'automation.admin')
    )
  );

CREATE POLICY "automation_workflows_insert"
  ON public.automation_workflows FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND public.has_permission(auth.uid(), 'automation.create')
  );

CREATE POLICY "automation_workflows_update"
  ON public.automation_workflows FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.has_permission(auth.uid(), 'automation.edit')
  );

CREATE POLICY "automation_workflows_delete"
  ON public.automation_workflows FOR DELETE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.has_permission(auth.uid(), 'automation.delete')
  );

-- Steps: via workflow access
CREATE POLICY "automation_steps_select"
  ON public.automation_steps FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.automation_workflows w
      WHERE w.id = workflow_id AND w.tenant_id = public.get_user_tenant_id()
    )
  );

CREATE POLICY "automation_steps_manage"
  ON public.automation_steps FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.automation_workflows w
      WHERE w.id = workflow_id
        AND w.tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'automation.edit')
    )
  );

-- Executions
CREATE POLICY "automation_executions_select"
  ON public.automation_executions FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.has_permission(auth.uid(), 'automation.logs.view')
  );

CREATE POLICY "automation_execution_logs_select"
  ON public.automation_execution_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.automation_executions e
      WHERE e.id = execution_id
        AND e.tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'automation.logs.view')
    )
  );

-- Templates: system templates visible to all; tenant templates scoped
CREATE POLICY "automation_templates_select"
  ON public.automation_templates FOR SELECT TO authenticated
  USING (
    is_system = true
    OR tenant_id IS NULL
    OR tenant_id = public.get_user_tenant_id()
  );

CREATE POLICY "automation_templates_manage"
  ON public.automation_templates FOR ALL TO authenticated
  USING (
    public.has_permission(auth.uid(), 'automation.templates.manage')
    AND (tenant_id IS NULL OR tenant_id = public.get_user_tenant_id())
  );

-- Approvals: approver or admin
CREATE POLICY "automation_approvals_select"
  ON public.automation_approvals FOR SELECT TO authenticated
  USING (
    approver_id = auth.uid()
    OR public.has_permission(auth.uid(), 'automation.admin')
  );

CREATE POLICY "automation_approvals_update"
  ON public.automation_approvals FOR UPDATE TO authenticated
  USING (approver_id = auth.uid());

-- Webhooks admin
CREATE POLICY "automation_webhooks_select"
  ON public.automation_webhooks FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.has_permission(auth.uid(), 'automation.view')
  );

CREATE POLICY "automation_webhooks_manage"
  ON public.automation_webhooks FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.has_permission(auth.uid(), 'automation.webhooks.manage')
  );

-- Schedules via workflow
CREATE POLICY "automation_schedules_select"
  ON public.automation_schedules FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.automation_workflows w
      WHERE w.id = workflow_id AND w.tenant_id = public.get_user_tenant_id()
    )
  );

-- Service role full access (edge functions)
CREATE POLICY "automation_service_role_workflows"
  ON public.automation_workflows FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "automation_service_role_steps"
  ON public.automation_steps FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "automation_service_role_executions"
  ON public.automation_executions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "automation_service_role_logs"
  ON public.automation_execution_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "automation_service_role_outbox"
  ON public.automation_event_outbox FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "automation_service_role_schedules"
  ON public.automation_schedules FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "automation_service_role_approvals"
  ON public.automation_approvals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "automation_service_role_dlq"
  ON public.automation_dead_letter FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "automation_service_role_webhooks"
  ON public.automation_webhooks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "automation_service_role_templates"
  ON public.automation_templates FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Emit outbox helper (callable from edge functions and triggers)
CREATE OR REPLACE FUNCTION public.automation_emit_event(
  p_event_key TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.automation_event_outbox (event_key, payload, tenant_id)
  VALUES (
    p_event_key,
    p_payload,
    COALESCE(p_tenant_id, '00000000-0000-0000-0000-000000000001'::UUID)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.automation_emit_event(TEXT, JSONB, UUID) TO authenticated, service_role;


-- 20260623120000_role_builder_v2.sql
-- ============================================================================
-- User Management V2 — Sprint 1: Custom Role Builder
-- New permission catalog keys + non-assignable flag
-- ============================================================================

ALTER TABLE public.permissions
  ADD COLUMN IF NOT EXISTS is_assignable BOOLEAN NOT NULL DEFAULT true;

INSERT INTO public.permissions (key, name, category, resource, action, description, is_assignable) VALUES
  ('org.manage_mfa_policy', 'Manage MFA Policy', 'Organization', 'org', 'manage_mfa_policy', 'Configure organization-wide MFA enforcement', true),
  ('org.manage_notification_settings', 'Manage Notification Settings', 'Organization', 'org', 'manage_notification_settings', 'Configure notification dispatch and preferences', true),
  ('org.manage_org_settings', 'Manage Organization Settings', 'Organization', 'org', 'manage_org_settings', 'Edit organization-wide configuration', true),
  ('org.view_sessions', 'View Sessions', 'Organization', 'org', 'view_sessions', 'View active member sessions', true),
  ('org.terminate_sessions', 'Terminate Sessions', 'Organization', 'org', 'terminate_sessions', 'Terminate active member sessions', true),
  ('org.manage_scim', 'Manage SCIM', 'Organization', 'org', 'manage_scim', 'Configure SCIM provisioning', true),
  ('org.delete_org', 'Delete Organization', 'Organization', 'org', 'delete_org', 'Permanently delete the organization', false),
  ('org.transfer_ownership', 'Transfer Ownership', 'Organization', 'org', 'transfer_ownership', 'Transfer organization ownership to another member', false)
ON CONFLICT (key) DO NOTHING;


-- 20260623120100_automation_rbac_extensions.sql
-- ============================================================================
-- Automation Engine — RBAC extensions, module registration, feature flag, seeds
-- ============================================================================

-- Additional permissions
INSERT INTO public.permissions (key, name, category, resource, action, description)
VALUES
  ('automation.execute', 'Execute Automation', 'Automation', 'automation', 'execute', 'Manually trigger workflow execution'),
  ('automation.logs.view', 'View Automation Logs', 'Automation', 'automation', 'logs.view', 'View workflow execution logs'),
  ('automation.templates.manage', 'Manage Automation Templates', 'Automation', 'automation', 'templates.manage', 'Create and publish automation templates'),
  ('automation.webhooks.manage', 'Manage Automation Webhooks', 'Automation', 'automation', 'webhooks.manage', 'Configure incoming automation webhooks')
ON CONFLICT (key) DO NOTHING;

-- Grant new permissions to roles (same pattern as enterprise RBAC seed)
DO $$
DECLARE
  v_owner_id UUID;
  v_admin_id UUID;
  v_manager_id UUID;
  v_member_id UUID;
  v_viewer_id UUID;
BEGIN
  SELECT id INTO v_owner_id FROM public.roles WHERE slug = 'owner' AND tenant_id = '00000000-0000-0000-0000-000000000001';
  SELECT id INTO v_admin_id FROM public.roles WHERE slug = 'admin' AND tenant_id = '00000000-0000-0000-0000-000000000001';
  SELECT id INTO v_manager_id FROM public.roles WHERE slug = 'manager' AND tenant_id = '00000000-0000-0000-0000-000000000001';
  SELECT id INTO v_member_id FROM public.roles WHERE slug = 'member' AND tenant_id = '00000000-0000-0000-0000-000000000001';
  SELECT id INTO v_viewer_id FROM public.roles WHERE slug = 'viewer' AND tenant_id = '00000000-0000-0000-0000-000000000001';

  IF v_owner_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_owner_id, p.id FROM public.permissions p WHERE p.key LIKE 'automation.%'
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_admin_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_admin_id, p.id FROM public.permissions p WHERE p.key LIKE 'automation.%'
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_manager_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_manager_id, p.id FROM public.permissions p
    WHERE p.key IN (
      'automation.view', 'automation.create', 'automation.edit', 'automation.export',
      'automation.execute', 'automation.logs.view', 'automation.templates.manage'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_member_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_member_id, p.id FROM public.permissions p
    WHERE p.key IN ('automation.view', 'automation.execute', 'automation.logs.view')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_viewer_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_viewer_id, p.id FROM public.permissions p
    WHERE p.key IN ('automation.view', 'automation.logs.view')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Register automation module
INSERT INTO public.app_modules (name, slug, description, icon, category, is_core, is_active, sort_order, dependencies)
VALUES (
  'Automation',
  'automation',
  'No-code workflow automation with triggers, actions, and approvals',
  'Workflow',
  'operations',
  false,
  true,
  9,
  '{platform}'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = true;

-- Feature flag
INSERT INTO public.app_config (key, value, category, description)
VALUES ('features.enableAutomations', 'true', 'features', 'Enable automation engine')
ON CONFLICT (key) DO NOTHING;

-- Extend notification_events for automation triggers
INSERT INTO public.notification_events (event_key, category, description, default_severity, default_priority, default_channels, is_subscribable)
VALUES
  ('task.created', 'tasks', 'New task created', 'info', 'medium', ARRAY['in_app'], true),
  ('task.updated', 'tasks', 'Task updated', 'info', 'low', ARRAY['in_app'], true),
  ('user.created', 'users', 'New user created', 'info', 'medium', ARRAY['in_app','email'], true),
  ('issue.created', 'eos', 'New EOS issue created', 'info', 'medium', ARRAY['in_app'], true),
  ('email.received', 'integrations', 'Inbound email received', 'info', 'medium', ARRAY['in_app'], false)
ON CONFLICT (event_key) DO NOTHING;

-- Seed system templates
INSERT INTO public.automation_templates (name, description, category, trigger_type, is_published, is_system, definition)
VALUES
  (
    'Task Reminder',
    'Remind assignee if task not completed after 24 hours',
    'tasks',
    'task.created',
    true,
    true,
    '{"version":1,"trigger":{"type":"task.created","filters":{}},"nodes":[{"id":"trigger","type":"trigger","config":{"event":"task.created"}},{"id":"delay1","type":"delay","config":{"duration":"24h"}},{"id":"cond1","type":"condition","config":{"operator":"AND","rules":[{"field":"status","op":"neq","value":"completed"}]}},{"id":"action1","type":"action","config":{"action":"send_notification","title":"Task Reminder","message":"Your task is still open"}}],"edges":[{"from":"trigger","to":"delay1"},{"from":"delay1","to":"cond1"},{"from":"cond1","to":"action1","when":"true"}]}'::jsonb
  ),
  (
    'Meeting Reminder',
    'Send reminder 15 minutes before meeting',
    'meetings',
    'meeting.scheduled',
    true,
    true,
    '{"version":1,"trigger":{"type":"meeting.scheduled"},"nodes":[{"id":"trigger","type":"trigger","config":{"event":"meeting.scheduled"}},{"id":"action1","type":"action","config":{"action":"send_notification","title":"Meeting Reminder","message":"Your meeting starts soon"}}],"edges":[{"from":"trigger","to":"action1"}]}'::jsonb
  ),
  (
    'Rock Escalation',
    'Notify manager when rock is overdue',
    'eos',
    'rock.overdue',
    true,
    true,
    '{"version":1,"trigger":{"type":"rock.overdue"},"nodes":[{"id":"trigger","type":"trigger","config":{"event":"rock.overdue"}},{"id":"action1","type":"action","config":{"action":"send_notification","severity":"warning"}}],"edges":[{"from":"trigger","to":"action1"}]}'::jsonb
  ),
  (
    'Issue Escalation',
    'Escalate unresolved issues after 48 hours',
    'eos',
    'issue.created',
    true,
    true,
    '{"version":1,"trigger":{"type":"issue.created"},"nodes":[{"id":"trigger","type":"trigger","config":{}},{"id":"delay1","type":"delay","config":{"duration":"48h"}},{"id":"action1","type":"action","config":{"action":"send_notification","title":"Issue Escalation"}}],"edges":[{"from":"trigger","to":"delay1"},{"from":"delay1","to":"action1"}]}'::jsonb
  ),
  (
    'New User Onboarding',
    'Welcome email and task for new users',
    'users',
    'user.created',
    true,
    true,
    '{"version":1,"trigger":{"type":"user.created"},"nodes":[{"id":"trigger","type":"trigger","config":{}},{"id":"action1","type":"action","config":{"action":"send_email","template":"welcome"}},{"id":"action2","type":"action","config":{"action":"create_task","title":"Complete onboarding"}}],"edges":[{"from":"trigger","to":"action1"},{"from":"action1","to":"action2"}]}'::jsonb
  ),
  (
    'Customer Follow-up',
    'Follow up with customer 3 days after deal stage change',
    'business',
    'custom.event',
    true,
    true,
    '{"version":1,"trigger":{"type":"custom.event","filters":{"module":"deals"}},"nodes":[{"id":"trigger","type":"trigger","config":{}},{"id":"delay1","type":"delay","config":{"duration":"72h"}},{"id":"action1","type":"action","config":{"action":"send_email"}}],"edges":[{"from":"trigger","to":"delay1"},{"from":"delay1","to":"action1"}]}'::jsonb
  ),
  (
    'Weekly Report',
    'Generate and send weekly summary every Monday',
    'reports',
    'schedule',
    true,
    true,
    '{"version":1,"trigger":{"type":"schedule","cron":"0 9 * * 1"},"nodes":[{"id":"trigger","type":"trigger","config":{"cron":"0 9 * * 1"}},{"id":"action1","type":"action","config":{"action":"generate_summary"}}],"edges":[{"from":"trigger","to":"action1"}]}'::jsonb
  ),
  (
    'Daily Digest',
    'Daily activity digest at 8 AM',
    'reports',
    'schedule',
    true,
    true,
    '{"version":1,"trigger":{"type":"schedule","cron":"0 8 * * *"},"nodes":[{"id":"trigger","type":"trigger","config":{}},{"id":"action1","type":"action","config":{"action":"send_notification","title":"Daily Digest"}}],"edges":[{"from":"trigger","to":"action1"}]}'::jsonb
  ),
  (
    'Approval Workflow',
    'Multi-level manager and finance approval',
    'approvals',
    'manual',
    true,
    true,
    '{"version":1,"trigger":{"type":"manual"},"nodes":[{"id":"trigger","type":"trigger","config":{}},{"id":"approval1","type":"approval","config":{"level":1,"role":"manager"}},{"id":"approval2","type":"approval","config":{"level":2,"role":"admin","label":"Finance"}},{"id":"action1","type":"action","config":{"action":"send_notification","title":"Approved"}}],"edges":[{"from":"trigger","to":"approval1"},{"from":"approval1","to":"approval2","when":"approved"},{"from":"approval2","to":"action1","when":"approved"}]}'::jsonb
  ),
  (
    'AI Summary Workflow',
    'Generate AI summary when agent completes',
    'ai',
    'ai.agent.completed',
    true,
    true,
    '{"version":1,"trigger":{"type":"ai.agent.completed"},"nodes":[{"id":"trigger","type":"trigger","config":{}},{"id":"action1","type":"action","config":{"action":"generate_summary"}},{"id":"action2","type":"action","config":{"action":"send_notification"}}],"edges":[{"from":"trigger","to":"action1"},{"from":"action1","to":"action2"}]}'::jsonb
  )
ON CONFLICT (name) WHERE is_system DO NOTHING;


-- 20260623120200_automation_pg_cron.sql
-- pg_cron schedule for automation engine (commented — enable on Supabase Pro)
-- SELECT cron.schedule(
--   'automation-scheduler',
--   '* * * * *',
--   $$ SELECT net.http_post(
--     url := current_setting('app.settings.supabase_url') || '/functions/v1/automation-scheduler',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
--     ),
--     body := '{}'::jsonb
--   ) $$
-- );
--
-- SELECT cron.schedule(
--   'automation-trigger-evaluator',
--   '* * * * *',
--   $$ SELECT net.http_post(
--     url := current_setting('app.settings.supabase_url') || '/functions/v1/automation-trigger-evaluator',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
--     ),
--     body := '{}'::jsonb
--   ) $$
-- );

-- Documentation-only migration; configure cron via Supabase Dashboard or uncomment above on Pro plans.


-- 20260623130000_mfa_enforcement.sql
-- MFA Enforcement (Sprint 2): policy table + per-user enrollment tracking

CREATE TABLE IF NOT EXISTS public.mfa_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  required BOOLEAN NOT NULL DEFAULT false,
  grace_period_days INTEGER NOT NULL DEFAULT 7,
  allowed_factors TEXT[] NOT NULL DEFAULT ARRAY['totp'],
  trust_idp_mfa BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS public.mfa_enrollment_status (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enrolled BOOLEAN NOT NULL DEFAULT false,
  enrolled_at TIMESTAMPTZ,
  grace_period_ends_at TIMESTAMPTZ,
  last_reminded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.mfa_policies (tenant_id, required, grace_period_days, allowed_factors, trust_idp_mfa)
VALUES ('00000000-0000-0000-0000-000000000001', false, 7, ARRAY['totp'], false)
ON CONFLICT (tenant_id) DO NOTHING;

ALTER TABLE public.mfa_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_enrollment_status ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read the policy (needed to enforce the grace gate client-side)
CREATE POLICY "mfa_policies_select_authenticated" ON public.mfa_policies
  FOR SELECT TO authenticated USING (true);

-- Only privileged users (checked via has_permission in edge functions using the service role) write policy;
-- block direct writes from the client entirely.
CREATE POLICY "mfa_policies_no_direct_write" ON public.mfa_policies
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Users can see and update their own enrollment status row
CREATE POLICY "mfa_enrollment_status_select_own" ON public.mfa_enrollment_status
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "mfa_enrollment_status_update_own" ON public.mfa_enrollment_status
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "mfa_enrollment_status_insert_own" ON public.mfa_enrollment_status
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Admins (via has_permission) can read all rows through edge functions using the service role,
-- so no broader SELECT policy is required here.


-- 20260623140000_ai_model_policy.sql
-- Org-wide AI model policy for agent chat (default model, user choice vs locked, visibility)

ALTER TABLE public.integration_settings
  ADD COLUMN IF NOT EXISTS ai_model_policy JSONB NOT NULL DEFAULT '{
    "selection_mode": "user_choice",
    "default_chat_model_id": null,
    "default_provider_slug": null,
    "user_visible_models": "all_enabled"
  }'::jsonb;

COMMENT ON COLUMN public.integration_settings.ai_model_policy IS
  'Org-wide agent chat model policy: selection_mode (admin_locked|user_choice), default_chat_model_id, user_visible_models (all_enabled|default_only)';

-- Ensure at most one default chat model globally
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY updated_at DESC NULLS LAST, name ASC) AS rn
  FROM public.ai_models
  WHERE category = 'chat' AND is_default = true
)
UPDATE public.ai_models
SET is_default = false
WHERE category = 'chat'
  AND is_default = true
  AND id NOT IN (SELECT id FROM ranked WHERE rn = 1);

-- Agent chat UI needs read access to org policy for all authenticated users
CREATE POLICY "Authenticated users can read integration_settings for agent chat"
  ON public.integration_settings FOR SELECT
  TO authenticated
  USING (true);


-- 20260623140000_disable_four_spaces.sql
-- Disable Four Spaces IA — revert to legacy Control Tower layout
UPDATE public.app_config
SET value = 'false'
WHERE key = 'features.enableFourSpaces';

INSERT INTO public.app_config (key, value, category, description)
VALUES (
  'features.enableFourSpaces',
  'false',
  'features',
  'Four Spaces IA (disabled — legacy layout)'
)
ON CONFLICT (key) DO UPDATE SET value = 'false';


-- 20260623140000_signup_domain_whitelist.sql
-- Self-Signup Domain Whitelist (Sprint 3)
-- Restricts open self-signup to approved email domains. Invited users and the
-- bootstrap first user are always exempt. If no domains are configured, the
-- whitelist is treated as disabled (all domains allowed).

INSERT INTO public.permissions (key, name, category, resource, action, description, is_assignable) VALUES
  ('org.manage_signup_policy', 'Manage Signup Domain Whitelist', 'Organization', 'org', 'manage_signup_policy', 'Configure allowed email domains for self-signup', true)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.signup_domain_allowlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.signup_domain_allowlist ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read the configured domains (admin UI relies on this).
CREATE POLICY "signup_domain_allowlist_select_authenticated" ON public.signup_domain_allowlist
  FOR SELECT TO authenticated USING (true);

-- Writes only via edge function using the service role (checks org.manage_signup_policy).
CREATE POLICY "signup_domain_allowlist_no_direct_write" ON public.signup_domain_allowlist
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- =====================================================
-- ENFORCEMENT TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION public.enforce_signup_domain_whitelist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_domain_count INTEGER;
  existing_user_count INTEGER;
  has_pending_invite BOOLEAN;
  signup_domain TEXT;
  domain_allowed BOOLEAN;
BEGIN
  -- Whitelist disabled (not configured yet) — allow all signups.
  SELECT COUNT(*) INTO active_domain_count
  FROM public.signup_domain_allowlist
  WHERE is_active = true;

  IF active_domain_count = 0 THEN
    RETURN NEW;
  END IF;

  -- Bootstrap: never block the very first user.
  SELECT COUNT(*) INTO existing_user_count FROM auth.users;
  IF existing_user_count <= 1 THEN
    RETURN NEW;
  END IF;

  -- Invited users (admin-issued invite) bypass the whitelist regardless of domain.
  SELECT EXISTS (
    SELECT 1 FROM public.user_invites
    WHERE lower(email) = lower(NEW.email)
  ) INTO has_pending_invite;

  IF has_pending_invite THEN
    RETURN NEW;
  END IF;

  signup_domain := lower(split_part(NEW.email, '@', 2));

  SELECT EXISTS (
    SELECT 1 FROM public.signup_domain_allowlist
    WHERE domain = signup_domain AND is_active = true
  ) INTO domain_allowed;

  IF NOT domain_allowed THEN
    RAISE EXCEPTION 'Sign-ups from this email domain are not permitted. Contact your administrator for an invite.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_enforce_domain_whitelist ON auth.users;

CREATE TRIGGER on_auth_user_created_enforce_domain_whitelist
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_signup_domain_whitelist();

COMMENT ON FUNCTION public.enforce_signup_domain_whitelist() IS
  'Blocks self-signup for email domains not on signup_domain_allowlist, unless the user has a pending invite or is the bootstrap first user.';


