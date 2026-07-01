-- Confluence: integration hub catalog + credential fields (validate-api-key + sync-confluence-knowledge).

INSERT INTO public.integration_providers (
  category_id,
  name,
  slug,
  description,
  auth_type,
  docs_url,
  is_available,
  is_coming_soon,
  is_beta,
  display_order
)
SELECT
  id,
  'Confluence',
  'confluence',
  'Sync Confluence Cloud pages into the knowledge base (REST API + Basic auth)',
  'basic',
  'https://developer.atlassian.com/cloud/confluence/rest/v1/intro/',
  true,
  false,
  false,
  25
FROM public.integration_categories
WHERE slug = 'storage-productivity'
ON CONFLICT (slug) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  auth_type = EXCLUDED.auth_type,
  docs_url = EXCLUDED.docs_url,
  is_available = EXCLUDED.is_available,
  is_coming_soon = EXCLUDED.is_coming_soon,
  is_beta = EXCLUDED.is_beta,
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
SELECT
  p.id,
  v.field_key,
  v.label,
  v.field_type,
  v.placeholder,
  v.is_required,
  v.is_sensitive,
  v.help_text,
  v.display_order
FROM public.integration_providers p
CROSS JOIN (
  VALUES
    (
      'confluence_email'::text,
      'Atlassian Email'::text,
      'email'::text,
      'you@company.com'::text,
      true::boolean,
      false::boolean,
      'Your Atlassian account email address'::text,
      10::integer
    ),
    (
      'confluence_api_token',
      'API Token',
      'password',
      '',
      true,
      true,
      'Create at id.atlassian.com → Security → API tokens',
      20
    ),
    (
      'confluence_domain',
      'Confluence Domain',
      'text',
      'yourcompany.atlassian.net',
      true,
      false,
      'Your Atlassian Cloud host (no https://), e.g. yourcompany.atlassian.net',
      30
    ),
    (
      'confluence_space_key',
      'Space Key (optional)',
      'text',
      'MYSPACE',
      false,
      false,
      'Limit sync to one space. Leave empty to sync pages from all spaces.',
      40
    )
) AS v(field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
WHERE p.slug = 'confluence'
ON CONFLICT (provider_id, field_key) DO UPDATE SET
  label = EXCLUDED.label,
  field_type = EXCLUDED.field_type,
  placeholder = EXCLUDED.placeholder,
  is_required = EXCLUDED.is_required,
  is_sensitive = EXCLUDED.is_sensitive,
  help_text = EXCLUDED.help_text,
  display_order = EXCLUDED.display_order;
