ALTER TABLE public.integration_settings
  ADD COLUMN IF NOT EXISTS primary_by_category JSONB NOT NULL DEFAULT '{}'::jsonb;