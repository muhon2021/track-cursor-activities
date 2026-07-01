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
