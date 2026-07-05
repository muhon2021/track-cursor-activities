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


-- 20260103_integration_hub_seed_data.sql
-- ============================================
-- Integration Hub Seed Data
-- Seed categories, providers, fields, and services
-- 20+ integrations across 6 categories
-- ============================================

-- ============================================
-- SEED: Integration Categories
-- ============================================
INSERT INTO public.integration_categories (name, slug, description, icon, display_order, enabled) VALUES
  ('AI Providers', 'ai-providers', 'AI models for chat, embeddings, and analysis', 'Brain', 10, true),
  ('Meeting Providers', 'meeting-providers', 'Video conferencing and meeting platforms', 'Video', 20, true),
  ('Email Providers', 'email-providers', 'Transactional and marketing email services', 'Mail', 30, true),
  ('CRM Systems', 'crm-systems', 'Customer relationship management platforms', 'Users', 40, true),
  ('Project Management', 'project-management', 'Task and project tracking tools', 'Kanban', 50, true),
  ('Storage & Productivity', 'storage-productivity', 'Cloud storage and productivity suites', 'Cloud', 60, true),
  ('Authentication', 'authentication', 'SSO and identity providers', 'Shield', 70, false); -- Disabled for now

-- ============================================
-- SEED: Integration Providers
-- ============================================

-- Get category IDs for provider insertion
DO $$
DECLARE
  cat_ai UUID;
  cat_meeting UUID;
  cat_email UUID;
  cat_crm UUID;
  cat_pm UUID;
  cat_storage UUID;
  cat_auth UUID;
BEGIN
  SELECT id INTO cat_ai FROM public.integration_categories WHERE slug = 'ai-providers';
  SELECT id INTO cat_meeting FROM public.integration_categories WHERE slug = 'meeting-providers';
  SELECT id INTO cat_email FROM public.integration_categories WHERE slug = 'email-providers';
  SELECT id INTO cat_crm FROM public.integration_categories WHERE slug = 'crm-systems';
  SELECT id INTO cat_pm FROM public.integration_categories WHERE slug = 'project-management';
  SELECT id INTO cat_storage FROM public.integration_categories WHERE slug = 'storage-productivity';
  SELECT id INTO cat_auth FROM public.integration_categories WHERE slug = 'authentication';

  -- ============================================
  -- AI PROVIDERS
  -- ============================================
  INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, docs_url, is_available, is_coming_soon, display_order) VALUES
    (cat_ai, 'OpenAI', 'openai', 'Industry-leading AI models for chat, embeddings, and vision', 'api_key', 'https://platform.openai.com/docs', true, false, 10),
    (cat_ai, 'Anthropic Claude', 'anthropic', 'Advanced AI models with extended context and reasoning', 'api_key', 'https://docs.anthropic.com', true, false, 20),
    (cat_ai, 'Google Gemini', 'google-gemini', 'Multimodal AI models from Google', 'api_key', 'https://ai.google.dev/docs', true, false, 30),
    (cat_ai, 'Perplexity', 'perplexity', 'AI with real-time web search capabilities', 'api_key', 'https://docs.perplexity.ai', true, false, 40);

  -- ============================================
  -- MEETING PROVIDERS
  -- ============================================
  INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, oauth_config, docs_url, is_available, is_coming_soon, display_order) VALUES
    (cat_meeting, 'Zoom', 'zoom', 'Video conferencing with recordings and transcriptions', 'oauth2',
      '{"authorize_url": "https://zoom.us/oauth/authorize", "token_url": "https://zoom.us/oauth/token", "scopes": ["user:read", "meeting:read", "recording:read"]}'::jsonb,
      'https://marketplace.zoom.us/docs/api-reference', true, false, 10),

    (cat_meeting, 'Microsoft Teams', 'microsoft-teams', 'Collaboration platform with meetings and chat', 'oauth2',
      '{"authorize_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token", "scopes": ["OnlineMeetings.ReadWrite", "Calendars.ReadWrite"]}'::jsonb,
      'https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview', false, true, 20),

    (cat_meeting, 'Google Meet', 'google-meet', 'Video conferencing integrated with Google Workspace', 'oauth2',
      '{"authorize_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token", "scopes": ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/meetings.space.created"]}'::jsonb,
      'https://developers.google.com/workspace/meet/api/guides/overview', false, true, 30),

    (cat_meeting, 'Cisco Webex', 'webex', 'Enterprise video conferencing and collaboration', 'oauth2',
      '{"authorize_url": "https://api.webex.com/v1/oauth2/authorize", "token_url": "https://api.webex.com/v1/oauth2/token", "scopes": ["spark:all", "meeting:recordings_read"]}'::jsonb,
      'https://developer.webex.com/docs/api/guides/integrations-and-authorization', false, true, 40),

    (cat_meeting, 'GoToMeeting', 'gotomeeting', 'Reliable video conferencing for businesses', 'oauth2',
      '{"authorize_url": "https://api.getgo.com/oauth/v2/authorize", "token_url": "https://api.getgo.com/oauth/v2/token", "scopes": ["meeting:read", "meeting:write"]}'::jsonb,
      'https://developer.goto.com/GoToMeetingV1', false, true, 50);

  -- ============================================
  -- EMAIL PROVIDERS
  -- ============================================
  INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, docs_url, is_available, is_coming_soon, display_order) VALUES
    (cat_email, 'SendGrid', 'sendgrid', 'Reliable email delivery platform by Twilio', 'api_key', 'https://docs.sendgrid.com', true, false, 10),
    (cat_email, 'Mailgun', 'mailgun', 'Developer-friendly email automation service', 'api_key', 'https://documentation.mailgun.com', false, true, 20),
    (cat_email, 'Postmark', 'postmark', 'Transactional email with excellent deliverability', 'api_key', 'https://postmarkapp.com/developer', false, true, 30),
    (cat_email, 'Amazon SES', 'amazon-ses', 'Cost-effective email service from AWS', 'service_account', 'https://docs.aws.amazon.com/ses', false, true, 40),
    (cat_email, 'Resend', 'resend', 'Modern email API for developers', 'api_key', 'https://resend.com/docs', false, true, 50);

  -- ============================================
  -- CRM SYSTEMS
  -- ============================================
  INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, oauth_config, docs_url, is_available, is_coming_soon, display_order) VALUES
    (cat_crm, 'Salesforce', 'salesforce', 'Enterprise CRM platform with comprehensive features', 'oauth2',
      '{"authorize_url": "https://login.salesforce.com/services/oauth2/authorize", "token_url": "https://login.salesforce.com/services/oauth2/token", "scopes": ["api", "refresh_token", "offline_access"]}'::jsonb,
      'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest', false, true, 10),

    (cat_crm, 'HubSpot', 'hubspot', 'Marketing, sales, and service CRM platform', 'oauth2',
      '{"authorize_url": "https://app.hubspot.com/oauth/authorize", "token_url": "https://api.hubapi.com/oauth/v1/token", "scopes": ["crm.objects.contacts.read", "crm.objects.contacts.write"]}'::jsonb,
      'https://developers.hubspot.com/docs/api-reference/overview', false, true, 20),

    (cat_crm, 'Pipedrive', 'pipedrive', 'Sales-focused CRM with simple interface', 'api_key', 'https://developers.pipedrive.com/docs/api/v1', false, true, 30),

    (cat_crm, 'Zoho CRM', 'zoho-crm', 'Affordable CRM for small to medium businesses', 'oauth2',
      '{"authorize_url": "https://accounts.zoho.com/oauth/v2/auth", "token_url": "https://accounts.zoho.com/oauth/v2/token", "scopes": ["ZohoCRM.modules.ALL"]}'::jsonb,
      'https://www.zoho.com/crm/developer/docs/api/v8', false, true, 40);

  -- ============================================
  -- PROJECT MANAGEMENT
  -- ============================================
  INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, oauth_config, docs_url, is_available, is_coming_soon, display_order) VALUES
    (cat_pm, 'Jira', 'jira', 'Issue tracking and project management by Atlassian', 'oauth2',
      '{"authorize_url": "https://auth.atlassian.com/authorize", "token_url": "https://auth.atlassian.com/oauth/token", "scopes": ["read:jira-work", "write:jira-work"]}'::jsonb,
      'https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro', false, true, 10),

    (cat_pm, 'Asana', 'asana', 'Work management platform for team collaboration', 'oauth2',
      '{"authorize_url": "https://app.asana.com/-/oauth_authorize", "token_url": "https://app.asana.com/-/oauth_token", "scopes": ["default"]}'::jsonb,
      'https://developers.asana.com/docs/authentication', false, true, 20),

    (cat_pm, 'Monday.com', 'monday', 'Visual work operating system', 'api_key', 'https://developer.monday.com/api-reference', false, true, 30),

    (cat_pm, 'Trello', 'trello', 'Simple kanban-style project management', 'api_key', 'https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization', false, true, 40),

    (cat_pm, 'ClickUp', 'clickup', 'All-in-one productivity platform', 'oauth2',
      '{"authorize_url": "https://app.clickup.com/api", "token_url": "https://api.clickup.com/api/v2/oauth/token", "scopes": ["task:read", "task:write"]}'::jsonb,
      'https://clickup.com/api', false, true, 50);

  -- ============================================
  -- STORAGE & PRODUCTIVITY
  -- ============================================
  INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, oauth_config, docs_url, is_available, is_coming_soon, display_order) VALUES
    (cat_storage, 'Google Workspace', 'google-workspace', 'Drive, Calendar, and Meet from Google', 'oauth2',
      '{"authorize_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token", "scopes": ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/meetings.space.created"]}'::jsonb,
      'https://developers.google.com/workspace', false, true, 10),

    (cat_storage, 'Microsoft 365', 'microsoft-365', 'OneDrive, Outlook, and Teams from Microsoft', 'oauth2',
      '{"authorize_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token", "scopes": ["Files.ReadWrite.All", "Mail.ReadWrite", "Calendars.ReadWrite"]}'::jsonb,
      'https://learn.microsoft.com/en-us/graph/overview', false, true, 20);

END $$;

-- ============================================
-- SEED: Integration Fields
-- Define required fields for each provider
-- ============================================

-- This will be populated dynamically, but let's add fields for available providers

DO $$
DECLARE
  provider_openai UUID;
  provider_anthropic UUID;
  provider_gemini UUID;
  provider_perplexity UUID;
  provider_sendgrid UUID;
  provider_zoom UUID;
BEGIN
  -- Get provider IDs
  SELECT id INTO provider_openai FROM public.integration_providers WHERE slug = 'openai';
  SELECT id INTO provider_anthropic FROM public.integration_providers WHERE slug = 'anthropic';
  SELECT id INTO provider_gemini FROM public.integration_providers WHERE slug = 'google-gemini';
  SELECT id INTO provider_perplexity FROM public.integration_providers WHERE slug = 'perplexity';
  SELECT id INTO provider_sendgrid FROM public.integration_providers WHERE slug = 'sendgrid';
  SELECT id INTO provider_zoom FROM public.integration_providers WHERE slug = 'zoom';

  -- ============================================
  -- OPENAI FIELDS
  -- ============================================
  INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order) VALUES
    (provider_openai, 'api_key', 'API Key', 'password', 'sk-...', true, true, 'Your OpenAI API key from platform.openai.com', 10),
    (provider_openai, 'organization_id', 'Organization ID', 'text', 'org-...', false, false, 'Optional: For organization-scoped API keys', 20),
    (provider_openai, 'base_url', 'Base URL', 'url', 'https://api.openai.com/v1', false, false, 'Optional: Override default API endpoint', 30);

  -- ============================================
  -- ANTHROPIC FIELDS
  -- ============================================
  INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order) VALUES
    (provider_anthropic, 'api_key', 'API Key', 'password', 'sk-ant-...', true, true, 'Your Anthropic API key from console.anthropic.com', 10),
    (provider_anthropic, 'base_url', 'Base URL', 'url', 'https://api.anthropic.com/v1', false, false, 'Optional: Override default API endpoint', 20);

  -- ============================================
  -- GOOGLE GEMINI FIELDS
  -- ============================================
  INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order) VALUES
    (provider_gemini, 'api_key', 'API Key', 'password', 'AIza...', true, true, 'Your Google AI API key from ai.google.dev', 10);

  -- ============================================
  -- PERPLEXITY FIELDS
  -- ============================================
  INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order) VALUES
    (provider_perplexity, 'api_key', 'API Key', 'password', 'pplx-...', true, true, 'Your Perplexity API key from perplexity.ai/settings', 10);

  -- ============================================
  -- SENDGRID FIELDS
  -- ============================================
  INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order) VALUES
    (provider_sendgrid, 'api_key', 'API Key', 'password', 'SG.…', true, true, 'Your SendGrid API key from app.sendgrid.com/settings/api_keys', 10),
    (provider_sendgrid, 'from_email', 'From Email', 'email', 'noreply@company.com', true, false, 'Default sender email address', 20),
    (provider_sendgrid, 'from_name', 'From Name', 'text', 'Your Company', false, false, 'Default sender name', 30);

  -- ============================================
  -- ZOOM FIELDS (OAuth - no fields needed, handled via OAuth flow)
  -- ============================================
  -- Zoom uses OAuth, so no API key fields needed

END $$;

-- ============================================
-- SEED: Integration Services
-- Define services for providers (like AI models)
-- ============================================

DO $$
DECLARE
  provider_zoom UUID;
  provider_sendgrid UUID;
BEGIN
  SELECT id INTO provider_zoom FROM public.integration_providers WHERE slug = 'zoom';
  SELECT id INTO provider_sendgrid FROM public.integration_providers WHERE slug = 'sendgrid';

  -- ============================================
  -- ZOOM SERVICES
  -- ============================================
  INSERT INTO public.integration_services (provider_id, name, service_key, description, features, enabled, is_default, display_order) VALUES
    (provider_zoom, 'Meeting Synchronization', 'zoom_meetings', 'Sync meeting metadata and participant information', '{"calendar_sync": true, "participant_tracking": true}'::jsonb, true, true, 10),
    (provider_zoom, 'Recording Downloads', 'zoom_recordings', 'Automatically download meeting recordings', '{"video": true, "audio": true, "storage_options": ["database", "s3", "google_drive"]}'::jsonb, true, false, 20),
    (provider_zoom, 'Transcript Processing', 'zoom_transcripts', 'Process and analyze meeting transcripts with AI', '{"ai_summary": true, "speaker_identification": true, "action_items": true}'::jsonb, true, false, 30),
    (provider_zoom, 'Webhook Events', 'zoom_webhooks', 'Real-time event notifications', '{"meeting_started": true, "meeting_ended": true, "recording_completed": true}'::jsonb, false, false, 40);

  -- ============================================
  -- SENDGRID SERVICES
  -- ============================================
  INSERT INTO public.integration_services (provider_id, name, service_key, description, features, enabled, is_default, display_order) VALUES
    (provider_sendgrid, 'Transactional Emails', 'sendgrid_transactional', 'Send transactional emails', '{"templates": true, "personalization": true}'::jsonb, true, true, 10),
    (provider_sendgrid, 'Email Analytics', 'sendgrid_analytics', 'Track email opens, clicks, and deliverability', '{"open_tracking": true, "click_tracking": true}'::jsonb, true, false, 20);

END $$;

-- ============================================
-- Success Message
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Integration Hub seed data loaded successfully!';
  RAISE NOTICE 'Categories: % ', (SELECT COUNT(*) FROM public.integration_categories);
  RAISE NOTICE 'Providers: % ', (SELECT COUNT(*) FROM public.integration_providers);
  RAISE NOTICE 'Fields: % ', (SELECT COUNT(*) FROM public.integration_fields);
  RAISE NOTICE 'Services: % ', (SELECT COUNT(*) FROM public.integration_services);
END $$;


-- 20260103_knowledge_enhancements.sql
-- Knowledge Base Enhancement Migration
-- Adds embedding status tracking, bookmarks, and auto-embedding triggers

-- =====================================================
-- 1. Add embedding status columns to knowledge_entries
-- =====================================================

ALTER TABLE knowledge_entries
ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'processing', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS embedding_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_embedded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reading_time_minutes INTEGER;

-- Create index on embedding_status for filtering
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_embedding_status ON knowledge_entries(embedding_status);

-- Add comment for clarity
COMMENT ON COLUMN knowledge_entries.embedding_status IS 'Status of embedding generation: pending, processing, completed, or failed';
COMMENT ON COLUMN knowledge_entries.embedding_count IS 'Number of embedding chunks generated for this entry';
COMMENT ON COLUMN knowledge_entries.last_embedded_at IS 'Timestamp when embeddings were last generated';
COMMENT ON COLUMN knowledge_entries.reading_time_minutes IS 'Estimated reading time in minutes';

-- =====================================================
-- 2. Create knowledge_bookmarks table for user favorites
-- =====================================================

CREATE TABLE IF NOT EXISTS knowledge_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate bookmarks
  UNIQUE(user_id, entry_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_knowledge_bookmarks_user_id ON knowledge_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bookmarks_entry_id ON knowledge_bookmarks(entry_id);

-- Add comment
COMMENT ON TABLE knowledge_bookmarks IS 'User bookmarks/favorites for knowledge base entries';

-- =====================================================
-- 3. Enable RLS on knowledge_bookmarks
-- =====================================================

ALTER TABLE knowledge_bookmarks ENABLE ROW LEVEL SECURITY;

-- Users can manage their own bookmarks
CREATE POLICY "Users can view own bookmarks"
  ON knowledge_bookmarks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own bookmarks"
  ON knowledge_bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks"
  ON knowledge_bookmarks FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 4. Function to calculate reading time
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_reading_time(content_text TEXT)
RETURNS INTEGER AS $$
DECLARE
  word_count INTEGER;
  reading_time INTEGER;
BEGIN
  -- Count words (split by spaces, roughly)
  word_count := array_length(regexp_split_to_array(content_text, '\s+'), 1);

  -- Average reading speed: 200 words per minute
  reading_time := CEIL(word_count::FLOAT / 200.0);

  -- Minimum 1 minute
  IF reading_time < 1 THEN
    reading_time := 1;
  END IF;

  RETURN reading_time;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_reading_time IS 'Calculates estimated reading time in minutes based on word count';

-- =====================================================
-- 5. Function to trigger embedding generation
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_knowledge_embedding()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for published entries with content
  IF NEW.status = 'published' AND NEW.content IS NOT NULL AND NEW.content != '' THEN

    -- If content changed or first time publishing, mark as pending
    IF (TG_OP = 'INSERT') OR (OLD.content != NEW.content) OR (OLD.status != 'published') THEN
      NEW.embedding_status := 'pending';

      -- Calculate reading time
      NEW.reading_time_minutes := calculate_reading_time(NEW.content);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_knowledge_embedding IS 'Automatically marks knowledge entries for embedding when published or content changes';

-- =====================================================
-- 6. Create trigger on knowledge_entries
-- =====================================================

DROP TRIGGER IF EXISTS knowledge_entry_embedding_trigger ON knowledge_entries;

CREATE TRIGGER knowledge_entry_embedding_trigger
  BEFORE INSERT OR UPDATE ON knowledge_entries
  FOR EACH ROW
  EXECUTE FUNCTION trigger_knowledge_embedding();

-- =====================================================
-- 7. Update existing entries with reading time
-- =====================================================

UPDATE knowledge_entries
SET reading_time_minutes = calculate_reading_time(content)
WHERE content IS NOT NULL AND reading_time_minutes IS NULL;

-- =====================================================
-- 8. Add embedding metadata to embeddings table
-- =====================================================

-- Add model_name column to track which embedding model was used
ALTER TABLE embeddings
ADD COLUMN IF NOT EXISTS model_name TEXT,
ADD COLUMN IF NOT EXISTS model_provider TEXT,
ADD COLUMN IF NOT EXISTS embedding_dimensions INTEGER;

-- Create index for querying by model
CREATE INDEX IF NOT EXISTS idx_embeddings_model_name ON embeddings(model_name);

COMMENT ON COLUMN embeddings.model_name IS 'Name of the AI model used to generate this embedding';
COMMENT ON COLUMN embeddings.model_provider IS 'Provider of the embedding model (openai, google, etc)';
COMMENT ON COLUMN embeddings.embedding_dimensions IS 'Dimensionality of the embedding vector';

-- =====================================================
-- 9. Function to get category statistics
-- =====================================================

CREATE OR REPLACE FUNCTION get_category_stats(category_uuid UUID)
RETURNS TABLE (
  entry_count BIGINT,
  published_count BIGINT,
  draft_count BIGINT,
  total_views BIGINT,
  last_updated TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as entry_count,
    COUNT(*) FILTER (WHERE status = 'published')::BIGINT as published_count,
    COUNT(*) FILTER (WHERE status = 'draft')::BIGINT as draft_count,
    COALESCE(SUM(view_count), 0)::BIGINT as total_views,
    MAX(updated_at) as last_updated
  FROM knowledge_entries
  WHERE category_id = category_uuid;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_category_stats IS 'Returns statistics for a knowledge category including entry counts and views';

-- =====================================================
-- 10. View for knowledge entries with bookmark status
-- =====================================================

CREATE OR REPLACE VIEW knowledge_entries_with_bookmarks AS
SELECT
  ke.*,
  EXISTS(
    SELECT 1 FROM knowledge_bookmarks kb
    WHERE kb.entry_id = ke.id AND kb.user_id = auth.uid()
  ) as is_bookmarked,
  (
    SELECT COUNT(*) FROM knowledge_bookmarks kb2
    WHERE kb2.entry_id = ke.id
  ) as bookmark_count
FROM knowledge_entries ke;

COMMENT ON VIEW knowledge_entries_with_bookmarks IS 'Knowledge entries with bookmark status for current user';

-- =====================================================
-- 11. Function to increment view count
-- =====================================================

CREATE OR REPLACE FUNCTION increment_view_count(entry_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE knowledge_entries
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = entry_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_view_count IS 'Increments the view count for a knowledge entry';

-- =====================================================
-- 12. Add embedding model selection to ai_models
-- =====================================================

ALTER TABLE ai_models
ADD COLUMN IF NOT EXISTS is_default_embedding BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN ai_models.is_default_embedding IS 'Indicates if this is the default model for knowledge base embeddings';

-- Create index for quick lookup
CREATE INDEX IF NOT EXISTS idx_ai_models_default_embedding ON ai_models(is_default_embedding) WHERE is_default_embedding = true;

-- =====================================================
-- 13. Grant permissions
-- =====================================================

-- Grant access to the new table and functions
GRANT ALL ON knowledge_bookmarks TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_reading_time TO authenticated;
GRANT EXECUTE ON FUNCTION get_category_stats TO authenticated;
GRANT EXECUTE ON FUNCTION increment_view_count TO authenticated;
GRANT SELECT ON knowledge_entries_with_bookmarks TO authenticated;


-- 20260103_link_ai_providers_to_integrations.sql
-- Migration: Link AI Providers to Integration Providers
-- Date: 2026-01-03
-- Purpose: Add integration_provider_id to ai_providers table to unify AI and Integration systems

-- Add integration_provider_id column to ai_providers table
ALTER TABLE public.ai_providers
ADD COLUMN integration_provider_id UUID REFERENCES public.integration_providers(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_ai_providers_integration_provider_id
ON public.ai_providers(integration_provider_id);

-- Update existing AI providers to link to their integration counterparts
-- OpenAI
UPDATE public.ai_providers
SET integration_provider_id = (
  SELECT id FROM public.integration_providers WHERE slug = 'openai' LIMIT 1
)
WHERE slug = 'openai';

-- Anthropic
UPDATE public.ai_providers
SET integration_provider_id = (
  SELECT id FROM public.integration_providers WHERE slug = 'anthropic' LIMIT 1
)
WHERE slug = 'anthropic';

-- Google AI (maps to google-gemini in integrations)
UPDATE public.ai_providers
SET integration_provider_id = (
  SELECT id FROM public.integration_providers WHERE slug = 'google-gemini' LIMIT 1
)
WHERE slug = 'google';

-- Perplexity
UPDATE public.ai_providers
SET integration_provider_id = (
  SELECT id FROM public.integration_providers WHERE slug = 'perplexity' LIMIT 1
)
WHERE slug = 'perplexity';

-- Add comment to explain the relationship
COMMENT ON COLUMN public.ai_providers.integration_provider_id IS
'Links AI provider to its corresponding integration provider for unified management';

-- Create a view that combines ai_providers with their integration status
CREATE OR REPLACE VIEW public.ai_providers_with_integration_status AS
SELECT
  ap.id,
  ap.name,
  ap.slug,
  ap.enabled AS provider_enabled,
  ap.api_key_secret_name,
  ap.description,
  ap.integration_provider_id,
  ip.name AS integration_provider_name,
  oi.id AS org_integration_id,
  oi.connection_status,
  oi.enabled AS integration_enabled,
  oi.config AS integration_config,
  CASE
    WHEN oi.connection_status = 'connected' THEN true
    ELSE false
  END AS is_connected
FROM public.ai_providers ap
LEFT JOIN public.integration_providers ip ON ap.integration_provider_id = ip.id
LEFT JOIN public.organization_integrations oi ON ip.id = oi.provider_id
ORDER BY ap.name;

-- Grant select permission on the view
GRANT SELECT ON public.ai_providers_with_integration_status TO authenticated;

-- Add RLS policy for the view (inherits from base tables)
COMMENT ON VIEW public.ai_providers_with_integration_status IS
'Combines AI providers with their integration connection status for unified display';


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


-- 20260105_user_oauth_tokens.sql
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


-- 20260105_webhook_logs.sql
-- ============================================
-- Webhook Logs Table
-- Stores incoming webhook events for debugging and audit
-- Sprint 5: Edge Functions Deployment
-- ============================================

-- Create the webhook_logs table
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,              -- 'zoom', 'google', 'microsoft', etc.
  event_type TEXT NOT NULL,            -- Event type from provider
  payload JSONB NOT NULL DEFAULT '{}', -- Full webhook payload
  processed BOOLEAN DEFAULT false,     -- Whether event has been processed
  processed_at TIMESTAMPTZ,           -- When event was processed
  error_message TEXT,                  -- Error if processing failed
  received_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_webhook_logs_provider
  ON public.webhook_logs(provider);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type
  ON public.webhook_logs(event_type);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_received_at
  ON public.webhook_logs(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed
  ON public.webhook_logs(processed)
  WHERE processed = false;

-- Enable RLS
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view webhook logs (for debugging)
CREATE POLICY "Admins can view webhook logs"
  ON public.webhook_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role can insert logs (edge functions)
CREATE POLICY "Service role can insert webhook logs"
  ON public.webhook_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Service role can update logs
CREATE POLICY "Service role can update webhook logs"
  ON public.webhook_logs
  FOR UPDATE
  TO service_role
  USING (true);

-- Comments
COMMENT ON TABLE public.webhook_logs IS 'Stores incoming webhook events from external providers for debugging and audit purposes';
COMMENT ON COLUMN public.webhook_logs.provider IS 'Provider identifier (zoom, google, microsoft)';
COMMENT ON COLUMN public.webhook_logs.event_type IS 'Event type from the provider (e.g., recording.completed)';
COMMENT ON COLUMN public.webhook_logs.payload IS 'Full JSON payload received from the webhook';
COMMENT ON COLUMN public.webhook_logs.processed IS 'Whether the event has been successfully processed';

-- Cleanup old logs (keep 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.webhook_logs
  WHERE received_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'webhook_logs table created successfully for Sprint 5!';
END $$;


-- 20260106_add_zoom_integration_fields.sql
-- ============================================
-- Add Integration Fields for Zoom OAuth Configuration
-- This migration adds form fields for configuring Zoom OAuth credentials
-- ============================================

-- Get the Zoom provider ID
DO $$
DECLARE
  provider_zoom_id UUID;
BEGIN
  -- Get Zoom provider ID
  SELECT id INTO provider_zoom_id
  FROM public.integration_providers
  WHERE slug = 'zoom'
  LIMIT 1;

  -- Only proceed if Zoom provider exists
  IF provider_zoom_id IS NOT NULL THEN
    -- Add Client ID field
    INSERT INTO public.integration_fields (
      provider_id,
      field_key,
      label,
      field_type,
      placeholder,
      is_required,
      is_sensitive,
      help_text,
      display_order
    ) VALUES (
      provider_zoom_id,
      'client_id',
      'Client ID',
      'text',
      'Enter your Zoom OAuth Client ID',
      true,
      false,
      'Your Zoom OAuth application Client ID from the Zoom Marketplace',
      10
    )
    ON CONFLICT (provider_id, field_key) DO NOTHING;

    -- Add Client Secret field
    INSERT INTO public.integration_fields (
      provider_id,
      field_key,
      label,
      field_type,
      placeholder,
      is_required,
      is_sensitive,
      help_text,
      display_order
    ) VALUES (
      provider_zoom_id,
      'client_secret',
      'Client Secret',
      'password',
      'Enter your Zoom OAuth Client Secret',
      true,
      true,
      'Your Zoom OAuth application Client Secret from the Zoom Marketplace',
      20
    )
    ON CONFLICT (provider_id, field_key) DO NOTHING;

    RAISE NOTICE 'Added integration fields for Zoom provider';
  ELSE
    RAISE NOTICE 'Zoom provider not found, skipping field creation';
  END IF;
END $$;



-- 20260106_configure_zoom_oauth_credentials.sql
-- ============================================
-- Configure Zoom OAuth Credentials
-- This script sets up the Zoom integration with OAuth credentials
-- ============================================

DO $$
DECLARE
  provider_zoom_id UUID;
  org_integration_id UUID;
BEGIN
  -- Get Zoom provider ID
  SELECT id INTO provider_zoom_id
  FROM public.integration_providers
  WHERE slug = 'zoom'
  LIMIT 1;

  IF provider_zoom_id IS NULL THEN
    RAISE EXCEPTION 'Zoom provider not found. Please run the integration_hub_seed_data migration first.';
  END IF;

  -- Check if organization_integration already exists
  SELECT id INTO org_integration_id
  FROM public.organization_integrations
  WHERE provider_id = provider_zoom_id
  LIMIT 1;

  IF org_integration_id IS NOT NULL THEN
    -- Update existing integration
    UPDATE public.organization_integrations
    SET
      config = jsonb_build_object(
        'client_id', 'RmaKdFehQWKQOC7jZTYZBw',
        'client_secret', 'CDDXyZIpOU5D8ZyqcY25OdvFNNRalASJ'
      ),
      enabled = true,
      connection_status = 'disconnected',
      updated_at = now()
    WHERE id = org_integration_id;

    RAISE NOTICE 'Updated existing Zoom integration with OAuth credentials';
  ELSE
    -- Create new integration
    INSERT INTO public.organization_integrations (
      provider_id,
      enabled,
      config,
      connection_status
    ) VALUES (
      provider_zoom_id,
      true,
      jsonb_build_object(
        'client_id', 'RmaKdFehQWKQOC7jZTYZBw',
        'client_secret', 'CDDXyZIpOU5D8ZyqcY25OdvFNNRalASJ'
      ),
      'disconnected'
    );

    RAISE NOTICE 'Created Zoom integration with OAuth credentials';
  END IF;

  RAISE NOTICE 'Zoom OAuth credentials configured successfully!';
  RAISE NOTICE 'Client ID: RmaKdFehQWKQOC7jZTYZBw';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Make sure your Zoom OAuth app has the redirect URL configured';
  RAISE NOTICE '2. Go to Admin → Integrations → Zoom to test the connection';
END $$;



-- 20260110191303_abdf3499-f9a5-41de-bee1-8efc7c1925a1.sql
-- Table to store user's Microsoft Teams
CREATE TABLE IF NOT EXISTS public.user_microsoft_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  visibility TEXT,
  web_url TEXT,
  is_archived BOOLEAN DEFAULT false,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, team_id)
);

-- Enable RLS
ALTER TABLE public.user_microsoft_teams ENABLE ROW LEVEL SECURITY;

-- Users can only see their own teams
CREATE POLICY "Users can view own teams" ON public.user_microsoft_teams
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own teams
CREATE POLICY "Users can insert own teams" ON public.user_microsoft_teams
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own teams
CREATE POLICY "Users can update own teams" ON public.user_microsoft_teams
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own teams
CREATE POLICY "Users can delete own teams" ON public.user_microsoft_teams
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_user_microsoft_teams_user_id ON public.user_microsoft_teams(user_id);
CREATE INDEX idx_user_microsoft_teams_team_id ON public.user_microsoft_teams(team_id);

-- Updated_at trigger
CREATE TRIGGER trigger_update_user_microsoft_teams_timestamp
  BEFORE UPDATE ON public.user_microsoft_teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 20260110192344_febb71a4-312b-441c-b67c-cce5d6d9ef31.sql
-- Create or replace trigger function for updated_at
CREATE OR REPLACE FUNCTION update_user_microsoft_teams_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Table to store Microsoft Teams channels
CREATE TABLE IF NOT EXISTS public.user_microsoft_teams_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  membership_type TEXT,
  web_url TEXT,
  email TEXT,
  is_favorite BOOLEAN DEFAULT false,
  created_date_time TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, team_id, channel_id)
);

-- Enable RLS
ALTER TABLE public.user_microsoft_teams_channels ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own channels" ON public.user_microsoft_teams_channels
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own channels" ON public.user_microsoft_teams_channels
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own channels" ON public.user_microsoft_teams_channels
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own channels" ON public.user_microsoft_teams_channels
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_user_ms_channels_user_team 
  ON public.user_microsoft_teams_channels(user_id, team_id);
CREATE INDEX idx_user_ms_channels_channel_id 
  ON public.user_microsoft_teams_channels(channel_id);

-- Updated_at trigger
CREATE TRIGGER trigger_update_user_ms_channels_timestamp
  BEFORE UPDATE ON public.user_microsoft_teams_channels
  FOR EACH ROW
  EXECUTE FUNCTION update_user_microsoft_teams_timestamp();

-- 20260110192415_fe49c977-d60a-472e-9bd5-b176677e21ff.sql
-- Fix function search_path for security
CREATE OR REPLACE FUNCTION update_user_microsoft_teams_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 20260110200245_c3a4fb1b-891a-45ac-ae18-a12c3b23ec86.sql
-- Create table for Microsoft Graph webhook subscriptions
CREATE TABLE IF NOT EXISTS public.graph_webhook_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id TEXT NOT NULL UNIQUE,
  resource TEXT NOT NULL,
  change_types TEXT[] NOT NULL DEFAULT ARRAY['created', 'updated', 'deleted'],
  notification_url TEXT NOT NULL,
  client_state TEXT NOT NULL, -- Encrypted secret for verification
  expiration_datetime TIMESTAMPTZ NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_notification_at TIMESTAMPTZ,
  error_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB
);

-- Create table for webhook notification logs
CREATE TABLE IF NOT EXISTS public.graph_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  resource_data JSONB,
  client_state_valid BOOLEAN NOT NULL DEFAULT false,
  processing_status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  metadata JSONB
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_graph_webhook_subscriptions_user ON public.graph_webhook_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_graph_webhook_subscriptions_active ON public.graph_webhook_subscriptions(is_active, expiration_datetime);
CREATE INDEX IF NOT EXISTS idx_graph_webhook_subscriptions_subscription_id ON public.graph_webhook_subscriptions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_graph_webhook_logs_subscription ON public.graph_webhook_logs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_graph_webhook_logs_received ON public.graph_webhook_logs(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_graph_webhook_logs_status ON public.graph_webhook_logs(processing_status);

-- Enable RLS
ALTER TABLE public.graph_webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for subscriptions - users can only see their own
CREATE POLICY "Users can view their own webhook subscriptions"
  ON public.graph_webhook_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own webhook subscriptions"
  ON public.graph_webhook_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own webhook subscriptions"
  ON public.graph_webhook_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own webhook subscriptions"
  ON public.graph_webhook_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for logs - service role only (edge functions)
-- Users cannot directly access logs, only through API
CREATE POLICY "Service role can manage webhook logs"
  ON public.graph_webhook_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_graph_webhook_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_graph_webhook_subscriptions_updated_at
  BEFORE UPDATE ON public.graph_webhook_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_graph_webhook_updated_at();

-- 20260110200619_ed859cde-1448-4e9d-8da6-b342ead96344.sql
-- Fix RLS for graph_webhook_logs to be service-role only (no public access)
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can manage webhook logs" ON public.graph_webhook_logs;

-- Create a policy that only allows authenticated users to read their own subscription logs
-- Edge functions with service_role key bypass RLS entirely
CREATE POLICY "Users can view logs for their subscriptions"
  ON public.graph_webhook_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.graph_webhook_subscriptions s
      WHERE s.subscription_id = graph_webhook_logs.subscription_id
      AND s.user_id = auth.uid()
    )
  );

-- Fix function search path for update_graph_webhook_updated_at
CREATE OR REPLACE FUNCTION update_graph_webhook_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 20260114113758_3bf44321-b44d-4220-bc93-a60d5485fadf.sql
DELETE FROM meetings WHERE id IN (
  '60370afd-1e26-40f3-b9b9-cf843737df26',
  'e688ec82-7fdd-441f-b78c-ff3177776471',
  'c64d686c-0ff4-495b-8629-ab9937faa667',
  '2b241bb6-fd44-454f-869e-6f1a4861a49f',
  'b30709e4-b97e-437c-a38d-19f25636b4e1',
  '623a13e5-a740-4186-87b4-7e82e7fc8738',
  '278956e9-6b46-4ae2-a5c4-63ffa74f3726',
  '2ff0a204-e7db-4025-b978-ad4f261c129a',
  '44a7a56a-46f0-4fef-843e-620b97d24c19',
  '043e737e-fbbc-49f6-87a2-26bc25e17840'
)

-- 20260115120000_meeting_provider_phase1.sql
-- Phase 1: Provider-agnostic meeting schema updates (additive)

-- Add new provider-agnostic columns to meetings
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'zoom',
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_meeting_id TEXT,
  ADD COLUMN IF NOT EXISTS external_uuid TEXT,
  ADD COLUMN IF NOT EXISTS join_url TEXT,
  ADD COLUMN IF NOT EXISTS host_url TEXT;

CREATE INDEX IF NOT EXISTS idx_meetings_provider ON public.meetings(provider);
CREATE INDEX IF NOT EXISTS idx_meetings_external_id ON public.meetings(external_id);

-- Backfill provider-agnostic columns from existing Zoom data
UPDATE public.meetings
SET
  provider = 'zoom',
  external_id = zoom_id,
  external_meeting_id = zoom_meeting_id,
  external_uuid = zoom_uuid,
  join_url = zoom_join_url,
  host_url = zoom_start_url
WHERE zoom_id IS NOT NULL OR zoom_meeting_id IS NOT NULL;

-- Create provider-agnostic meeting_files table (parallel to zoom_files)
CREATE TABLE IF NOT EXISTS public.meeting_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'zoom',
  external_meeting_id TEXT,
  file_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_path TEXT,
  storage_path TEXT,
  download_url TEXT,
  transcript_text TEXT,
  transcript_content JSONB,
  is_processed BOOLEAN DEFAULT false,
  has_embeddings BOOLEAN DEFAULT false,
  processing_status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_files_meeting ON public.meeting_files(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_files_type ON public.meeting_files(file_type);
CREATE INDEX IF NOT EXISTS idx_meeting_files_processed ON public.meeting_files(is_processed);
CREATE INDEX IF NOT EXISTS idx_meeting_files_provider ON public.meeting_files(provider);

-- Copy existing zoom_files data into meeting_files
INSERT INTO public.meeting_files (
  id,
  meeting_id,
  provider,
  external_meeting_id,
  file_type,
  file_name,
  file_size,
  file_path,
  storage_path,
  download_url,
  transcript_text,
  transcript_content,
  is_processed,
  has_embeddings,
  processing_status,
  metadata,
  created_at,
  updated_at
)
SELECT
  id,
  meeting_id,
  'zoom',
  NULL,
  file_type,
  file_name,
  file_size,
  file_path,
  storage_path,
  download_url,
  transcript_text,
  transcript_content,
  is_processed,
  has_embeddings,
  processing_status,
  metadata,
  created_at,
  updated_at
FROM public.zoom_files
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.meeting_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all meeting files"
  ON public.meeting_files FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view meeting files"
  ON public.meeting_files FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage meeting files for their meetings"
  ON public.meeting_files FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings
      WHERE meetings.id = meeting_files.meeting_id
        AND meetings.organizer_id = auth.uid()
    )
  );

CREATE TRIGGER update_meeting_files_updated_at
  BEFORE UPDATE ON public.meeting_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Generalize embeddings table with provider-agnostic columns
ALTER TABLE public.embeddings
  ADD COLUMN IF NOT EXISTS provider_corpus_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_document_id TEXT;

UPDATE public.embeddings
SET
  provider_corpus_id = gemini_corpus_id,
  provider_document_id = gemini_document_id
WHERE gemini_corpus_id IS NOT NULL OR gemini_document_id IS NOT NULL;

-- Add feature flag for generic meetings rollout
INSERT INTO public.app_config (key, value, category, description)
VALUES (
  'features.useGenericMeetings',
  'false',
  'features',
  'Use provider-agnostic meeting data and UI'
)
ON CONFLICT (key) DO NOTHING;


-- 20260119194316_ead3d652-fe71-4bac-9263-594289a79adc.sql
-- Phase 1: Provider-Agnostic Meeting System Migration
-- This migration adds generic columns while keeping old columns functional

-- Step 1.1: Add Generic Columns to meetings Table
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'zoom';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS external_meeting_id TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS external_uuid TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS join_url TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS host_url TEXT;

-- Create indexes for provider-based queries
CREATE INDEX IF NOT EXISTS idx_meetings_provider ON meetings(provider);
CREATE INDEX IF NOT EXISTS idx_meetings_external_id ON meetings(external_id);

-- Step 1.2: Backfill Existing Data from Zoom columns
UPDATE meetings SET
  provider = 'zoom',
  external_id = zoom_id,
  external_meeting_id = zoom_meeting_id,
  external_uuid = zoom_uuid,
  join_url = zoom_join_url,
  host_url = zoom_start_url
WHERE zoom_id IS NOT NULL OR zoom_meeting_id IS NOT NULL;

-- Step 1.3: Create meeting_files Table (Provider-Agnostic)
CREATE TABLE IF NOT EXISTS meeting_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'zoom',
  external_meeting_id TEXT,
  file_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_path TEXT,
  storage_path TEXT,
  download_url TEXT,
  transcript_text TEXT,
  transcript_content JSONB,
  is_processed BOOLEAN DEFAULT false,
  has_embeddings BOOLEAN DEFAULT false,
  processing_status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for meeting_files
CREATE INDEX IF NOT EXISTS idx_meeting_files_meeting_id ON meeting_files(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_files_provider ON meeting_files(provider);

-- Copy existing zoom_files data to meeting_files
INSERT INTO meeting_files (
  id, meeting_id, provider, external_meeting_id, file_type, file_name,
  file_size, file_path, storage_path, download_url, transcript_text,
  transcript_content, is_processed, has_embeddings, processing_status,
  metadata, created_at, updated_at
)
SELECT
  id, meeting_id, 'zoom', NULL, file_type, file_name,
  file_size, file_path, storage_path, download_url, transcript_text,
  transcript_content, is_processed, has_embeddings, processing_status,
  COALESCE(metadata, '{}'::jsonb), created_at, updated_at
FROM zoom_files
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on meeting_files
ALTER TABLE meeting_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meeting_files
CREATE POLICY "Admins can manage all meeting files"
  ON meeting_files FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view meeting files"
  ON meeting_files FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage meeting files for their meetings"
  ON meeting_files FOR ALL
  USING (EXISTS (
    SELECT 1 FROM meetings
    WHERE meetings.id = meeting_files.meeting_id
    AND meetings.organizer_id = auth.uid()
  ));

-- Create trigger for updated_at
CREATE TRIGGER update_meeting_files_updated_at
  BEFORE UPDATE ON meeting_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 1.4: Generalize embeddings Table
ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS provider_corpus_id TEXT;
ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS provider_document_id TEXT;

-- Backfill from Gemini-specific columns
UPDATE embeddings SET
  provider_corpus_id = gemini_corpus_id,
  provider_document_id = gemini_document_id
WHERE gemini_corpus_id IS NOT NULL OR gemini_document_id IS NOT NULL;

-- Add useGenericMeetings feature flag
INSERT INTO app_config (key, value, category, description)
VALUES (
  'useGenericMeetings',
  'false'::jsonb,
  'features',
  'Enable provider-agnostic meeting system (Phase 1-3 rollout)'
)
ON CONFLICT (key) DO UPDATE SET
  value = 'false'::jsonb,
  description = 'Enable provider-agnostic meeting system (Phase 1-3 rollout)',
  updated_at = now();

-- 20260120152959_c2442cca-71eb-49e9-b59a-15231d4bdf25.sql
-- Add unique constraint to meeting_files for upsert operations
ALTER TABLE meeting_files 
ADD CONSTRAINT meeting_files_external_meeting_id_file_type_key 
UNIQUE (external_meeting_id, file_type);

-- 20260126_agent_conversations.sql
-- =============================================
-- Phase 1: Agent Conversation Threading
-- Migration: Add conversation threading to AI agents
-- =============================================

-- 1. Add new columns to ai_agents table
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS avatar VARCHAR(255);
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS welcome_message TEXT;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS conversation_starters JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

-- 2. Create agent_conversations table (conversation threads)
CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title VARCHAR(255),
  summary TEXT,

  is_archived BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,

  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for agent_conversations
CREATE INDEX IF NOT EXISTS idx_agent_conversations_agent_user
  ON public.agent_conversations(agent_id, user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_user
  ON public.agent_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_created_at
  ON public.agent_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_last_message
  ON public.agent_conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_archived
  ON public.agent_conversations(user_id, is_archived) WHERE is_archived = false;

-- 3. Create agent_messages table (individual messages in conversations)
CREATE TABLE IF NOT EXISTS public.agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,

  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,

  -- AI response metadata
  model_used VARCHAR(100),
  provider_used VARCHAR(50),
  tokens_input INTEGER,
  tokens_output INTEGER,
  latency_ms INTEGER,

  -- Tool usage tracking
  tool_calls JSONB,
  tool_results JSONB,

  -- Citations from RAG
  citations JSONB DEFAULT '[]'::jsonb,

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for agent_messages
CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation
  ON public.agent_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created_at
  ON public.agent_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_messages_role
  ON public.agent_messages(conversation_id, role);

-- 4. Enable RLS on new tables
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for agent_conversations

-- Users can view their own conversations
CREATE POLICY "Users can view their own conversations"
  ON public.agent_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create conversations
CREATE POLICY "Users can create conversations"
  ON public.agent_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own conversations
CREATE POLICY "Users can update their own conversations"
  ON public.agent_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own conversations
CREATE POLICY "Users can delete their own conversations"
  ON public.agent_conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all conversations
CREATE POLICY "Admins can view all conversations"
  ON public.agent_conversations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. RLS Policies for agent_messages

-- Users can view messages in their conversations
CREATE POLICY "Users can view messages in their conversations"
  ON public.agent_messages FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM public.agent_conversations
      WHERE user_id = auth.uid()
    )
  );

-- Users can create messages in their conversations
CREATE POLICY "Users can create messages in their conversations"
  ON public.agent_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.agent_conversations
      WHERE user_id = auth.uid()
    )
  );

-- Users can delete messages in their conversations
CREATE POLICY "Users can delete messages in their conversations"
  ON public.agent_messages FOR DELETE
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM public.agent_conversations
      WHERE user_id = auth.uid()
    )
  );

-- Admins can view all messages
CREATE POLICY "Admins can view all messages"
  ON public.agent_messages FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. Create triggers for updated_at
CREATE TRIGGER update_agent_conversations_updated_at
  BEFORE UPDATE ON public.agent_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Create function to update conversation stats after message insert
CREATE OR REPLACE FUNCTION public.update_conversation_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.agent_conversations
  SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    updated_at = now()
  WHERE id = NEW.conversation_id;

  -- Also increment agent usage count
  UPDATE public.ai_agents
  SET usage_count = usage_count + 1
  WHERE id = (
    SELECT agent_id FROM public.agent_conversations
    WHERE id = NEW.conversation_id
  )
  AND NEW.role = 'user';  -- Only count user messages

  RETURN NEW;
END;
$$;

CREATE TRIGGER update_conversation_stats_on_message
  AFTER INSERT ON public.agent_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_stats();

-- 9. Create function to auto-generate conversation title
CREATE OR REPLACE FUNCTION public.generate_conversation_title()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only set title if it's null and this is the first user message
  IF NEW.role = 'user' THEN
    UPDATE public.agent_conversations
    SET title = CASE
      WHEN title IS NULL OR title = ''
      THEN LEFT(NEW.content, 100) || CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END
      ELSE title
    END
    WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_generate_conversation_title
  AFTER INSERT ON public.agent_messages
  FOR EACH ROW EXECUTE FUNCTION public.generate_conversation_title();

-- 10. Create helper function to get or create conversation
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  p_agent_id UUID,
  p_user_id UUID,
  p_conversation_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- If conversation_id provided, verify it exists and belongs to user
  IF p_conversation_id IS NOT NULL THEN
    SELECT id INTO v_conversation_id
    FROM public.agent_conversations
    WHERE id = p_conversation_id
      AND user_id = p_user_id
      AND agent_id = p_agent_id;

    IF v_conversation_id IS NOT NULL THEN
      RETURN v_conversation_id;
    END IF;
  END IF;

  -- Create new conversation
  INSERT INTO public.agent_conversations (agent_id, user_id)
  VALUES (p_agent_id, p_user_id)
  RETURNING id INTO v_conversation_id;

  RETURN v_conversation_id;
END;
$$;

-- 11. Create function to archive old conversations
CREATE OR REPLACE FUNCTION public.archive_old_conversations(
  p_user_id UUID,
  p_days_old INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.agent_conversations
  SET is_archived = true
  WHERE user_id = p_user_id
    AND is_archived = false
    AND last_message_at < NOW() - (p_days_old || ' days')::INTERVAL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 12. Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_old_conversations(UUID, INTEGER) TO authenticated;


