-- =============================================
-- Phase 2, 3, 5: Tool Config, Streaming, Memory
-- Migration: Add tool configuration and memory system
-- =============================================

-- ============================================
-- PHASE 2: Tool Configuration
-- ============================================

-- Add tool configuration columns to ai_agents
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

-- Custom tools configuration (for function calling)
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tools_config JSONB DEFAULT '[]'::jsonb;

-- Comment on columns for documentation
COMMENT ON COLUMN public.ai_agents.tool_code_interpreter IS 'Enable code execution capability';
COMMENT ON COLUMN public.ai_agents.tool_file_search IS 'Enable searching through knowledge base files';
COMMENT ON COLUMN public.ai_agents.tool_web_search IS 'Enable real-time web search (requires Perplexity or similar)';
COMMENT ON COLUMN public.ai_agents.tool_image_generation IS 'Enable image generation (DALL-E, etc.)';
COMMENT ON COLUMN public.ai_agents.tool_mcp IS 'Enable Model Context Protocol servers';
COMMENT ON COLUMN public.ai_agents.mcp_server_ids IS 'Array of connected MCP server IDs';
COMMENT ON COLUMN public.ai_agents.tools_config IS 'Custom function/tool definitions for the agent';

-- ============================================
-- PHASE 5: Agent Memory System
-- ============================================

-- Create agent_memory table for long-term memory
CREATE TABLE IF NOT EXISTS public.agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Memory classification
  memory_type VARCHAR(50) NOT NULL CHECK (memory_type IN (
    'summary',      -- Conversation summaries
    'context',      -- User background/context
    'pattern',      -- Learned user patterns
    'fact',         -- Important facts to remember
    'decision',     -- Previous decisions made
    'preference'    -- User preferences
  )),

  -- Content
  content TEXT NOT NULL,
  embedding vector(1536),  -- For semantic search

  -- Source tracking
  source_conversation_id UUID REFERENCES public.agent_conversations(id) ON DELETE SET NULL,
  source_message_id UUID REFERENCES public.agent_messages(id) ON DELETE SET NULL,

  -- Relevance and access tracking
  relevance_score DECIMAL(3,2) DEFAULT 0.5 CHECK (relevance_score >= 0 AND relevance_score <= 1),
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,

  -- Lifecycle
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,  -- Optional memory expiration

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for agent_memory
CREATE INDEX IF NOT EXISTS idx_agent_memory_agent_user
  ON public.agent_memory(agent_id, user_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_type
  ON public.agent_memory(agent_id, user_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_agent_memory_active
  ON public.agent_memory(agent_id, user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_agent_memory_relevance
  ON public.agent_memory(agent_id, user_id, relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memory_embedding
  ON public.agent_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enable RLS on agent_memory
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_memory

-- Users can view their own memories
CREATE POLICY "Users can view their own agent memories"
  ON public.agent_memory FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create memories
CREATE POLICY "Users can create agent memories"
  ON public.agent_memory FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own memories
CREATE POLICY "Users can update their own agent memories"
  ON public.agent_memory FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own memories
CREATE POLICY "Users can delete their own agent memories"
  ON public.agent_memory FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all memories
CREATE POLICY "Admins can view all agent memories"
  ON public.agent_memory FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_agent_memory_updated_at
  BEFORE UPDATE ON public.agent_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Memory Retrieval Functions
-- ============================================

-- Function to match memories by semantic similarity
CREATE OR REPLACE FUNCTION public.match_agent_memories(
  query_embedding vector,
  p_agent_id UUID,
  p_user_id UUID,
  match_count INTEGER DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  memory_type VARCHAR,
  similarity FLOAT,
  relevance_score DECIMAL,
  source_conversation_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    am.id,
    am.content,
    am.memory_type,
    1 - (am.embedding <=> query_embedding) as similarity,
    am.relevance_score,
    am.source_conversation_id,
    am.created_at
  FROM public.agent_memory am
  WHERE am.agent_id = p_agent_id
    AND am.user_id = p_user_id
    AND am.is_active = true
    AND (am.expires_at IS NULL OR am.expires_at > NOW())
    AND am.embedding IS NOT NULL
    AND (1 - (am.embedding <=> query_embedding)) > match_threshold
  ORDER BY
    am.relevance_score DESC,
    am.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Function to get recent memories by type
CREATE OR REPLACE FUNCTION public.get_recent_memories(
  p_agent_id UUID,
  p_user_id UUID,
  p_memory_type VARCHAR DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  memory_type VARCHAR,
  relevance_score DECIMAL,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    am.id,
    am.content,
    am.memory_type,
    am.relevance_score,
    am.created_at
  FROM public.agent_memory am
  WHERE am.agent_id = p_agent_id
    AND am.user_id = p_user_id
    AND am.is_active = true
    AND (am.expires_at IS NULL OR am.expires_at > NOW())
    AND (p_memory_type IS NULL OR am.memory_type = p_memory_type)
  ORDER BY am.created_at DESC
  LIMIT p_limit;
$$;

-- Function to update memory access stats
CREATE OR REPLACE FUNCTION public.update_memory_access(
  p_memory_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.agent_memory
  SET
    access_count = access_count + 1,
    last_accessed_at = NOW()
  WHERE id = ANY(p_memory_ids);
END;
$$;

-- Function to extract and store memories from conversation
CREATE OR REPLACE FUNCTION public.store_agent_memory(
  p_agent_id UUID,
  p_user_id UUID,
  p_memory_type VARCHAR,
  p_content TEXT,
  p_embedding vector DEFAULT NULL,
  p_source_conversation_id UUID DEFAULT NULL,
  p_source_message_id UUID DEFAULT NULL,
  p_relevance_score DECIMAL DEFAULT 0.8,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_memory_id UUID;
BEGIN
  INSERT INTO public.agent_memory (
    agent_id,
    user_id,
    memory_type,
    content,
    embedding,
    source_conversation_id,
    source_message_id,
    relevance_score,
    metadata
  ) VALUES (
    p_agent_id,
    p_user_id,
    p_memory_type,
    p_content,
    p_embedding,
    p_source_conversation_id,
    p_source_message_id,
    p_relevance_score,
    p_metadata
  )
  RETURNING id INTO v_memory_id;

  RETURN v_memory_id;
END;
$$;

-- Function to decay old memories (reduce relevance over time)
CREATE OR REPLACE FUNCTION public.decay_agent_memories(
  p_agent_id UUID DEFAULT NULL,
  p_decay_factor DECIMAL DEFAULT 0.95,
  p_min_relevance DECIMAL DEFAULT 0.1
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.agent_memory
  SET
    relevance_score = GREATEST(relevance_score * p_decay_factor, p_min_relevance),
    updated_at = NOW()
  WHERE is_active = true
    AND relevance_score > p_min_relevance
    AND (p_agent_id IS NULL OR agent_id = p_agent_id)
    AND last_accessed_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.match_agent_memories(vector, UUID, UUID, INTEGER, FLOAT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_memories(UUID, UUID, VARCHAR, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_memory_access(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_agent_memory(UUID, UUID, VARCHAR, TEXT, vector, UUID, UUID, DECIMAL, JSONB) TO authenticated;

-- ============================================
-- PHASE 3: Streaming Support
-- ============================================

-- Add streaming tracking to agent_messages
ALTER TABLE public.agent_messages ADD COLUMN IF NOT EXISTS
  is_streaming BOOLEAN DEFAULT false;

ALTER TABLE public.agent_messages ADD COLUMN IF NOT EXISTS
  stream_completed_at TIMESTAMPTZ;

-- Track tool calls more explicitly
ALTER TABLE public.agent_messages ADD COLUMN IF NOT EXISTS
  tool_call_status VARCHAR(20) CHECK (tool_call_status IN (
    'pending', 'executing', 'completed', 'failed'
  ));

-- Add streaming session tracking
CREATE TABLE IF NOT EXISTS public.streaming_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.agent_messages(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'completed', 'cancelled', 'error'
  )),

  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,

  tokens_streamed INTEGER DEFAULT 0,
  error_message TEXT,

  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_streaming_sessions_conversation
  ON public.streaming_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_streaming_sessions_status
  ON public.streaming_sessions(status) WHERE status = 'active';

-- Enable RLS
ALTER TABLE public.streaming_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for streaming_sessions
CREATE POLICY "Users can view their streaming sessions"
  ON public.streaming_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create streaming sessions"
  ON public.streaming_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their streaming sessions"
  ON public.streaming_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
