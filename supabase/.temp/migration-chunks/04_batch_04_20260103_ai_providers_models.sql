-- 20260102161850_648cde25-5f4f-457a-a24a-20e25acbf577.sql
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

-- 20260102162554_a2fefe3f-bda1-4849-92f4-1fc66d085077.sql
-- Create activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource_type ON public.activity_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can view all activity logs
CREATE POLICY "Admins can view all activity logs"
  ON public.activity_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own activity logs
CREATE POLICY "Users can view their own activity logs"
  ON public.activity_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow inserts via service role (edge function) or authenticated users for their own logs
CREATE POLICY "Users can insert their own activity logs"
  ON public.activity_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can delete old logs (for cleanup)
CREATE POLICY "Admins can delete activity logs"
  ON public.activity_logs
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 20260102165229_eacdf2c9-d0fa-4630-8f13-ba5a829e6099.sql
-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date TIMESTAMP WITH TIME ZONE,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  client_id UUID REFERENCES public.clients(id),
  meeting_id UUID REFERENCES public.meetings(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for task access
CREATE POLICY "Users can view all tasks" 
ON public.tasks 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create tasks" 
ON public.tasks 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update tasks they created or are assigned to" 
ON public.tasks 
FOR UPDATE 
USING (auth.uid() = created_by OR auth.uid() = assigned_to);

CREATE POLICY "Users can delete tasks they created" 
ON public.tasks 
FOR DELETE 
USING (auth.uid() = created_by);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_priority ON public.tasks(priority);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);

-- 20260102_seed_additional_features.sql
-- Add additional feature flags and branding options
-- This migration extends the default configuration with new features

-- Insert new feature flags
INSERT INTO public.app_config (key, value, category, description) VALUES
  -- Additional Features
  ('features.enableClients', 'true', 'features', 'Enable client management module'),
  ('features.enableAIAgents', 'true', 'features', 'Enable AI agents management'),
  ('features.enablePersonalKnowledge', 'true', 'features', 'Enable personal knowledge uploads'),
  ('features.enableFeedback', 'true', 'features', 'Enable feedback collection'),
  ('features.enableGoogleDrive', 'false', 'features', 'Enable Google Drive integration'),
  ('features.enableZoomSync', 'false', 'features', 'Enable Zoom meeting sync'),

  -- Branding
  ('branding.logoUrl', 'null', 'branding', 'URL to custom logo image'),

  -- System
  ('system.onboardingCompleted', 'false', 'system', 'Platform onboarding wizard completed')
ON CONFLICT (key) DO NOTHING;


-- 20260103_ai_providers_models.sql
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


