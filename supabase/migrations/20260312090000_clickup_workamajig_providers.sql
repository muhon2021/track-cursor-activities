-- Enable ClickUp provider and add Workamajig provider + fields
-- This migration assumes the Integration Hub core schema is already applied.

DO $$
DECLARE
  cat_pm UUID;
  provider_clickup UUID;
  provider_workamajig UUID;
BEGIN
  -- Get Project Management category id
  SELECT id INTO cat_pm
  FROM public.integration_categories
  WHERE slug = 'project-management';

  -- Safety guard
  IF cat_pm IS NULL THEN
    RAISE NOTICE 'Project Management category not found, skipping provider setup';
    RETURN;
  END IF;

  -- Ensure ClickUp provider exists and is enabled (was seeded as coming soon)
  SELECT id INTO provider_clickup
  FROM public.integration_providers
  WHERE slug = 'clickup';

  IF provider_clickup IS NULL THEN
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
      'ClickUp',
      'clickup',
      'All-in-one productivity platform',
      'oauth2',
      '{"authorize_url": "https://app.clickup.com/api", "token_url": "https://api.clickup.com/api/v2/oauth/token"}'::jsonb,
      'https://clickup.com/api',
      true,
      false,
      50
    )
    RETURNING id INTO provider_clickup;
  ELSE
    UPDATE public.integration_providers
    SET
      category_id    = COALESCE(category_id, cat_pm),
      auth_type      = 'oauth2',
      oauth_config   = COALESCE(
        oauth_config,
        '{"authorize_url": "https://app.clickup.com/api", "token_url": "https://api.clickup.com/api/v2/oauth/token"}'::jsonb
      ),
      is_available   = true,
      is_coming_soon = false
    WHERE id = provider_clickup;
  END IF;

  -- Ensure Workamajig provider exists (token-based API, not browser OAuth)
  SELECT id INTO provider_workamajig
  FROM public.integration_providers
  WHERE slug = 'workamajig';

  IF provider_workamajig IS NULL THEN
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
      cat_pm,
      'Workamajig',
      'workamajig',
      'Agency project management and finance platform',
      'api_key',
      'https://support.workamajig.com/hc/en-us/articles/360023007451-API-Overview',
      true,
      false,
      60
    )
    RETURNING id INTO provider_workamajig;
  END IF;

  -- Add ClickUp org-level fields (client_id / client_secret) if missing
  IF provider_clickup IS NOT NULL THEN
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
        provider_clickup,
        'client_id',
        'Client ID',
        'text',
        'clk_...',
        true,
        false,
        'ClickUp OAuth app Client ID from your workspace settings',
        10
      )
    ON CONFLICT (provider_id, field_key) DO NOTHING;

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
        provider_clickup,
        'client_secret',
        'Client Secret',
        'password',
        '****************',
        true,
        true,
        'ClickUp OAuth app Client Secret (keep this safe)',
        20
      )
    ON CONFLICT (provider_id, field_key) DO NOTHING;
  END IF;

  -- Optional Workamajig org-level defaults for API usage
  IF provider_workamajig IS NOT NULL THEN
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
        provider_workamajig,
        'base_url',
        'API Base URL',
        'url',
        'https://your-subdomain.workamajig.com',
        true,
        false,
        'Your Workamajig instance base URL (without /api/beta1).',
        10
      )
    ON CONFLICT (provider_id, field_key) DO NOTHING;

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
        provider_workamajig,
        'api_access_token',
        'Company API Access Token',
        'password',
        'APIAccessToken from Workamajig',
        true,
        true,
        'Company API access token from Workamajig API settings (APIAccessToken header).',
        20
      )
    ON CONFLICT (provider_id, field_key) DO NOTHING;

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
        provider_workamajig,
        'user_token',
        'User Token',
        'password',
        'UserToken from Workamajig',
        true,
        true,
        'User-specific API user token from Workamajig (UserToken header).',
        30
      )
    ON CONFLICT (provider_id, field_key) DO NOTHING;
  END IF;
END;
$$;

