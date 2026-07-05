-- Add color to pods for POD Management UI (Create/Edit POD)
ALTER TABLE public.pods
ADD COLUMN IF NOT EXISTS color TEXT;

COMMENT ON COLUMN public.pods.color IS 'Hex or preset color key for POD display (e.g. #3b82f6 or blue)';
