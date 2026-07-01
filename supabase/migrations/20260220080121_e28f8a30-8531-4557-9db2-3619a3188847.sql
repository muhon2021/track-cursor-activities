INSERT INTO public.system_settings (category, key, value, description, created_at, updated_at)
VALUES (
  'ai',
  'embedding_processing_enabled',
  'true'::jsonb,
  'When true, embedding Edge Functions process pending meetings and knowledge files. When false, they return 503 or skip work.',
  NOW(),
  NOW()
)
ON CONFLICT (category, key) DO UPDATE SET
  updated_at = NOW(),
  description = EXCLUDED.description;