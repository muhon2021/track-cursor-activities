-- Add head_user_id, color, and parent_department_id to departments
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS head_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS parent_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- Backfill head_user_id from the existing manager_id once
UPDATE public.departments
SET head_user_id = manager_id
WHERE head_user_id IS NULL AND manager_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_departments_parent_department_id ON public.departments(parent_department_id);
