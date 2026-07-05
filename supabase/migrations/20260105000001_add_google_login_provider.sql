-- ============================================
-- Add Google Login Provider for Authentication
-- Enables "Sign in with Google" button on login page
-- ============================================

-- Enable the authentication category
UPDATE public.integration_categories
SET enabled = true
WHERE slug = 'authentication';

-- Add Google Login provider to authentication category
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
  'Google Login',
  'google-login',
  'Allow users to sign in with their Google accounts for seamless authentication',
  'oauth2',
  '{"authorize_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token", "scopes": ["openid", "email", "profile"], "response_type": "code"}'::jsonb,
  'https://developers.google.com/identity/protocols/oauth2',
  true,
  false,
  false,
  10
FROM public.integration_categories
WHERE slug = 'authentication'
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  oauth_config = EXCLUDED.oauth_config,
  docs_url = EXCLUDED.docs_url,
  is_available = EXCLUDED.is_available;

-- Add configuration fields for Google Login
INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
SELECT
  id,
  'client_id',
  'Client ID',
  'text',
  'your-client-id.apps.googleusercontent.com',
  true,
  false,
  'OAuth 2.0 Client ID from Google Cloud Console',
  10
FROM public.integration_providers WHERE slug = 'google-login'
ON CONFLICT (provider_id, field_key) DO NOTHING;

INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
SELECT
  id,
  'client_secret',
  'Client Secret',
  'password',
  'GOCSPX-...',
  true,
  true,
  'OAuth 2.0 Client Secret from Google Cloud Console',
  20
FROM public.integration_providers WHERE slug = 'google-login'
ON CONFLICT (provider_id, field_key) DO NOTHING;

-- Add services for Google Login
INSERT INTO public.integration_services (provider_id, name, service_key, description, features, enabled, is_default, display_order)
SELECT
  id,
  'Sign In with Google',
  'google_signin',
  'Enable Google as a sign-in option on the login page',
  '{"sso": true, "email_verification": true, "profile_sync": true}'::jsonb,
  true,
  true,
  10
FROM public.integration_providers WHERE slug = 'google-login'
ON CONFLICT (provider_id, service_key) DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Google Login provider added successfully!';
END $$;
