
INSERT INTO public.integration_categories (name, slug, description, icon, display_order, enabled)
VALUES (
  'CRM Systems',
  'crm-systems',
  'Customer relationship management platforms',
  'Users',
  40,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  enabled = true,
  updated_at = now();

DO $$
DECLARE
  cat_crm UUID;
BEGIN
  SELECT id INTO cat_crm FROM public.integration_categories WHERE slug = 'crm-systems' LIMIT 1;
  IF cat_crm IS NULL THEN
    RAISE EXCEPTION 'crm-systems category missing after upsert';
  END IF;

  INSERT INTO public.integration_providers (
    category_id, name, slug, description, auth_type, oauth_config, docs_url, is_available, is_coming_soon, display_order
  ) VALUES
    (
      cat_crm,
      'Salesforce',
      'salesforce',
      'Enterprise CRM platform with comprehensive features',
      'oauth2',
      '{"authorize_url": "https://login.salesforce.com/services/oauth2/authorize", "token_url": "https://login.salesforce.com/services/oauth2/token", "scopes": ["api", "refresh_token", "offline_access"]}'::jsonb,
      'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest',
      false,
      true,
      10
    ),
    (
      cat_crm,
      'HubSpot',
      'hubspot',
      'Marketing, sales, and service CRM platform',
      'oauth2',
      '{"authorize_url": "https://app.hubspot.com/oauth/authorize", "token_url": "https://api.hubapi.com/oauth/v1/token", "scopes": ["crm.objects.contacts.read", "crm.objects.contacts.write"]}'::jsonb,
      'https://developers.hubspot.com/docs/api-reference/overview',
      false,
      true,
      20
    ),
    (
      cat_crm,
      'Pipedrive',
      'pipedrive',
      'Sales-focused CRM with simple interface',
      'api_key',
      NULL,
      'https://developers.pipedrive.com/docs/api/v1',
      false,
      true,
      30
    ),
    (
      cat_crm,
      'Zoho CRM',
      'zoho-crm',
      'Affordable CRM for small to medium businesses',
      'oauth2',
      '{"authorize_url": "https://accounts.zoho.com/oauth/v2/auth", "token_url": "https://accounts.zoho.com/oauth/v2/token", "scopes": ["ZohoCRM.modules.ALL", "ZohoCRM.settings.ALL"]}'::jsonb,
      'https://www.zoho.com/crm/developer/docs/api/v8',
      true,
      false,
      40
    )
  ON CONFLICT (slug) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    auth_type = EXCLUDED.auth_type,
    oauth_config = EXCLUDED.oauth_config,
    docs_url = EXCLUDED.docs_url,
    is_available = EXCLUDED.is_available,
    is_coming_soon = EXCLUDED.is_coming_soon,
    display_order = EXCLUDED.display_order,
    updated_at = now();
END $$;
