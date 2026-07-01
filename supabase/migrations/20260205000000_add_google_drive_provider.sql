-- ============================================
-- Add Google Drive Provider for Storage Integration
-- Enables Google Drive file sync and management
-- ============================================

-- Add Google Drive provider to storage-productivity category
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
  is_beta,
  display_order
)
SELECT
  id,
  'Google Drive',
  'google-drive',
  'Sync and manage files from Google Drive for knowledge base and document management',
  'oauth2',
  '{"authorize_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token", "scopes": ["https://www.googleapis.com/auth/drive.readonly", "https://www.googleapis.com/auth/drive.file"]}'::jsonb,
  'https://developers.google.com/drive/api/guides/about-sdk',
  true,
  false,
  false,
  15
FROM public.integration_categories
WHERE slug = 'storage-productivity'
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  oauth_config = EXCLUDED.oauth_config,
  docs_url = EXCLUDED.docs_url,
  is_available = EXCLUDED.is_available;

-- Insert Google Drive integration fields (client_id and client_secret)
INSERT INTO integration_fields (
  provider_id,
  field_key,
  label,
  field_type,
  is_required,
  is_sensitive,
  display_order,
  placeholder,
  help_text
)
SELECT
  id,
  'client_id',
  'Client ID',
  'text',
  true,
  false,
  1,
  'Enter your Google OAuth Client ID',
  'Get this from the Google Cloud Console under APIs & Services > Credentials'
FROM public.integration_providers
WHERE slug = 'google-drive'
ON CONFLICT (provider_id, field_key) DO UPDATE SET
  label = EXCLUDED.label,
  field_type = EXCLUDED.field_type,
  is_required = EXCLUDED.is_required,
  placeholder = EXCLUDED.placeholder,
  help_text = EXCLUDED.help_text;

INSERT INTO integration_fields (
  provider_id,
  field_key,
  label,
  field_type,
  is_required,
  is_sensitive,
  display_order,
  placeholder,
  help_text
)
SELECT
  id,
  'client_secret',
  'Client Secret',
  'password',
  true,
  true,
  2,
  'Enter your Google OAuth Client Secret',
  'Get this from the Google Cloud Console under APIs & Services > Credentials'
FROM public.integration_providers
WHERE slug = 'google-drive'
ON CONFLICT (provider_id, field_key) DO UPDATE SET
  label = EXCLUDED.label,
  field_type = EXCLUDED.field_type,
  is_required = EXCLUDED.is_required,
  is_sensitive = EXCLUDED.is_sensitive,
  placeholder = EXCLUDED.placeholder,
  help_text = EXCLUDED.help_text;

