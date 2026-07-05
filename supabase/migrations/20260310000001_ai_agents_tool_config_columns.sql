-- Add missing tool configuration columns to ai_agents table.
-- These columns were originally part of 20260126_tool_config_streaming_memory.sql
-- which was not applied to the database.

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tool_code_interpreter BOOLEAN DEFAULT false;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tool_file_search BOOLEAN DEFAULT false;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tool_web_search BOOLEAN DEFAULT false;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tool_image_generation BOOLEAN DEFAULT false;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tool_mcp BOOLEAN DEFAULT false;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  mcp_server_ids UUID[] DEFAULT '{}';

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tools_config JSONB DEFAULT '[]'::jsonb;
