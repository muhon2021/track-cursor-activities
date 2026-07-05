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

