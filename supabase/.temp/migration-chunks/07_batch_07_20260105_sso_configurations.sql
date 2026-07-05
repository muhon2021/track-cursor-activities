-- 20260103_migrate_existing_integrations.sql
-- ============================================
-- Migrate Existing Integrations
-- Move configurations from app_config to organization_integrations
-- This migration is OPTIONAL and safe to run even if no data exists
-- ============================================

-- ============================================
-- MIGRATION: Migrate existing app_config integrations
-- ============================================
DO $$
DECLARE
  provider_openai UUID;
  provider_anthropic UUID;
  provider_gemini UUID;
  provider_perplexity UUID;
  provider_sendgrid UUID;
  provider_zoom UUID;
  provider_google_drive UUID;

  config_value JSONB;
  api_key TEXT;
  org_id TEXT;
  from_email TEXT;
  from_name TEXT;
  client_id TEXT;
  client_secret TEXT;
  account_id TEXT;
BEGIN
  -- Get provider IDs from integration_providers
  SELECT id INTO provider_openai FROM public.integration_providers WHERE slug = 'openai';
  SELECT id INTO provider_anthropic FROM public.integration_providers WHERE slug = 'anthropic';
  SELECT id INTO provider_gemini FROM public.integration_providers WHERE slug = 'google-gemini';
  SELECT id INTO provider_perplexity FROM public.integration_providers WHERE slug = 'perplexity';
  SELECT id INTO provider_sendgrid FROM public.integration_providers WHERE slug = 'sendgrid';
  SELECT id INTO provider_zoom FROM public.integration_providers WHERE slug = 'zoom';

  -- Note: Google Drive might not exist yet in providers, but Google Workspace will
  SELECT id INTO provider_google_drive FROM public.integration_providers WHERE slug = 'google-workspace';

  RAISE NOTICE 'Starting migration of existing integrations from app_config...';

  -- ============================================
  -- MIGRATE: OpenAI
  -- ============================================
  BEGIN
    -- Check if OpenAI config exists in app_config
    SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.openai.api_key';

    IF config_value IS NOT NULL THEN
      api_key := config_value #>> '{}'; -- Extract string value

      -- Get organization ID if it exists
      SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.openai.organization_id';
      org_id := config_value #>> '{}';

      -- Insert into organization_integrations
      INSERT INTO public.organization_integrations (
        provider_id,
        enabled,
        config,
        connection_status,
        last_tested_at
      ) VALUES (
        provider_openai,
        true, -- Assume enabled if config exists
        jsonb_build_object(
          'api_key', api_key,
          'organization_id', COALESCE(org_id, ''),
          'base_url', 'https://api.openai.com/v1'
        ),
        'disconnected', -- Will need to test
        NULL
      )
      ON CONFLICT (organization_id, provider_id) DO UPDATE
        SET config = EXCLUDED.config,
            enabled = true;

      RAISE NOTICE 'Migrated OpenAI integration';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'OpenAI migration skipped: %', SQLERRM;
  END;

  -- ============================================
  -- MIGRATE: Anthropic
  -- ============================================
  BEGIN
    SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.anthropic.api_key';

    IF config_value IS NOT NULL THEN
      api_key := config_value #>> '{}';

      INSERT INTO public.organization_integrations (
        provider_id,
        enabled,
        config,
        connection_status
      ) VALUES (
        provider_anthropic,
        true,
        jsonb_build_object(
          'api_key', api_key,
          'base_url', 'https://api.anthropic.com/v1'
        ),
        'disconnected'
      )
      ON CONFLICT (organization_id, provider_id) DO UPDATE
        SET config = EXCLUDED.config,
            enabled = true;

      RAISE NOTICE 'Migrated Anthropic integration';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Anthropic migration skipped: %', SQLERRM;
  END;

  -- ============================================
  -- MIGRATE: Google Gemini
  -- ============================================
  BEGIN
    SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.google.api_key';

    IF config_value IS NOT NULL THEN
      api_key := config_value #>> '{}';

      INSERT INTO public.organization_integrations (
        provider_id,
        enabled,
        config,
        connection_status
      ) VALUES (
        provider_gemini,
        true,
        jsonb_build_object('api_key', api_key),
        'disconnected'
      )
      ON CONFLICT (organization_id, provider_id) DO UPDATE
        SET config = EXCLUDED.config,
            enabled = true;

      RAISE NOTICE 'Migrated Google Gemini integration';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Google Gemini migration skipped: %', SQLERRM;
  END;

  -- ============================================
  -- MIGRATE: Perplexity
  -- ============================================
  BEGIN
    SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.perplexity.api_key';

    IF config_value IS NOT NULL THEN
      api_key := config_value #>> '{}';

      INSERT INTO public.organization_integrations (
        provider_id,
        enabled,
        config,
        connection_status
      ) VALUES (
        provider_perplexity,
        true,
        jsonb_build_object('api_key', api_key),
        'disconnected'
      )
      ON CONFLICT (organization_id, provider_id) DO UPDATE
        SET config = EXCLUDED.config,
            enabled = true;

      RAISE NOTICE 'Migrated Perplexity integration';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Perplexity migration skipped: %', SQLERRM;
  END;

  -- ============================================
  -- MIGRATE: SendGrid
  -- ============================================
  BEGIN
    SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.sendgrid.api_key';

    IF config_value IS NOT NULL THEN
      api_key := config_value #>> '{}';

      -- Get from_email and from_name
      SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.sendgrid.from_email';
      from_email := config_value #>> '{}';

      SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.sendgrid.from_name';
      from_name := config_value #>> '{}';

      INSERT INTO public.organization_integrations (
        provider_id,
        enabled,
        config,
        connection_status
      ) VALUES (
        provider_sendgrid,
        true,
        jsonb_build_object(
          'api_key', api_key,
          'from_email', COALESCE(from_email, ''),
          'from_name', COALESCE(from_name, '')
        ),
        'disconnected'
      )
      ON CONFLICT (organization_id, provider_id) DO UPDATE
        SET config = EXCLUDED.config,
            enabled = true;

      RAISE NOTICE 'Migrated SendGrid integration';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'SendGrid migration skipped: %', SQLERRM;
  END;

  -- ============================================
  -- MIGRATE: Zoom
  -- ============================================
  BEGIN
    SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.zoom.client_id';

    IF config_value IS NOT NULL THEN
      client_id := config_value #>> '{}';

      SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.zoom.client_secret';
      client_secret := config_value #>> '{}';

      SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.zoom.account_id';
      account_id := config_value #>> '{}';

      INSERT INTO public.organization_integrations (
        provider_id,
        enabled,
        config,
        connection_status
      ) VALUES (
        provider_zoom,
        true,
        jsonb_build_object(
          'client_id', COALESCE(client_id, ''),
          'client_secret', COALESCE(client_secret, ''),
          'account_id', COALESCE(account_id, '')
        ),
        'disconnected'
      )
      ON CONFLICT (organization_id, provider_id) DO UPDATE
        SET config = EXCLUDED.config,
            enabled = true;

      RAISE NOTICE 'Migrated Zoom integration';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Zoom migration skipped: %', SQLERRM;
  END;

  -- ============================================
  -- MIGRATE: Google Drive (to Google Workspace)
  -- ============================================
  BEGIN
    IF provider_google_drive IS NOT NULL THEN
      SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.google_drive.client_id';

      IF config_value IS NOT NULL THEN
        client_id := config_value #>> '{}';

        SELECT value INTO config_value FROM public.app_config WHERE key = 'integrations.google_drive.client_secret';
        client_secret := config_value #>> '{}';

        INSERT INTO public.organization_integrations (
          provider_id,
          enabled,
          config,
          connection_status
        ) VALUES (
          provider_google_drive,
          true,
          jsonb_build_object(
            'client_id', COALESCE(client_id, ''),
            'client_secret', COALESCE(client_secret, '')
          ),
          'disconnected'
        )
        ON CONFLICT (organization_id, provider_id) DO UPDATE
          SET config = EXCLUDED.config,
              enabled = true;

        RAISE NOTICE 'Migrated Google Drive integration to Google Workspace';
      END IF;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Google Drive migration skipped: %', SQLERRM;
  END;

  -- ============================================
  -- Summary
  -- ============================================
  RAISE NOTICE '─────────────────────────────────────────';
  RAISE NOTICE 'Migration complete!';
  RAISE NOTICE 'Active integrations: %', (SELECT COUNT(*) FROM public.organization_integrations WHERE enabled = true);
  RAISE NOTICE '─────────────────────────────────────────';
  RAISE NOTICE 'Note: Connection statuses are set to "disconnected"';
  RAISE NOTICE 'Admins should test connections in the Integration Hub';

END $$;


-- 20260105_add_google_login_provider.sql
-- ============================================
-- Add Google Login Provider for Authentication
-- Enables "Sign in with Google" button on login page
-- ============================================

-- Enable the authentication category
UPDATE public.integration_categories
SET enabled = true
WHERE slug = 'authentication';

-- Add Google Login provider to authentication category
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
  is_beta,
  display_order
)
SELECT
  id,
  'Google Login',
  'google-login',
  'Allow users to sign in with their Google accounts for seamless authentication',
  'oauth2',
  '{"authorize_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token", "scopes": ["openid", "email", "profile"], "response_type": "code"}'::jsonb,
  'https://developers.google.com/identity/protocols/oauth2',
  true,
  false,
  false,
  10
FROM public.integration_categories
WHERE slug = 'authentication'
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  oauth_config = EXCLUDED.oauth_config,
  docs_url = EXCLUDED.docs_url,
  is_available = EXCLUDED.is_available;

-- Add configuration fields for Google Login
INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
SELECT
  id,
  'client_id',
  'Client ID',
  'text',
  'your-client-id.apps.googleusercontent.com',
  true,
  false,
  'OAuth 2.0 Client ID from Google Cloud Console',
  10
FROM public.integration_providers WHERE slug = 'google-login'
ON CONFLICT (provider_id, field_key) DO NOTHING;

INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
SELECT
  id,
  'client_secret',
  'Client Secret',
  'password',
  'GOCSPX-...',
  true,
  true,
  'OAuth 2.0 Client Secret from Google Cloud Console',
  20
FROM public.integration_providers WHERE slug = 'google-login'
ON CONFLICT (provider_id, field_key) DO NOTHING;

-- Add services for Google Login
INSERT INTO public.integration_services (provider_id, name, service_key, description, features, enabled, is_default, display_order)
SELECT
  id,
  'Sign In with Google',
  'google_signin',
  'Enable Google as a sign-in option on the login page',
  '{"sso": true, "email_verification": true, "profile_sync": true}'::jsonb,
  true,
  true,
  10
FROM public.integration_providers WHERE slug = 'google-login'
ON CONFLICT (provider_id, service_key) DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Google Login provider added successfully!';
END $$;


-- 20260105_add_user_id_to_organization_integrations.sql
-- ============================================
-- Add user_id to organization_integrations table
-- Allows per-user integration configurations
-- ============================================

-- Add user_id column
ALTER TABLE public.organization_integrations
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_organization_integrations_user_id
ON public.organization_integrations(user_id);

-- Drop the old unique constraint and add a new one that includes user_id
ALTER TABLE public.organization_integrations
DROP CONSTRAINT IF EXISTS organization_integrations_organization_id_provider_id_key;

-- Add new unique constraint: one integration per provider per user
ALTER TABLE public.organization_integrations
ADD CONSTRAINT organization_integrations_user_provider_key
UNIQUE(user_id, provider_id);

-- ============================================
-- Update RLS Policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all organization integrations" ON public.organization_integrations;
DROP POLICY IF EXISTS "Admins can manage organization integrations" ON public.organization_integrations;

-- Users can view their own integrations
CREATE POLICY "Users can view own integrations"
  ON public.organization_integrations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own integrations
CREATE POLICY "Users can create own integrations"
  ON public.organization_integrations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own integrations
CREATE POLICY "Users can update own integrations"
  ON public.organization_integrations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own integrations
CREATE POLICY "Users can delete own integrations"
  ON public.organization_integrations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all integrations
CREATE POLICY "Admins can view all integrations"
  ON public.organization_integrations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can manage all integrations
CREATE POLICY "Admins can manage all integrations"
  ON public.organization_integrations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- Update existing rows to set user_id from created_by
-- ============================================
UPDATE public.organization_integrations
SET user_id = created_by
WHERE user_id IS NULL AND created_by IS NOT NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'user_id column added and RLS policies updated for organization_integrations!';
END $$;


-- 20260105_oauth_states.sql
-- ============================================
-- OAuth States Table
-- Sprint 10: User Integration Connections
-- Stores temporary OAuth state for CSRF protection
-- ============================================

-- Create the oauth_states table
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  redirect_uri TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for state lookups
CREATE INDEX IF NOT EXISTS idx_oauth_states_state
  ON public.oauth_states(state);

-- Create index for cleanup
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at
  ON public.oauth_states(expires_at);

-- Enable RLS
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Service role can manage states (edge functions)
CREATE POLICY "Service role can manage oauth states"
  ON public.oauth_states
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Cleanup expired states function
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_states()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.oauth_states
  WHERE expires_at < NOW();
END;
$$;

-- Comments
COMMENT ON TABLE public.oauth_states IS 'Temporary storage for OAuth state parameters during authentication flow';
COMMENT ON COLUMN public.oauth_states.state IS 'Random state parameter for CSRF protection';
COMMENT ON COLUMN public.oauth_states.expires_at IS 'When this state expires (typically 10 minutes)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'oauth_states table created successfully for Sprint 10!';
END $$;


-- 20260105_sso_configurations.sql
-- ============================================
-- SSO Configurations Table
-- Stores enterprise SSO provider settings
-- Sprint 7: Enterprise SSO & Authentication
-- ============================================

-- SSO Configuration table for enterprise identity providers
CREATE TABLE IF NOT EXISTS public.sso_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type TEXT NOT NULL CHECK (provider_type IN ('google_workspace', 'azure_ad', 'saml', 'oidc')),
  display_name TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  is_primary BOOLEAN DEFAULT false,

  -- OAuth Credentials
  client_id TEXT,
  tenant_id TEXT,                    -- For Azure AD

  -- Domain Restrictions
  domain_restrictions TEXT[] DEFAULT '{}',

  -- Auto-provisioning
  auto_provision_role TEXT DEFAULT 'user' CHECK (auto_provision_role IN ('admin', 'moderator', 'user')),
  auto_create_users BOOLEAN DEFAULT true,

  -- Additional metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Only one config per provider type
  UNIQUE(provider_type)
);

-- Enable RLS
ALTER TABLE public.sso_configurations ENABLE ROW LEVEL SECURITY;

-- Only admins can manage SSO configurations
CREATE POLICY "Admins can manage SSO configs"
  ON public.sso_configurations
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Public can view enabled SSO providers (non-sensitive fields only)
CREATE POLICY "Public can view enabled SSO providers"
  ON public.sso_configurations
  FOR SELECT
  TO anon
  USING (is_enabled = true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sso_configurations_provider_type
  ON public.sso_configurations(provider_type);

CREATE INDEX IF NOT EXISTS idx_sso_configurations_enabled
  ON public.sso_configurations(is_enabled)
  WHERE is_enabled = true;

-- Trigger for updated_at
CREATE TRIGGER update_sso_configurations_updated_at
  BEFORE UPDATE ON public.sso_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- SSO Domain Allowlist Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.sso_domain_allowlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  sso_config_id UUID REFERENCES public.sso_configurations(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(domain, sso_config_id)
);

-- Enable RLS
ALTER TABLE public.sso_domain_allowlist ENABLE ROW LEVEL SECURITY;

-- Only admins can manage domain allowlist
CREATE POLICY "Admins can manage domain allowlist"
  ON public.sso_domain_allowlist
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sso_domain_allowlist_domain
  ON public.sso_domain_allowlist(domain);

CREATE INDEX IF NOT EXISTS idx_sso_domain_allowlist_config
  ON public.sso_domain_allowlist(sso_config_id);

-- ============================================
-- SSO Login Logs Table (for audit)
-- ============================================

CREATE TABLE IF NOT EXISTS public.sso_login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sso_config_id UUID REFERENCES public.sso_configurations(id) ON DELETE SET NULL,
  provider_type TEXT NOT NULL,
  email TEXT,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sso_login_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view login logs
CREATE POLICY "Admins can view SSO login logs"
  ON public.sso_login_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role can insert logs
CREATE POLICY "Service role can insert SSO logs"
  ON public.sso_login_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sso_login_logs_user_id
  ON public.sso_login_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_sso_login_logs_created_at
  ON public.sso_login_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sso_login_logs_success
  ON public.sso_login_logs(success);

-- ============================================
-- Auth Configuration app_config entries
-- ============================================

-- Insert default auth configuration
INSERT INTO public.app_config (key, value, category, description)
VALUES
  ('auth.allow_email_password', 'true', 'auth', 'Enable traditional email/password login'),
  ('auth.allow_public_signup', 'true', 'auth', 'Allow self-registration'),
  ('auth.require_sso', 'false', 'auth', 'Force SSO for all users (disable other methods)'),
  ('auth.default_sso_provider', 'null', 'auth', 'UUID of primary SSO provider'),
  ('auth.session_timeout_hours', '24', 'auth', 'Session timeout duration in hours')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- Helper Functions
-- ============================================

-- Function to validate email domain against allowlist
CREATE OR REPLACE FUNCTION public.validate_sso_domain(
  p_email TEXT,
  p_sso_config_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_domain TEXT;
  v_is_valid BOOLEAN;
BEGIN
  -- Extract domain from email
  v_domain := split_part(p_email, '@', 2);

  -- Check if domain restrictions are configured
  SELECT EXISTS (
    SELECT 1 FROM public.sso_domain_allowlist
    WHERE sso_config_id = p_sso_config_id
    AND is_active = true
    AND domain = v_domain
  ) INTO v_is_valid;

  -- If no allowlist entries, allow all domains
  IF NOT EXISTS (
    SELECT 1 FROM public.sso_domain_allowlist
    WHERE sso_config_id = p_sso_config_id
    AND is_active = true
  ) THEN
    RETURN true;
  END IF;

  RETURN v_is_valid;
END;
$$;

-- Function to get enabled SSO providers (safe for public)
CREATE OR REPLACE FUNCTION public.get_enabled_sso_providers()
RETURNS TABLE (
  id UUID,
  provider_type TEXT,
  display_name TEXT,
  is_primary BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sso.id,
    sso.provider_type,
    sso.display_name,
    sso.is_primary
  FROM public.sso_configurations sso
  WHERE sso.is_enabled = true
  ORDER BY sso.is_primary DESC, sso.display_name ASC;
END;
$$;

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE public.sso_configurations IS 'Stores SSO provider configurations for enterprise authentication';
COMMENT ON TABLE public.sso_domain_allowlist IS 'Email domain allowlist for SSO providers';
COMMENT ON TABLE public.sso_login_logs IS 'Audit log for SSO login attempts';
COMMENT ON FUNCTION public.validate_sso_domain IS 'Validates if an email domain is allowed for a given SSO provider';
COMMENT ON FUNCTION public.get_enabled_sso_providers IS 'Returns list of enabled SSO providers (safe for login page)';

-- ============================================
-- Success message
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'SSO tables and functions created successfully for Sprint 7!';
END $$;


