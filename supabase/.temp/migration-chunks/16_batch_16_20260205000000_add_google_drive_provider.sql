-- 20260204050227_c84b5c6f-001f-40d7-b714-9ab9b8810936.sql
-- Insert Google Meet integration fields (client_id and client_secret)
INSERT INTO integration_fields (
  provider_id,
  field_key,
  label,
  field_type,
  is_required,
  display_order,
  placeholder,
  help_text
)
VALUES
  (
    '815ebb95-78cd-4fcf-a90e-7087006b3ea7',
    'client_id',
    'Client ID',
    'text',
    true,
    1,
    'Enter your Google OAuth Client ID',
    'Get this from the Google Cloud Console under APIs & Services > Credentials'
  ),
  (
    '815ebb95-78cd-4fcf-a90e-7087006b3ea7',
    'client_secret',
    'Client Secret',
    'password',
    true,
    2,
    'Enter your Google OAuth Client Secret',
    'Get this from the Google Cloud Console under APIs & Services > Credentials'
  );

-- 20260204_api_keys.sql
/**
 * API Keys Management
 *
 * Enables API key-based authentication for programmatic access to Control Tower APIs.
 * Supports scoped permissions and rate limiting.
 *
 * Use Cases:
 * - Third-party integrations accessing Control Tower APIs
 * - Automation scripts and CI/CD pipelines
 * - Mobile apps and SPAs (for server-side operations)
 * - Webhooks and background jobs
 */

-- ============================================================================
-- API Keys Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Key identification
  name TEXT NOT NULL,
  description TEXT,
  key_prefix TEXT NOT NULL, -- First 8 chars of key for display (e.g., "sk_live_")
  key_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of full key

  -- Ownership
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID, -- Future multi-org support

  -- Permissions
  scopes TEXT[] NOT NULL DEFAULT '{read}', -- read, write, admin
  allowed_endpoints TEXT[] DEFAULT '{}', -- Specific endpoints allowed (empty = all)

  -- Security
  allowed_ips TEXT[] DEFAULT '{}', -- IP whitelist (empty = all IPs)
  rate_limit_per_minute INTEGER DEFAULT 60,

  -- Status
  enabled BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ, -- NULL = never expires

  -- Metadata
  last_used_at TIMESTAMPTZ,
  last_used_ip TEXT,
  total_requests INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_created_by ON api_keys(created_by);
CREATE INDEX idx_api_keys_enabled ON api_keys(enabled);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);

-- RLS Policies
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Admins can manage all API keys
CREATE POLICY "Admins can manage all API keys"
  ON api_keys
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Users can view their own API keys
CREATE POLICY "Users can view their own API keys"
  ON api_keys
  FOR SELECT
  USING (created_by = auth.uid());

-- Users can create their own API keys
CREATE POLICY "Users can create their own API keys"
  ON api_keys
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Users can update their own API keys
CREATE POLICY "Users can update their own API keys"
  ON api_keys
  FOR UPDATE
  USING (created_by = auth.uid());

-- Users can delete their own API keys
CREATE POLICY "Users can delete their own API keys"
  ON api_keys
  FOR DELETE
  USING (created_by = auth.uid());

-- ============================================================================
-- API Key Request Logs Table (for analytics and debugging)
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_key_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,

  -- Request details
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,

  -- Client info
  ip_address TEXT,
  user_agent TEXT,

  -- Error tracking
  error_message TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_api_logs_key_id ON api_key_request_logs(api_key_id);
CREATE INDEX idx_api_logs_created_at ON api_key_request_logs(created_at);
CREATE INDEX idx_api_logs_endpoint ON api_key_request_logs(endpoint);

-- RLS Policies
ALTER TABLE api_key_request_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs
CREATE POLICY "Admins can view all API logs"
  ON api_key_request_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Users can view logs for their API keys
CREATE POLICY "Users can view their API key logs"
  ON api_key_request_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM api_keys
      WHERE api_keys.id = api_key_id
      AND api_keys.created_by = auth.uid()
    )
  );

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Generate API key with prefix
CREATE OR REPLACE FUNCTION generate_api_key(p_prefix TEXT DEFAULT 'sk_live')
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  -- Generate 48-character random string
  FOR i IN 1..48 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;

  -- Return with prefix
  RETURN p_prefix || '_' || result;
END;
$$ LANGUAGE plpgsql;

-- Hash API key using SHA-256
CREATE OR REPLACE FUNCTION hash_api_key(p_key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(p_key, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Validate API key and return key info
CREATE OR REPLACE FUNCTION validate_api_key(p_key TEXT)
RETURNS TABLE (
  id UUID,
  created_by UUID,
  scopes TEXT[],
  allowed_endpoints TEXT[],
  allowed_ips TEXT[],
  rate_limit_per_minute INTEGER
) AS $$
DECLARE
  v_key_hash TEXT;
BEGIN
  -- Hash the provided key
  v_key_hash := hash_api_key(p_key);

  -- Return key info if valid
  RETURN QUERY
  SELECT
    k.id,
    k.created_by,
    k.scopes,
    k.allowed_endpoints,
    k.allowed_ips,
    k.rate_limit_per_minute
  FROM api_keys k
  WHERE k.key_hash = v_key_hash
    AND k.enabled = TRUE
    AND (k.expires_at IS NULL OR k.expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update API key usage stats
CREATE OR REPLACE FUNCTION update_api_key_usage(
  p_key_hash TEXT,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE api_keys
  SET
    last_used_at = NOW(),
    last_used_ip = COALESCE(p_ip_address, last_used_ip),
    total_requests = total_requests + 1
  WHERE key_hash = p_key_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up expired API keys
CREATE OR REPLACE FUNCTION cleanup_expired_api_keys()
RETURNS void AS $$
BEGIN
  -- Delete expired API keys
  DELETE FROM api_keys
  WHERE expires_at < NOW();

  -- Delete old request logs (older than 90 days)
  DELETE FROM api_key_request_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE api_keys IS 'API keys for programmatic access to Control Tower APIs';
COMMENT ON TABLE api_key_request_logs IS 'Request logs for API key usage analytics';

COMMENT ON COLUMN api_keys.key_prefix IS 'First 8 chars of key for display (e.g., sk_live_abc12345)';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash of the full API key';
COMMENT ON COLUMN api_keys.scopes IS 'Permissions: read, write, admin';
COMMENT ON COLUMN api_keys.allowed_endpoints IS 'Specific endpoints allowed (empty = all endpoints)';
COMMENT ON COLUMN api_keys.allowed_ips IS 'IP whitelist (empty = all IPs allowed)';
COMMENT ON COLUMN api_keys.rate_limit_per_minute IS 'Max requests per minute (default: 60)';


-- 20260204_oauth_provider.sql
/**
 * OAuth Provider Tables
 *
 * Enables this Control Tower instance to act as an OAuth 2.0 identity provider
 * for other Control Tower instances or third-party applications.
 *
 * Flow:
 * 1. External app registers as oauth_clients (admin creates)
 * 2. User visits /oauth/authorize with client_id
 * 3. User consents, oauth_authorization_codes created
 * 4. External app exchanges code for access_token at /oauth/token
 * 5. oauth_access_tokens created
 * 6. External app calls /oauth/userinfo with access_token
 */

-- ============================================================================
-- OAuth Clients Table
-- Stores registered OAuth client applications
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT UNIQUE NOT NULL,
  client_secret TEXT NOT NULL, -- hashed
  client_name TEXT NOT NULL,
  client_type TEXT NOT NULL DEFAULT 'confidential', -- 'confidential' or 'public'

  -- OAuth configuration
  redirect_uris TEXT[] NOT NULL DEFAULT '{}', -- Allowed redirect URIs
  allowed_scopes TEXT[] NOT NULL DEFAULT '{openid,profile,email}', -- Scopes this client can request
  grant_types TEXT[] NOT NULL DEFAULT '{authorization_code,refresh_token}', -- Allowed grant types

  -- Client metadata
  logo_url TEXT,
  homepage_url TEXT,
  privacy_policy_url TEXT,
  terms_of_service_url TEXT,

  -- Security
  require_pkce BOOLEAN DEFAULT FALSE,
  require_consent BOOLEAN DEFAULT TRUE,
  trusted BOOLEAN DEFAULT FALSE, -- If true, skip consent screen

  -- Status
  enabled BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metrics
  total_authorizations INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ
);

-- Add indexes
CREATE INDEX idx_oauth_clients_client_id ON oauth_clients(client_id);
CREATE INDEX idx_oauth_clients_enabled ON oauth_clients(enabled);

-- Add RLS
ALTER TABLE oauth_clients ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage OAuth clients
CREATE POLICY "Admins can manage OAuth clients"
  ON oauth_clients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- ============================================================================
-- OAuth Authorization Codes Table
-- Temporary codes issued during authorization flow
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Authorization details
  redirect_uri TEXT NOT NULL,
  scope TEXT[] NOT NULL DEFAULT '{openid,profile,email}',

  -- PKCE support
  code_challenge TEXT,
  code_challenge_method TEXT, -- 'S256' or 'plain'

  -- Lifecycle
  used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_oauth_codes_code ON oauth_authorization_codes(code);
CREATE INDEX idx_oauth_codes_client_id ON oauth_authorization_codes(client_id);
CREATE INDEX idx_oauth_codes_user_id ON oauth_authorization_codes(user_id);
CREATE INDEX idx_oauth_codes_expires_at ON oauth_authorization_codes(expires_at);

-- Add RLS
ALTER TABLE oauth_authorization_codes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own authorization codes
CREATE POLICY "Users can view their own authorization codes"
  ON oauth_authorization_codes
  FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- OAuth Access Tokens Table
-- Long-lived access tokens for API access
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token TEXT UNIQUE NOT NULL,
  refresh_token TEXT UNIQUE,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Token details
  scope TEXT[] NOT NULL DEFAULT '{openid,profile,email}',
  token_type TEXT NOT NULL DEFAULT 'Bearer',

  -- Lifecycle
  revoked BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
  refresh_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Add indexes
CREATE INDEX idx_oauth_tokens_access_token ON oauth_access_tokens(access_token);
CREATE INDEX idx_oauth_tokens_refresh_token ON oauth_access_tokens(refresh_token);
CREATE INDEX idx_oauth_tokens_client_id ON oauth_access_tokens(client_id);
CREATE INDEX idx_oauth_tokens_user_id ON oauth_access_tokens(user_id);
CREATE INDEX idx_oauth_tokens_expires_at ON oauth_access_tokens(expires_at);

-- Add RLS
ALTER TABLE oauth_access_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view their own tokens
CREATE POLICY "Users can view their own access tokens"
  ON oauth_access_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- OAuth User Consents Table
-- Track user consent decisions for each client
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,

  -- Consent details
  scopes TEXT[] NOT NULL DEFAULT '{openid,profile,email}',
  consented_at TIMESTAMPTZ DEFAULT NOW(),

  -- If user revokes, we delete the row
  -- If they re-consent, we recreate

  UNIQUE(user_id, client_id)
);

-- Add indexes
CREATE INDEX idx_oauth_consents_user_id ON oauth_user_consents(user_id);
CREATE INDEX idx_oauth_consents_client_id ON oauth_user_consents(client_id);

-- Add RLS
ALTER TABLE oauth_user_consents ENABLE ROW LEVEL SECURITY;

-- Users can view/revoke their own consents
CREATE POLICY "Users can manage their own consents"
  ON oauth_user_consents
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to generate secure random tokens
CREATE OR REPLACE FUNCTION generate_oauth_token(length INTEGER DEFAULT 32)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired codes and tokens
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_data()
RETURNS void AS $$
BEGIN
  -- Delete expired authorization codes
  DELETE FROM oauth_authorization_codes
  WHERE expires_at < NOW();

  -- Delete expired access tokens
  DELETE FROM oauth_access_tokens
  WHERE expires_at < NOW()
  AND refresh_expires_at < NOW();

  -- Delete revoked tokens older than 30 days
  DELETE FROM oauth_access_tokens
  WHERE revoked = TRUE
  AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Function to verify client secret using bcrypt
CREATE OR REPLACE FUNCTION verify_client_secret(
  p_client_id TEXT,
  p_secret TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_stored_hash TEXT;
BEGIN
  -- Get stored hash for client
  SELECT client_secret INTO v_stored_hash
  FROM oauth_clients
  WHERE client_id = p_client_id
  AND enabled = TRUE;

  IF v_stored_hash IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Verify password using pgcrypto crypt
  RETURN (v_stored_hash = crypt(p_secret, v_stored_hash));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Seed Data - Example OAuth Client
-- ============================================================================

-- Create a sample OAuth client for testing
INSERT INTO oauth_clients (
  client_id,
  client_secret,
  client_name,
  redirect_uris,
  allowed_scopes,
  logo_url,
  homepage_url,
  require_consent,
  trusted
) VALUES (
  'control-tower-dev-client',
  -- This is a hashed version of 'dev_secret_123' using pgcrypto
  crypt('dev_secret_123', gen_salt('bf')),
  'Control Tower Development',
  ARRAY['http://localhost:8080/auth/callback', 'https://dev.controltower.com/auth/callback'],
  ARRAY['openid', 'profile', 'email', 'roles'],
  NULL,
  'http://localhost:8080',
  TRUE,
  FALSE
) ON CONFLICT (client_id) DO NOTHING;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE oauth_clients IS 'Registered OAuth 2.0 client applications that can authenticate users';
COMMENT ON TABLE oauth_authorization_codes IS 'Temporary authorization codes issued during OAuth flow';
COMMENT ON TABLE oauth_access_tokens IS 'Access and refresh tokens for authenticated API access';
COMMENT ON TABLE oauth_user_consents IS 'User consent records for each OAuth client';

COMMENT ON COLUMN oauth_clients.client_type IS 'confidential = server-side apps with secrets, public = SPA/mobile apps';
COMMENT ON COLUMN oauth_clients.require_pkce IS 'Require Proof Key for Code Exchange (recommended for public clients)';
COMMENT ON COLUMN oauth_clients.trusted IS 'If true, skip consent screen (for first-party apps)';

COMMENT ON COLUMN oauth_authorization_codes.code_challenge IS 'PKCE code challenge for enhanced security';
COMMENT ON COLUMN oauth_authorization_codes.code_challenge_method IS 'PKCE method: S256 (SHA-256) or plain';

COMMENT ON COLUMN oauth_access_tokens.scope IS 'Granted scopes for this token';
COMMENT ON COLUMN oauth_access_tokens.revoked IS 'If true, token has been revoked and cannot be used';


-- 20260205000000_add_google_drive_provider.sql
-- ============================================
-- Add Google Drive Provider for Storage Integration
-- Enables Google Drive file sync and management
-- ============================================

-- Add Google Drive provider to storage-productivity category
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
  'Google Drive',
  'google-drive',
  'Sync and manage files from Google Drive for knowledge base and document management',
  'oauth2',
  '{"authorize_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token", "scopes": ["https://www.googleapis.com/auth/drive.readonly", "https://www.googleapis.com/auth/drive.file"]}'::jsonb,
  'https://developers.google.com/drive/api/guides/about-sdk',
  true,
  false,
  false,
  15
FROM public.integration_categories
WHERE slug = 'storage-productivity'
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  oauth_config = EXCLUDED.oauth_config,
  docs_url = EXCLUDED.docs_url,
  is_available = EXCLUDED.is_available;

-- Insert Google Drive integration fields (client_id and client_secret)
INSERT INTO integration_fields (
  provider_id,
  field_key,
  label,
  field_type,
  is_required,
  is_sensitive,
  display_order,
  placeholder,
  help_text
)
SELECT
  id,
  'client_id',
  'Client ID',
  'text',
  true,
  false,
  1,
  'Enter your Google OAuth Client ID',
  'Get this from the Google Cloud Console under APIs & Services > Credentials'
FROM public.integration_providers
WHERE slug = 'google-drive'
ON CONFLICT (provider_id, field_key) DO UPDATE SET
  label = EXCLUDED.label,
  field_type = EXCLUDED.field_type,
  is_required = EXCLUDED.is_required,
  placeholder = EXCLUDED.placeholder,
  help_text = EXCLUDED.help_text;

INSERT INTO integration_fields (
  provider_id,
  field_key,
  label,
  field_type,
  is_required,
  is_sensitive,
  display_order,
  placeholder,
  help_text
)
SELECT
  id,
  'client_secret',
  'Client Secret',
  'password',
  true,
  true,
  2,
  'Enter your Google OAuth Client Secret',
  'Get this from the Google Cloud Console under APIs & Services > Credentials'
FROM public.integration_providers
WHERE slug = 'google-drive'
ON CONFLICT (provider_id, field_key) DO UPDATE SET
  label = EXCLUDED.label,
  field_type = EXCLUDED.field_type,
  is_required = EXCLUDED.is_required,
  is_sensitive = EXCLUDED.is_sensitive,
  placeholder = EXCLUDED.placeholder,
  help_text = EXCLUDED.help_text;



