-- 20260413180000_ensure_crm_integration_category.sql
-- Some environments never received integration hub CRM rows; the UI only shows categories
-- from integration_categories WHERE enabled = true. Without crm-systems, Zoho never appears.

INSERT INTO public.integration_categories (name, slug, description, icon, display_order, enabled)
VALUES (
  'CRM Systems',
  'crm-systems',
  'Customer relationship management platforms',
  'Users',
  40,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  enabled = true,
  updated_at = now();

DO $$
DECLARE
  cat_crm UUID;
BEGIN
  SELECT id INTO cat_crm FROM public.integration_categories WHERE slug = 'crm-systems' LIMIT 1;
  IF cat_crm IS NULL THEN
    RAISE EXCEPTION 'crm-systems category missing after upsert';
  END IF;

  INSERT INTO public.integration_providers (
    category_id, name, slug, description, auth_type, oauth_config, docs_url, is_available, is_coming_soon, display_order
  ) VALUES
    (
      cat_crm,
      'Salesforce',
      'salesforce',
      'Enterprise CRM platform with comprehensive features',
      'oauth2',
      '{"authorize_url": "https://login.salesforce.com/services/oauth2/authorize", "token_url": "https://login.salesforce.com/services/oauth2/token", "scopes": ["api", "refresh_token", "offline_access"]}'::jsonb,
      'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest',
      false,
      true,
      10
    ),
    (
      cat_crm,
      'HubSpot',
      'hubspot',
      'Marketing, sales, and service CRM platform',
      'oauth2',
      '{"authorize_url": "https://app.hubspot.com/oauth/authorize", "token_url": "https://api.hubapi.com/oauth/v1/token", "scopes": ["crm.objects.contacts.read", "crm.objects.contacts.write"]}'::jsonb,
      'https://developers.hubspot.com/docs/api-reference/overview',
      false,
      true,
      20
    ),
    (
      cat_crm,
      'Pipedrive',
      'pipedrive',
      'Sales-focused CRM with simple interface',
      'api_key',
      NULL,
      'https://developers.pipedrive.com/docs/api/v1',
      false,
      true,
      30
    ),
    (
      cat_crm,
      'Zoho CRM',
      'zoho-crm',
      'Affordable CRM for small to medium businesses',
      'oauth2',
      '{"authorize_url": "https://accounts.zoho.com/oauth/v2/auth", "token_url": "https://accounts.zoho.com/oauth/v2/token", "scopes": ["ZohoCRM.modules.ALL", "ZohoCRM.settings.ALL"]}'::jsonb,
      'https://www.zoho.com/crm/developer/docs/api/v8',
      true,
      false,
      40
    )
  ON CONFLICT (slug) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    auth_type = EXCLUDED.auth_type,
    oauth_config = EXCLUDED.oauth_config,
    docs_url = EXCLUDED.docs_url,
    is_available = EXCLUDED.is_available,
    is_coming_soon = EXCLUDED.is_coming_soon,
    display_order = EXCLUDED.display_order,
    updated_at = now();
END $$;

-- Zoho credential form fields (ProviderDetail only renders the form when integration_fields exist).
-- Needed when 20260413120000 ran before zoho-crm row existed (fields insert was skipped).
DO $$
DECLARE
  zid UUID;
BEGIN
  SELECT id INTO zid FROM public.integration_providers WHERE slug = 'zoho-crm' LIMIT 1;
  IF zid IS NULL THEN
    RAISE NOTICE 'zoho-crm provider not found; skip integration_fields';
    RETURN;
  END IF;

  INSERT INTO public.integration_fields (
    provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order
  ) VALUES
    (zid, 'zoho_client_id', 'Zoho Client ID', 'text', '1000.xxx', true, false, 'From Zoho API Console (Server-based client)', 10),
    (zid, 'zoho_client_secret', 'Zoho Client Secret', 'password', '••••••••', true, true, 'Keep secret; stored in integration config', 20),
    (zid, 'zoho_redirect_uri', 'Redirect URI', 'url', 'https://…/functions/v1/user-oauth-callback', false, false, 'Must match Zoho API Console redirect URL', 30),
    (zid, 'zoho_accounts_url', 'Accounts domain (optional)', 'url', 'https://accounts.zoho.com', false, false, 'EU/IN/AU accounts host if not US', 40)
  ON CONFLICT (provider_id, field_key) DO UPDATE SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;
END $$;


-- 20260413193000_jira_task_sync_and_hub_fields.sql
-- Jira: API-key hub fields, task extensions, Jira comment columns, time logs.
-- Keeps existing integration_providers.oauth_config for jira (not dropped).

-- ---------------------------------------------------------------------------
-- Integration hub: Jira as api_key + form fields
-- ---------------------------------------------------------------------------
UPDATE public.integration_providers
SET
  auth_type = 'api_key',
  is_available = true,
  is_coming_soon = false
WHERE slug = 'jira';

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
  v.field_type::text,
  v.placeholder,
  v.is_required,
  v.is_sensitive,
  v.help_text,
  v.display_order
FROM public.integration_providers p
CROSS JOIN (VALUES
  ('jira_host', 'Jira site URL', 'url', 'https://your-domain.atlassian.net', true, false,
   'Your Jira Cloud site base URL (with or without https://). Must match JIRA_HOST secret for sync.', 10),
  ('jira_email', 'Atlassian account email', 'email', 'you@company.com', true, false,
   'Email for the Atlassian account used to create the API token. Same as JIRA_EMAIL secret.', 20),
  ('jira_api_token', 'API token', 'password', 'API token from id.atlassian.com', true, true,
   'Create at https://id.atlassian.com/manage-profile/security/api-tokens — also set as JIRA_API_TOKEN secret for Edge sync.', 30)
) AS v(field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
WHERE p.slug = 'jira'
ON CONFLICT (provider_id, field_key) DO UPDATE SET
  label = EXCLUDED.label,
  field_type = EXCLUDED.field_type,
  placeholder = EXCLUDED.placeholder,
  is_required = EXCLUDED.is_required,
  is_sensitive = EXCLUDED.is_sensitive,
  help_text = EXCLUDED.help_text,
  display_order = EXCLUDED.display_order;

-- ---------------------------------------------------------------------------
-- Tasks: work type (Jira issue type label) + index for Jira external id
-- ---------------------------------------------------------------------------
ALTER TABLE public.tasks  ADD COLUMN IF NOT EXISTS work_type TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_metadata_external_id
  ON public.tasks ((metadata->>'external_id'))
  WHERE metadata->>'external_id' IS NOT NULL;

COMMENT ON COLUMN public.tasks.work_type IS 'Issue type name when synced from Jira (or other PM tools)';

-- ---------------------------------------------------------------------------
-- Comments: optional user for Jira-imported rows; Jira ids and author display
-- ---------------------------------------------------------------------------
ALTER TABLE public.task_comments
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.task_comments
  ADD COLUMN IF NOT EXISTS jira_comment_id TEXT,
  ADD COLUMN IF NOT EXISTS jira_author_name TEXT,
  ADD COLUMN IF NOT EXISTS jira_author_email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_comments_task_jira_comment
  ON public.task_comments (task_id, jira_comment_id)
  WHERE jira_comment_id IS NOT NULL;

COMMENT ON COLUMN public.task_comments.jira_comment_id IS 'Jira comment id for idempotent sync';
COMMENT ON COLUMN public.task_comments.jira_author_name IS 'Jira display name when user_id is null';
COMMENT ON COLUMN public.task_comments.jira_author_email IS 'Jira author email when available';

-- ---------------------------------------------------------------------------
-- Time logs (Jira worklogs + future manual entries)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  hours NUMERIC NOT NULL CHECK (hours >= 0),
  started_at TIMESTAMPTZ,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_time_logs_task_id ON public.task_time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_time_logs_source ON public.task_time_logs(source);

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_time_logs_jira_worklog
  ON public.task_time_logs (task_id, ((metadata->>'jira_worklog_id')))
  WHERE source = 'jira' AND (metadata->>'jira_worklog_id') IS NOT NULL;

ALTER TABLE public.task_time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read task_time_logs"
  ON public.task_time_logs FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert task_time_logs"
  ON public.task_time_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own task_time_logs"
  ON public.task_time_logs FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete own task_time_logs"
  ON public.task_time_logs FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.task_time_logs IS 'Per-entry time tracking; Jira sync uses source=jira and metadata.jira_worklog_id';


-- 20260413210000_jira_integration_hub_visible.sql
-- Ensure Jira appears in Integration Hub (/admin/integrations): available, not "coming soon",
-- and present even if an environment skipped the original hub seed.

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
SELECT
  c.id,
  'Jira',
  'jira',
  'Issue tracking and project management by Atlassian (Jira Cloud API token)',
  'api_key',
  '{"authorize_url": "https://auth.atlassian.com/authorize", "token_url": "https://auth.atlassian.com/oauth/token", "scopes": ["read:jira-work", "write:jira-work"]}'::jsonb,
  'https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro',
  true,
  false,
  10
FROM public.integration_categories c
WHERE c.slug = 'project-management'
ON CONFLICT (slug) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  auth_type = 'api_key',
  oauth_config = COALESCE(integration_providers.oauth_config, EXCLUDED.oauth_config),
  docs_url = EXCLUDED.docs_url,
  is_available = true,
  is_coming_soon = false,
  display_order = COALESCE(integration_providers.display_order, EXCLUDED.display_order);

-- Credential form on /admin/integrations/jira (ProviderDetail needs integration_fields rows).
DO $$
DECLARE
  jid UUID;
BEGIN
  SELECT id INTO jid FROM public.integration_providers WHERE slug = 'jira' LIMIT 1;
  IF jid IS NULL THEN
    RAISE NOTICE 'jira provider not found; skip integration_fields';
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
    jid,
    v.field_key,
    v.label,
    v.field_type::text,
    v.placeholder,
    v.is_required,
    v.is_sensitive,
    v.help_text,
    v.display_order
  FROM (VALUES
    ('jira_host', 'Jira site URL', 'url', 'https://your-domain.atlassian.net', true, false,
     'Your Jira Cloud site base URL (with or without https://). Must match JIRA_HOST secret for sync.', 10),
    ('jira_email', 'Atlassian account email', 'email', 'you@company.com', true, false,
     'Email for the Atlassian account used to create the API token. Same as JIRA_EMAIL secret.', 20),
    ('jira_api_token', 'API token', 'password', 'API token from id.atlassian.com', true, true,
     'Create at https://id.atlassian.com/manage-profile/security/api-tokens — also set as JIRA_API_TOKEN secret for Edge sync.', 30)
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


-- 20260413220000_jira_integration_fields_ensure.sql
-- Repair: Jira provider existed but integration_fields were never inserted (e.g. provider
-- created after 20260413193000 field seed, or 20260413210000 applied before fields block existed).

DO $$
DECLARE
  jid UUID;
BEGIN
  SELECT id INTO jid FROM public.integration_providers WHERE slug = 'jira' LIMIT 1;
  IF jid IS NULL THEN
    RAISE NOTICE 'jira provider not found; skip integration_fields';
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
    jid,
    v.field_key,
    v.label,
    v.field_type::text,
    v.placeholder,
    v.is_required,
    v.is_sensitive,
    v.help_text,
    v.display_order
  FROM (VALUES
    ('jira_host', 'Jira site URL', 'url', 'https://your-domain.atlassian.net', true, false,
     'Your Jira Cloud site base URL (with or without https://). Must match JIRA_HOST secret for sync.', 10),
    ('jira_email', 'Atlassian account email', 'email', 'you@company.com', true, false,
     'Email for the Atlassian account used to create the API token. Same as JIRA_EMAIL secret.', 20),
    ('jira_api_token', 'API token', 'password', 'API token from id.atlassian.com', true, true,
     'Create at https://id.atlassian.com/manage-profile/security/api-tokens — also set as JIRA_API_TOKEN secret for Edge sync.', 30)
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


-- 20260414040859_391c10be-7af6-433f-ad11-a65d8006549d.sql
DO $$
DECLARE
  meeting_category_id UUID;
  fellow_provider_id UUID;
BEGIN
  SELECT id INTO meeting_category_id
  FROM public.integration_categories
  WHERE slug = 'meetings'
  LIMIT 1;

  IF meeting_category_id IS NULL THEN
    RAISE EXCEPTION 'integration category meetings not found';
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

-- 20260414041622_9ba9021c-f461-4883-8d41-87a2c85f1d9f.sql
UPDATE public.integration_providers AS p
SET category_id = c.id,
    updated_at = now()
FROM public.integration_categories AS c
WHERE p.slug = 'fellow'
  AND c.slug = 'meeting-providers'
  AND p.category_id IS DISTINCT FROM c.id;

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


-- 20260616153000_knowledge_file_manager.sql
-- Knowledge Base file/folder manager tables.
-- Mirrors KNOWLEDGEBASE_IMPLEMENTATION.md using Supabase/RLS for this Vite app.

CREATE TABLE IF NOT EXISTS public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  is_public BOOLEAN NOT NULL DEFAULT false,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  size BIGINT NOT NULL DEFAULT 0,
  file_count INTEGER NOT NULL DEFAULT 0,
  shared_with JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS folders_name_user_id_unique
ON public.folders (user_id, lower(name))
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_folders_user_created
ON public.folders (user_id, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_folders_shared_with
ON public.folders USING GIN (shared_with);

CREATE TABLE IF NOT EXISTS public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID NULL REFERENCES public.folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  path TEXT NOT NULL,
  url TEXT NOT NULL,
  s3_key TEXT NULL,
  storage_type TEXT NOT NULL DEFAULT 'local' CHECK (storage_type IN ('local', 's3')),
  is_public BOOLEAN NOT NULL DEFAULT false,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  openai JSONB NULL,
  shared_with JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_files_user_created
ON public.files (user_id, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_files_user_folder
ON public.files (user_id, folder_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_files_user_type
ON public.files (user_id, type)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_files_storage_type
ON public.files (storage_type);

CREATE INDEX IF NOT EXISTS idx_files_shared_with
ON public.files USING GIN (shared_with);

CREATE OR REPLACE FUNCTION public.update_knowledge_manager_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS folders_updated_at ON public.folders;
CREATE TRIGGER folders_updated_at
BEFORE UPDATE ON public.folders
FOR EACH ROW
EXECUTE FUNCTION public.update_knowledge_manager_updated_at();

DROP TRIGGER IF EXISTS files_updated_at ON public.files;
CREATE TRIGGER files_updated_at
BEFORE UPDATE ON public.files
FOR EACH ROW
EXECUTE FUNCTION public.update_knowledge_manager_updated_at();

CREATE OR REPLACE FUNCTION public.refresh_knowledge_folder_stats(folder_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF folder_uuid IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.folders
  SET
    size = COALESCE((
      SELECT SUM(size)
      FROM public.files
      WHERE folder_id = folder_uuid AND deleted_at IS NULL
    ), 0),
    file_count = COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM public.files
      WHERE folder_id = folder_uuid AND deleted_at IS NULL
    ), 0)
  WHERE id = folder_uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_knowledge_folder_stats_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.refresh_knowledge_folder_stats(NEW.folder_id);
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.refresh_knowledge_folder_stats(OLD.folder_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS files_refresh_folder_stats ON public.files;
CREATE TRIGGER files_refresh_folder_stats
AFTER INSERT OR UPDATE OR DELETE ON public.files
FOR EACH ROW
EXECUTE FUNCTION public.refresh_knowledge_folder_stats_trigger();

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read owned or shared folders" ON public.folders;
CREATE POLICY "Users can read owned or shared folders"
ON public.folders FOR SELECT
USING (
  deleted_at IS NULL
  AND (
    user_id = auth.uid()
    OR is_public
    OR shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
  )
);

DROP POLICY IF EXISTS "Users can create own folders" ON public.folders;
CREATE POLICY "Users can create own folders"
ON public.folders FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners and write shares can update folders" ON public.folders;
CREATE POLICY "Owners and write shares can update folders"
ON public.folders FOR UPDATE
USING (
  user_id = auth.uid()
  OR shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text, 'permissions', 'write'))
)
WITH CHECK (
  user_id = auth.uid()
  OR shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text, 'permissions', 'write'))
);

DROP POLICY IF EXISTS "Owners can delete folders" ON public.folders;
CREATE POLICY "Owners can delete folders"
ON public.folders FOR DELETE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read owned shared or folder shared files" ON public.files;
CREATE POLICY "Users can read owned shared or folder shared files"
ON public.files FOR SELECT
USING (
  deleted_at IS NULL
  AND (
    user_id = auth.uid()
    OR is_public
    OR shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
    OR EXISTS (
      SELECT 1
      FROM public.folders
      WHERE folders.id = files.folder_id
        AND folders.deleted_at IS NULL
        AND (
          folders.user_id = auth.uid()
          OR folders.is_public
          OR folders.shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
        )
    )
  )
);

DROP POLICY IF EXISTS "Users can create own files" ON public.files;
CREATE POLICY "Users can create own files"
ON public.files FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners and write shares can update files" ON public.files;
CREATE POLICY "Owners and write shares can update files"
ON public.files FOR UPDATE
USING (
  user_id = auth.uid()
  OR shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text, 'permissions', 'write'))
  OR EXISTS (
    SELECT 1
    FROM public.folders
    WHERE folders.id = files.folder_id
      AND folders.shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text, 'permissions', 'write'))
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text, 'permissions', 'write'))
  OR EXISTS (
    SELECT 1
    FROM public.folders
    WHERE folders.id = files.folder_id
      AND folders.shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text, 'permissions', 'write'))
  )
);

DROP POLICY IF EXISTS "Owners can delete files" ON public.files;
CREATE POLICY "Owners can delete files"
ON public.files FOR DELETE
USING (user_id = auth.uid());

INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledgebase', 'knowledgebase', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Knowledgebase users can read storage objects" ON storage.objects;
CREATE POLICY "Knowledgebase users can read storage objects"
ON storage.objects FOR SELECT
USING (bucket_id = 'knowledgebase');

DROP POLICY IF EXISTS "Knowledgebase users can upload own storage objects" ON storage.objects;
CREATE POLICY "Knowledgebase users can upload own storage objects"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'knowledgebase'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Knowledgebase users can update own storage objects" ON storage.objects;
CREATE POLICY "Knowledgebase users can update own storage objects"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'knowledgebase'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'knowledgebase'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Knowledgebase users can delete own storage objects" ON storage.objects;
CREATE POLICY "Knowledgebase users can delete own storage objects"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'knowledgebase'
  AND (storage.foldername(name))[1] = auth.uid()::text
);


-- 20260617090000_integration_settings_primary_by_category.sql
-- ============================================
-- Integration Preferences — per-category primary integration with multi-source
-- ============================================

ALTER TABLE public.integration_settings
  ADD COLUMN IF NOT EXISTS primary_by_category JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.integration_settings.primary_by_category IS
  'Per-category integration preferences: { [category_slug]: { primary_slug: string | null, active_slugs: string[] } }. Supersedes primary_integrations, which is kept for backward-compatible reads.';


-- 20260617120000_branding_assets_and_config.sql
-- Migration: Branding Assets Bucket + Extended Branding Config
-- Creates the branding-assets storage bucket and seeds new app_config branding keys

-- ============================================================
-- 1. Create branding-assets storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'branding-assets',
  'branding-assets',
  true,
  10485760, -- 10 MB max file size
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/svg+xml',
    'image/x-icon',
    'image/vnd.microsoft.icon',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. RLS policies for branding-assets bucket
-- ============================================================

-- Allow authenticated users to read all branding assets (public logos etc.)
CREATE POLICY "Authenticated users can read branding assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'branding-assets');

-- Allow anonymous users to read branding assets (needed for login page before auth)
CREATE POLICY "Public read access for branding assets"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'branding-assets');

-- Only admins can upload branding assets
CREATE POLICY "Admins can upload branding assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'branding-assets'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can update branding assets
CREATE POLICY "Admins can update branding assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'branding-assets'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can delete branding assets
CREATE POLICY "Admins can delete branding assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'branding-assets'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- ============================================================
-- 3. Seed new app_config branding keys
--    Uses ON CONFLICT DO NOTHING so existing values are preserved
-- ============================================================
INSERT INTO public.app_config (key, value, category, description, is_sensitive)
VALUES
  (
    'branding.primaryColor',
    '"#6366f1"',
    'branding',
    'Primary brand color used for buttons, links, and accents',
    false
  ),
  (
    'branding.secondaryColor',
    '""',
    'branding',
    'Secondary brand color used for supporting UI elements',
    false
  ),
  (
    'branding.faviconUrl',
    'null',
    'branding',
    'URL to the favicon (ICO or PNG)',
    false
  ),
  (
    'branding.emailFromName',
    '"Control Tower"',
    'branding',
    'Display name used in outgoing email From field',
    false
  ),
  (
    'branding.replyToEmail',
    '""',
    'branding',
    'Reply-to email address for outgoing notifications',
    false
  ),
  (
    'branding.loginMessage',
    '"Welcome to Control Tower"',
    'branding',
    'Welcome message displayed on the login page',
    false
  ),
  (
    'branding.loginBackgroundUrl',
    'null',
    'branding',
    'URL to the login page background image',
    false
  )
ON CONFLICT (key) DO NOTHING;


-- 20260617120000_kb_rag_enhancement.sql
-- ============================================================================
-- RAG Enhancement: kb_source_config, eval, reembed, permissions, memory admin
-- ============================================================================

-- Per-source chunking + reranker configuration
CREATE TABLE IF NOT EXISTS public.kb_source_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
  chunk_size INTEGER NOT NULL DEFAULT 1000,
  chunk_overlap INTEGER NOT NULL DEFAULT 100,
  chunk_strategy TEXT NOT NULL DEFAULT 'fixed'
    CHECK (chunk_strategy IN ('fixed', 'sentence-window', 'heading-aware', 'parent-child')),
  strategy_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  reranker_provider TEXT DEFAULT 'cohere'
    CHECK (reranker_provider IS NULL OR reranker_provider IN ('cohere', 'voyage', 'bge', 'custom')),
  reranker_threshold NUMERIC(4,3) DEFAULT 0.75,
  reranker_max_results INTEGER DEFAULT 10,
  reranker_enabled BOOLEAN DEFAULT false,
  reranker_override_global BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id)
);

CREATE INDEX IF NOT EXISTS idx_kb_source_config_source ON public.kb_source_config(source_id);

-- RAG evaluation runs
CREATE TABLE IF NOT EXISTS public.kb_eval_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  answer TEXT,
  retrieval_latency_ms INTEGER,
  rerank_latency_ms INTEGER,
  generation_latency_ms INTEGER,
  latency_ms INTEGER,
  cost NUMERIC(12,6) DEFAULT 0,
  source_id UUID REFERENCES public.knowledge_sources(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_eval_runs_created_at ON public.kb_eval_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_eval_runs_created_by ON public.kb_eval_runs(created_by);

CREATE TABLE IF NOT EXISTS public.kb_eval_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.kb_eval_runs(id) ON DELETE CASCADE,
  chunk_id UUID,
  chunk_preview TEXT,
  similarity_score NUMERIC(6,5),
  rerank_score NUMERIC(6,5),
  source_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_eval_results_run ON public.kb_eval_results(run_id);
CREATE INDEX IF NOT EXISTS idx_kb_eval_results_chunk ON public.kb_eval_results(chunk_id);

CREATE TABLE IF NOT EXISTS public.kb_eval_test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  expected_answer TEXT,
  run_id UUID REFERENCES public.kb_eval_runs(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_eval_test_cases_created_at ON public.kb_eval_test_cases(created_at DESC);

-- Bulk re-embed jobs
CREATE TABLE IF NOT EXISTS public.kb_reembed_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'paused', 'completed', 'cancelled', 'failed')),
  total_documents INTEGER DEFAULT 0,
  processed_documents INTEGER DEFAULT 0,
  failed_documents INTEGER DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_reembed_jobs_source ON public.kb_reembed_jobs(source_id);
CREATE INDEX IF NOT EXISTS idx_kb_reembed_jobs_status ON public.kb_reembed_jobs(status);

CREATE TABLE IF NOT EXISTS public.kb_reembed_job_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.kb_reembed_jobs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_reembed_job_items_job ON public.kb_reembed_job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_kb_reembed_job_items_status ON public.kb_reembed_job_items(job_id, status);

-- Source-level permissions
CREATE TABLE IF NOT EXISTS public.kb_source_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
  app_role public.app_role,
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  permissions JSONB NOT NULL DEFAULT '["view"]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT kb_source_permissions_target_check CHECK (
    app_role IS NOT NULL OR role_id IS NOT NULL OR pod_id IS NOT NULL OR department_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_kb_source_permissions_source ON public.kb_source_permissions(source_id);
CREATE INDEX IF NOT EXISTS idx_kb_source_permissions_role ON public.kb_source_permissions(source_id, app_role);
CREATE INDEX IF NOT EXISTS idx_kb_source_permissions_pod ON public.kb_source_permissions(source_id, pod_id);
CREATE INDEX IF NOT EXISTS idx_kb_source_permissions_dept ON public.kb_source_permissions(source_id, department_id);

-- Agent memories soft delete
ALTER TABLE public.agent_memories
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agent_memories_not_deleted
  ON public.agent_memories(user_id) WHERE deleted_at IS NULL;

-- Sync attempt tracking on knowledge files
ALTER TABLE public.knowledge_files
  ADD COLUMN IF NOT EXISTS last_sync_attempt_at TIMESTAMPTZ;

-- Updated_at triggers
DROP TRIGGER IF EXISTS set_kb_source_config_updated_at ON public.kb_source_config;
CREATE TRIGGER set_kb_source_config_updated_at
  BEFORE UPDATE ON public.kb_source_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_kb_reembed_jobs_updated_at ON public.kb_reembed_jobs;
CREATE TRIGGER set_kb_reembed_jobs_updated_at
  BEFORE UPDATE ON public.kb_reembed_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_kb_source_permissions_updated_at ON public.kb_source_permissions;
CREATE TRIGGER set_kb_source_permissions_updated_at
  BEFORE UPDATE ON public.kb_source_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default config for existing sources
INSERT INTO public.kb_source_config (source_id, chunk_size, chunk_overlap, chunk_strategy)
SELECT id, 1000, 100, 'fixed'
FROM public.knowledge_sources
ON CONFLICT (source_id) DO NOTHING;

-- Global RAG reranker defaults
INSERT INTO public.system_settings (category, key, value, description)
VALUES
  ('rag', 'reranker_provider', '"cohere"'::jsonb, 'Default reranker provider'),
  ('rag', 'reranker_threshold', '0.75'::jsonb, 'Default reranker score threshold'),
  ('rag', 'reranker_max_results', '10'::jsonb, 'Default max reranked results'),
  ('rag', 'reranker_enabled', 'false'::jsonb, 'Enable reranking globally')
ON CONFLICT (category, key) DO NOTHING;

-- ============================================================================
-- RPC: check_kb_source_permission
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_kb_source_permission(
  p_source_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_admin BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT public.has_role(v_user_id, 'admin') INTO v_is_admin;
  IF v_is_admin THEN
    RETURN true;
  END IF;

  -- No rows = permissive default (backward compatible)
  IF NOT EXISTS (SELECT 1 FROM kb_source_permissions WHERE source_id = p_source_id) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM kb_source_permissions sp
    WHERE sp.source_id = p_source_id
      AND sp.permissions ? p_permission
      AND (
        (sp.app_role IS NOT NULL AND public.has_role(v_user_id, sp.app_role))
        OR (sp.pod_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM pod_members pm
          WHERE pm.pod_id = sp.pod_id AND pm.user_id = v_user_id
        ))
        OR (sp.department_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM employee_profiles ep
          WHERE ep.user_id = v_user_id AND ep.department_id = sp.department_id
        ))
      )
  );
END;
$$;

-- ============================================================================
-- RPC: admin_list_user_memories
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_user_memories(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  agent_id UUID,
  user_id UUID,
  memory_type TEXT,
  memory_category TEXT,
  content TEXT,
  importance_score DOUBLE PRECISION,
  confidence_score DOUBLE PRECISION,
  source TEXT,
  created_at TIMESTAMPTZ,
  user_email TEXT,
  department_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.agent_id,
    m.user_id,
    m.memory_type,
    m.memory_category,
    m.content,
    m.importance_score,
    m.importance_score AS confidence_score,
    COALESCE(m.source_type, 'agent')::TEXT AS source,
    m.created_at,
    p.email AS user_email,
    d.name AS department_name
  FROM agent_memories m
  JOIN profiles p ON p.id = m.user_id
  LEFT JOIN employee_profiles ep ON ep.user_id = m.user_id
  LEFT JOIN departments d ON d.id = ep.department_id
  WHERE m.user_id = p_user_id
    AND m.deleted_at IS NULL
  ORDER BY m.created_at DESC;
END;
$$;

-- ============================================================================
-- RPC: admin_export_user_memories
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_export_user_memories(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT jsonb_build_object(
    'exported_at', now(),
    'user_id', p_user_id,
    'agent_memories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id,
        'memory_type', m.memory_type,
        'memory_category', m.memory_category,
        'content', m.content,
        'importance_score', m.importance_score,
        'created_at', m.created_at
      ))
      FROM agent_memories m
      WHERE m.user_id = p_user_id AND m.deleted_at IS NULL
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.kb_source_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_eval_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_eval_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_eval_test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_reembed_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_reembed_job_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_source_permissions ENABLE ROW LEVEL SECURITY;

-- kb_source_config
CREATE POLICY "Admins manage kb_source_config"
  ON public.kb_source_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read kb_source_config"
  ON public.kb_source_config FOR SELECT TO authenticated
  USING (true);

-- kb_eval_*
CREATE POLICY "Admins manage kb_eval_runs"
  ON public.kb_eval_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage kb_eval_results"
  ON public.kb_eval_results FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage kb_eval_test_cases"
  ON public.kb_eval_test_cases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- kb_reembed_*
CREATE POLICY "Admins manage kb_reembed_jobs"
  ON public.kb_reembed_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage kb_reembed_job_items"
  ON public.kb_reembed_job_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- kb_source_permissions
CREATE POLICY "Admins manage kb_source_permissions"
  ON public.kb_source_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read kb_source_permissions"
  ON public.kb_source_permissions FOR SELECT TO authenticated
  USING (true);

-- Tighten knowledge_sources write to admin only
DROP POLICY IF EXISTS "Authenticated users can manage sources" ON public.knowledge_sources;
CREATE POLICY "Admins manage knowledge_sources"
  ON public.knowledge_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Tighten embedding_queue write to admin only
DROP POLICY IF EXISTS "Authenticated users can manage queue" ON public.embedding_queue;
CREATE POLICY "Admins manage embedding_queue"
  ON public.embedding_queue FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.kb_source_config IS 'Per-source chunking and reranker configuration for RAG pipeline';


-- 20260617120839_f5fba990-40a7-4c93-b5f4-e00909af667a.sql
ALTER TABLE public.integration_settings
  ADD COLUMN IF NOT EXISTS primary_by_category JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 20260617130000_document_parser_tables.sql
-- Migration: Document Parser Tables
-- Creates parsed_documents, document_pages, document_tables, document_images
-- Also fixes pre-existing schema issues in embedding_queue and knowledge_files

-- ============================================================
-- 1. parsed_documents — one row per processed file
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parsed_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Source reference (polymorphic)
  source_type TEXT NOT NULL CHECK (source_type IN ('knowledge_file', 'unified_document', 'user_knowledge_file')),
  source_id UUID NOT NULL,
  -- File info
  file_name TEXT,
  mime_type TEXT,
  -- Parsing status
  parse_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (parse_status IN ('pending', 'processing', 'completed', 'failed')),
  parse_version TEXT NOT NULL DEFAULT 'v1',
  parse_errors JSONB,
  -- Result summary
  page_count INTEGER DEFAULT 0,
  table_count INTEGER DEFAULT 0,
  image_count INTEGER DEFAULT 0,
  word_count INTEGER DEFAULT 0,
  -- Timestamps
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parsed_documents_source ON public.parsed_documents (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_parsed_documents_status ON public.parsed_documents (parse_status);
CREATE INDEX IF NOT EXISTS idx_parsed_documents_version ON public.parsed_documents (parse_version);

ALTER TABLE public.parsed_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage parsed_documents"
  ON public.parsed_documents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can read parsed_documents"
  ON public.parsed_documents FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 2. document_pages — extracted page content
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.parsed_documents(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_pages_document ON public.document_pages (document_id);
CREATE INDEX IF NOT EXISTS idx_document_pages_number ON public.document_pages (document_id, page_number);

ALTER TABLE public.document_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage document_pages"
  ON public.document_pages FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can read document_pages"
  ON public.document_pages FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 3. document_tables — extracted tabular data
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.parsed_documents(id) ON DELETE CASCADE,
  page_number INTEGER,
  table_index INTEGER NOT NULL DEFAULT 0,
  headers TEXT[] DEFAULT '{}',
  rows JSONB DEFAULT '[]'::jsonb,
  markdown_repr TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_tables_document ON public.document_tables (document_id);

ALTER TABLE public.document_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage document_tables"
  ON public.document_tables FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can read document_tables"
  ON public.document_tables FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 4. document_images — extracted image metadata
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.parsed_documents(id) ON DELETE CASCADE,
  page_number INTEGER,
  image_index INTEGER NOT NULL DEFAULT 0,
  caption TEXT,
  ocr_text TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_images_document ON public.document_images (document_id);

ALTER TABLE public.document_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage document_images"
  ON public.document_images FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can read document_images"
  ON public.document_images FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 5. Add parse_version to knowledge_files and unified_documents
-- ============================================================
ALTER TABLE public.knowledge_files
  ADD COLUMN IF NOT EXISTS parse_version TEXT DEFAULT 'v0';

ALTER TABLE public.unified_documents
  ADD COLUMN IF NOT EXISTS parse_version TEXT DEFAULT 'v0';

-- v0 = processed by old Blob.text() path, v1 = processed by kb-document-parser

-- ============================================================
-- 6. Fix embedding_queue CHECK constraint
--    Old: ('file','entry','meeting','user_file')
--    New: also allows 'knowledge_file','knowledge_entry','unified_document','task'
-- ============================================================
ALTER TABLE public.embedding_queue
  DROP CONSTRAINT IF EXISTS embedding_queue_entity_type_check;

ALTER TABLE public.embedding_queue
  ADD CONSTRAINT embedding_queue_entity_type_check
  CHECK (entity_type IN (
    'file', 'entry', 'meeting', 'user_file', 'task',
    'knowledge_file', 'knowledge_entry', 'unified_document'
  ));

-- ============================================================
-- 7. Updated_at trigger for parsed_documents
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_parsed_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER parsed_documents_updated_at
  BEFORE UPDATE ON public.parsed_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_parsed_documents_updated_at();


