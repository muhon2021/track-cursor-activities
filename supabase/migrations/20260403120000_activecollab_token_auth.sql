-- ActiveCollab uses API token auth (issue-token), not OAuth2.
-- See: https://developers.activecollab.com/api-documentation/v1/authentication.html

DO $$
DECLARE
  pid UUID;
BEGIN
  SELECT id INTO pid FROM public.integration_providers WHERE slug = 'activecollab' LIMIT 1;
  IF pid IS NULL THEN
    RAISE NOTICE 'ActiveCollab provider not found, skipping token-auth migration';
    RETURN;
  END IF;

  UPDATE public.integration_providers
  SET
    auth_type = 'api_key',
    oauth_config = NULL,
    docs_url = COALESCE(
      docs_url,
      'https://developers.activecollab.com/api-documentation/v1/authentication.html'
    )
  WHERE id = pid;

  DELETE FROM public.integration_fields
  WHERE provider_id = pid AND field_key IN ('client_id', 'client_secret');

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
  VALUES (
    pid,
    'base_url',
    'Base URL',
    'url',
    'https://your-company.activecollab.com',
    true,
    false,
    'Your ActiveCollab instance base URL (API lives under /api/v1).',
    10
  )
  ON CONFLICT (provider_id, field_key) DO UPDATE
  SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;

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
  VALUES (
    pid,
    'client_name',
    'Client name',
    'text',
    'Control Tower',
    true,
    false,
    'Application name sent to ActiveCollab when issuing an API token (see issue-token API).',
    20
  )
  ON CONFLICT (provider_id, field_key) DO UPDATE
  SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;

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
  VALUES (
    pid,
    'client_vendor',
    'Client vendor',
    'text',
    'Your company name',
    true,
    false,
    'Vendor name sent to ActiveCollab when issuing an API token (see issue-token API).',
    30
  )
  ON CONFLICT (provider_id, field_key) DO UPDATE
  SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;
END;
$$;
