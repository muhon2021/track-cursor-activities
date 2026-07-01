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
