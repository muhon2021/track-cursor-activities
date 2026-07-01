-- Fellow.ai integration: catalog entry + credential fields (request-time API proxy).
-- Runtime: Edge Function fellow-api reads organization_integrations.config for the signed-in user.

DO $$
DECLARE
  meeting_category_id UUID;
  fellow_provider_id UUID;
BEGIN
  SELECT id INTO meeting_category_id
  FROM public.integration_categories
  WHERE slug = 'meeting-providers'
  LIMIT 1;

  IF meeting_category_id IS NULL THEN
    RAISE EXCEPTION 'integration category meeting-providers not found';
  END IF;

  INSERT INTO public.integration_providers (
    category_id,
    name,
    slug,
    description,
    auth_type,
    docs_url,
    is_available,
    is_coming_soon,
    display_order
  )
  VALUES (
    meeting_category_id,
    'Fellow',
    'fellow',
    'Fellow meeting recordings, notes, and AI action items via Developer API (request-time proxy)',
    'api_key',
    'https://developers.fellow.ai',
    true,
    false,
    35
  )
  ON CONFLICT (slug) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    auth_type = EXCLUDED.auth_type,
    docs_url = EXCLUDED.docs_url,
    is_available = EXCLUDED.is_available,
    is_coming_soon = EXCLUDED.is_coming_soon,
    display_order = EXCLUDED.display_order;

  SELECT id INTO fellow_provider_id
  FROM public.integration_providers
  WHERE slug = 'fellow'
  LIMIT 1;

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
  )
  VALUES
    (
      fellow_provider_id,
      'subdomain',
      'Workspace subdomain',
      'text',
      'e.g. mycompany (for mycompany.fellow.app)',
      true,
      false,
      'The subdomain of your Fellow workspace URL.',
      10
    ),
    (
      fellow_provider_id,
      'api_key',
      'Fellow API key',
      'password',
      'Paste your Fellow Developer API key',
      true,
      true,
      'Create under User settings → Developer API in Fellow.',
      20
    )
  ON CONFLICT (provider_id, field_key) DO UPDATE SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;
END $$;
