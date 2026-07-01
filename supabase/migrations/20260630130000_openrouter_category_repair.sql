-- Repair: OpenRouter was placed on a duplicate "AI Providers" tab in some environments.
-- Move openrouter into the same category as OpenAI/Anthropic/Gemini/Perplexity and remove the extra tab.

DO $$
DECLARE
  canonical_ai_category_id UUID;
  dup_category_id UUID;
BEGIN
  SELECT ip.category_id INTO canonical_ai_category_id
  FROM public.integration_providers ip
  WHERE ip.slug IN ('openai', 'anthropic', 'google-gemini', 'perplexity')
  ORDER BY CASE ip.slug
    WHEN 'openai' THEN 1
    WHEN 'anthropic' THEN 2
    WHEN 'google-gemini' THEN 3
    ELSE 4
  END
  LIMIT 1;

  IF canonical_ai_category_id IS NULL THEN
    RAISE NOTICE 'No canonical AI provider category found; skip openrouter category repair';
    RETURN;
  END IF;

  UPDATE public.integration_providers
  SET category_id = canonical_ai_category_id,
      updated_at = now()
  WHERE slug = 'openrouter'
    AND category_id IS DISTINCT FROM canonical_ai_category_id;

  FOR dup_category_id IN
    SELECT ic.id
    FROM public.integration_categories ic
    WHERE ic.id <> canonical_ai_category_id
      AND (
        lower(trim(ic.name)) IN ('ai providers', 'ai provider')
        OR ic.slug IN ('ai-providers', 'ai-provider')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.integration_providers ip
        WHERE ip.category_id = ic.id
          AND ip.slug <> 'openrouter'
      )
  LOOP
    DELETE FROM public.integration_categories WHERE id = dup_category_id;
  END LOOP;
END $$;
