-- Insert integration fields for Google Drive
INSERT INTO integration_fields (
  id, provider_id, field_key, field_type, label, 
  placeholder, help_text, is_required, is_sensitive, display_order
) VALUES 
  (
    gen_random_uuid(),
    'b5c092ce-f08f-4510-8299-0369e6195477',
    'client_id',
    'text',
    'Client ID',
    'Enter your Google OAuth Client ID',
    'Get this from the Google Cloud Console under APIs & Services > Credentials',
    true,
    false,
    1
  ),
  (
    gen_random_uuid(),
    'b5c092ce-f08f-4510-8299-0369e6195477',
    'client_secret',
    'password',
    'Client Secret',
    'Enter your Google OAuth Client Secret',
    'Get this from the Google Cloud Console under APIs & Services > Credentials',
    true,
    true,
    2
  );

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';