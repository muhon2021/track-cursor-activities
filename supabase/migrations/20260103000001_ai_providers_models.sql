-- AI providers/models schema already created in 20260102161850.
-- This migration adds newer model catalog entries idempotently.

INSERT INTO public.ai_providers (name, slug, api_key_secret_name, base_url, enabled) VALUES
  ('OpenAI', 'openai', 'OPENAI_API_KEY', 'https://api.openai.com/v1', true),
  ('Anthropic', 'anthropic', 'ANTHROPIC_API_KEY', 'https://api.anthropic.com/v1', true),
  ('Google', 'google', 'GOOGLE_AI_API_KEY', 'https://generativelanguage.googleapis.com/v1', true),
  ('Perplexity', 'perplexity', 'PERPLEXITY_API_KEY', 'https://api.perplexity.ai', true)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  openai_id UUID;
  anthropic_id UUID;
  google_id UUID;
  perplexity_id UUID;
BEGIN
  SELECT id INTO openai_id FROM public.ai_providers WHERE slug = 'openai';
  SELECT id INTO anthropic_id FROM public.ai_providers WHERE slug = 'anthropic';
  SELECT id INTO google_id FROM public.ai_providers WHERE slug = 'google';
  SELECT id INTO perplexity_id FROM public.ai_providers WHERE slug = 'perplexity';

  INSERT INTO public.ai_models (provider_id, name, model_id, category, context_window, input_cost_per_1k, output_cost_per_1k, enabled, is_default, features)
  SELECT openai_id, 'GPT-5', 'gpt-5', 'chat', 400000, 0.00125, 0.01, true, false, '{"reasoning": true, "vision": true, "function_calling": true}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM public.ai_models WHERE model_id = 'gpt-5');

  INSERT INTO public.ai_models (provider_id, name, model_id, category, context_window, input_cost_per_1k, output_cost_per_1k, enabled, is_default, features)
  SELECT openai_id, 'GPT-5 mini', 'gpt-5-mini', 'chat', 400000, 0.00025, 0.002, true, false, '{"reasoning": true, "vision": true, "function_calling": true, "fast": true}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM public.ai_models WHERE model_id = 'gpt-5-mini');

  INSERT INTO public.ai_models (provider_id, name, model_id, category, context_window, input_cost_per_1k, output_cost_per_1k, enabled, is_default, features)
  SELECT openai_id, 'GPT-5 nano', 'gpt-5-nano', 'chat', 400000, 0.00005, 0.0004, true, false, '{"fast": true, "function_calling": true}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM public.ai_models WHERE model_id = 'gpt-5-nano');

  INSERT INTO public.ai_models (provider_id, name, model_id, category, context_window, input_cost_per_1k, output_cost_per_1k, enabled, is_default, features)
  SELECT anthropic_id, 'Claude Opus 4', 'claude-opus-4-20250514', 'chat', 200000, 0.015, 0.075, true, false, '{"vision": true, "reasoning": true, "highest_quality": true}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM public.ai_models WHERE model_id = 'claude-opus-4-20250514');

  INSERT INTO public.ai_models (provider_id, name, model_id, category, context_window, input_cost_per_1k, output_cost_per_1k, enabled, is_default, features)
  SELECT anthropic_id, 'Claude Haiku 4.5', 'claude-haiku-4-5-20250514', 'chat', 200000, 0.001, 0.01, true, false, '{"fast": true, "vision": true}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM public.ai_models WHERE model_id = 'claude-haiku-4-5-20250514');

  INSERT INTO public.ai_models (provider_id, name, model_id, category, context_window, input_cost_per_1k, output_cost_per_1k, enabled, is_default, features)
  SELECT google_id, 'Gemini 2.5 Pro', 'gemini-2.5-pro', 'chat', 200000, 0.00125, 0.01, true, false, '{"vision": true, "reasoning": true, "multimodal": true}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM public.ai_models WHERE model_id = 'gemini-2.5-pro');

  INSERT INTO public.ai_models (provider_id, name, model_id, category, context_window, input_cost_per_1k, output_cost_per_1k, enabled, is_default, features)
  SELECT google_id, 'Gemini 2.5 Flash', 'gemini-2.5-flash', 'chat', 200000, 0.0003, 0.0025, true, false, '{"vision": true, "multimodal": true, "fast": true}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM public.ai_models WHERE model_id = 'gemini-2.5-flash');

  INSERT INTO public.ai_models (provider_id, name, model_id, category, context_window, embedding_cost_per_1k, enabled, is_default, features)
  SELECT google_id, 'text-embedding-004', 'text-embedding-004', 'embedding', 2048, 0.000025, true, false, '{"dimensions": 768}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM public.ai_models WHERE model_id = 'text-embedding-004');
END $$;
