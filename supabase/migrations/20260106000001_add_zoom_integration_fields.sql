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

