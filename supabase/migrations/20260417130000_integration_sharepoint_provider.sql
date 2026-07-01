-- SharePoint: integration hub catalog + credential fields (validate-api-key + sync-sharepoint-knowledge).
-- category_id: same section as Google Drive & Confluence (prefer google-drive row, else storage-productivity).

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
  c.resolved_id,
  'SharePoint',
  'sharepoint',
  'Sync document library files into the Knowledge Base via Microsoft Graph (application permissions).',
  'oauth2',
  'https://learn.microsoft.com/graph/',
  true,
  false,
  false,
  30
FROM (
  SELECT COALESCE(
    (SELECT category_id FROM public.integration_providers WHERE slug = 'google-drive' LIMIT 1),
    (SELECT id FROM public.integration_categories WHERE slug = 'storage-productivity' LIMIT 1)
  ) AS resolved_id
) AS c
WHERE c.resolved_id IS NOT NULL
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
      'tenant_id'::text,
      'Tenant ID'::text,
      'text'::text,
      'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::text,
      true::boolean,
      false::boolean,
      'Azure AD directory (tenant) ID'::text,
      10::integer
    ),
    (
      'client_id',
      'Client ID',
      'text',
      'Application (client) ID',
      true,
      false,
      'Azure AD app registration Application (client) ID',
      20
    ),
    (
      'client_secret',
      'Client Secret',
      'password',
      '',
      true,
      true,
      'App registration client secret value',
      30
    ),
    (
      'sharepoint_hostname',
      'SharePoint hostname',
      'text',
      'contoso.sharepoint.com',
      true,
      false,
      'Hostname only, no https://',
      40
    ),
    (
      'sharepoint_site_path',
      'Site path',
      'text',
      '/sites/YourSite',
      true,
      false,
      'Path to site collection, e.g. /sites/Engineering or / for root',
      50
    )
) AS v(field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
WHERE p.slug = 'sharepoint'
ON CONFLICT (provider_id, field_key) DO UPDATE SET
  label = EXCLUDED.label,
  field_type = EXCLUDED.field_type,
  placeholder = EXCLUDED.placeholder,
  is_required = EXCLUDED.is_required,
  is_sensitive = EXCLUDED.is_sensitive,
  help_text = EXCLUDED.help_text,
  display_order = EXCLUDED.display_order;
