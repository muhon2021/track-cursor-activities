-- ============================================================================
-- Create SendGrid Configuration Table
-- ============================================================================
-- Singleton table for SendGrid integration configuration. Stores API keys,
-- webhook settings, and tracking preferences.
-- ============================================================================

CREATE TABLE IF NOT EXISTS sendgrid_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_encrypted TEXT,
  from_email TEXT DEFAULT 'noreply@sjinnovation.com',
  from_name TEXT DEFAULT 'SJ Innovation',
  is_enabled BOOLEAN DEFAULT false,
  webhook_url TEXT,
  webhook_secret TEXT,
  enable_open_tracking BOOLEAN DEFAULT true,
  enable_click_tracking BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index (should only be one row)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sendgrid_config_single ON sendgrid_config ((1));

-- Enable RLS
ALTER TABLE sendgrid_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view config" ON sendgrid_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can manage config" ON sendgrid_config FOR ALL TO authenticated
  USING (has_role('admin'::app_role)) WITH CHECK (has_role('admin'::app_role));

-- Create function to get or create default config
CREATE OR REPLACE FUNCTION get_or_create_sendgrid_config()
RETURNS sendgrid_config AS $$
DECLARE
  config sendgrid_config;
BEGIN
  SELECT * INTO config FROM sendgrid_config LIMIT 1;

  IF config IS NULL THEN
    INSERT INTO sendgrid_config (
      api_key_encrypted,
      from_email,
      from_name,
      is_enabled,
      webhook_url,
      webhook_secret,
      enable_open_tracking,
      enable_click_tracking
    ) VALUES (
      NULL,
      'noreply@sjinnovation.com',
      'SJ Innovation',
      false,
      NULL,
      NULL,
      true,
      true
    )
    RETURNING * INTO config;
  END IF;

  RETURN config;
END;
$$ LANGUAGE plpgsql;

-- Ensure default config exists
DO $$
BEGIN
  PERFORM get_or_create_sendgrid_config();
END $$;
