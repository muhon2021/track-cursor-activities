DO $$
DECLARE
  cat_pm UUID;
  provider_activecollab UUID;
BEGIN
  SELECT id INTO cat_pm FROM public.integration_categories WHERE slug = 'project-management' LIMIT 1;
  IF cat_pm IS NULL THEN
    RAISE NOTICE 'Project Management category not found, skipping ActiveCollab setup';
    RETURN;
  END IF;
  SELECT id INTO provider_activecollab FROM public.integration_providers WHERE slug = 'activecollab' LIMIT 1;
  IF provider_activecollab IS NULL THEN
    INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, oauth_config, docs_url, is_available, is_coming_soon, display_order)
    VALUES (cat_pm, 'ActiveCollab', 'activecollab', 'Project management and task tracking with time tracking and invoicing', 'oauth2', '{"authorize_url":"https://app.activecollab.com/auth/login","token_url":"https://app.activecollab.com/api/v1/external/login","userinfo_url":"https://app.activecollab.com/api/v1/users/me","response_type":"code"}'::jsonb, 'https://developers.activecollab.com/api-documentation/index.html', true, false, 55)
    RETURNING id INTO provider_activecollab;
  ELSE
    UPDATE public.integration_providers SET category_id = cat_pm, auth_type = 'oauth2', oauth_config = COALESCE(oauth_config, '{"authorize_url":"https://app.activecollab.com/auth/login","token_url":"https://app.activecollab.com/api/v1/external/login","userinfo_url":"https://app.activecollab.com/api/v1/users/me","response_type":"code"}'::jsonb), docs_url = COALESCE(docs_url, 'https://developers.activecollab.com/api-documentation/index.html'), is_available = true, is_coming_soon = false WHERE id = provider_activecollab;
  END IF;
  INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order) VALUES (provider_activecollab, 'base_url', 'Base URL', 'url', 'https://your-company.activecollab.com', true, false, 'Your ActiveCollab instance base URL. OAuth and API calls are resolved from this URL.', 10) ON CONFLICT (provider_id, field_key) DO UPDATE SET label = EXCLUDED.label, field_type = EXCLUDED.field_type, placeholder = EXCLUDED.placeholder, is_required = EXCLUDED.is_required, is_sensitive = EXCLUDED.is_sensitive, help_text = EXCLUDED.help_text, display_order = EXCLUDED.display_order;
  INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order) VALUES (provider_activecollab, 'client_id', 'Client ID', 'text', 'activecollab_client_id', true, false, 'OAuth client id for your ActiveCollab app.', 20) ON CONFLICT (provider_id, field_key) DO UPDATE SET label = EXCLUDED.label, field_type = EXCLUDED.field_type, placeholder = EXCLUDED.placeholder, is_required = EXCLUDED.is_required, is_sensitive = EXCLUDED.is_sensitive, help_text = EXCLUDED.help_text, display_order = EXCLUDED.display_order;
  INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order) VALUES (provider_activecollab, 'client_secret', 'Client Secret', 'password', '****************', true, true, 'OAuth client secret for your ActiveCollab app.', 30) ON CONFLICT (provider_id, field_key) DO UPDATE SET label = EXCLUDED.label, field_type = EXCLUDED.field_type, placeholder = EXCLUDED.placeholder, is_required = EXCLUDED.is_required, is_sensitive = EXCLUDED.is_sensitive, help_text = EXCLUDED.help_text, display_order = EXCLUDED.display_order;
END;
$$;