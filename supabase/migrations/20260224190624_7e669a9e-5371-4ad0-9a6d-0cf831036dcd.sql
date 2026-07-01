BEGIN;

ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS module TEXT;

-- Refresh PostgREST cache
NOTIFY pgrst, 'reload schema';

COMMIT;