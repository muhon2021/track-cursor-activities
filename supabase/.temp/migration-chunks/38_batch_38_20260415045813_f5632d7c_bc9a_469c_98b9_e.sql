-- 20260414042752_e94a5c80-c1cf-474f-ba29-fbf2cea1a40d.sql
DO $$
DECLARE
  email_category_id UUID;
  outlook_provider_id UUID;
BEGIN
  SELECT id INTO email_category_id
  FROM public.integration_categories
  WHERE slug = 'email'
  LIMIT 1;

  IF email_category_id IS NULL THEN
    RAISE EXCEPTION 'integration category email not found';
  END IF;

  INSERT INTO public.integration_providers (
    category_id,
    name,
    slug,
    description,
    auth_type,
    oauth_config,
    docs_url,
    is_available,
    is_coming_soon,
    display_order
  )
  VALUES (
    email_category_id,
    'Microsoft Outlook',
    'outlook',
    'Connect Outlook mail and calendar via Microsoft Graph (delegated OAuth). Register an Entra app, then each user completes Connect.',
    'oauth2',
    '{
      "authorize_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      "scopes": [
        "openid", "profile", "email", "offline_access",
        "User.Read", "Mail.Read", "Mail.Send", "Calendars.ReadWrite"
      ],
      "default_scopes": [
        "openid", "profile", "email", "offline_access",
        "User.Read", "Mail.Read", "Mail.Send", "Calendars.ReadWrite"
      ]
    }'::jsonb,
    'https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview',
    true,
    false,
    15
  )
  ON CONFLICT (slug) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    auth_type = EXCLUDED.auth_type,
    oauth_config = COALESCE(integration_providers.oauth_config, EXCLUDED.oauth_config),
    docs_url = EXCLUDED.docs_url,
    is_available = EXCLUDED.is_available,
    is_coming_soon = EXCLUDED.is_coming_soon,
    display_order = COALESCE(integration_providers.display_order, EXCLUDED.display_order);

  SELECT id INTO outlook_provider_id
  FROM public.integration_providers
  WHERE slug = 'outlook'
  LIMIT 1;

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
  VALUES
    (
      outlook_provider_id,
      'client_id',
      'Application (client) ID',
      'text',
      'Entra app client ID',
      true,
      false,
      'From Microsoft Entra ID → App registrations → your app.',
      10
    ),
    (
      outlook_provider_id,
      'client_secret',
      'Client secret',
      'password',
      'Paste client secret value',
      true,
      true,
      'Create a client secret under Certificates & secrets. Redirect URI in Entra must include {SUPABASE_URL}/functions/v1/user-oauth-callback',
      20
    ),
    (
      outlook_provider_id,
      'tenant_id',
      'Directory (tenant) ID — optional',
      'text',
      'Leave blank for multi-tenant (/common)',
      false,
      false,
      'Single-tenant only: your tenant GUID. When set, authorize and token URLs use this tenant instead of /common.',
      30
    )
  ON CONFLICT (provider_id, field_key) DO UPDATE SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;
END $$;

-- 20260414044314_f36778f6-d6a6-4745-b745-e92e19943b5d.sql
ALTER TABLE public.okrs ADD COLUMN IF NOT EXISTS okr_type TEXT DEFAULT 'personal';
ALTER TABLE public.okrs ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE public.okrs ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.okrs ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 20260414060235_aff0c5b0-6be3-4f0c-b9d0-9c4dbff82ab5.sql

DO $$
DECLARE
  u1 UUID := (SELECT id FROM auth.users ORDER BY created_at LIMIT 1);
  pod_eng UUID;
  pod_sales UUID;
  pod_ops UUID;
  okr1 UUID;
  okr2 UUID;
  okr3 UUID;
  okr4 UUID;
  okr5 UUID;
  okr6 UUID;
  okr7 UUID;
  okr8 UUID;
  kr1 UUID;
  kr2 UUID;
BEGIN
  IF u1 IS NULL THEN RAISE NOTICE 'No users — skipping.'; RETURN; END IF;

  SELECT id INTO pod_eng  FROM eos_pods WHERE name = 'Engineering'  LIMIT 1;
  SELECT id INTO pod_sales FROM eos_pods WHERE name = 'Sales & BD' LIMIT 1;
  SELECT id INTO pod_ops  FROM eos_pods WHERE name = 'Operations'  LIMIT 1;

  -- Clean all existing OKR data
  DELETE FROM okr_check_ins WHERE user_id = u1;
  DELETE FROM okr_key_results WHERE owner_id = u1;
  DELETE FROM okrs WHERE created_by = u1;

  -- Active Q2 2026 — Company OKRs
  INSERT INTO okrs (title, description, owner_id, status, quarter, start_date, end_date, progress, pod_id, created_by, okr_type, year, is_archived)
  VALUES ('Ship all 10 modules to production', 'Complete development, QA, and data seeding for all platform modules.', u1, 'active', 'Q2 2026', '2026-04-01', '2026-06-30', 65, pod_eng, u1, 'company', 2026, false)
  RETURNING id INTO okr1;

  INSERT INTO okrs (title, description, owner_id, status, quarter, start_date, end_date, progress, pod_id, created_by, okr_type, year, is_archived)
  VALUES ('Improve platform reliability to 99.9%', 'Reduce downtime, add monitoring, and fix top-10 bugs.', u1, 'at_risk', 'Q2 2026', '2026-04-01', '2026-06-30', 30, pod_eng, u1, 'company', 2026, false)
  RETURNING id INTO okr4;

  -- Active Q2 2026 — Team OKRs
  INSERT INTO okrs (title, description, owner_id, status, quarter, start_date, end_date, progress, pod_id, created_by, okr_type, year, is_archived)
  VALUES ('Acquire 10 pilot customers', 'Sign paid pilot agreements with 10 mid-market agencies.', u1, 'active', 'Q2 2026', '2026-04-01', '2026-06-30', 20, pod_sales, u1, 'team', 2026, false)
  RETURNING id INTO okr2;

  INSERT INTO okrs (title, description, owner_id, status, quarter, start_date, end_date, progress, pod_id, created_by, okr_type, year, is_archived)
  VALUES ('Establish operational excellence', 'Implement SOPs, OKR tracking, and team cadences.', u1, 'on_track', 'Q2 2026', '2026-04-01', '2026-06-30', 40, pod_ops, u1, 'team', 2026, false)
  RETURNING id INTO okr3;

  -- Active Q2 2026 — Personal OKR
  INSERT INTO okrs (title, description, owner_id, status, quarter, start_date, end_date, progress, pod_id, created_by, okr_type, year, is_archived)
  VALUES ('Complete AI/ML certification', 'Finish Stanford online AI course and apply learnings to product.', u1, 'active', 'Q2 2026', '2026-04-01', '2026-06-30', 55, null, u1, 'personal', 2026, false)
  RETURNING id INTO okr7;

  -- Closed/Archived Q1 2026
  INSERT INTO okrs (title, description, owner_id, status, quarter, start_date, end_date, progress, pod_id, created_by, okr_type, year, is_archived)
  VALUES ('Launch MVP platform', 'Deliver core modules to production.', u1, 'completed', 'Q1 2026', '2026-01-01', '2026-03-31', 100, pod_eng, u1, 'company', 2026, true)
  RETURNING id INTO okr5;

  INSERT INTO okrs (title, description, owner_id, status, quarter, start_date, end_date, progress, pod_id, created_by, okr_type, year, is_archived)
  VALUES ('Close first 3 paying customers', 'Convert pilot users to paid subscriptions.', u1, 'completed', 'Q1 2026', '2026-01-01', '2026-03-31', 100, pod_sales, u1, 'team', 2026, true)
  RETURNING id INTO okr6;

  INSERT INTO okrs (title, description, owner_id, status, quarter, start_date, end_date, progress, pod_id, created_by, okr_type, year, is_archived)
  VALUES ('Set up team cadences', 'Establish L10 meetings, scorecards, and weekly check-ins.', u1, 'completed', 'Q1 2026', '2026-01-01', '2026-03-31', 85, pod_ops, u1, 'team', 2026, true)
  RETURNING id INTO okr8;

  -- Key Results (using valid statuses: not_started, on_track, at_risk, behind, completed)
  INSERT INTO okr_key_results (okr_id, title, metric_type, current_value, target_value, start_value, unit, status, owner_id, sort_order) VALUES
    (okr1, 'Modules with development complete',     'number',     8,  10, 0, 'modules',  'on_track',    u1, 1),
    (okr1, 'QA checklist items tested',             'number',     45, 85, 0, 'items',    'behind',      u1, 2),
    (okr1, 'Demo seed data coverage',               'percentage', 60, 100, 0, '%',       'on_track',    u1, 3),
    (okr2, 'Discovery calls completed',             'number',     6,  30, 0, 'calls',    'on_track',    u1, 1),
    (okr2, 'Proposals sent',                        'number',     2,  15, 0, 'proposals','behind',      u1, 2),
    (okr2, 'Signed pilot agreements',               'number',     0,  10, 0, 'pilots',   'not_started', u1, 3),
    (okr3, 'SOPs documented',                       'number',     4,  12, 0, 'SOPs',     'on_track',    u1, 1),
    (okr3, 'Weekly L10 completion rate',             'percentage', 80, 95, 0, '%',        'on_track',    u1, 2),
    (okr3, 'Team NPS score',                        'number',     72, 80, 0, 'NPS',      'on_track',    u1, 3),
    (okr4, 'P0 bugs resolved',                      'number',     3,  10, 0, 'bugs',     'at_risk',     u1, 1),
    (okr4, 'Uptime percentage',                     'percentage', 99.2, 99.9, 98, '%',   'behind',      u1, 2),
    (okr4, 'Monitoring alerts configured',           'number',     5,  20, 0, 'alerts',   'on_track',    u1, 3),
    (okr5, 'Core modules deployed',                 'number',     5,  5, 0, 'modules',   'completed',   u1, 1),
    (okr5, 'Auth & SSO working',                    'number',     1,  1, 0, 'milestone', 'completed',   u1, 2),
    (okr6, 'Customers converted',                   'number',     3,  3, 0, 'customers', 'completed',   u1, 1),
    (okr6, 'MRR achieved',                          'currency',   4500, 3000, 0, 'USD',  'completed',   u1, 2),
    (okr7, 'Course modules completed',              'number',     6,  12, 0, 'modules',  'on_track',    u1, 1),
    (okr7, 'AI features prototyped',                'number',     2,  4, 0, 'prototypes','on_track',    u1, 2);

  -- Check-ins
  SELECT id INTO kr1 FROM okr_key_results WHERE okr_id = okr1 AND title = 'Modules with development complete' LIMIT 1;
  SELECT id INTO kr2 FROM okr_key_results WHERE okr_id = okr2 AND title = 'Discovery calls completed' LIMIT 1;

  IF kr1 IS NOT NULL THEN
    INSERT INTO okr_check_ins (okr_id, key_result_id, user_id, previous_value, new_value, confidence, notes) VALUES
      (okr1, kr1, u1, 6, 8, 'high', 'Completed Actions categories + Productivity charts this week.'),
      (okr1, kr1, u1, 5, 6, 'high', 'Knowledge Base modularization done. Projects finalized.');
  END IF;

  IF kr2 IS NOT NULL THEN
    INSERT INTO okr_check_ins (okr_id, key_result_id, user_id, previous_value, new_value, confidence, notes) VALUES
      (okr2, kr2, u1, 4, 6, 'medium', 'Two calls with healthcare SaaS prospects. Good pipeline.');
  END IF;

  RAISE NOTICE 'OKR seed data cleaned and re-inserted successfully.';
END $$;


-- 20260414100000_float_admin_integration.sql
-- Float admin integration: provider seed + synced schedule tables (admin-only UI).

DO $$
DECLARE
  pm_category_id UUID;
  float_provider_id UUID;
BEGIN
  SELECT id INTO pm_category_id
  FROM public.integration_categories
  WHERE slug = 'project-management'
  LIMIT 1;

  IF pm_category_id IS NULL THEN
    RAISE EXCEPTION 'integration category project-management not found';
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
    display_order
  )
  VALUES (
    pm_category_id,
    'Float',
    'float',
    'Resource scheduling platform for people, projects, and allocations',
    'api_key',
    'https://developer.float.com',
    true,
    false,
    60
  )
  ON CONFLICT (slug) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    auth_type = EXCLUDED.auth_type,
    docs_url = EXCLUDED.docs_url,
    is_available = EXCLUDED.is_available,
    is_coming_soon = EXCLUDED.is_coming_soon,
    display_order = EXCLUDED.display_order;

  SELECT id INTO float_provider_id
  FROM public.integration_providers
  WHERE slug = 'float'
  LIMIT 1;

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
  VALUES
    (
      float_provider_id,
      'float_api_key',
      'Float API key',
      'password',
      'Paste your Float personal access token',
      true,
      true,
      'Create in Float profile settings. Used by sync-float-schedule.',
      10
    ),
    (
      float_provider_id,
      'float_base_url',
      'Float API base URL',
      'url',
      'https://api.float.com/v3',
      false,
      false,
      'Optional override. Default is https://api.float.com/v3',
      20
    )
  ON CONFLICT (provider_id, field_key) DO UPDATE SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;
END $$;

CREATE TABLE IF NOT EXISTS public.float_synced_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  float_people_id TEXT NOT NULL,
  name TEXT,
  email TEXT,
  role TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT float_synced_people_unique UNIQUE (float_people_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.float_synced_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  float_project_id TEXT NOT NULL,
  name TEXT,
  client_name TEXT,
  projects_linked BOOLEAN NOT NULL DEFAULT false,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT float_synced_projects_unique UNIQUE (float_project_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.float_synced_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  float_allocation_id TEXT NOT NULL,
  float_people_id TEXT,
  float_project_id TEXT,
  starts_at DATE,
  ends_at DATE,
  hours NUMERIC,
  source_type TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT float_synced_allocations_unique UNIQUE (float_allocation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_float_people_user ON public.float_synced_people(user_id);
CREATE INDEX IF NOT EXISTS idx_float_projects_user ON public.float_synced_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_float_allocations_user ON public.float_synced_allocations(user_id);

ALTER TABLE public.float_synced_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.float_synced_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.float_synced_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read float_synced_people" ON public.float_synced_people;
DROP POLICY IF EXISTS "Authenticated users can read float_synced_projects" ON public.float_synced_projects;
DROP POLICY IF EXISTS "Authenticated users can read float_synced_allocations" ON public.float_synced_allocations;

CREATE POLICY "Authenticated users can read float_synced_people"
  ON public.float_synced_people FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read float_synced_projects"
  ON public.float_synced_projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read float_synced_allocations"
  ON public.float_synced_allocations FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.float_synced_people TO authenticated;
GRANT SELECT ON public.float_synced_projects TO authenticated;
GRANT SELECT ON public.float_synced_allocations TO authenticated;
REVOKE ALL ON public.float_synced_people FROM anon;
REVOKE ALL ON public.float_synced_projects FROM anon;
REVOKE ALL ON public.float_synced_allocations FROM anon;


-- 20260414150000_fellow_integration.sql
-- Fellow.ai integration: catalog entry + credential fields (request-time API proxy).
-- Runtime: Edge Function fellow-api reads organization_integrations.config for the signed-in user.

DO $$
DECLARE
  meeting_category_id UUID;
  fellow_provider_id UUID;
BEGIN
  SELECT id INTO meeting_category_id
  FROM public.integration_categories
  WHERE slug = 'meeting-providers'
  LIMIT 1;

  IF meeting_category_id IS NULL THEN
    RAISE EXCEPTION 'integration category meeting-providers not found';
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
    display_order
  )
  VALUES (
    meeting_category_id,
    'Fellow',
    'fellow',
    'Fellow meeting recordings, notes, and AI action items via Developer API (request-time proxy)',
    'api_key',
    'https://developers.fellow.ai',
    true,
    false,
    35
  )
  ON CONFLICT (slug) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    auth_type = EXCLUDED.auth_type,
    docs_url = EXCLUDED.docs_url,
    is_available = EXCLUDED.is_available,
    is_coming_soon = EXCLUDED.is_coming_soon,
    display_order = EXCLUDED.display_order;

  SELECT id INTO fellow_provider_id
  FROM public.integration_providers
  WHERE slug = 'fellow'
  LIMIT 1;

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
  VALUES
    (
      fellow_provider_id,
      'subdomain',
      'Workspace subdomain',
      'text',
      'e.g. mycompany (for mycompany.fellow.app)',
      true,
      false,
      'The subdomain of your Fellow workspace URL.',
      10
    ),
    (
      fellow_provider_id,
      'api_key',
      'Fellow API key',
      'password',
      'Paste your Fellow Developer API key',
      true,
      true,
      'Create under User settings → Developer API in Fellow.',
      20
    )
  ON CONFLICT (provider_id, field_key) DO UPDATE SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;
END $$;


-- 20260414160000_fellow_provider_category_ensure.sql
-- Ensure Fellow stays under Meeting Providers (Integration Hub groups by category_id).
-- Fixes environments where fellow was created with the wrong category_id.

UPDATE public.integration_providers AS p
SET category_id = c.id,
    updated_at = now()
FROM public.integration_categories AS c
WHERE p.slug = 'fellow'
  AND c.slug = 'meeting-providers'
  AND p.category_id IS DISTINCT FROM c.id;


-- 20260414170000_outlook_integration_hub.sql
-- Microsoft Outlook (Integration Hub): per-user OAuth via user-oauth-connect / user-oauth-callback.
-- Distinct from MSAL / Teams admin SSO. Stores tokens in user_oauth_tokens (provider_slug outlook).

DO $$
DECLARE
  email_category_id UUID;
  outlook_provider_id UUID;
BEGIN
  SELECT id INTO email_category_id
  FROM public.integration_categories
  WHERE slug = 'email-providers'
  LIMIT 1;

  IF email_category_id IS NULL THEN
    RAISE EXCEPTION 'integration category email-providers not found';
  END IF;

  INSERT INTO public.integration_providers (
    category_id,
    name,
    slug,
    description,
    auth_type,
    oauth_config,
    docs_url,
    is_available,
    is_coming_soon,
    display_order
  )
  VALUES (
    email_category_id,
    'Microsoft Outlook',
    'outlook',
    'Connect Outlook mail and calendar via Microsoft Graph (delegated OAuth). Register an Entra app, then each user completes Connect.',
    'oauth2',
    '{
      "authorize_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      "scopes": [
        "openid", "profile", "email", "offline_access",
        "User.Read", "Mail.Read", "Mail.Send", "Calendars.ReadWrite"
      ],
      "default_scopes": [
        "openid", "profile", "email", "offline_access",
        "User.Read", "Mail.Read", "Mail.Send", "Calendars.ReadWrite"
      ]
    }'::jsonb,
    'https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview',
    true,
    false,
    15
  )
  ON CONFLICT (slug) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    auth_type = EXCLUDED.auth_type,
    oauth_config = COALESCE(integration_providers.oauth_config, EXCLUDED.oauth_config),
    docs_url = EXCLUDED.docs_url,
    is_available = EXCLUDED.is_available,
    is_coming_soon = EXCLUDED.is_coming_soon,
    display_order = COALESCE(integration_providers.display_order, EXCLUDED.display_order);

  SELECT id INTO outlook_provider_id
  FROM public.integration_providers
  WHERE slug = 'outlook'
  LIMIT 1;

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
  VALUES
    (
      outlook_provider_id,
      'client_id',
      'Application (client) ID',
      'text',
      'Entra app client ID',
      true,
      false,
      'From Microsoft Entra ID → App registrations → your app.',
      10
    ),
    (
      outlook_provider_id,
      'client_secret',
      'Client secret',
      'password',
      'Paste client secret value',
      true,
      true,
      'Create a client secret under Certificates & secrets. Redirect URI in Entra must include {SUPABASE_URL}/functions/v1/user-oauth-callback',
      20
    ),
    (
      outlook_provider_id,
      'tenant_id',
      'Directory (tenant) ID — optional',
      'text',
      'Leave blank for multi-tenant (/common)',
      false,
      false,
      'Single-tenant only: your tenant GUID. When set, authorize and token URLs use this tenant instead of /common.',
      30
    )
  ON CONFLICT (provider_id, field_key) DO UPDATE SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;
END $$;


-- 20260414193000_task_stream_admin_support.sql
-- Add stream-style metadata and role access rules on task_categories.

ALTER TABLE IF EXISTS task_categories
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'layers',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES task_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_task_categories_parent_id ON task_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_task_categories_is_active ON task_categories(is_active);

CREATE TABLE IF NOT EXISTS task_category_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES task_categories(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  access_level TEXT NOT NULL DEFAULT 'full' CHECK (access_level IN ('full', 'read_only')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (category_id, role_id, access_level)
);

ALTER TABLE task_category_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read task_category_roles" ON task_category_roles;
CREATE POLICY "Authenticated users can read task_category_roles"
  ON task_category_roles FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage task_category_roles" ON task_category_roles;
CREATE POLICY "Admins can manage task_category_roles"
  ON task_category_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );


-- 20260415044830_41ee2748-566a-42bc-b3b6-67a0efdd066d.sql

-- Insert Confluence provider
INSERT INTO public.integration_providers (
  category_id, name, slug, description, auth_type, docs_url,
  is_available, is_coming_soon, is_beta, display_order
)
SELECT id, 'Confluence', 'confluence',
  'Sync Confluence Cloud pages into the knowledge base (REST API + Basic auth)',
  'basic', 'https://developer.atlassian.com/cloud/confluence/rest/v1/intro/',
  true, false, false, 25
FROM public.integration_categories WHERE slug = 'storage-productivity'
ON CONFLICT (slug) DO UPDATE SET
  category_id = EXCLUDED.category_id, name = EXCLUDED.name,
  description = EXCLUDED.description, auth_type = EXCLUDED.auth_type,
  docs_url = EXCLUDED.docs_url, is_available = EXCLUDED.is_available,
  is_coming_soon = EXCLUDED.is_coming_soon, is_beta = EXCLUDED.is_beta,
  display_order = EXCLUDED.display_order;

-- Insert credential fields
INSERT INTO public.integration_fields (
  provider_id, field_key, label, field_type, placeholder,
  is_required, is_sensitive, help_text, display_order
)
SELECT p.id, v.field_key, v.label, v.field_type, v.placeholder,
  v.is_required, v.is_sensitive, v.help_text, v.display_order
FROM public.integration_providers p
CROSS JOIN (VALUES
  ('confluence_email'::text, 'Atlassian Email'::text, 'email'::text, 'you@company.com'::text, true::boolean, false::boolean, 'Your Atlassian account email address'::text, 10::integer),
  ('confluence_api_token', 'API Token', 'password', '', true, true, 'Create at id.atlassian.com → Security → API tokens', 20),
  ('confluence_domain', 'Confluence Domain', 'text', 'yourcompany.atlassian.net', true, false, 'Your Atlassian Cloud host (no https://), e.g. yourcompany.atlassian.net', 30),
  ('confluence_space_key', 'Space Key (optional)', 'text', 'MYSPACE', false, false, 'Limit sync to one space. Leave empty to sync pages from all spaces.', 40)
) AS v(field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
WHERE p.slug = 'confluence'
ON CONFLICT (provider_id, field_key) DO UPDATE SET
  label = EXCLUDED.label, field_type = EXCLUDED.field_type,
  placeholder = EXCLUDED.placeholder, is_required = EXCLUDED.is_required,
  is_sensitive = EXCLUDED.is_sensitive, help_text = EXCLUDED.help_text,
  display_order = EXCLUDED.display_order;


-- 20260415045813_f5632d7c-bc9a-469c-98b9-e1a7b798b31c.sql

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
    category_id, name, slug, description, auth_type, docs_url,
    is_available, is_coming_soon, is_beta, display_order
  ) VALUES (
    cat_id, 'Confluence', 'confluence',
    'Sync Confluence Cloud pages into the knowledge base (REST API + Basic auth)',
    'basic', 'https://developer.atlassian.com/cloud/confluence/rest/v1/intro/',
    true, false, false, 25
  )
  ON CONFLICT (slug) DO UPDATE SET
    category_id = EXCLUDED.category_id, name = EXCLUDED.name,
    description = EXCLUDED.description, auth_type = EXCLUDED.auth_type,
    docs_url = EXCLUDED.docs_url, is_available = EXCLUDED.is_available,
    is_coming_soon = EXCLUDED.is_coming_soon, is_beta = EXCLUDED.is_beta,
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
    provider_id, field_key, label, field_type, placeholder,
    is_required, is_sensitive, help_text, display_order
  )
  SELECT pid, v.field_key, v.label, v.field_type::text, v.placeholder,
    v.is_required, v.is_sensitive, v.help_text, v.display_order
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
    label = EXCLUDED.label, field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder, is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive, help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;
END $$;


