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


