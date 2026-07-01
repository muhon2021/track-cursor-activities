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
