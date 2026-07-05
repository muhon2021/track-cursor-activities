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

    (cat_crm, 'Pipedrive', 'pipedrive', 'Sales-focused CRM with simple interface', 'api_key', NULL, 'https://developers.pipedrive.com/docs/api/v1', false, true, 30),

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

    (cat_pm, 'Monday.com', 'monday', 'Visual work operating system', 'api_key', NULL, 'https://developer.monday.com/api-reference', false, true, 30),

    (cat_pm, 'Trello', 'trello', 'Simple kanban-style project management', 'api_key', NULL, 'https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization', false, true, 40),

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
