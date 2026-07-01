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
