-- Add missing columns to ai_agents for meetings AI agent seed data
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS welcome_message TEXT;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS conversation_starters JSONB;