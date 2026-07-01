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
