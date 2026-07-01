
DO $$
DECLARE
  cat_id UUID;
BEGIN
  SELECT category_id INTO cat_id
  FROM public.integration_providers
  WHERE slug = 'google-drive'
  LIMIT 1;

  IF cat_id IS NULL THEN
    SELECT id INTO cat_id
    FROM public.integration_categories
    WHERE slug = 'storage-productivity'
    LIMIT 1;
  END IF;

  IF cat_id IS NULL THEN
    RAISE EXCEPTION 'confluence_integration_hub_ensure: need google-drive provider or storage-productivity category';
  END IF;

  INSERT INTO public.integration_providers (
    category_id, name, slug, description, auth_type, docs_url,
    is_available, is_coming_soon, is_beta, display_order
  ) VALUES (
    cat_id, 'Confluence', 'confluence',
    'Sync Confluence Cloud pages into the knowledge base (REST API + Basic auth)',
    'basic', 'https://developer.atlassian.com/cloud/confluence/rest/v1/intro/',
    true, false, false, 25
  )
  ON CONFLICT (slug) DO UPDATE SET
    category_id = EXCLUDED.category_id, name = EXCLUDED.name,
    description = EXCLUDED.description, auth_type = EXCLUDED.auth_type,
    docs_url = EXCLUDED.docs_url, is_available = EXCLUDED.is_available,
    is_coming_soon = EXCLUDED.is_coming_soon, is_beta = EXCLUDED.is_beta,
    display_order = EXCLUDED.display_order;
END $$;

DO $$
DECLARE
  pid UUID;
BEGIN
  SELECT id INTO pid FROM public.integration_providers WHERE slug = 'confluence' LIMIT 1;
  IF pid IS NULL THEN
    RAISE NOTICE 'confluence provider not found after ensure; skip integration_fields';
    RETURN;
  END IF;

  INSERT INTO public.integration_fields (
    provider_id, field_key, label, field_type, placeholder,
    is_required, is_sensitive, help_text, display_order
  )
  SELECT pid, v.field_key, v.label, v.field_type::text, v.placeholder,
    v.is_required, v.is_sensitive, v.help_text, v.display_order
  FROM (VALUES
    ('confluence_email', 'Atlassian Email', 'email', 'you@company.com', true, false,
     'Your Atlassian account email address', 10),
    ('confluence_api_token', 'API Token', 'password', '', true, true,
     'Create at id.atlassian.com → Security → API tokens', 20),
    ('confluence_domain', 'Confluence Domain', 'text', 'yourcompany.atlassian.net', true, false,
     'Your Atlassian Cloud host (no https://), e.g. yourcompany.atlassian.net', 30),
    ('confluence_space_key', 'Space Key (optional)', 'text', 'MYSPACE', false, false,
     'Limit sync to one space. Leave empty to sync pages from all spaces.', 40)
  ) AS v(field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
  ON CONFLICT (provider_id, field_key) DO UPDATE SET
    label = EXCLUDED.label, field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder, is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive, help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;
END $$;
