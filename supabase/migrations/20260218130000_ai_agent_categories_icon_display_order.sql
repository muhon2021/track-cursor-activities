-- Add icon and display_order to ai_agent_categories (Create New Category modal)
ALTER TABLE public.ai_agent_categories
  ADD COLUMN IF NOT EXISTS icon TEXT,
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ai_agent_categories_display_order
  ON public.ai_agent_categories(display_order);
