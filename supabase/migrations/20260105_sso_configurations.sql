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
