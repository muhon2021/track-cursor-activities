-- Storage configuration singleton + files table extensions for multi-provider support.

CREATE TABLE IF NOT EXISTS public.storage_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_type TEXT NOT NULL DEFAULT 'local' CHECK (storage_type IN ('local', 's3', 'supabase')),
  aws_access_key_id TEXT,
  aws_secret_access_key TEXT,
  aws_region TEXT NOT NULL DEFAULT 'us-east-1',
  s3_bucket_name TEXT,
  supabase_storage_bucket TEXT NOT NULL DEFAULT 'knowledgebase',
  supabase_storage_public BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_config_single ON public.storage_config ((1));

ALTER TABLE public.storage_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read storage config" ON public.storage_config;
CREATE POLICY "Admins can read storage config"
ON public.storage_config FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage storage config" ON public.storage_config;
CREATE POLICY "Admins can manage storage config"
ON public.storage_config FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_or_create_storage_config()
RETURNS public.storage_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config public.storage_config;
BEGIN
  SELECT * INTO config FROM public.storage_config LIMIT 1;

  IF config IS NULL THEN
    INSERT INTO public.storage_config (
      storage_type,
      aws_region,
      supabase_storage_bucket,
      supabase_storage_public
    ) VALUES (
      'local',
      'us-east-1',
      'knowledgebase',
      true
    )
    RETURNING * INTO config;
  END IF;

  RETURN config;
END;
$$;

DO $$
BEGIN
  PERFORM public.get_or_create_storage_config();
END $$;

-- Extend files table for supabase provider
ALTER TABLE public.files
  DROP CONSTRAINT IF EXISTS files_storage_type_check;

ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

ALTER TABLE public.files
  ADD CONSTRAINT files_storage_type_check
  CHECK (storage_type IN ('local', 's3', 'supabase'));

CREATE INDEX IF NOT EXISTS idx_files_storage_path
ON public.files (storage_path)
WHERE storage_path IS NOT NULL;

-- Authenticated users can read active storage type (non-secret fields only via view)
CREATE OR REPLACE VIEW public.storage_config_public
WITH (security_invoker = true)
AS
SELECT
  storage_type,
  aws_region,
  supabase_storage_bucket,
  supabase_storage_public,
  updated_at
FROM public.storage_config
LIMIT 1;

GRANT SELECT ON public.storage_config_public TO authenticated;
