-- Add required OAuth configuration fields for Zoom provider
INSERT INTO integration_fields (provider_id, field_key, label, field_type, is_required, is_sensitive, help_text, display_order)
SELECT 
  ip.id,
  'client_id',
  'Client ID',
  'text',
  true,
  false,
  'Your Zoom OAuth App Client ID from the Zoom Marketplace',
  1
FROM integration_providers ip WHERE ip.slug = 'zoom'
ON CONFLICT (provider_id, field_key) DO NOTHING;

INSERT INTO integration_fields (provider_id, field_key, label, field_type, is_required, is_sensitive, help_text, display_order)
SELECT 
  ip.id,
  'client_secret',
  'Client Secret',
  'password',
  true,
  true,
  'Your Zoom OAuth App Client Secret from the Zoom Marketplace',
  2
FROM integration_providers ip WHERE ip.slug = 'zoom'
ON CONFLICT (provider_id, field_key) DO NOTHING;

-- Also update the oauth_config with proper Zoom OAuth settings
UPDATE integration_providers
SET oauth_config = jsonb_build_object(
  'authorization_url', 'https://zoom.us/oauth/authorize',
  'token_url', 'https://zoom.us/oauth/token',
  'scopes', ARRAY['meeting:read', 'recording:read', 'user:read']
)
WHERE slug = 'zoom';