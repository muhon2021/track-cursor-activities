-- ActiveCollab: API token via issue-token (org supplies base URL + client app labels).
-- User connects with email/password once; token is stored in user_oauth_tokens.
-- @see https://developers.activecollab.com/api-documentation/v1/authentication.html

DO $$
DECLARE
  cat_pm UUID;
  provider_activecollab UUID;
BEGIN
  SELECT id INTO cat_pm
  FROM public.integration_categories
  WHERE slug = 'project-management'
  LIMIT 1;

  IF cat_pm IS NULL THEN
    RAISE NOTICE 'Project Management category not found, skipping ActiveCollab setup';
    RETURN;
  END IF;

  SELECT id INTO provider_activecollab
  FROM public.integration_providers
  WHERE slug = 'activecollab'
  LIMIT 1;

  IF provider_activecollab IS NULL THEN
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
      display_order
    )
    VALUES (
      cat_pm,
      'ActiveCollab',
      'activecollab',
      'Project management and task tracking with time tracking and invoicing',
      'api_key',
      NULL,
      'https://developers.activecollab.com/api-documentation/v1/authentication.html',
      true,
      false,
      55
    )
    RETURNING id INTO provider_activecollab;
  ELSE
    UPDATE public.integration_providers
    SET
      category_id = cat_pm,
      auth_type = 'api_key',
      oauth_config = NULL,
      docs_url = COALESCE(
        docs_url,
        'https://developers.activecollab.com/api-documentation/v1/authentication.html'
      ),
      is_available = true,
      is_coming_soon = false
    WHERE id = provider_activecollab;
  END IF;

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
    provider_activecollab,
    'base_url',
    'Base URL',
    'url',
    'https://your-company.activecollab.com',
    true,
    false,
    'Your ActiveCollab instance base URL (API under /api/v1).',
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
    provider_activecollab,
    'client_name',
    'Client name',
    'text',
    'Control Tower',
    true,
    false,
    'Application name for ActiveCollab issue-token (see API authentication docs).',
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
    provider_activecollab,
    'client_vendor',
    'Client vendor',
    'text',
    'Your company name',
    true,
    false,
    'Vendor name for ActiveCollab issue-token (see API authentication docs).',
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

  DELETE FROM public.integration_fields
  WHERE provider_id = provider_activecollab AND field_key IN ('client_id', 'client_secret');
END;
$$;
