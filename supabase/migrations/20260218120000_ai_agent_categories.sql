-- AI Agent Categories: organize AI agents into named categories (slug links to ai_agents.category)
CREATE TABLE IF NOT EXISTS public.ai_agent_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_agent_categories_slug ON public.ai_agent_categories(slug);
CREATE INDEX idx_ai_agent_categories_is_active ON public.ai_agent_categories(is_active);

ALTER TABLE public.ai_agent_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ai_agent_categories"
  ON public.ai_agent_categories FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_ai_agent_categories_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER ai_agent_categories_updated_at
  BEFORE UPDATE ON public.ai_agent_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_ai_agent_categories_updated_at();

-- Seed from distinct ai_agents.category values (slug: lowercase, spaces/special to underscore)
INSERT INTO public.ai_agent_categories (name, slug, description, is_active)
SELECT sub.name, sub.slug, NULL, true
FROM (
  SELECT
    TRIM(cat) AS name,
    LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(cat), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '_', 'g')) AS slug
  FROM (
    SELECT DISTINCT category AS cat
    FROM public.ai_agents
    WHERE category IS NOT NULL AND TRIM(category) <> ''
  ) d
) sub
WHERE sub.slug <> ''
ON CONFLICT (slug) DO NOTHING;

-- If no categories from agents, insert a default so the page has something
INSERT INTO public.ai_agent_categories (name, slug, description, is_active)
VALUES ('General', 'general', 'General purpose agents', true)
ON CONFLICT (slug) DO NOTHING;
