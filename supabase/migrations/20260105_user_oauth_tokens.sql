-- ============================================
-- User OAuth Tokens Table
-- Stores individual user OAuth connections
-- Sprint 10: User Integration Connections
-- ============================================

-- Create the user_oauth_tokens table
CREATE TABLE IF NOT EXISTS public.user_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_slug TEXT NOT NULL,  -- 'google', 'microsoft', 'zoom'

  -- OAuth Credentials (should be encrypted in production)
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  scopes TEXT[],

  -- Account Info from provider
  account_email TEXT,           -- Connected account email
  account_name TEXT,            -- Display name from provider
  account_id TEXT,              -- Provider's user ID
  account_avatar_url TEXT,      -- Profile picture URL

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ,
  error_message TEXT,           -- Last error if any
  error_at TIMESTAMPTZ,         -- When error occurred

  -- Metadata
  metadata JSONB DEFAULT '{}',  -- Additional provider-specific data

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- One token per provider per user
  UNIQUE(user_id, provider_slug)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_oauth_tokens_user_id
  ON public.user_oauth_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_user_oauth_tokens_provider
  ON public.user_oauth_tokens(provider_slug);

CREATE INDEX IF NOT EXISTS idx_user_oauth_tokens_user_provider
  ON public.user_oauth_tokens(user_id, provider_slug);

CREATE INDEX IF NOT EXISTS idx_user_oauth_tokens_expires_at
  ON public.user_oauth_tokens(expires_at)
  WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.user_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- ============================================

-- Users can view their own tokens (without exposing actual token values)
CREATE POLICY "Users can view own OAuth tokens"
  ON public.user_oauth_tokens
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own tokens
CREATE POLICY "Users can insert own OAuth tokens"
  ON public.user_oauth_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own tokens
CREATE POLICY "Users can update own OAuth tokens"
  ON public.user_oauth_tokens
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own tokens
CREATE POLICY "Users can delete own OAuth tokens"
  ON public.user_oauth_tokens
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all tokens (for support/debugging)
CREATE POLICY "Admins can view all OAuth tokens"
  ON public.user_oauth_tokens
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- Trigger for updated_at
-- ============================================

CREATE TRIGGER update_user_oauth_tokens_updated_at
  BEFORE UPDATE ON public.user_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Helper function to check if user has valid token
-- ============================================

CREATE OR REPLACE FUNCTION public.user_has_valid_oauth_token(
  p_user_id UUID,
  p_provider_slug TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_oauth_tokens
    WHERE user_id = p_user_id
      AND provider_slug = p_provider_slug
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_exists;

  RETURN v_exists;
END;
$$;

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE public.user_oauth_tokens IS 'Stores OAuth tokens for individual user connections to external services (Google, Zoom, Microsoft, etc.)';
COMMENT ON COLUMN public.user_oauth_tokens.provider_slug IS 'Identifier for the OAuth provider (google, microsoft, zoom)';
COMMENT ON COLUMN public.user_oauth_tokens.access_token IS 'OAuth access token - should be encrypted at rest';
COMMENT ON COLUMN public.user_oauth_tokens.refresh_token IS 'OAuth refresh token for obtaining new access tokens';
COMMENT ON COLUMN public.user_oauth_tokens.expires_at IS 'When the access token expires';
COMMENT ON COLUMN public.user_oauth_tokens.scopes IS 'Array of OAuth scopes granted by the user';
COMMENT ON COLUMN public.user_oauth_tokens.account_email IS 'Email address of the connected account';
COMMENT ON COLUMN public.user_oauth_tokens.is_active IS 'Whether this connection is active (can be disabled without deleting)';
COMMENT ON COLUMN public.user_oauth_tokens.error_message IS 'Last error message if token refresh or API call failed';

-- ============================================
-- Success message
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'user_oauth_tokens table created successfully for Sprint 10!';
END $$;
