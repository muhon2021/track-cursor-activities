
-- 1. ai_agent_categories: add UNIQUE(name), set icon default
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_agent_categories_name_key'
    AND conrelid = 'public.ai_agent_categories'::regclass
  ) THEN
    ALTER TABLE public.ai_agent_categories ADD CONSTRAINT ai_agent_categories_name_key UNIQUE (name);
  END IF;
END $$;

ALTER TABLE public.ai_agent_categories
  ALTER COLUMN icon SET DEFAULT 'folder';

-- 2. RLS: allow authenticated users to SELECT (active-only for non-admins; admins see all)
DROP POLICY IF EXISTS "Authenticated can read active categories" ON public.ai_agent_categories;
CREATE POLICY "Authenticated can read active categories"
  ON public.ai_agent_categories FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 3. ai_agents: add deleted_at for soft deletes
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.ai_agents.deleted_at IS 'Soft delete; agents with deleted_at set are excluded from category counts';
