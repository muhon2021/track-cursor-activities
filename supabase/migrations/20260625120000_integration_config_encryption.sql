-- Integration config credential encryption
-- Sensitive values in organization_integrations.config are encrypted by the
-- integration-config Edge Function (AES-GCM, v1:iv:ciphertext format).
-- Decryption happens in the integration-config Edge Function.
--
-- Set ENCRYPTION_KEY as a Supabase Function secret before saving integrations.

COMMENT ON COLUMN public.organization_integrations.config IS
  'Integration settings JSONB. Sensitive fields (api_key, client_secret, tokens) are encrypted at rest via integration-config Edge Function.';
