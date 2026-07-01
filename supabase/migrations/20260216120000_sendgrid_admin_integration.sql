-- ============================================================================
-- SendGrid Admin Integration
-- integrations table for status tracking, sendgrid_config cleanup (no API key in DB)
-- ============================================================================

-- Simple integrations table for status (slug, name, status, last_sync)
-- Used by dedicated SendGrid admin page - not the generic Integration Hub
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('connected', 'disconnected', 'error')),
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integrations_slug ON integrations(slug);

CREATE TRIGGER set_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view integrations"
  ON integrations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage integrations"
  ON integrations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed SendGrid integration row
INSERT INTO integrations (slug, name, status)
VALUES ('sendgrid', 'SendGrid', 'disconnected')
ON CONFLICT (slug) DO NOTHING;

-- API key: support UI submission for now (optional; also supports Supabase secrets)
-- Remove old encrypted column if present, add plain api_key for UI
ALTER TABLE sendgrid_config DROP COLUMN IF EXISTS api_key_encrypted;
ALTER TABLE sendgrid_config ADD COLUMN IF NOT EXISTS api_key TEXT;

-- Update get_or_create_sendgrid_config
CREATE OR REPLACE FUNCTION get_or_create_sendgrid_config()
RETURNS sendgrid_config AS $$
DECLARE config sendgrid_config;
BEGIN
  SELECT * INTO config FROM sendgrid_config LIMIT 1;
  IF config IS NULL THEN
    INSERT INTO sendgrid_config (from_email, from_name, is_enabled, webhook_url, webhook_secret, enable_open_tracking, enable_click_tracking)
    VALUES ('noreply@sjinnovation.com', 'SJ Innovation', false, NULL, NULL, true, true)
    RETURNING * INTO config;
  END IF;
  RETURN config;
END;
$$ LANGUAGE plpgsql;
