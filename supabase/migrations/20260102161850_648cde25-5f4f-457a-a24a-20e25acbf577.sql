-- Create AI Providers table
CREATE TABLE public.ai_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  base_url TEXT,
  api_key_secret_name TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create AI Models table
CREATE TABLE public.ai_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES public.ai_providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('chat', 'embedding')),
  context_window INTEGER NOT NULL DEFAULT 128000,
  input_cost_per_1k NUMERIC(12, 8) NOT NULL DEFAULT 0,
  output_cost_per_1k NUMERIC(12, 8) NOT NULL DEFAULT 0,
  embedding_cost_per_1k NUMERIC(12, 8) NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  features JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create AI Usage Logs table
CREATE TABLE public.ai_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  model_id UUID REFERENCES public.ai_models(id) ON DELETE SET NULL,
  function_name TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  embedding_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(12, 8) NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_providers (read by all authenticated, write by admins)
CREATE POLICY "Authenticated users can view providers"
  ON public.ai_providers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage providers"
  ON public.ai_providers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for ai_models (read by all authenticated, write by admins)
CREATE POLICY "Authenticated users can view models"
  ON public.ai_models FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage models"
  ON public.ai_models FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for ai_usage_logs (users see their own, admins see all)
CREATE POLICY "Users can view their own usage logs"
  ON public.ai_usage_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own usage logs"
  ON public.ai_usage_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all usage logs"
  ON public.ai_usage_logs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create indexes
CREATE INDEX idx_ai_models_provider_id ON public.ai_models(provider_id);
CREATE INDEX idx_ai_models_category ON public.ai_models(category);
CREATE INDEX idx_ai_usage_logs_user_id ON public.ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_logs_created_at ON public.ai_usage_logs(created_at);

-- Triggers for updated_at
CREATE TRIGGER update_ai_providers_updated_at
  BEFORE UPDATE ON public.ai_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_models_updated_at
  BEFORE UPDATE ON public.ai_models
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default providers
INSERT INTO public.ai_providers (name, slug, description, api_key_secret_name) VALUES
  ('OpenAI', 'openai', 'GPT models for chat and embeddings', 'OPENAI_API_KEY'),
  ('Anthropic', 'anthropic', 'Claude models for advanced reasoning', 'ANTHROPIC_API_KEY'),
  ('Google AI', 'google', 'Gemini models for multimodal AI', 'GOOGLE_AI_API_KEY'),
  ('Perplexity', 'perplexity', 'Sonar models with web search', 'PERPLEXITY_API_KEY');

-- Seed default models (with latest pricing)
INSERT INTO public.ai_models (provider_id, name, model_id, category, context_window, input_cost_per_1k, output_cost_per_1k, features, is_default) VALUES
  -- OpenAI Chat Models
  ((SELECT id FROM public.ai_providers WHERE slug = 'openai'), 'GPT-4o', 'gpt-4o', 'chat', 128000, 0.005, 0.015, '{"vision": true, "reasoning": true}', true),
  ((SELECT id FROM public.ai_providers WHERE slug = 'openai'), 'GPT-4o mini', 'gpt-4o-mini', 'chat', 128000, 0.00015, 0.0006, '{"vision": true, "fast": true}', false),
  ((SELECT id FROM public.ai_providers WHERE slug = 'openai'), 'GPT-4 Turbo', 'gpt-4-turbo', 'chat', 128000, 0.01, 0.03, '{"vision": true}', false),
  -- OpenAI Embedding Models
  ((SELECT id FROM public.ai_providers WHERE slug = 'openai'), 'text-embedding-3-small', 'text-embedding-3-small', 'embedding', 8191, 0, 0, '{}', true),
  ((SELECT id FROM public.ai_providers WHERE slug = 'openai'), 'text-embedding-3-large', 'text-embedding-3-large', 'embedding', 8191, 0, 0, '{}', false),
  -- Anthropic Models
  ((SELECT id FROM public.ai_providers WHERE slug = 'anthropic'), 'Claude Sonnet 4', 'claude-sonnet-4-20250514', 'chat', 200000, 0.003, 0.015, '{"reasoning": true, "highest_quality": true}', false),
  ((SELECT id FROM public.ai_providers WHERE slug = 'anthropic'), 'Claude Haiku 3.5', 'claude-3-5-haiku-20241022', 'chat', 200000, 0.001, 0.005, '{"fast": true}', false),
  -- Google Models
  ((SELECT id FROM public.ai_providers WHERE slug = 'google'), 'Gemini 2.0 Flash', 'gemini-2.0-flash', 'chat', 1000000, 0.0001, 0.0004, '{"vision": true, "fast": true, "multimodal": true}', false),
  ((SELECT id FROM public.ai_providers WHERE slug = 'google'), 'Gemini 1.5 Pro', 'gemini-1.5-pro', 'chat', 2000000, 0.00125, 0.005, '{"vision": true, "reasoning": true}', false),
  -- Perplexity Models
  ((SELECT id FROM public.ai_providers WHERE slug = 'perplexity'), 'Sonar', 'sonar', 'chat', 128000, 0.001, 0.001, '{"web_search": true, "fast": true}', false),
  ((SELECT id FROM public.ai_providers WHERE slug = 'perplexity'), 'Sonar Pro', 'sonar-pro', 'chat', 200000, 0.003, 0.015, '{"web_search": true, "reasoning": true}', false);

-- Set embedding costs (separate update for clarity)
UPDATE public.ai_models SET embedding_cost_per_1k = 0.00002 WHERE model_id = 'text-embedding-3-small';
UPDATE public.ai_models SET embedding_cost_per_1k = 0.00013 WHERE model_id = 'text-embedding-3-large';