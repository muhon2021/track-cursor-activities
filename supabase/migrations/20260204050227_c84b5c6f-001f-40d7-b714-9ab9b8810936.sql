-- Insert Google Meet integration fields (client_id and client_secret)
INSERT INTO integration_fields (
  provider_id,
  field_key,
  label,
  field_type,
  is_required,
  display_order,
  placeholder,
  help_text
)
VALUES
  (
    '815ebb95-78cd-4fcf-a90e-7087006b3ea7',
    'client_id',
    'Client ID',
    'text',
    true,
    1,
    'Enter your Google OAuth Client ID',
    'Get this from the Google Cloud Console under APIs & Services > Credentials'
  ),
  (
    '815ebb95-78cd-4fcf-a90e-7087006b3ea7',
    'client_secret',
    'Client Secret',
    'password',
    true,
    2,
    'Enter your Google OAuth Client Secret',
    'Get this from the Google Cloud Console under APIs & Services > Credentials'
  );