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
