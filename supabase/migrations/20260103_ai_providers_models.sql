-- ============================================
-- AI Providers & Models Migration
-- Create tables for multi-provider AI integration with cost tracking
-- ============================================

-- Create ai_providers table
CREATE TABLE public.ai_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  api_key_secret_name TEXT,
  base_url TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create ai_models table
CREATE TABLE public.ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.ai_providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('chat', 'embedding')),
  context_window INTEGER DEFAULT 0,
  input_cost_per_1k DECIMAL(10, 8) DEFAULT 0,
  output_cost_per_1k DECIMAL(10, 8) DEFAULT 0,
  embedding_cost_per_1k DECIMAL(10, 8) DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  features JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider_id, model_id)
);

-- Create ai_usage_logs table
CREATE TABLE public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  model_id UUID REFERENCES public.ai_models(id) ON DELETE SET NULL,
  function_name TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  embedding_tokens INTEGER DEFAULT 0,
  estimated_cost DECIMAL(10, 8) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_ai_providers_slug ON public.ai_providers(slug);
CREATE INDEX idx_ai_providers_enabled ON public.ai_providers(enabled);

CREATE INDEX idx_ai_models_provider ON public.ai_models(provider_id);
CREATE INDEX idx_ai_models_category ON public.ai_models(category);
CREATE INDEX idx_ai_models_enabled ON public.ai_models(enabled);
CREATE INDEX idx_ai_models_is_default ON public.ai_models(is_default);

CREATE INDEX idx_ai_usage_logs_user ON public.ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_logs_model ON public.ai_usage_logs(model_id);
CREATE INDEX idx_ai_usage_logs_created_at ON public.ai_usage_logs(created_at);

-- Enable RLS
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_providers
CREATE POLICY "Everyone can view enabled providers"
  ON public.ai_providers FOR SELECT
  TO authenticated
  USING (enabled = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage providers"
  ON public.ai_providers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for ai_models
CREATE POLICY "Everyone can view enabled models"
  ON public.ai_models FOR SELECT
  TO authenticated
  USING (enabled = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage models"
  ON public.ai_models FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for ai_usage_logs
CREATE POLICY "Users can view own usage logs"
  ON public.ai_usage_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert usage logs"
  ON public.ai_usage_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create triggers for updated_at timestamp
CREATE TRIGGER update_ai_providers_updated_at
  BEFORE UPDATE ON public.ai_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_models_updated_at
  BEFORE UPDATE ON public.ai_models
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Seed AI Providers
-- ============================================

INSERT INTO public.ai_providers (name, slug, api_key_secret_name, base_url, enabled) VALUES
  ('OpenAI', 'openai', 'OPENAI_API_KEY', 'https://api.openai.com/v1', true),
  ('Anthropic', 'anthropic', 'ANTHROPIC_API_KEY', 'https://api.anthropic.com/v1', true),
  ('Google', 'google', 'GOOGLE_AI_API_KEY', 'https://generativelanguage.googleapis.com/v1', true),
  ('Perplexity', 'perplexity', 'PERPLEXITY_API_KEY', 'https://api.perplexity.ai', true);

-- ============================================
-- Seed AI Models with Latest Pricing (as of Jan 2026)
-- ============================================

-- Get provider IDs for seeding models
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

  -- OpenAI Chat Models
  INSERT INTO public.ai_models (provider_id, name, model_id, category, context_window, input_cost_per_1k, output_cost_per_1k, enabled, is_default, features) VALUES
    (openai_id, 'GPT-5', 'gpt-5', 'chat', 400000, 0.00125, 0.01, true, false, '{"reasoning": true, "vision": true, "function_calling": true}'::jsonb),
    (openai_id, 'GPT-5 mini', 'gpt-5-mini', 'chat', 400000, 0.00025, 0.002, true, false, '{"reasoning": true, "vision": true, "function_calling": true, "fast": true}'::jsonb),
    (openai_id, 'GPT-5 nano', 'gpt-5-nano', 'chat', 400000, 0.00005, 0.0004, true, false, '{"fast": true, "function_calling": true}'::jsonb),
    (openai_id, 'GPT-4o', 'gpt-4o', 'chat', 128000, 0.005, 0.015, true, true, '{"vision": true, "function_calling": true}'::jsonb),
    (openai_id, 'GPT-4o mini', 'gpt-4o-mini', 'chat', 128000, 0.00015, 0.0006, true, false, '{"vision": true, "function_calling": true, "fast": true}'::jsonb);

  -- OpenAI Embedding Models
  INSERT INTO public.ai_models (provider_id, name, model_id, category, context_window, embedding_cost_per_1k, enabled, is_default, features) VALUES
    (openai_id, 'text-embedding-3-small', 'text-embedding-3-small', 'embedding', 8191, 0.00002, true, true, '{"dimensions": 1536}'::jsonb),
    (openai_id, 'text-embedding-3-large', 'text-embedding-3-large', 'embedding', 8191, 0.00013, true, false, '{"dimensions": 3072, "high_quality": true}'::jsonb);

  -- Anthropic Chat Models
  INSERT INTO public.ai_models (provider_id, name, model_id, category, context_window, input_cost_per_1k, output_cost_per_1k, enabled, is_default, features) VALUES
    (anthropic_id, 'Claude Sonnet 4', 'claude-sonnet-4-20250514', 'chat', 200000, 0.003, 0.015, true, false, '{"vision": true, "reasoning": true}'::jsonb),
    (anthropic_id, 'Claude Opus 4', 'claude-opus-4-20250514', 'chat', 200000, 0.015, 0.075, true, false, '{"vision": true, "reasoning": true, "highest_quality": true}'::jsonb),
    (anthropic_id, 'Claude Haiku 4.5', 'claude-haiku-4-5-20250514', 'chat', 200000, 0.001, 0.01, true, false, '{"fast": true, "vision": true}'::jsonb);

  -- Google Chat Models
  INSERT INTO public.ai_models (provider_id, name, model_id, category, context_window, input_cost_per_1k, output_cost_per_1k, enabled, is_default, features) VALUES
    (google_id, 'Gemini 2.5 Pro', 'gemini-2.5-pro', 'chat', 200000, 0.00125, 0.01, true, false, '{"vision": true, "reasoning": true, "multimodal": true}'::jsonb),
    (google_id, 'Gemini 2.5 Flash', 'gemini-2.5-flash', 'chat', 200000, 0.0003, 0.0025, true, false, '{"vision": true, "multimodal": true, "fast": true}'::jsonb);

  -- Google Embedding Models
  INSERT INTO public.ai_models (provider_id, name, model_id, category, context_window, embedding_cost_per_1k, enabled, is_default, features) VALUES
    (google_id, 'text-embedding-004', 'text-embedding-004', 'embedding', 2048, 0.000025, true, false, '{"dimensions": 768}'::jsonb);

  -- Perplexity Chat Models
  INSERT INTO public.ai_models (provider_id, name, model_id, category, context_window, input_cost_per_1k, output_cost_per_1k, enabled, is_default, features) VALUES
    (perplexity_id, 'Sonar', 'sonar', 'chat', 128000, 0.001, 0.001, true, false, '{"web_search": true, "real_time": true}'::jsonb),
    (perplexity_id, 'Sonar Pro', 'sonar-pro', 'chat', 200000, 0.003, 0.015, true, false, '{"web_search": true, "real_time": true, "reasoning": true}'::jsonb);
END $$;
