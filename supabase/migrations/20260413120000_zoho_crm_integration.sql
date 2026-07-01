-- Zoho CRM: enable provider, admin fields, cache tables for deal detail tabs

-- 1) Provider availability + OAuth scopes (settings API used for token validation)
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

-- 2) Integration fields for org/user OAuth admin UI (client credentials in config)
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
