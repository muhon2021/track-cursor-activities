
-- Add Project Management category and ClickUp/Workamajig providers

INSERT INTO public.integration_categories (name, slug, description, icon, display_order, enabled)
VALUES ('Project Management', 'project-management', 'Project management and productivity tools', 'FolderKanban', 5, true)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  cat_pm UUID;
  provider_clickup UUID;
  provider_workamajig UUID;
BEGIN
  SELECT id INTO cat_pm FROM public.integration_categories WHERE slug = 'project-management';

  IF cat_pm IS NULL THEN
    RAISE EXCEPTION 'Project Management category not found after insert';
  END IF;

  -- ClickUp provider
  SELECT id INTO provider_clickup FROM public.integration_providers WHERE slug = 'clickup';
  IF provider_clickup IS NULL THEN
    INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, oauth_config, docs_url, is_available, is_coming_soon, display_order)
    VALUES (cat_pm, 'ClickUp', 'clickup', 'All-in-one productivity platform', 'oauth2', '{"authorize_url":"https://app.clickup.com/api","token_url":"https://api.clickup.com/api/v2/oauth/token"}'::jsonb, 'https://clickup.com/api', true, false, 50)
    RETURNING id INTO provider_clickup;
  ELSE
    UPDATE public.integration_providers SET category_id = cat_pm, auth_type = 'oauth2', is_available = true, is_coming_soon = false WHERE id = provider_clickup;
  END IF;

  -- Workamajig provider
  SELECT id INTO provider_workamajig FROM public.integration_providers WHERE slug = 'workamajig';
  IF provider_workamajig IS NULL THEN
    INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, docs_url, is_available, is_coming_soon, display_order)
    VALUES (cat_pm, 'Workamajig', 'workamajig', 'Agency project management and finance platform', 'api_key', 'https://support.workamajig.com/hc/en-us/articles/360023007451-API-Overview', true, false, 60)
    RETURNING id INTO provider_workamajig;
  END IF;

  -- ClickUp fields
  IF provider_clickup IS NOT NULL THEN
    INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
    VALUES (provider_clickup, 'client_id', 'Client ID', 'text', 'clk_...', true, false, 'ClickUp OAuth app Client ID', 10)
    ON CONFLICT (provider_id, field_key) DO NOTHING;
    INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
    VALUES (provider_clickup, 'client_secret', 'Client Secret', 'password', '****************', true, true, 'ClickUp OAuth app Client Secret', 20)
    ON CONFLICT (provider_id, field_key) DO NOTHING;
  END IF;

  -- Workamajig fields
  IF provider_workamajig IS NOT NULL THEN
    INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
    VALUES (provider_workamajig, 'base_url', 'API Base URL', 'url', 'https://your-subdomain.workamajig.com', true, false, 'Your Workamajig instance base URL', 10)
    ON CONFLICT (provider_id, field_key) DO NOTHING;
    INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
    VALUES (provider_workamajig, 'api_access_token', 'Company API Access Token', 'password', 'APIAccessToken from Workamajig', true, true, 'Company API access token (APIAccessToken header)', 20)
    ON CONFLICT (provider_id, field_key) DO NOTHING;
    INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
    VALUES (provider_workamajig, 'user_token', 'User Token', 'password', 'UserToken from Workamajig', true, true, 'User-specific API token (UserToken header)', 30)
    ON CONFLICT (provider_id, field_key) DO NOTHING;
  END IF;
END;
$$;
