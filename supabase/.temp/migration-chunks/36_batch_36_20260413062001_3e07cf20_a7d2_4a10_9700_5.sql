-- 20260402121618_1af436eb-1b65-4a35-b39a-70c7040a9fdf.sql
DO $$
DECLARE
  cat_pm UUID;
  provider_activecollab UUID;
BEGIN
  SELECT id INTO cat_pm FROM public.integration_categories WHERE slug = 'project-management' LIMIT 1;
  IF cat_pm IS NULL THEN
    RAISE NOTICE 'Project Management category not found, skipping ActiveCollab setup';
    RETURN;
  END IF;
  SELECT id INTO provider_activecollab FROM public.integration_providers WHERE slug = 'activecollab' LIMIT 1;
  IF provider_activecollab IS NULL THEN
    INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, oauth_config, docs_url, is_available, is_coming_soon, display_order)
    VALUES (cat_pm, 'ActiveCollab', 'activecollab', 'Project management and task tracking with time tracking and invoicing', 'oauth2', '{"authorize_url":"https://app.activecollab.com/auth/login","token_url":"https://app.activecollab.com/api/v1/external/login","userinfo_url":"https://app.activecollab.com/api/v1/users/me","response_type":"code"}'::jsonb, 'https://developers.activecollab.com/api-documentation/index.html', true, false, 55)
    RETURNING id INTO provider_activecollab;
  ELSE
    UPDATE public.integration_providers SET category_id = cat_pm, auth_type = 'oauth2', oauth_config = COALESCE(oauth_config, '{"authorize_url":"https://app.activecollab.com/auth/login","token_url":"https://app.activecollab.com/api/v1/external/login","userinfo_url":"https://app.activecollab.com/api/v1/users/me","response_type":"code"}'::jsonb), docs_url = COALESCE(docs_url, 'https://developers.activecollab.com/api-documentation/index.html'), is_available = true, is_coming_soon = false WHERE id = provider_activecollab;
  END IF;
  INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order) VALUES (provider_activecollab, 'base_url', 'Base URL', 'url', 'https://your-company.activecollab.com', true, false, 'Your ActiveCollab instance base URL. OAuth and API calls are resolved from this URL.', 10) ON CONFLICT (provider_id, field_key) DO UPDATE SET label = EXCLUDED.label, field_type = EXCLUDED.field_type, placeholder = EXCLUDED.placeholder, is_required = EXCLUDED.is_required, is_sensitive = EXCLUDED.is_sensitive, help_text = EXCLUDED.help_text, display_order = EXCLUDED.display_order;
  INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order) VALUES (provider_activecollab, 'client_id', 'Client ID', 'text', 'activecollab_client_id', true, false, 'OAuth client id for your ActiveCollab app.', 20) ON CONFLICT (provider_id, field_key) DO UPDATE SET label = EXCLUDED.label, field_type = EXCLUDED.field_type, placeholder = EXCLUDED.placeholder, is_required = EXCLUDED.is_required, is_sensitive = EXCLUDED.is_sensitive, help_text = EXCLUDED.help_text, display_order = EXCLUDED.display_order;
  INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order) VALUES (provider_activecollab, 'client_secret', 'Client Secret', 'password', '****************', true, true, 'OAuth client secret for your ActiveCollab app.', 30) ON CONFLICT (provider_id, field_key) DO UPDATE SET label = EXCLUDED.label, field_type = EXCLUDED.field_type, placeholder = EXCLUDED.placeholder, is_required = EXCLUDED.is_required, is_sensitive = EXCLUDED.is_sensitive, help_text = EXCLUDED.help_text, display_order = EXCLUDED.display_order;
END;
$$;

-- 20260403120000_activecollab_token_auth.sql
-- ActiveCollab uses API token auth (issue-token), not OAuth2.
-- See: https://developers.activecollab.com/api-documentation/v1/authentication.html

DO $$
DECLARE
  pid UUID;
BEGIN
  SELECT id INTO pid FROM public.integration_providers WHERE slug = 'activecollab' LIMIT 1;
  IF pid IS NULL THEN
    RAISE NOTICE 'ActiveCollab provider not found, skipping token-auth migration';
    RETURN;
  END IF;

  UPDATE public.integration_providers
  SET
    auth_type = 'api_key',
    oauth_config = NULL,
    docs_url = COALESCE(
      docs_url,
      'https://developers.activecollab.com/api-documentation/v1/authentication.html'
    )
  WHERE id = pid;

  DELETE FROM public.integration_fields
  WHERE provider_id = pid AND field_key IN ('client_id', 'client_secret');

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
  VALUES (
    pid,
    'base_url',
    'Base URL',
    'url',
    'https://your-company.activecollab.com',
    true,
    false,
    'Your ActiveCollab instance base URL (API lives under /api/v1).',
    10
  )
  ON CONFLICT (provider_id, field_key) DO UPDATE
  SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
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
  VALUES (
    pid,
    'client_name',
    'Client name',
    'text',
    'Control Tower',
    true,
    false,
    'Application name sent to ActiveCollab when issuing an API token (see issue-token API).',
    20
  )
  ON CONFLICT (provider_id, field_key) DO UPDATE
  SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
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
  VALUES (
    pid,
    'client_vendor',
    'Client vendor',
    'text',
    'Your company name',
    true,
    false,
    'Vendor name sent to ActiveCollab when issuing an API token (see issue-token API).',
    30
  )
  ON CONFLICT (provider_id, field_key) DO UPDATE
  SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;
END;
$$;


-- 20260410082812_85eee214-9df7-4e50-b7fa-c5f053fa2299.sql
-- Add project_id column to tasks table for ActiveCollab sync
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Add index for join performance
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);

-- 20260413051814_8b6e680a-b77b-495a-9587-64d4fbc3c905.sql

-- 1) Provider availability + OAuth scopes
UPDATE public.integration_providers
SET
  is_available = true,
  is_coming_soon = false,
  oauth_config = jsonb_set(
    COALESCE(oauth_config, '{}'::jsonb),
    '{scopes}',
    '["ZohoCRM.modules.ALL", "ZohoCRM.settings.ALL"]'::jsonb,
    true
  )
WHERE slug = 'zoho-crm';

-- 2) Integration fields for org/user OAuth admin UI
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

-- 3) Deal tab cache tables
CREATE TABLE IF NOT EXISTS public.zoho_deal_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  zoho_attachment_id TEXT NOT NULL,
  file_name TEXT,
  size_bytes BIGINT,
  content_type TEXT,
  download_url TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, zoho_attachment_id)
);

CREATE TABLE IF NOT EXISTS public.zoho_deal_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  zoho_module TEXT NOT NULL,
  zoho_record_id TEXT NOT NULL,
  title TEXT,
  content TEXT,
  activity_type TEXT,
  occurred_at TIMESTAMPTZ,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, zoho_module, zoho_record_id)
);

CREATE TABLE IF NOT EXISTS public.zoho_deal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  zoho_event_id TEXT NOT NULL,
  title TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  location TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, zoho_event_id)
);

CREATE TABLE IF NOT EXISTS public.zoho_contact_enrichment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  zoho_contact_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id)
);

CREATE TABLE IF NOT EXISTS public.zoho_account_enrichment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  zoho_account_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id)
);

CREATE INDEX IF NOT EXISTS idx_zoho_deal_attachments_deal ON public.zoho_deal_attachments(deal_id);
CREATE INDEX IF NOT EXISTS idx_zoho_deal_engagements_deal ON public.zoho_deal_engagements(deal_id);
CREATE INDEX IF NOT EXISTS idx_zoho_deal_events_deal ON public.zoho_deal_events(deal_id);
CREATE INDEX IF NOT EXISTS idx_zoho_contact_enrichment_deal ON public.zoho_contact_enrichment(deal_id);
CREATE INDEX IF NOT EXISTS idx_zoho_account_enrichment_deal ON public.zoho_account_enrichment(deal_id);

ALTER TABLE public.zoho_deal_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoho_deal_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoho_deal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoho_contact_enrichment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoho_account_enrichment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage zoho_deal_attachments" ON public.zoho_deal_attachments;
CREATE POLICY "Authenticated users can manage zoho_deal_attachments"
  ON public.zoho_deal_attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage zoho_deal_engagements" ON public.zoho_deal_engagements;
CREATE POLICY "Authenticated users can manage zoho_deal_engagements"
  ON public.zoho_deal_engagements FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage zoho_deal_events" ON public.zoho_deal_events;
CREATE POLICY "Authenticated users can manage zoho_deal_events"
  ON public.zoho_deal_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage zoho_contact_enrichment" ON public.zoho_contact_enrichment;
CREATE POLICY "Authenticated users can manage zoho_contact_enrichment"
  ON public.zoho_contact_enrichment FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage zoho_account_enrichment" ON public.zoho_account_enrichment;
CREATE POLICY "Authenticated users can manage zoho_account_enrichment"
  ON public.zoho_account_enrichment FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 20260413051937_5e63e5e9-e58d-4512-8e85-f4bd80092418.sql

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


-- 20260413052523_767e4865-c67e-46a4-b76f-eebe21439f1d.sql

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


-- 20260413060240_0f447365-0847-4d84-a91b-67233098e7ab.sql
-- Jira: API-key hub fields, task extensions, Jira comment columns, time logs.
-- Keeps existing integration_providers.oauth_config for jira (not dropped).

-- ---------------------------------------------------------------------------
-- Integration hub: Jira as api_key + form fields
-- ---------------------------------------------------------------------------
UPDATE public.integration_providers
SET auth_type = 'api_key'
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

-- 20260413060903_d731dc93-39f7-4951-9932-6fd5eb662f12.sql
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

-- 20260413062001_3e07cf20-a7d2-4a10-9700-5b518d91d076.sql
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

