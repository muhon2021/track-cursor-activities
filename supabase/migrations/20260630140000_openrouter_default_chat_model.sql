-- Seed a default OpenRouter chat model so agent-default selection can resolve a model id.
DO $$
DECLARE
  openrouter_id UUID;
BEGIN
  SELECT id INTO openrouter_id
  FROM public.ai_providers
  WHERE slug = 'openrouter'
  LIMIT 1;

  IF openrouter_id IS NULL THEN
    RAISE NOTICE 'openrouter ai_provider not found; skipping default chat model seed';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ai_models
    WHERE provider_id = openrouter_id
      AND model_id = 'deepseek/deepseek-r1'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.ai_models (
    provider_id,
    name,
    model_id,
    category,
    context_window,
    input_cost_per_1k,
    output_cost_per_1k,
    embedding_cost_per_1k,
    enabled,
    is_default,
    features
  ) VALUES (
    openrouter_id,
    'DeepSeek R1',
    'deepseek/deepseek-r1',
    'chat',
    64000,
    0,
    0,
    0,
    true,
    true,
    '{"reasoning": true}'::jsonb
  );
END $$;
