-- 20260103_integration_helper_functions.sql
-- ============================================
-- Integration Hub Helper Functions
-- Utility functions for managing integrations
-- ============================================

-- ============================================
-- FUNCTION: get_integration_config
-- Retrieve integration configuration by provider slug
-- Returns decrypted config (note: actual encryption to be implemented)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_integration_config(
  provider_slug_input TEXT,
  organization_id_input UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  integration_config JSONB;
  provider_record RECORD;
BEGIN
  -- Get provider details
  SELECT * INTO provider_record
  FROM public.integration_providers
  WHERE slug = provider_slug_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found: %', provider_slug_input;
  END IF;

  -- Get integration config
  SELECT config INTO integration_config
  FROM public.organization_integrations
  WHERE provider_id = provider_record.id
    AND (organization_id IS NULL OR organization_id = organization_id_input)
    AND enabled = true
  LIMIT 1;

  IF integration_config IS NULL THEN
    RAISE EXCEPTION 'Integration not configured for provider: %', provider_slug_input;
  END IF;

  -- TODO: Decrypt sensitive fields (api_key, client_secret, etc.)
  -- For now, return as-is
  RETURN integration_config;
END;
$$;

COMMENT ON FUNCTION public.get_integration_config IS 'Retrieve integration configuration by provider slug. Returns config JSONB.';

-- ============================================
-- FUNCTION: set_integration_config
-- Store integration configuration
-- ============================================
CREATE OR REPLACE FUNCTION public.set_integration_config(
  provider_slug_input TEXT,
  config_input JSONB,
  organization_id_input UUID DEFAULT NULL,
  enabled_input BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  provider_record RECORD;
  integration_id UUID;
BEGIN
  -- Verify user is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can configure integrations';
  END IF;

  -- Get provider
  SELECT * INTO provider_record
  FROM public.integration_providers
  WHERE slug = provider_slug_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found: %', provider_slug_input;
  END IF;

  -- TODO: Encrypt sensitive fields before storing

  -- Upsert integration config
  INSERT INTO public.organization_integrations (
    organization_id,
    provider_id,
    config,
    enabled,
    connection_status,
    created_by
  ) VALUES (
    organization_id_input,
    provider_record.id,
    config_input,
    enabled_input,
    'disconnected',
    auth.uid()
  )
  ON CONFLICT (organization_id, provider_id) DO UPDATE
    SET config = EXCLUDED.config,
        enabled = EXCLUDED.enabled,
        updated_at = now()
  RETURNING id INTO integration_id;

  RETURN integration_id;
END;
$$;

COMMENT ON FUNCTION public.set_integration_config IS 'Store or update integration configuration. Returns integration ID.';

-- ============================================
-- FUNCTION: test_integration_connection
-- Update connection status after testing
-- ============================================
CREATE OR REPLACE FUNCTION public.test_integration_connection(
  provider_slug_input TEXT,
  is_valid BOOLEAN,
  message_input TEXT DEFAULT NULL,
  organization_id_input UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  provider_record RECORD;
  new_status TEXT;
BEGIN
  -- Verify user is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can test connections';
  END IF;

  -- Get provider
  SELECT * INTO provider_record
  FROM public.integration_providers
  WHERE slug = provider_slug_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found: %', provider_slug_input;
  END IF;

  -- Determine new status
  IF is_valid THEN
    new_status := 'connected';
  ELSE
    new_status := 'error';
  END IF;

  -- Update integration status
  UPDATE public.organization_integrations
  SET
    connection_status = new_status,
    connection_message = message_input,
    last_tested_at = now()
  WHERE provider_id = provider_record.id
    AND (organization_id IS NULL OR organization_id = organization_id_input);

  RETURN is_valid;
END;
$$;

COMMENT ON FUNCTION public.test_integration_connection IS 'Update connection status after testing. Pass TRUE if valid, FALSE if error.';

-- ============================================
-- FUNCTION: get_enabled_integrations
-- Get all enabled integrations for an organization
-- ============================================
CREATE OR REPLACE FUNCTION public.get_enabled_integrations(
  category_slug_input TEXT DEFAULT NULL,
  organization_id_input UUID DEFAULT NULL
)
RETURNS TABLE (
  integration_id UUID,
  provider_slug TEXT,
  provider_name TEXT,
  category_slug TEXT,
  auth_type TEXT,
  connection_status TEXT,
  last_tested_at TIMESTAMPTZ,
  config JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    oi.id as integration_id,
    p.slug as provider_slug,
    p.name as provider_name,
    c.slug as category_slug,
    p.auth_type,
    oi.connection_status,
    oi.last_tested_at,
    oi.config
  FROM public.organization_integrations oi
  INNER JOIN public.integration_providers p ON oi.provider_id = p.id
  INNER JOIN public.integration_categories c ON p.category_id = c.id
  WHERE oi.enabled = true
    AND (category_slug_input IS NULL OR c.slug = category_slug_input)
    AND (organization_id_input IS NULL OR oi.organization_id = organization_id_input)
  ORDER BY c.display_order, p.display_order;
END;
$$;

COMMENT ON FUNCTION public.get_enabled_integrations IS 'Get all enabled integrations, optionally filtered by category.';

-- ============================================
-- FUNCTION: log_integration_usage
-- Convenience function for logging integration API usage
-- ============================================
CREATE OR REPLACE FUNCTION public.log_integration_usage(
  provider_slug_input TEXT,
  action_input TEXT,
  status_input TEXT DEFAULT 'success',
  request_metadata_input JSONB DEFAULT NULL,
  response_metadata_input JSONB DEFAULT NULL,
  error_message_input TEXT DEFAULT NULL,
  estimated_cost_input DECIMAL(10, 8) DEFAULT 0,
  organization_id_input UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  provider_record RECORD;
  log_id UUID;
BEGIN
  -- Get provider
  SELECT id INTO provider_record
  FROM public.integration_providers
  WHERE slug = provider_slug_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found: %', provider_slug_input;
  END IF;

  -- Insert usage log
  INSERT INTO public.integration_usage_logs (
    organization_id,
    provider_id,
    user_id,
    action,
    status,
    request_metadata,
    response_metadata,
    error_message,
    estimated_cost
  ) VALUES (
    organization_id_input,
    provider_record.id,
    auth.uid(),
    action_input,
    status_input,
    request_metadata_input,
    response_metadata_input,
    error_message_input,
    estimated_cost_input
  )
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;

COMMENT ON FUNCTION public.log_integration_usage IS 'Log integration API usage for analytics and debugging.';

-- ============================================
-- FUNCTION: get_integration_usage_stats
-- Get usage statistics for a provider
-- ============================================
CREATE OR REPLACE FUNCTION public.get_integration_usage_stats(
  provider_slug_input TEXT,
  start_date TIMESTAMPTZ DEFAULT NULL,
  end_date TIMESTAMPTZ DEFAULT NULL,
  organization_id_input UUID DEFAULT NULL
)
RETURNS TABLE (
  total_calls BIGINT,
  successful_calls BIGINT,
  failed_calls BIGINT,
  success_rate NUMERIC,
  total_cost NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  provider_record RECORD;
  start_filter TIMESTAMPTZ;
  end_filter TIMESTAMPTZ;
BEGIN
  -- Verify user is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can view usage statistics';
  END IF;

  -- Get provider
  SELECT id INTO provider_record
  FROM public.integration_providers
  WHERE slug = provider_slug_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found: %', provider_slug_input;
  END IF;

  -- Default to last 30 days if not specified
  start_filter := COALESCE(start_date, now() - interval '30 days');
  end_filter := COALESCE(end_date, now());

  RETURN QUERY
  SELECT
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE status = 'success') as successful_calls,
    COUNT(*) FILTER (WHERE status = 'error') as failed_calls,
    ROUND(
      COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / NULLIF(COUNT(*), 0) * 100,
      2
    ) as success_rate,
    SUM(estimated_cost) as total_cost
  FROM public.integration_usage_logs
  WHERE provider_id = provider_record.id
    AND created_at BETWEEN start_filter AND end_filter
    AND (organization_id_input IS NULL OR organization_id = organization_id_input);
END;
$$;

COMMENT ON FUNCTION public.get_integration_usage_stats IS 'Get usage statistics for a provider over a date range.';

-- ============================================
-- FUNCTION: get_default_service
-- Get the default service for a provider
-- ============================================
CREATE OR REPLACE FUNCTION public.get_default_service(
  provider_slug_input TEXT
)
RETURNS TABLE (
  service_id UUID,
  service_name TEXT,
  service_key TEXT,
  features JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  provider_record RECORD;
BEGIN
  -- Get provider
  SELECT id INTO provider_record
  FROM public.integration_providers
  WHERE slug = provider_slug_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found: %', provider_slug_input;
  END IF;

  RETURN QUERY
  SELECT
    s.id as service_id,
    s.name as service_name,
    s.service_key,
    s.features
  FROM public.integration_services s
  WHERE s.provider_id = provider_record.id
    AND s.enabled = true
    AND s.is_default = true
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_default_service IS 'Get the default service for a provider (if any).';

-- ============================================
-- FUNCTION: toggle_service
-- Enable or disable a specific service
-- ============================================
CREATE OR REPLACE FUNCTION public.toggle_service(
  provider_slug_input TEXT,
  service_key_input TEXT,
  enabled_input BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  provider_record RECORD;
BEGIN
  -- Verify user is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can toggle services';
  END IF;

  -- Get provider
  SELECT id INTO provider_record
  FROM public.integration_providers
  WHERE slug = provider_slug_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found: %', provider_slug_input;
  END IF;

  -- Update service
  UPDATE public.integration_services
  SET enabled = enabled_input,
      updated_at = now()
  WHERE provider_id = provider_record.id
    AND service_key = service_key_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not found: % for provider: %', service_key_input, provider_slug_input;
  END IF;

  RETURN enabled_input;
END;
$$;

COMMENT ON FUNCTION public.toggle_service IS 'Enable or disable a specific service for a provider.';

-- ============================================
-- Success Message
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Integration helper functions created successfully!';
  RAISE NOTICE 'Available functions:';
  RAISE NOTICE '  - get_integration_config(provider_slug)';
  RAISE NOTICE '  - set_integration_config(provider_slug, config, enabled)';
  RAISE NOTICE '  - test_integration_connection(provider_slug, is_valid, message)';
  RAISE NOTICE '  - get_enabled_integrations(category_slug)';
  RAISE NOTICE '  - log_integration_usage(provider_slug, action, status, ...)';
  RAISE NOTICE '  - get_integration_usage_stats(provider_slug, start_date, end_date)';
  RAISE NOTICE '  - get_default_service(provider_slug)';
  RAISE NOTICE '  - toggle_service(provider_slug, service_key, enabled)';
END $$;


-- 20260103_integration_hub_schema.sql
-- ============================================
-- Integration Hub Schema Migration
-- Unified integration system for all third-party services
-- Supports: AI, Meeting, Email, CRM, Project Management, Storage, Auth
-- ============================================

-- ============================================
-- Helper Function: Update updated_at timestamp
-- ============================================
-- Note: This function may already exist, using IF NOT EXISTS
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TABLE 1: integration_categories
-- Define high-level categories for organizing integrations
-- ============================================
CREATE TABLE public.integration_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT, -- Lucide icon name (e.g., 'Brain', 'Video', 'Mail')
  display_order INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for fast lookup and sorting
CREATE INDEX idx_integration_categories_slug ON public.integration_categories(slug);
CREATE INDEX idx_integration_categories_display_order ON public.integration_categories(display_order);
CREATE INDEX idx_integration_categories_enabled ON public.integration_categories(enabled);

-- Trigger for updated_at
CREATE TRIGGER set_integration_categories_updated_at
  BEFORE UPDATE ON public.integration_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- TABLE 2: integration_providers
-- Define individual service providers within categories
-- ============================================
CREATE TABLE public.integration_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.integration_categories(id) ON DELETE CASCADE,

  -- Provider identification
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  docs_url TEXT,

  -- Authentication configuration
  auth_type TEXT NOT NULL CHECK (auth_type IN ('api_key', 'oauth2', 'basic', 'service_account')),
  oauth_config JSONB, -- { authorize_url, token_url, scopes[] }

  -- Status flags
  is_available BOOLEAN DEFAULT true, -- Ready to use
  is_coming_soon BOOLEAN DEFAULT false, -- Planned but not implemented
  is_beta BOOLEAN DEFAULT false, -- Available but in beta

  -- Display settings
  display_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_integration_providers_category ON public.integration_providers(category_id);
CREATE INDEX idx_integration_providers_slug ON public.integration_providers(slug);
CREATE INDEX idx_integration_providers_display_order ON public.integration_providers(display_order);
CREATE INDEX idx_integration_providers_available ON public.integration_providers(is_available);

-- Trigger for updated_at
CREATE TRIGGER set_integration_providers_updated_at
  BEFORE UPDATE ON public.integration_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- TABLE 3: integration_fields
-- Define dynamic form fields for each provider
-- ============================================
CREATE TABLE public.integration_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.integration_providers(id) ON DELETE CASCADE,

  -- Field definition
  field_key TEXT NOT NULL, -- e.g., 'api_key', 'client_id', 'domain'
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'password', 'url', 'email', 'select', 'textarea')),

  -- Validation and defaults
  placeholder TEXT,
  default_value TEXT,
  is_required BOOLEAN DEFAULT false,
  is_sensitive BOOLEAN DEFAULT false, -- Should be encrypted

  -- Help and documentation
  help_text TEXT,
  validation_regex TEXT,

  -- Select options (if field_type = 'select')
  select_options JSONB, -- [{ value: 'option1', label: 'Option 1' }]

  -- Display
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure unique field keys per provider
  UNIQUE(provider_id, field_key)
);

-- Indexes
CREATE INDEX idx_integration_fields_provider ON public.integration_fields(provider_id);
CREATE INDEX idx_integration_fields_display_order ON public.integration_fields(display_order);

-- ============================================
-- TABLE 4: organization_integrations
-- Store organization-specific integration configurations
-- ============================================
CREATE TABLE public.organization_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID, -- Future: multi-tenancy support (nullable for now)
  provider_id UUID NOT NULL REFERENCES public.integration_providers(id) ON DELETE CASCADE,

  -- Configuration
  enabled BOOLEAN DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb, -- Encrypted credentials and settings

  -- Connection status
  connection_status TEXT CHECK (connection_status IN ('connected', 'disconnected', 'error', 'testing')) DEFAULT 'disconnected',
  connection_message TEXT, -- Error message or additional info
  last_tested_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,

  -- OAuth tokens (encrypted)
  oauth_tokens JSONB, -- { access_token, refresh_token, expires_at }

  -- Metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraint: one integration per provider per organization
  UNIQUE(organization_id, provider_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_organization_integrations_provider ON public.organization_integrations(provider_id);
CREATE INDEX idx_organization_integrations_org ON public.organization_integrations(organization_id);
CREATE INDEX idx_organization_integrations_enabled ON public.organization_integrations(enabled);
CREATE INDEX idx_organization_integrations_status ON public.organization_integrations(connection_status);

-- Trigger for updated_at
CREATE TRIGGER set_organization_integrations_updated_at
  BEFORE UPDATE ON public.organization_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- TABLE 5: integration_services
-- Individual services within a provider (like AI models within a provider)
-- ============================================
CREATE TABLE public.integration_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.integration_providers(id) ON DELETE CASCADE,

  -- Service identification
  name TEXT NOT NULL,
  service_key TEXT NOT NULL, -- e.g., 'zoom_meetings', 'zoom_recordings'
  description TEXT,

  -- Features and capabilities
  features JSONB, -- { recording: true, transcription: true, breakout_rooms: false }

  -- Pricing (optional, for cost tracking)
  has_cost BOOLEAN DEFAULT false,
  cost_model JSONB, -- { type: 'per_api_call', rate: 0.001 } or { type: 'flat', rate: 10 }

  -- Status
  enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- Like default AI model
  requires_config BOOLEAN DEFAULT false, -- Needs additional setup

  -- Display
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(provider_id, service_key)
);

-- Indexes
CREATE INDEX idx_integration_services_provider ON public.integration_services(provider_id);
CREATE INDEX idx_integration_services_enabled ON public.integration_services(enabled);
CREATE INDEX idx_integration_services_default ON public.integration_services(is_default);

-- Trigger for updated_at
CREATE TRIGGER set_integration_services_updated_at
  BEFORE UPDATE ON public.integration_services
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- TABLE 6: integration_usage_logs
-- Track API usage for analytics (similar to ai_usage_logs)
-- ============================================
CREATE TABLE public.integration_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID, -- Future: multi-tenancy
  provider_id UUID REFERENCES public.integration_providers(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.integration_services(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Usage details
  action TEXT NOT NULL, -- e.g., 'send_email', 'create_meeting', 'upload_file'
  status TEXT CHECK (status IN ('success', 'error', 'partial')) DEFAULT 'success',

  -- Metadata (flexible JSONB for provider-specific data)
  request_metadata JSONB, -- Request details
  response_metadata JSONB, -- Response details
  error_message TEXT,

  -- Cost tracking
  estimated_cost DECIMAL(10, 8) DEFAULT 0,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for analytics queries
CREATE INDEX idx_integration_usage_logs_provider ON public.integration_usage_logs(provider_id);
CREATE INDEX idx_integration_usage_logs_service ON public.integration_usage_logs(service_id);
CREATE INDEX idx_integration_usage_logs_user ON public.integration_usage_logs(user_id);
CREATE INDEX idx_integration_usage_logs_created_at ON public.integration_usage_logs(created_at);
CREATE INDEX idx_integration_usage_logs_org ON public.integration_usage_logs(organization_id);
CREATE INDEX idx_integration_usage_logs_status ON public.integration_usage_logs(status);
CREATE INDEX idx_integration_usage_logs_action ON public.integration_usage_logs(action);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.integration_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_usage_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS: integration_categories
-- ============================================
-- Categories are viewable by all authenticated users
CREATE POLICY "Categories are viewable by authenticated users"
  ON public.integration_categories FOR SELECT
  TO authenticated
  USING (enabled = true OR public.has_role(auth.uid(), 'admin'));

-- Only admins can manage categories
CREATE POLICY "Admins can manage categories"
  ON public.integration_categories FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- RLS: integration_providers
-- ============================================
-- Providers are viewable by all authenticated users
CREATE POLICY "Providers are viewable by authenticated users"
  ON public.integration_providers FOR SELECT
  TO authenticated
  USING (true); -- All providers visible (including coming_soon)

-- Only admins can manage providers
CREATE POLICY "Admins can manage providers"
  ON public.integration_providers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- RLS: integration_fields
-- ============================================
-- Fields are viewable by all authenticated users
CREATE POLICY "Fields are viewable by authenticated users"
  ON public.integration_fields FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage fields
CREATE POLICY "Admins can manage fields"
  ON public.integration_fields FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- RLS: organization_integrations
-- ============================================
-- Only admins can view organization integrations
CREATE POLICY "Admins can view all organization integrations"
  ON public.organization_integrations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can manage organization integrations
CREATE POLICY "Admins can manage organization integrations"
  ON public.organization_integrations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- RLS: integration_services
-- ============================================
-- Services are viewable by all authenticated users
CREATE POLICY "Services are viewable by authenticated users"
  ON public.integration_services FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage services
CREATE POLICY "Admins can manage services"
  ON public.integration_services FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- RLS: integration_usage_logs
-- ============================================
-- Admins can view all usage logs
CREATE POLICY "Admins can view all usage logs"
  ON public.integration_usage_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own usage logs
CREATE POLICY "Users can view their own usage logs"
  ON public.integration_usage_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- System can insert usage logs
CREATE POLICY "System can insert usage logs"
  ON public.integration_usage_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- COMMENTS (Documentation)
-- ============================================
COMMENT ON TABLE public.integration_categories IS 'High-level categories for organizing third-party integrations (AI, Meeting, Email, CRM, etc.)';
COMMENT ON TABLE public.integration_providers IS 'Individual service providers within categories (Zoom, Google, Salesforce, etc.)';
COMMENT ON TABLE public.integration_fields IS 'Dynamic form fields for provider configuration (API keys, OAuth settings, etc.)';
COMMENT ON TABLE public.organization_integrations IS 'Organization-specific integration configurations with encrypted credentials';
COMMENT ON TABLE public.integration_services IS 'Individual services within a provider (similar to AI models within a provider)';
COMMENT ON TABLE public.integration_usage_logs IS 'API usage tracking for analytics, cost monitoring, and debugging';

COMMENT ON COLUMN public.integration_providers.auth_type IS 'Authentication method: api_key, oauth2, basic, service_account';
COMMENT ON COLUMN public.integration_providers.oauth_config IS 'OAuth configuration JSON: { authorize_url, token_url, scopes[] }';
COMMENT ON COLUMN public.organization_integrations.config IS 'Encrypted provider credentials and settings';
COMMENT ON COLUMN public.organization_integrations.oauth_tokens IS 'Encrypted OAuth tokens: { access_token, refresh_token, expires_at }';
COMMENT ON COLUMN public.integration_services.cost_model IS 'Cost structure JSON: { type: "per_api_call", rate: 0.001 }';


