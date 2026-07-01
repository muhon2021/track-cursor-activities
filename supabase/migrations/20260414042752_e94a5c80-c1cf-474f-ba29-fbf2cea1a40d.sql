DO $$
DECLARE
  email_category_id UUID;
  outlook_provider_id UUID;
BEGIN
  SELECT id INTO email_category_id
  FROM public.integration_categories
  WHERE slug = 'email'
  LIMIT 1;

  IF email_category_id IS NULL THEN
    RAISE EXCEPTION 'integration category email not found';
  END IF;

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
    email_category_id,
    'Microsoft Outlook',
    'outlook',
    'Connect Outlook mail and calendar via Microsoft Graph (delegated OAuth). Register an Entra app, then each user completes Connect.',
    'oauth2',
    '{
      "authorize_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      "scopes": [
        "openid", "profile", "email", "offline_access",
        "User.Read", "Mail.Read", "Mail.Send", "Calendars.ReadWrite"
      ],
      "default_scopes": [
        "openid", "profile", "email", "offline_access",
        "User.Read", "Mail.Read", "Mail.Send", "Calendars.ReadWrite"
      ]
    }'::jsonb,
    'https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview',
    true,
    false,
    15
  )
  ON CONFLICT (slug) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    auth_type = EXCLUDED.auth_type,
    oauth_config = COALESCE(integration_providers.oauth_config, EXCLUDED.oauth_config),
    docs_url = EXCLUDED.docs_url,
    is_available = EXCLUDED.is_available,
    is_coming_soon = EXCLUDED.is_coming_soon,
    display_order = COALESCE(integration_providers.display_order, EXCLUDED.display_order);

  SELECT id INTO outlook_provider_id
  FROM public.integration_providers
  WHERE slug = 'outlook'
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
      outlook_provider_id,
      'client_id',
      'Application (client) ID',
      'text',
      'Entra app client ID',
      true,
      false,
      'From Microsoft Entra ID → App registrations → your app.',
      10
    ),
    (
      outlook_provider_id,
      'client_secret',
      'Client secret',
      'password',
      'Paste client secret value',
      true,
      true,
      'Create a client secret under Certificates & secrets. Redirect URI in Entra must include {SUPABASE_URL}/functions/v1/user-oauth-callback',
      20
    ),
    (
      outlook_provider_id,
      'tenant_id',
      'Directory (tenant) ID — optional',
      'text',
      'Leave blank for multi-tenant (/common)',
      false,
      false,
      'Single-tenant only: your tenant GUID. When set, authorize and token URLs use this tenant instead of /common.',
      30
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