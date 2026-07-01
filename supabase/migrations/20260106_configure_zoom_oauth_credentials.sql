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

