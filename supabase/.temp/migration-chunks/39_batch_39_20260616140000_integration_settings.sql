-- 20260415051748_20639912-7a4e-46f3-b56c-f8a8a4769df8.sql
INSERT INTO public.integration_providers (
  category_id,
  name,
  slug,
  description,
  auth_type,
  docs_url,
  is_available,
  is_coming_soon,
  is_beta,
  display_order
)
SELECT
  id,
  'SharePoint',
  'sharepoint',
  'Sync document library files into the Knowledge Base via Microsoft Graph (application permissions).',
  'oauth2',
  'https://learn.microsoft.com/graph/',
  true,
  false,
  false,
  30
FROM public.integration_categories
WHERE slug = 'storage-productivity'
ON CONFLICT (slug) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  auth_type = EXCLUDED.auth_type,
  docs_url = EXCLUDED.docs_url,
  is_available = EXCLUDED.is_available,
  is_coming_soon = EXCLUDED.is_coming_soon,
  is_beta = EXCLUDED.is_beta,
  display_order = EXCLUDED.display_order;

INSERT INTO public.integration_fields (
  provider_id,
  field_key,
  label,
  field_type,
  placeholder,
  is_required,
  is_sensitive,
  help_text,
  display_order
)
SELECT
  p.id,
  v.field_key,
  v.label,
  v.field_type,
  v.placeholder,
  v.is_required,
  v.is_sensitive,
  v.help_text,
  v.display_order
FROM public.integration_providers p
CROSS JOIN (
  VALUES
    (
      'tenant_id'::text,
      'Tenant ID'::text,
      'text'::text,
      'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::text,
      true::boolean,
      false::boolean,
      'Azure AD directory (tenant) ID'::text,
      10::integer
    ),
    (
      'client_id',
      'Client ID',
      'text',
      'Application (client) ID',
      true,
      false,
      'Azure AD app registration Application (client) ID',
      20
    ),
    (
      'client_secret',
      'Client Secret',
      'password',
      '',
      true,
      true,
      'App registration client secret value',
      30
    ),
    (
      'sharepoint_hostname',
      'SharePoint hostname',
      'text',
      'contoso.sharepoint.com',
      true,
      false,
      'Hostname only, no https://',
      40
    ),
    (
      'sharepoint_site_path',
      'Site path',
      'text',
      '/sites/YourSite',
      true,
      false,
      'Path to site collection, e.g. /sites/Engineering or / for root',
      50
    )
) AS v(field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
WHERE p.slug = 'sharepoint'
ON CONFLICT (provider_id, field_key) DO UPDATE SET
  label = EXCLUDED.label,
  field_type = EXCLUDED.field_type,
  placeholder = EXCLUDED.placeholder,
  is_required = EXCLUDED.is_required,
  is_sensitive = EXCLUDED.is_sensitive,
  help_text = EXCLUDED.help_text,
  display_order = EXCLUDED.display_order;

-- 20260415052220_13b68263-6266-4fca-90df-7e708ff0075e.sql
DO $$
DECLARE
  cat_id UUID;
BEGIN
  SELECT category_id INTO cat_id
  FROM public.integration_providers
  WHERE slug = 'google-drive'
  LIMIT 1;

  IF cat_id IS NULL THEN
    SELECT id INTO cat_id
    FROM public.integration_categories
    WHERE slug = 'storage-productivity'
    LIMIT 1;
  END IF;

  IF cat_id IS NULL THEN
    RAISE EXCEPTION 'sharepoint_integration_hub_ensure: need google-drive provider or storage-productivity category';
  END IF;

  INSERT INTO public.integration_providers (
    category_id,
    name,
    slug,
    description,
    auth_type,
    docs_url,
    is_available,
    is_coming_soon,
    is_beta,
    display_order
  ) VALUES (
    cat_id,
    'SharePoint',
    'sharepoint',
    'Sync document library files into the Knowledge Base via Microsoft Graph (application permissions).',
    'oauth2',
    'https://learn.microsoft.com/graph/',
    true,
    false,
    false,
    30
  )
  ON CONFLICT (slug) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    auth_type = EXCLUDED.auth_type,
    docs_url = EXCLUDED.docs_url,
    is_available = EXCLUDED.is_available,
    is_coming_soon = EXCLUDED.is_coming_soon,
    is_beta = EXCLUDED.is_beta,
    display_order = EXCLUDED.display_order;
END $$;

DO $$
DECLARE
  pid UUID;
BEGIN
  SELECT id INTO pid FROM public.integration_providers WHERE slug = 'sharepoint' LIMIT 1;
  IF pid IS NULL THEN
    RAISE NOTICE 'sharepoint provider not found after ensure; skip integration_fields';
    RETURN;
  END IF;

  INSERT INTO public.integration_fields (
    provider_id,
    field_key,
    label,
    field_type,
    placeholder,
    is_required,
    is_sensitive,
    help_text,
    display_order
  )
  SELECT
    pid,
    v.field_key,
    v.label,
    v.field_type::text,
    v.placeholder,
    v.is_required,
    v.is_sensitive,
    v.help_text,
    v.display_order
  FROM (VALUES
    ('tenant_id', 'Tenant ID', 'text', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', true, false,
     'Azure AD directory (tenant) ID', 10),
    ('client_id', 'Client ID', 'text', 'Application (client) ID', true, false,
     'Azure AD app registration Application (client) ID', 20),
    ('client_secret', 'Client Secret', 'password', '', true, true,
     'App registration client secret value', 30),
    ('sharepoint_hostname', 'SharePoint hostname', 'text', 'contoso.sharepoint.com', true, false,
     'Hostname only, no https://', 40),
    ('sharepoint_site_path', 'Site path', 'text', '/sites/YourSite', true, false,
     'Path to site collection, e.g. /sites/Engineering or / for root', 50)
  ) AS v(field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
  ON CONFLICT (provider_id, field_key) DO UPDATE SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;
END $$;

-- 20260415120000_confluence_integration.sql
-- Confluence: integration hub catalog + credential fields (validate-api-key + sync-confluence-knowledge).

INSERT INTO public.integration_providers (
  category_id,
  name,
  slug,
  description,
  auth_type,
  docs_url,
  is_available,
  is_coming_soon,
  is_beta,
  display_order
)
SELECT
  id,
  'Confluence',
  'confluence',
  'Sync Confluence Cloud pages into the knowledge base (REST API + Basic auth)',
  'basic',
  'https://developer.atlassian.com/cloud/confluence/rest/v1/intro/',
  true,
  false,
  false,
  25
FROM public.integration_categories
WHERE slug = 'storage-productivity'
ON CONFLICT (slug) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  auth_type = EXCLUDED.auth_type,
  docs_url = EXCLUDED.docs_url,
  is_available = EXCLUDED.is_available,
  is_coming_soon = EXCLUDED.is_coming_soon,
  is_beta = EXCLUDED.is_beta,
  display_order = EXCLUDED.display_order;

INSERT INTO public.integration_fields (
  provider_id,
  field_key,
  label,
  field_type,
  placeholder,
  is_required,
  is_sensitive,
  help_text,
  display_order
)
SELECT
  p.id,
  v.field_key,
  v.label,
  v.field_type,
  v.placeholder,
  v.is_required,
  v.is_sensitive,
  v.help_text,
  v.display_order
FROM public.integration_providers p
CROSS JOIN (
  VALUES
    (
      'confluence_email'::text,
      'Atlassian Email'::text,
      'email'::text,
      'you@company.com'::text,
      true::boolean,
      false::boolean,
      'Your Atlassian account email address'::text,
      10::integer
    ),
    (
      'confluence_api_token',
      'API Token',
      'password',
      '',
      true,
      true,
      'Create at id.atlassian.com → Security → API tokens',
      20
    ),
    (
      'confluence_domain',
      'Confluence Domain',
      'text',
      'yourcompany.atlassian.net',
      true,
      false,
      'Your Atlassian Cloud host (no https://), e.g. yourcompany.atlassian.net',
      30
    ),
    (
      'confluence_space_key',
      'Space Key (optional)',
      'text',
      'MYSPACE',
      false,
      false,
      'Limit sync to one space. Leave empty to sync pages from all spaces.',
      40
    )
) AS v(field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
WHERE p.slug = 'confluence'
ON CONFLICT (provider_id, field_key) DO UPDATE SET
  label = EXCLUDED.label,
  field_type = EXCLUDED.field_type,
  placeholder = EXCLUDED.placeholder,
  is_required = EXCLUDED.is_required,
  is_sensitive = EXCLUDED.is_sensitive,
  help_text = EXCLUDED.help_text,
  display_order = EXCLUDED.display_order;


-- 20260416103000_confluence_integration_hub_ensure.sql
-- Ensure Confluence appears on /admin/integrations (same pattern as jira_integration_hub_visible).
-- Resolves category from google-drive if present (guarantees same "Storage" section as in the UI),
-- else storage-productivity. Fails loudly if neither path works so deploys do not silently skip the row.

DO $$
DECLARE
  cat_id UUID;
BEGIN
  SELECT category_id INTO cat_id
  FROM public.integration_providers
  WHERE slug = 'google-drive'
  LIMIT 1;

  IF cat_id IS NULL THEN
    SELECT id INTO cat_id
    FROM public.integration_categories
    WHERE slug = 'storage-productivity'
    LIMIT 1;
  END IF;

  IF cat_id IS NULL THEN
    RAISE EXCEPTION 'confluence_integration_hub_ensure: need google-drive provider or storage-productivity category';
  END IF;

  INSERT INTO public.integration_providers (
    category_id,
    name,
    slug,
    description,
    auth_type,
    docs_url,
    is_available,
    is_coming_soon,
    is_beta,
    display_order
  ) VALUES (
    cat_id,
    'Confluence',
    'confluence',
    'Sync Confluence Cloud pages into the knowledge base (REST API + Basic auth)',
    'basic',
    'https://developer.atlassian.com/cloud/confluence/rest/v1/intro/',
    true,
    false,
    false,
    25
  )
  ON CONFLICT (slug) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    auth_type = EXCLUDED.auth_type,
    docs_url = EXCLUDED.docs_url,
    is_available = EXCLUDED.is_available,
    is_coming_soon = EXCLUDED.is_coming_soon,
    is_beta = EXCLUDED.is_beta,
    display_order = EXCLUDED.display_order;
END $$;

DO $$
DECLARE
  pid UUID;
BEGIN
  SELECT id INTO pid FROM public.integration_providers WHERE slug = 'confluence' LIMIT 1;
  IF pid IS NULL THEN
    RAISE NOTICE 'confluence provider not found after ensure; skip integration_fields';
    RETURN;
  END IF;

  INSERT INTO public.integration_fields (
    provider_id,
    field_key,
    label,
    field_type,
    placeholder,
    is_required,
    is_sensitive,
    help_text,
    display_order
  )
  SELECT
    pid,
    v.field_key,
    v.label,
    v.field_type::text,
    v.placeholder,
    v.is_required,
    v.is_sensitive,
    v.help_text,
    v.display_order
  FROM (VALUES
    ('confluence_email', 'Atlassian Email', 'email', 'you@company.com', true, false,
     'Your Atlassian account email address', 10),
    ('confluence_api_token', 'API Token', 'password', '', true, true,
     'Create at id.atlassian.com → Security → API tokens', 20),
    ('confluence_domain', 'Confluence Domain', 'text', 'yourcompany.atlassian.net', true, false,
     'Your Atlassian Cloud host (no https://), e.g. yourcompany.atlassian.net', 30),
    ('confluence_space_key', 'Space Key (optional)', 'text', 'MYSPACE', false, false,
     'Limit sync to one space. Leave empty to sync pages from all spaces.', 40)
  ) AS v(field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
  ON CONFLICT (provider_id, field_key) DO UPDATE SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;
END $$;


-- 20260417130000_integration_sharepoint_provider.sql
-- SharePoint: integration hub catalog + credential fields (validate-api-key + sync-sharepoint-knowledge).
-- category_id: same section as Google Drive & Confluence (prefer google-drive row, else storage-productivity).

INSERT INTO public.integration_providers (
  category_id,
  name,
  slug,
  description,
  auth_type,
  docs_url,
  is_available,
  is_coming_soon,
  is_beta,
  display_order
)
SELECT
  c.resolved_id,
  'SharePoint',
  'sharepoint',
  'Sync document library files into the Knowledge Base via Microsoft Graph (application permissions).',
  'oauth2',
  'https://learn.microsoft.com/graph/',
  true,
  false,
  false,
  30
FROM (
  SELECT COALESCE(
    (SELECT category_id FROM public.integration_providers WHERE slug = 'google-drive' LIMIT 1),
    (SELECT id FROM public.integration_categories WHERE slug = 'storage-productivity' LIMIT 1)
  ) AS resolved_id
) AS c
WHERE c.resolved_id IS NOT NULL
ON CONFLICT (slug) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  auth_type = EXCLUDED.auth_type,
  docs_url = EXCLUDED.docs_url,
  is_available = EXCLUDED.is_available,
  is_coming_soon = EXCLUDED.is_coming_soon,
  is_beta = EXCLUDED.is_beta,
  display_order = EXCLUDED.display_order;

INSERT INTO public.integration_fields (
  provider_id,
  field_key,
  label,
  field_type,
  placeholder,
  is_required,
  is_sensitive,
  help_text,
  display_order
)
SELECT
  p.id,
  v.field_key,
  v.label,
  v.field_type,
  v.placeholder,
  v.is_required,
  v.is_sensitive,
  v.help_text,
  v.display_order
FROM public.integration_providers p
CROSS JOIN (
  VALUES
    (
      'tenant_id'::text,
      'Tenant ID'::text,
      'text'::text,
      'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::text,
      true::boolean,
      false::boolean,
      'Azure AD directory (tenant) ID'::text,
      10::integer
    ),
    (
      'client_id',
      'Client ID',
      'text',
      'Application (client) ID',
      true,
      false,
      'Azure AD app registration Application (client) ID',
      20
    ),
    (
      'client_secret',
      'Client Secret',
      'password',
      '',
      true,
      true,
      'App registration client secret value',
      30
    ),
    (
      'sharepoint_hostname',
      'SharePoint hostname',
      'text',
      'contoso.sharepoint.com',
      true,
      false,
      'Hostname only, no https://',
      40
    ),
    (
      'sharepoint_site_path',
      'Site path',
      'text',
      '/sites/YourSite',
      true,
      false,
      'Path to site collection, e.g. /sites/Engineering or / for root',
      50
    )
) AS v(field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
WHERE p.slug = 'sharepoint'
ON CONFLICT (provider_id, field_key) DO UPDATE SET
  label = EXCLUDED.label,
  field_type = EXCLUDED.field_type,
  placeholder = EXCLUDED.placeholder,
  is_required = EXCLUDED.is_required,
  is_sensitive = EXCLUDED.is_sensitive,
  help_text = EXCLUDED.help_text,
  display_order = EXCLUDED.display_order;


-- 20260417140000_sharepoint_integration_hub_ensure.sql
-- Ensure SharePoint appears on /admin/integrations under the same Storage category as Google Drive & Confluence.
-- (Mirrors 20260416103000_confluence_integration_hub_ensure.sql — fixes missing row if 20260417130000 was not applied
-- or category_id must match google-drive for a consistent hub section.)

DO $$
DECLARE
  cat_id UUID;
BEGIN
  SELECT category_id INTO cat_id
  FROM public.integration_providers
  WHERE slug = 'google-drive'
  LIMIT 1;

  IF cat_id IS NULL THEN
    SELECT id INTO cat_id
    FROM public.integration_categories
    WHERE slug = 'storage-productivity'
    LIMIT 1;
  END IF;

  IF cat_id IS NULL THEN
    RAISE EXCEPTION 'sharepoint_integration_hub_ensure: need google-drive provider or storage-productivity category';
  END IF;

  INSERT INTO public.integration_providers (
    category_id,
    name,
    slug,
    description,
    auth_type,
    docs_url,
    is_available,
    is_coming_soon,
    is_beta,
    display_order
  ) VALUES (
    cat_id,
    'SharePoint',
    'sharepoint',
    'Sync document library files into the Knowledge Base via Microsoft Graph (application permissions).',
    'oauth2',
    'https://learn.microsoft.com/graph/',
    true,
    false,
    false,
    30
  )
  ON CONFLICT (slug) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    auth_type = EXCLUDED.auth_type,
    docs_url = EXCLUDED.docs_url,
    is_available = EXCLUDED.is_available,
    is_coming_soon = EXCLUDED.is_coming_soon,
    is_beta = EXCLUDED.is_beta,
    display_order = EXCLUDED.display_order;
END $$;

DO $$
DECLARE
  pid UUID;
BEGIN
  SELECT id INTO pid FROM public.integration_providers WHERE slug = 'sharepoint' LIMIT 1;
  IF pid IS NULL THEN
    RAISE NOTICE 'sharepoint provider not found after ensure; skip integration_fields';
    RETURN;
  END IF;

  INSERT INTO public.integration_fields (
    provider_id,
    field_key,
    label,
    field_type,
    placeholder,
    is_required,
    is_sensitive,
    help_text,
    display_order
  )
  SELECT
    pid,
    v.field_key,
    v.label,
    v.field_type::text,
    v.placeholder,
    v.is_required,
    v.is_sensitive,
    v.help_text,
    v.display_order
  FROM (VALUES
    ('tenant_id', 'Tenant ID', 'text', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', true, false,
     'Azure AD directory (tenant) ID', 10),
    ('client_id', 'Client ID', 'text', 'Application (client) ID', true, false,
     'Azure AD app registration Application (client) ID', 20),
    ('client_secret', 'Client Secret', 'password', '', true, true,
     'App registration client secret value', 30),
    ('sharepoint_hostname', 'SharePoint hostname', 'text', 'contoso.sharepoint.com', true, false,
     'Hostname only, no https://', 40),
    ('sharepoint_site_path', 'Site path', 'text', '/sites/YourSite', true, false,
     'Path to site collection, e.g. /sites/Engineering or / for root', 50)
  ) AS v(field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
  ON CONFLICT (provider_id, field_key) DO UPDATE SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;
END $$;


-- 20260616120000_department_users_and_drop_skills.sql
-- ============================================================================
-- Department Users + Drop Obsolete Skills Tables
-- ============================================================================

-- Drop obsolete skills management tables (SkillManagement page removed)
DROP TABLE IF EXISTS public.employee_skills CASCADE;
DROP TABLE IF EXISTS public.skills CASCADE;

-- ========================
-- Department Users Junction
-- ========================
CREATE TABLE IF NOT EXISTS public.department_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (department_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_department_users_department ON public.department_users(department_id);
CREATE INDEX IF NOT EXISTS idx_department_users_user ON public.department_users(user_id);

ALTER TABLE public.department_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view department users" ON public.department_users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage department users" ON public.department_users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Backfill from existing employee_profiles assignments
INSERT INTO public.department_users (department_id, user_id)
SELECT DISTINCT department_id, user_id
FROM public.employee_profiles
WHERE department_id IS NOT NULL AND user_id IS NOT NULL
ON CONFLICT (department_id, user_id) DO NOTHING;


-- 20260616140000_integration_settings.sql
-- ============================================
-- Integration Preferences — organization-level settings
-- Primary integrations and primary knowledge sources
-- ============================================

CREATE TABLE IF NOT EXISTS public.integration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NULL,
  primary_integrations JSONB NOT NULL DEFAULT '[]'::jsonb,
  primary_knowledge_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Single global config row for single-tenant deployments
CREATE UNIQUE INDEX IF NOT EXISTS integration_settings_global_singleton
  ON public.integration_settings ((1))
  WHERE organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_integration_settings_organization_id
  ON public.integration_settings(organization_id)
  WHERE organization_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_integration_settings_updated_at ON public.integration_settings;
CREATE TRIGGER set_integration_settings_updated_at
  BEFORE UPDATE ON public.integration_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

-- Admins and moderators can view preferences
CREATE POLICY "Admins and moderators can view integration_settings"
  ON public.integration_settings FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  );

-- Only admins can create or update preferences
CREATE POLICY "Admins can insert integration_settings"
  ON public.integration_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update integration_settings"
  ON public.integration_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete integration_settings"
  ON public.integration_settings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.integration_settings IS
  'Organization-level primary integration and knowledge source preferences for AI and knowledge features';


