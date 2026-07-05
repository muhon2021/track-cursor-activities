-- 20260126_mcp_integration.sql
-- =============================================
-- Phase 6: MCP (Model Context Protocol) Integration
-- Migration: Add MCP server management
-- =============================================

-- ============================================
-- MCP Servers Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(100),  -- Emoji or icon name

  -- Connection Configuration
  server_url TEXT NOT NULL,
  transport_type VARCHAR(50) NOT NULL DEFAULT 'stdio' CHECK (
    transport_type IN ('stdio', 'http', 'websocket', 'sse')
  ),

  -- Authentication
  auth_type VARCHAR(50) DEFAULT 'none' CHECK (
    auth_type IN ('none', 'api_key', 'bearer', 'oauth', 'basic')
  ),
  auth_config JSONB DEFAULT '{}'::jsonb,  -- Encrypted auth details

  -- Available Tools (discovered or configured)
  available_tools JSONB DEFAULT '[]'::jsonb,
  /*
    Format:
    [
      {
        "name": "web_search",
        "description": "Search the web",
        "inputSchema": { "type": "object", "properties": {...} }
      }
    ]
  */

  -- Available Resources (for context)
  available_resources JSONB DEFAULT '[]'::jsonb,

  -- Available Prompts (pre-defined prompts)
  available_prompts JSONB DEFAULT '[]'::jsonb,

  -- Capabilities
  capabilities JSONB DEFAULT '{
    "tools": true,
    "resources": false,
    "prompts": false,
    "sampling": false
  }'::jsonb,

  -- Ownership
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_global BOOLEAN DEFAULT false,  -- Available to all users (admin only)

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,  -- Connection tested successfully
  last_verified_at TIMESTAMPTZ,
  error_message TEXT,

  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mcp_servers_user
  ON public.mcp_servers(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_global
  ON public.mcp_servers(is_global) WHERE is_global = true;
CREATE INDEX IF NOT EXISTS idx_mcp_servers_active
  ON public.mcp_servers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_mcp_servers_transport
  ON public.mcp_servers(transport_type);

-- Enable RLS
ALTER TABLE public.mcp_servers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for MCP Servers
-- ============================================

-- Users can view their own servers and global servers
CREATE POLICY "Users can view own and global MCP servers"
  ON public.mcp_servers FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR is_global = true
  );

-- Users can create their own servers
CREATE POLICY "Users can create MCP servers"
  ON public.mcp_servers FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND is_global = false  -- Only admins can create global servers
  );

-- Users can update their own servers
CREATE POLICY "Users can update own MCP servers"
  ON public.mcp_servers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own servers
CREATE POLICY "Users can delete own MCP servers"
  ON public.mcp_servers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can manage global servers
CREATE POLICY "Admins can manage global MCP servers"
  ON public.mcp_servers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- MCP Tool Executions (Audit Log)
-- ============================================

CREATE TABLE IF NOT EXISTS public.mcp_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  server_id UUID NOT NULL REFERENCES public.mcp_servers(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.agent_conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.agent_messages(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Execution details
  tool_name VARCHAR(255) NOT NULL,
  tool_input JSONB,
  tool_output JSONB,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'executing', 'completed', 'failed', 'timeout')
  ),
  error_message TEXT,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mcp_executions_server
  ON public.mcp_tool_executions(server_id);
CREATE INDEX IF NOT EXISTS idx_mcp_executions_agent
  ON public.mcp_tool_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_mcp_executions_user
  ON public.mcp_tool_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_executions_status
  ON public.mcp_tool_executions(status);
CREATE INDEX IF NOT EXISTS idx_mcp_executions_created
  ON public.mcp_tool_executions(created_at DESC);

-- Enable RLS
ALTER TABLE public.mcp_tool_executions ENABLE ROW LEVEL SECURITY;

-- Users can view their own executions
CREATE POLICY "Users can view own MCP executions"
  ON public.mcp_tool_executions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- System can insert executions
CREATE POLICY "Users can create MCP executions"
  ON public.mcp_tool_executions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all executions
CREATE POLICY "Admins can view all MCP executions"
  ON public.mcp_tool_executions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- Agent-MCP Server Junction Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.agent_mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  server_id UUID NOT NULL REFERENCES public.mcp_servers(id) ON DELETE CASCADE,

  -- Configuration overrides
  enabled_tools TEXT[] DEFAULT '{}',  -- Subset of tools to enable, empty = all
  tool_config JSONB DEFAULT '{}'::jsonb,  -- Per-tool config overrides

  is_enabled BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(agent_id, server_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_mcp_agent
  ON public.agent_mcp_servers(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_mcp_server
  ON public.agent_mcp_servers(server_id);

-- Enable RLS
ALTER TABLE public.agent_mcp_servers ENABLE ROW LEVEL SECURITY;

-- Users can view agent-MCP connections for agents they can access
CREATE POLICY "Users can view agent MCP connections"
  ON public.agent_mcp_servers FOR SELECT
  TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM public.ai_agents
      WHERE is_enabled = true
    )
  );

-- Users can manage agent-MCP connections
CREATE POLICY "Users can manage agent MCP connections"
  ON public.agent_mcp_servers FOR ALL
  TO authenticated
  USING (
    server_id IN (
      SELECT id FROM public.mcp_servers
      WHERE user_id = auth.uid() OR is_global = true
    )
  );

-- ============================================
-- Triggers
-- ============================================

-- Update timestamp trigger
CREATE TRIGGER update_mcp_servers_updated_at
  BEFORE UPDATE ON public.mcp_servers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_mcp_servers_updated_at
  BEFORE UPDATE ON public.agent_mcp_servers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update server usage on tool execution
CREATE OR REPLACE FUNCTION public.update_mcp_server_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.mcp_servers
  SET
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = NEW.server_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER update_mcp_server_usage_on_execution
  AFTER INSERT ON public.mcp_tool_executions
  FOR EACH ROW EXECUTE FUNCTION public.update_mcp_server_usage();

-- ============================================
-- Helper Functions
-- ============================================

-- Get MCP servers available for an agent
CREATE OR REPLACE FUNCTION public.get_agent_mcp_servers(
  p_agent_id UUID
)
RETURNS TABLE(
  server_id UUID,
  server_name VARCHAR,
  server_url TEXT,
  transport_type VARCHAR,
  available_tools JSONB,
  enabled_tools TEXT[],
  is_verified BOOLEAN
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    ms.id as server_id,
    ms.name as server_name,
    ms.server_url,
    ms.transport_type,
    ms.available_tools,
    COALESCE(ams.enabled_tools, '{}') as enabled_tools,
    ms.is_verified
  FROM public.mcp_servers ms
  JOIN public.agent_mcp_servers ams ON ms.id = ams.server_id
  WHERE ams.agent_id = p_agent_id
    AND ams.is_enabled = true
    AND ms.is_active = true;
$$;

-- Get all tools available for an agent (from all connected MCP servers)
CREATE OR REPLACE FUNCTION public.get_agent_mcp_tools(
  p_agent_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_tools JSONB := '[]'::jsonb;
  v_server RECORD;
  v_tool JSONB;
BEGIN
  FOR v_server IN
    SELECT * FROM public.get_agent_mcp_servers(p_agent_id)
  LOOP
    -- Add tools from this server
    FOR v_tool IN
      SELECT * FROM jsonb_array_elements(v_server.available_tools)
    LOOP
      -- Check if tool is enabled (empty array = all enabled)
      IF array_length(v_server.enabled_tools, 1) IS NULL
         OR (v_tool->>'name') = ANY(v_server.enabled_tools) THEN
        v_tools := v_tools || jsonb_build_object(
          'server_id', v_server.server_id,
          'server_name', v_server.server_name,
          'tool', v_tool
        );
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_tools;
END;
$$;

-- Verify MCP server connection
CREATE OR REPLACE FUNCTION public.verify_mcp_server(
  p_server_id UUID,
  p_is_verified BOOLEAN,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.mcp_servers
  SET
    is_verified = p_is_verified,
    last_verified_at = NOW(),
    error_message = p_error_message,
    updated_at = NOW()
  WHERE id = p_server_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_agent_mcp_servers(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agent_mcp_tools(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_mcp_server(UUID, BOOLEAN, TEXT) TO authenticated;

-- ============================================
-- Seed Data: Example MCP Server Templates
-- ============================================

-- These are templates that can be used as reference
INSERT INTO public.mcp_servers (
  name, description, icon, server_url, transport_type,
  auth_type, available_tools, capabilities, is_global, is_active, is_verified
)
SELECT
  'Web Search (Example)',
  'Example MCP server for web search capabilities',
  '🌐',
  'http://localhost:3001/mcp',
  'http',
  'api_key',
  '[
    {
      "name": "web_search",
      "description": "Search the web for current information",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": { "type": "string", "description": "Search query" },
          "num_results": { "type": "integer", "description": "Number of results", "default": 5 }
        },
        "required": ["query"]
      }
    },
    {
      "name": "fetch_url",
      "description": "Fetch content from a URL",
      "inputSchema": {
        "type": "object",
        "properties": {
          "url": { "type": "string", "description": "URL to fetch" }
        },
        "required": ["url"]
      }
    }
  ]'::jsonb,
  '{"tools": true, "resources": false, "prompts": false}'::jsonb,
  true,
  false,  -- Disabled by default (example only)
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.mcp_servers WHERE name = 'Web Search (Example)'
);

INSERT INTO public.mcp_servers (
  name, description, icon, server_url, transport_type,
  auth_type, available_tools, capabilities, is_global, is_active, is_verified
)
SELECT
  'File System (Example)',
  'Example MCP server for file system operations',
  '📁',
  'stdio://filesystem-server',
  'stdio',
  'none',
  '[
    {
      "name": "read_file",
      "description": "Read contents of a file",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": { "type": "string", "description": "File path to read" }
        },
        "required": ["path"]
      }
    },
    {
      "name": "list_directory",
      "description": "List files in a directory",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": { "type": "string", "description": "Directory path" }
        },
        "required": ["path"]
      }
    }
  ]'::jsonb,
  '{"tools": true, "resources": true, "prompts": false}'::jsonb,
  true,
  false,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.mcp_servers WHERE name = 'File System (Example)'
);


-- 20260126_tool_config_streaming_memory.sql
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


-- 20260128_auto_first_admin.sql
-- Migration: Auto-assign first user as admin
-- Purpose: Automatically grant admin role to the first user who signs up
-- Date: 2026-01-28
-- Solves: Admin panel visibility issue - chicken-and-egg problem

-- =====================================================
-- FUNCTION: Auto-assign admin to first user
-- =====================================================

CREATE OR REPLACE FUNCTION public.auto_assign_first_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Count existing users (including the one being inserted)
  SELECT COUNT(*) INTO user_count
  FROM auth.users;

  -- Log for debugging
  RAISE NOTICE 'User signup detected: % (Total users: %)', NEW.email, user_count;

  -- If this is the first user (count = 1 after insert), make them admin
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    RAISE NOTICE 'First user % automatically granted admin role', NEW.email;
  ELSE
    -- For subsequent users, assign default 'user' role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;

    RAISE NOTICE 'User % assigned default user role', NEW.email;
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- TRIGGER: Execute on user creation
-- =====================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;

-- Create trigger on auth.users table
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_first_admin();

-- =====================================================
-- BACKFILL: Assign roles to existing users
-- =====================================================

-- First, count existing users
DO $$
DECLARE
  existing_user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO existing_user_count
  FROM auth.users;

  RAISE NOTICE 'Found % existing users', existing_user_count;
END $$;

-- Backfill existing users without roles
-- If only one user exists and has no role, make them admin
DO $$
DECLARE
  total_users INTEGER;
  users_without_roles INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_users FROM auth.users;
  SELECT COUNT(*) INTO users_without_roles
  FROM auth.users u
  WHERE u.id NOT IN (SELECT user_id FROM public.user_roles);

  RAISE NOTICE 'Total users: %, Users without roles: %', total_users, users_without_roles;

  -- If there's only one user and they have no role, make them admin
  IF total_users = 1 AND users_without_roles = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT id, 'admin'::app_role
    FROM auth.users
    WHERE id NOT IN (SELECT user_id FROM public.user_roles)
    LIMIT 1;

    RAISE NOTICE 'Granted admin role to the only existing user';
  ELSE
    -- Otherwise, give all users without roles the default 'user' role
    INSERT INTO public.user_roles (user_id, role)
    SELECT id, 'user'::app_role
    FROM auth.users
    WHERE id NOT IN (SELECT user_id FROM public.user_roles);

    RAISE NOTICE 'Granted user role to % existing users', users_without_roles;
  END IF;
END $$;

-- =====================================================
-- VERIFICATION QUERY (comment out in production)
-- =====================================================

-- Show all users and their roles
SELECT
  u.id,
  u.email,
  ur.role,
  u.created_at,
  CASE
    WHEN ur.role IS NULL THEN '⚠️  NO ROLE'
    WHEN ur.role = 'admin' THEN '✅ ADMIN'
    WHEN ur.role = 'moderator' THEN '✅ MODERATOR'
    ELSE '👤 USER'
  END as status
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
ORDER BY u.created_at ASC;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION public.auto_assign_first_admin() IS
  'Automatically assigns admin role to first user, user role to subsequent users';

COMMENT ON TRIGGER on_auth_user_created_assign_role ON auth.users IS
  'Triggers role assignment when new user signs up';


-- 20260128_verify_user_roles_rls.sql
-- Migration: Verify and enhance RLS policies for user_roles table
-- Purpose: Ensure secure access control for user role management
-- Date: 2026-01-28
-- Related to: Admin panel visibility fix

-- =====================================================
-- VERIFICATION: Check existing policies
-- =====================================================

-- List all policies on user_roles table
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'user_roles';

  RAISE NOTICE 'Found % existing policies on user_roles table', policy_count;
END $$;

-- =====================================================
-- ENSURE: Service role has full access
-- =====================================================

-- Drop existing service role policy if exists (for clean re-creation)
DROP POLICY IF EXISTS "Service role can manage all user roles" ON public.user_roles;

-- Create policy for service role (used by edge functions)
CREATE POLICY "Service role can manage all user roles"
  ON public.user_roles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- VERIFY: Core RLS policies exist
-- =====================================================

-- These policies should already exist from the initial migration:
-- 1. "Users can view their own roles" - FOR SELECT (users see own role)
-- 2. "Admins can view all user roles" - FOR SELECT (admins see all roles)
-- 3. "Admins can manage user roles" - FOR ALL (admins can CRUD roles)

-- Verification query (comment out in production)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_roles'
ORDER BY policyname;

-- =====================================================
-- FUNCTION: Check if user is admin (helper)
-- =====================================================

-- Create or replace helper function for checking admin status
-- This is used throughout the application
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = COALESCE(_user_id, auth.uid())
      AND role IN ('admin', 'moderator')
  )
$$;

-- Add comment
COMMENT ON FUNCTION public.is_admin IS
  'Returns true if the given user (or current user) has admin or moderator role';

-- =====================================================
-- FUNCTION: Get user role (helper)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID DEFAULT auth.uid())
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = COALESCE(_user_id, auth.uid())
  LIMIT 1
$$;

-- Add comment
COMMENT ON FUNCTION public.get_user_role IS
  'Returns the role of the given user (or current user). Returns NULL if no role assigned.';

-- =====================================================
-- INDEX: Optimize role lookups
-- =====================================================

-- Create index on user_id for faster lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- Create index on role for faster admin queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles(user_id, role);

-- =====================================================
-- GRANT: Ensure proper permissions
-- =====================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

-- Grant select on user_roles to authenticated (RLS will filter)
GRANT SELECT ON public.user_roles TO authenticated;

-- Grant all operations to service role
GRANT ALL ON public.user_roles TO service_role;

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION public.has_role TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role TO authenticated, anon, service_role;

-- =====================================================
-- SECURITY AUDIT: Show all policies
-- =====================================================

-- Generate security audit report
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'USER_ROLES SECURITY AUDIT';
  RAISE NOTICE '========================================';

  RAISE NOTICE 'RLS Enabled: %', (
    SELECT relrowsecurity
    FROM pg_class
    WHERE relname = 'user_roles'
  );

  RAISE NOTICE '';
  RAISE NOTICE 'Active Policies:';
  FOR rec IN
    SELECT policyname, cmd, roles::text
    FROM pg_policies
    WHERE tablename = 'user_roles'
    ORDER BY policyname
  LOOP
    RAISE NOTICE '  - % (%, %)', rec.policyname, rec.cmd, rec.roles;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'Helper Functions:';
  RAISE NOTICE '  - has_role(UUID, app_role) -> BOOLEAN';
  RAISE NOTICE '  - is_admin(UUID) -> BOOLEAN';
  RAISE NOTICE '  - get_user_role(UUID) -> app_role';

  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.user_roles IS
  'Stores user role assignments. Protected by RLS policies. Only admins can modify.';

COMMENT ON COLUMN public.user_roles.user_id IS
  'Reference to auth.users. Cascades on delete.';

COMMENT ON COLUMN public.user_roles.role IS
  'User role: admin, moderator, or user. See app_role enum type.';

COMMENT ON POLICY "Users can view their own roles" ON public.user_roles IS
  'Allows authenticated users to see their own role assignment';

COMMENT ON POLICY "Admins can view all user roles" ON public.user_roles IS
  'Allows admins to see all user role assignments';

COMMENT ON POLICY "Admins can manage user roles" ON public.user_roles IS
  'Allows admins to INSERT/UPDATE/DELETE user role assignments';

COMMENT ON POLICY "Service role can manage all user roles" ON public.user_roles IS
  'Allows edge functions with service role key to manage roles programmatically';


-- 20260201235633_5a5d63f2-63cb-4b44-b0f0-696c35f57e0e.sql
-- Add unique constraints for seed file ON CONFLICT clauses

-- clients.email unique
ALTER TABLE public.clients 
ADD CONSTRAINT clients_email_unique UNIQUE (email);

-- app_modules.slug unique
ALTER TABLE public.app_modules 
ADD CONSTRAINT app_modules_slug_unique UNIQUE (slug);

-- system_settings (category, key) unique
ALTER TABLE public.system_settings 
ADD CONSTRAINT system_settings_category_key_unique UNIQUE (category, key);

-- app_config.key unique
ALTER TABLE public.app_config 
ADD CONSTRAINT app_config_key_unique UNIQUE (key);

-- 20260201_actions_module.sql
-- ============================================================================
-- Migration: Actions Module (Phase 1)
-- Adds task streams, task comments, subtask support, categories, and
-- contributors to enable full standalone task management.
--
-- The existing "tasks" table is preserved. New columns are added via ALTER
-- rather than creating a separate tasks_v2, keeping migration simpler
-- and avoiding data duplication.
-- ============================================================================

-- ===================
-- 1. task_streams
-- ===================
-- Organizational buckets for tasks (like channels or workspaces).

CREATE TABLE IF NOT EXISTS task_streams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  is_archived BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE task_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read task_streams"
  ON task_streams FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create task_streams"
  ON task_streams FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Stream creators and admins can update task_streams"
  ON task_streams FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );


-- ===================
-- 2. task_stream_members
-- ===================
-- Stream membership for access control and notifications.

CREATE TABLE IF NOT EXISTS task_stream_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES task_streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(stream_id, user_id)
);

ALTER TABLE task_stream_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read their stream memberships"
  ON task_stream_members FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Stream owners and admins can manage members"
  ON task_stream_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM task_stream_members sm
      WHERE sm.stream_id = task_stream_members.stream_id
      AND sm.user_id = auth.uid()
      AND sm.role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );


-- ===================
-- 3. task_categories
-- ===================
-- Label/tag system for tasks.

CREATE TABLE IF NOT EXISTS task_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  color TEXT DEFAULT '#8b5cf6',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE task_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read task_categories"
  ON task_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage task_categories"
  ON task_categories FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Seed default categories
INSERT INTO task_categories (name, slug, color, sort_order) VALUES
  ('Bug Fix', 'bug-fix', '#ef4444', 1),
  ('Feature', 'feature', '#3b82f6', 2),
  ('Improvement', 'improvement', '#8b5cf6', 3),
  ('Research', 'research', '#f59e0b', 4),
  ('Documentation', 'documentation', '#10b981', 5)
ON CONFLICT (slug) DO NOTHING;


-- ===================
-- 4. Extend tasks table
-- ===================
-- Add new columns for streams, subtasks, and richer task data.

-- Stream reference
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS stream_id UUID REFERENCES task_streams(id) ON DELETE SET NULL;

-- Subtask support (self-referencing)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE;

-- Category reference
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES task_categories(id) ON DELETE SET NULL;

-- Completion tracking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Slug for URL-friendly identifiers
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS slug TEXT;

-- Position for manual ordering within a stream or view
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- Create index for slug lookups
CREATE INDEX IF NOT EXISTS idx_tasks_slug ON tasks(slug);

-- Create index for stream filtering
CREATE INDEX IF NOT EXISTS idx_tasks_stream_id ON tasks(stream_id);

-- Create index for subtask lookups
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);

-- Create index for assigned user filtering
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);


-- ===================
-- 5. task_comments
-- ===================
-- Threaded comments on tasks.

CREATE TABLE IF NOT EXISTS task_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES task_comments(id) ON DELETE CASCADE,
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read task_comments"
  ON task_comments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create task_comments"
  ON task_comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Comment authors can update their comments"
  ON task_comments FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Comment authors and admins can delete comments"
  ON task_comments FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);


-- ===================
-- 6. task_attachments
-- ===================
-- File attachments on tasks (stored in Supabase Storage).

CREATE TABLE IF NOT EXISTS task_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read task_attachments"
  ON task_attachments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload task_attachments"
  ON task_attachments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Uploaders and admins can delete task_attachments"
  ON task_attachments FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );


-- ===================
-- 7. task_contributors
-- ===================
-- Additional contributors/watchers on a task beyond the assignee.

CREATE TABLE IF NOT EXISTS task_contributors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'contributor' CHECK (role IN ('contributor', 'reviewer', 'watcher')),
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, user_id)
);

ALTER TABLE task_contributors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read task_contributors"
  ON task_contributors FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Task assignees and admins can manage task_contributors"
  ON task_contributors FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_contributors.task_id
      AND (t.assigned_to = auth.uid() OR t.created_by = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );


-- 20260201_app_modules.sql
-- ============================================================================
-- Migration: app_modules, user_module_permissions, system_settings
-- Phase 0: Foundation for modular architecture
-- ============================================================================

-- ===================
-- 1. app_modules table
-- ===================
-- Registry of available modules. Admin can toggle modules on/off.

CREATE TABLE IF NOT EXISTS app_modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT 'Layout',
  category TEXT DEFAULT 'business' CHECK (category IN ('core', 'business', 'intelligence', 'operations')),
  is_core BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  dependencies TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE app_modules ENABLE ROW LEVEL SECURITY;

-- Everyone can read modules (needed for navigation filtering)
CREATE POLICY "Anyone can read app_modules"
  ON app_modules FOR SELECT
  USING (true);

-- Only admins can update modules
CREATE POLICY "Admins can update app_modules"
  ON app_modules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can insert modules
CREATE POLICY "Admins can insert app_modules"
  ON app_modules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Seed default modules
INSERT INTO app_modules (name, slug, description, icon, category, is_core, is_active, sort_order, dependencies) VALUES
  ('Platform Core', 'platform', 'Authentication, layouts, navigation, UI components', 'Layout', 'core', true, true, 0, '{}'),
  ('Actions', 'actions', 'Standalone task management with streams and comments', 'CheckSquare', 'operations', false, true, 1, '{platform}'),
  ('EOS', 'eos', 'Entrepreneurial Operating System - V/TO, OKRs, issues, scorecards', 'Target', 'business', false, true, 2, '{platform}'),
  ('Meetings', 'meetings', 'Meeting lifecycle management with AI summaries', 'Calendar', 'operations', false, true, 3, '{platform}'),
  ('Knowledge Base', 'knowledge', 'Knowledge management with vector embeddings and semantic search', 'BookOpen', 'intelligence', false, true, 4, '{platform}'),
  ('Projects', 'projects', 'Project lifecycle management with billing and resource projection', 'FolderKanban', 'business', false, true, 5, '{platform}'),
  ('Business Development', 'business-dev', 'Deal pipeline, client management, contacts, CRM integration', 'TrendingUp', 'business', false, true, 6, '{platform}'),
  ('Productivity', 'productivity', 'Team and individual productivity metrics and AI insights', 'BarChart3', 'operations', false, true, 7, '{platform}'),
  ('Admin', 'admin', 'Administrative control panel for platform configuration', 'Shield', 'core', true, true, 8, '{platform}')
ON CONFLICT (slug) DO NOTHING;


-- ==============================
-- 2. user_module_permissions table
-- ==============================
-- Per-user module access. If no row exists, user has access to all active modules.
-- When rows exist for a user, they can only access modules listed here.

CREATE TABLE IF NOT EXISTS user_module_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES app_modules(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_id)
);

-- Enable RLS
ALTER TABLE user_module_permissions ENABLE ROW LEVEL SECURITY;

-- Users can read their own permissions
CREATE POLICY "Users can read own module permissions"
  ON user_module_permissions FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all permissions
CREATE POLICY "Admins can read all module permissions"
  ON user_module_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Admins can manage permissions
CREATE POLICY "Admins can insert module permissions"
  ON user_module_permissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete module permissions"
  ON user_module_permissions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );


-- ========================
-- 3. system_settings table
-- ========================
-- Key-value settings organized by category.
-- Used for module-specific configuration that doesn't fit in app_config.

CREATE TABLE IF NOT EXISTS system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category, key)
);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Anyone can read system_settings"
  ON system_settings FOR SELECT
  USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can manage system_settings"
  ON system_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );


-- ==============================
-- 4. RPC: get_user_modules
-- ==============================
-- Returns list of module slugs the current user can access.

CREATE OR REPLACE FUNCTION get_user_modules()
RETURNS TABLE(slug TEXT, name TEXT, icon TEXT, category TEXT) AS $$
DECLARE
  has_restrictions BOOLEAN;
BEGIN
  -- Check if user has specific module restrictions
  SELECT EXISTS(
    SELECT 1 FROM user_module_permissions WHERE user_id = auth.uid()
  ) INTO has_restrictions;

  IF has_restrictions THEN
    -- Return only granted modules that are also active
    RETURN QUERY
      SELECT m.slug, m.name, m.icon, m.category
      FROM app_modules m
      INNER JOIN user_module_permissions p ON p.module_id = m.id
      WHERE p.user_id = auth.uid()
      AND m.is_active = true
      ORDER BY m.sort_order;
  ELSE
    -- No restrictions: return all active modules
    RETURN QUERY
      SELECT m.slug, m.name, m.icon, m.category
      FROM app_modules m
      WHERE m.is_active = true
      ORDER BY m.sort_order;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 20260201_business_dev_module.sql
-- ============================================================================
-- Business Development Module Migration
-- ============================================================================
-- Adds deals pipeline, contacts, lead follow-up, and communication tracking.
-- Note: clients table already exists.
-- ============================================================================

-- ========================
-- Deals
-- ========================
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  stage TEXT NOT NULL DEFAULT 'lead'
    CHECK (stage IN ('lead', 'discovery', 'estimation', 'proposal', 'won', 'lost')),
  value NUMERIC(12,2),
  currency TEXT DEFAULT 'USD',
  probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  client_id UUID,
  contact_id UUID,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expected_close_date DATE,
  closed_at TIMESTAMPTZ,
  lost_reason TEXT,
  source TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Deal Activities
-- ========================
CREATE TABLE IF NOT EXISTS deal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('note', 'call', 'email', 'meeting', 'stage_change', 'task')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Deal Comments
-- ========================
CREATE TABLE IF NOT EXISTS deal_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Contacts
-- ========================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  title TEXT,
  linkedin_url TEXT,
  client_id UUID,
  source TEXT DEFAULT 'manual',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  last_contacted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Lead Follow-Up
-- ========================
CREATE TABLE IF NOT EXISTS lead_followup_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'interested', 'not_interested', 'converted', 'dormant')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  next_follow_up DATE,
  follow_up_notes TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  converted_deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (contact_id)
);

-- ========================
-- Contact Communications
-- ========================
CREATE TABLE IF NOT EXISTS contact_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'phone', 'linkedin', 'meeting', 'other')),
  direction TEXT DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  subject TEXT,
  content TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Scheduled Emails
-- ========================
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- FK for deals.contact_id now that contacts table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'deals_contact_id_fkey') THEN
    ALTER TABLE deals ADD CONSTRAINT deals_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_owner ON deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_client ON deals(client_id);
CREATE INDEX IF NOT EXISTS idx_deals_slug ON deals(slug);
CREATE INDEX IF NOT EXISTS idx_deal_activities_deal ON deal_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_comments_deal ON deal_comments(deal_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_client ON contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_lead_followup_status ON lead_followup_contacts(status);
CREATE INDEX IF NOT EXISTS idx_lead_followup_assigned ON lead_followup_contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_contact_comms_contact ON contact_communications(contact_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status ON scheduled_emails(status);

-- ========================
-- RLS Policies
-- ========================
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view deals" ON deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage deals" ON deals FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE deal_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view activities" ON deal_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage activities" ON deal_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE deal_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view deal comments" ON deal_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage deal comments" ON deal_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view contacts" ON contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage contacts" ON contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE lead_followup_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view followups" ON lead_followup_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage followups" ON lead_followup_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE contact_communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view communications" ON contact_communications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage communications" ON contact_communications FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE scheduled_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view emails" ON scheduled_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage emails" ON scheduled_emails FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 20260201_eos_module.sql
-- ============================================================================
-- EOS Module Migration
-- ============================================================================
-- Creates tables for:
-- - VTO (Vision/Traction Organizer)
-- - OKRs (Objectives & Key Results)
-- - Issues (with pod organization)
-- - Scorecard (metrics tracking)
-- - Accountability (org chart + GWC assessments)
-- ============================================================================

-- ========================
-- EOS Pods (team groupings)
-- ========================
CREATE TABLE IF NOT EXISTS eos_pods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  lead_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- VTO (Vision/Traction Organizer)
-- ========================
CREATE TABLE IF NOT EXISTS eos_vto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content JSONB DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- OKRs
-- ========================
CREATE TABLE IF NOT EXISTS okrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'at_risk', 'behind', 'on_track', 'completed', 'closed')),
  quarter TEXT NOT NULL, -- e.g. 'Q1 2026'
  start_date DATE,
  end_date DATE,
  progress NUMERIC(5,2) DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  pod_id UUID REFERENCES eos_pods(id) ON DELETE SET NULL,
  parent_okr_id UUID REFERENCES okrs(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS okr_key_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_id UUID NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  metric_type TEXT NOT NULL DEFAULT 'number'
    CHECK (metric_type IN ('number', 'percentage', 'currency', 'boolean')),
  current_value NUMERIC DEFAULT 0,
  target_value NUMERIC NOT NULL DEFAULT 100,
  start_value NUMERIC DEFAULT 0,
  unit TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'on_track', 'at_risk', 'behind', 'completed')),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS okr_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_id UUID NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  key_result_id UUID REFERENCES okr_key_results(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_value NUMERIC,
  new_value NUMERIC NOT NULL,
  confidence TEXT DEFAULT 'medium'
    CHECK (confidence IN ('low', 'medium', 'high')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Issues
-- ========================
CREATE TABLE IF NOT EXISTS eos_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'solved', 'archived')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  category TEXT DEFAULT 'process'
    CHECK (category IN ('people', 'process', 'system', 'external')),
  pod_id UUID REFERENCES eos_pods(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_anonymous BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual', 'meeting', 'project', 'ai')),
  meeting_id UUID,
  solved_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eos_issue_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES eos_issues(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL
    CHECK (suggestion_type IN ('root_cause', 'action_item', 'related_pattern')),
  content TEXT NOT NULL,
  confidence NUMERIC(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  ai_model TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Scorecard
-- ========================
CREATE TABLE IF NOT EXISTS eos_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  frequency TEXT DEFAULT 'weekly'
    CHECK (frequency IN ('weekly', 'monthly', 'quarterly')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eos_scorecard_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_id UUID NOT NULL REFERENCES eos_scorecards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  metric_type TEXT DEFAULT 'number'
    CHECK (metric_type IN ('number', 'percentage', 'currency', 'boolean')),
  target_value NUMERIC,
  current_value NUMERIC DEFAULT 0,
  unit TEXT DEFAULT '',
  goal_direction TEXT DEFAULT 'higher_is_better'
    CHECK (goal_direction IN ('higher_is_better', 'lower_is_better', 'target')),
  week_of DATE,
  status TEXT DEFAULT 'on_track'
    CHECK (status IN ('on_track', 'off_track', 'needs_attention')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Accountability
-- ========================
CREATE TABLE IF NOT EXISTS accountability_charts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_current BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accountability_responsibilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_id UUID NOT NULL REFERENCES accountability_charts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role_title TEXT NOT NULL,
  department TEXT,
  reports_to UUID REFERENCES accountability_responsibilities(id) ON DELETE SET NULL,
  responsibilities JSONB DEFAULT '[]',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gwc_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  responsibility_id UUID NOT NULL REFERENCES accountability_responsibilities(id) ON DELETE CASCADE,
  assessor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gets_it BOOLEAN DEFAULT false,
  wants_it BOOLEAN DEFAULT false,
  has_capacity BOOLEAN DEFAULT false,
  notes TEXT,
  assessment_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (responsibility_id, assessor_id, assessment_date)
);

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_okrs_owner ON okrs(owner_id);
CREATE INDEX IF NOT EXISTS idx_okrs_status ON okrs(status);
CREATE INDEX IF NOT EXISTS idx_okrs_quarter ON okrs(quarter);
CREATE INDEX IF NOT EXISTS idx_okrs_pod ON okrs(pod_id);
CREATE INDEX IF NOT EXISTS idx_okr_key_results_okr ON okr_key_results(okr_id);
CREATE INDEX IF NOT EXISTS idx_okr_check_ins_okr ON okr_check_ins(okr_id);
CREATE INDEX IF NOT EXISTS idx_okr_check_ins_kr ON okr_check_ins(key_result_id);

CREATE INDEX IF NOT EXISTS idx_eos_issues_status ON eos_issues(status);
CREATE INDEX IF NOT EXISTS idx_eos_issues_priority ON eos_issues(priority);
CREATE INDEX IF NOT EXISTS idx_eos_issues_pod ON eos_issues(pod_id);
CREATE INDEX IF NOT EXISTS idx_eos_issues_assigned ON eos_issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_eos_issue_suggestions_issue ON eos_issue_suggestions(issue_id);

CREATE INDEX IF NOT EXISTS idx_scorecard_metrics_scorecard ON eos_scorecard_metrics(scorecard_id);
CREATE INDEX IF NOT EXISTS idx_scorecard_metrics_week ON eos_scorecard_metrics(week_of);

CREATE INDEX IF NOT EXISTS idx_accountability_resp_chart ON accountability_responsibilities(chart_id);
CREATE INDEX IF NOT EXISTS idx_accountability_resp_user ON accountability_responsibilities(user_id);
CREATE INDEX IF NOT EXISTS idx_accountability_resp_reports_to ON accountability_responsibilities(reports_to);
CREATE INDEX IF NOT EXISTS idx_gwc_responsibility ON gwc_assessments(responsibility_id);

-- ========================
-- RLS Policies
-- ========================

-- Pods
ALTER TABLE eos_pods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view pods" ON eos_pods
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage pods" ON eos_pods
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- VTO
ALTER TABLE eos_vto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view VTO" ON eos_vto
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage VTO" ON eos_vto
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OKRs
ALTER TABLE okrs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view OKRs" ON okrs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage OKRs" ON okrs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE okr_key_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view key results" ON okr_key_results
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage key results" ON okr_key_results
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE okr_check_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view check-ins" ON okr_check_ins
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create check-ins" ON okr_check_ins
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Issues
ALTER TABLE eos_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view issues" ON eos_issues
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage issues" ON eos_issues
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE eos_issue_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view suggestions" ON eos_issue_suggestions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage suggestions" ON eos_issue_suggestions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Scorecard
ALTER TABLE eos_scorecards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view scorecards" ON eos_scorecards
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage scorecards" ON eos_scorecards
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE eos_scorecard_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view metrics" ON eos_scorecard_metrics
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage metrics" ON eos_scorecard_metrics
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Accountability
ALTER TABLE accountability_charts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view charts" ON accountability_charts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage charts" ON accountability_charts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE accountability_responsibilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view responsibilities" ON accountability_responsibilities
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage responsibilities" ON accountability_responsibilities
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE gwc_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view GWC assessments" ON gwc_assessments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage their own assessments" ON gwc_assessments
  FOR ALL TO authenticated USING (auth.uid() = assessor_id) WITH CHECK (auth.uid() = assessor_id);

-- ========================
-- Seed VTO sections
-- ========================
INSERT INTO eos_vto (section, title, content, sort_order) VALUES
  ('core_values', 'Core Values', '{"values": []}', 1),
  ('core_focus', 'Core Focus', '{"purpose": "", "niche": ""}', 2),
  ('ten_year_target', '10-Year Target', '{"target": ""}', 3),
  ('marketing_strategy', 'Marketing Strategy', '{"target_market": "", "uniques": [], "proven_process": "", "guarantee": ""}', 4),
  ('three_year_picture', '3-Year Picture', '{"revenue": "", "profit": "", "measurables": []}', 5),
  ('one_year_plan', '1-Year Plan', '{"revenue": "", "profit": "", "goals": []}', 6),
  ('quarterly_rocks', 'Quarterly Rocks', '{"quarter": "", "rocks": []}', 7),
  ('issues_list', 'Issues List', '{"issues": []}', 8)
ON CONFLICT (section) DO NOTHING;


-- 20260201_knowledge_module.sql
-- ============================================================================
-- Knowledge Base Module Migration
-- ============================================================================
-- Creates tables for knowledge files, embeddings, processing queue,
-- user knowledge, and search analytics.
-- Note: knowledge_entries and knowledge_categories tables already exist.
-- ============================================================================

-- ========================
-- Knowledge Sources
-- ========================
CREATE TABLE IF NOT EXISTS knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('upload', 'google_drive', 'url', 'meeting', 'api')),
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Knowledge Files
-- ========================
CREATE TABLE IF NOT EXISTS knowledge_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID,
  source_id UUID REFERENCES knowledge_sources(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT,
  processing_status TEXT DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  processing_error TEXT,
  chunk_count INTEGER DEFAULT 0,
  embedding_model TEXT,
  metadata JSONB DEFAULT '{}',
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Knowledge Embeddings
-- ========================
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES knowledge_files(id) ON DELETE CASCADE,
  entry_id UUID,
  content TEXT NOT NULL,
  chunk_index INTEGER DEFAULT 0,
  token_count INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- User Knowledge Files
-- ========================
CREATE TABLE IF NOT EXISTS user_knowledge_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT,
  processing_status TEXT DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  chunk_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Embedding Queue
-- ========================
CREATE TABLE IF NOT EXISTS embedding_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('file', 'entry', 'meeting', 'user_file')),
  entity_id UUID NOT NULL,
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Common Knowledge
-- ========================
CREATE TABLE IF NOT EXISTS common_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Vector Search Logs
-- ========================
CREATE TABLE IF NOT EXISTS vector_search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  result_count INTEGER DEFAULT 0,
  top_score NUMERIC(5,4),
  search_type TEXT DEFAULT 'semantic',
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_knowledge_files_category ON knowledge_files(category_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_files_status ON knowledge_files(processing_status);
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_file ON knowledge_embeddings(file_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_entry ON knowledge_embeddings(entry_id);
CREATE INDEX IF NOT EXISTS idx_user_knowledge_files_user ON user_knowledge_files(user_id);
CREATE INDEX IF NOT EXISTS idx_embedding_queue_status ON embedding_queue(status);
CREATE INDEX IF NOT EXISTS idx_embedding_queue_entity ON embedding_queue(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_vector_search_logs_user ON vector_search_logs(user_id);

-- ========================
-- RLS Policies
-- ========================
ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view sources" ON knowledge_sources
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage sources" ON knowledge_sources
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE knowledge_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view files" ON knowledge_files
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage files" ON knowledge_files
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view embeddings" ON knowledge_embeddings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage embeddings" ON knowledge_embeddings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE user_knowledge_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own knowledge" ON user_knowledge_files
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own knowledge" ON user_knowledge_files
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE embedding_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view queue" ON embedding_queue
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage queue" ON embedding_queue
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE common_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view common knowledge" ON common_knowledge
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage common knowledge" ON common_knowledge
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE vector_search_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view search logs" ON vector_search_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create search logs" ON vector_search_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);


-- 20260201_meetings_v2.sql
-- ============================================================================
-- Meetings Module V2 Migration
-- ============================================================================
-- Extends existing meetings table and adds:
-- - meeting_series (recurring meeting definitions)
-- - meeting_agenda_items (structured agendas)
-- - meeting_takeaways (decisions, action items, notes)
-- - meeting_participants (attendee management)
-- - meeting_transcripts (transcript storage)
-- - meeting_categorizations (auto/manual categorization)
-- - meeting_assignments (link meetings to clients/projects)
-- ============================================================================

-- ========================
-- Extend existing meetings table
-- ========================
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS series_id UUID,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS agenda_finalized BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS action_items JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS efficiency_score NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- ========================
-- Meeting Series
-- ========================
CREATE TABLE IF NOT EXISTS meeting_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  recurrence_rule TEXT NOT NULL, -- iCal RRULE format (e.g. 'FREQ=WEEKLY;BYDAY=MO')
  duration_minutes INTEGER DEFAULT 60,
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  default_agenda JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  next_occurrence TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add FK for series_id after table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'meetings_series_id_fkey'
  ) THEN
    ALTER TABLE meetings
      ADD CONSTRAINT meetings_series_id_fkey
      FOREIGN KEY (series_id) REFERENCES meeting_series(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ========================
-- Agenda Items
-- ========================
CREATE TABLE IF NOT EXISTS meeting_agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  presenter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Takeaways
-- ========================
CREATE TABLE IF NOT EXISTS meeting_takeaways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  agenda_item_id UUID REFERENCES meeting_agenda_items(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  takeaway_type TEXT NOT NULL DEFAULT 'note'
    CHECK (takeaway_type IN ('decision', 'action_item', 'note', 'follow_up')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date DATE,
  is_completed BOOLEAN DEFAULT false,
  task_id UUID, -- Link to tasks table if converted
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Participants
-- ========================
CREATE TABLE IF NOT EXISTS meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  name TEXT,
  role TEXT DEFAULT 'attendee'
    CHECK (role IN ('organizer', 'presenter', 'attendee', 'optional')),
  rsvp_status TEXT DEFAULT 'pending'
    CHECK (rsvp_status IN ('pending', 'accepted', 'declined', 'tentative')),
  attended BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (meeting_id, user_id)
);

-- ========================
-- Transcripts
-- ========================
CREATE TABLE IF NOT EXISTS meeting_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  source TEXT DEFAULT 'manual'
    CHECK (source IN ('zoom', 'teams', 'google_meet', 'manual', 'upload')),
  word_count INTEGER,
  duration_seconds INTEGER,
  speakers JSONB DEFAULT '[]', -- [{name, segments}]
  processed_at TIMESTAMPTZ,
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Categorizations
-- ========================
CREATE TABLE IF NOT EXISTS meeting_categorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  confidence NUMERIC(3,2) DEFAULT 1.0,
  source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual', 'ai', 'rule')),
  rule_id UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (meeting_id, category)
);

-- ========================
-- Assignments (link to clients/projects)
-- ========================
CREATE TABLE IF NOT EXISTS meeting_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('client', 'project', 'deal')),
  entity_id UUID NOT NULL,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (meeting_id, entity_type, entity_id)
);

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_meetings_series ON meetings(series_id);
CREATE INDEX IF NOT EXISTS idx_meetings_slug ON meetings(slug);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled ON meetings(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_meeting_series_organizer ON meeting_series(organizer_id);
CREATE INDEX IF NOT EXISTS idx_meeting_series_active ON meeting_series(is_active);

CREATE INDEX IF NOT EXISTS idx_agenda_items_meeting ON meeting_agenda_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_agenda_items_order ON meeting_agenda_items(meeting_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_takeaways_meeting ON meeting_takeaways(meeting_id);
CREATE INDEX IF NOT EXISTS idx_takeaways_assigned ON meeting_takeaways(assigned_to);
CREATE INDEX IF NOT EXISTS idx_takeaways_type ON meeting_takeaways(takeaway_type);

CREATE INDEX IF NOT EXISTS idx_participants_meeting ON meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON meeting_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_transcripts_meeting ON meeting_transcripts(meeting_id);

CREATE INDEX IF NOT EXISTS idx_categorizations_meeting ON meeting_categorizations(meeting_id);
CREATE INDEX IF NOT EXISTS idx_categorizations_category ON meeting_categorizations(category);

CREATE INDEX IF NOT EXISTS idx_assignments_meeting ON meeting_assignments(meeting_id);
CREATE INDEX IF NOT EXISTS idx_assignments_entity ON meeting_assignments(entity_type, entity_id);

-- ========================
-- RLS Policies
-- ========================

-- Meeting Series
ALTER TABLE meeting_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view series" ON meeting_series
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage their own series" ON meeting_series
  FOR ALL TO authenticated USING (auth.uid() = organizer_id) WITH CHECK (auth.uid() = organizer_id);

-- Agenda Items
ALTER TABLE meeting_agenda_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view agenda items" ON meeting_agenda_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage agenda items" ON meeting_agenda_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Takeaways
ALTER TABLE meeting_takeaways ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view takeaways" ON meeting_takeaways
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage takeaways" ON meeting_takeaways
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Participants
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view participants" ON meeting_participants
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage participants" ON meeting_participants
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Transcripts
ALTER TABLE meeting_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view transcripts" ON meeting_transcripts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage transcripts" ON meeting_transcripts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Categorizations
ALTER TABLE meeting_categorizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view categorizations" ON meeting_categorizations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage categorizations" ON meeting_categorizations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Assignments
ALTER TABLE meeting_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view assignments" ON meeting_assignments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage assignments" ON meeting_assignments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 20260201_productivity_module.sql
-- ============================================================================
-- Productivity Module Migration
-- ============================================================================
-- Creates tables for productivity tracking, employee profiles, departments,
-- pods, leave events, process documentation, alerts, and AI insights.
-- ============================================================================

-- ========================
-- Departments
-- ========================
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Pods (Teams)
-- ========================
CREATE TABLE IF NOT EXISTS pods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  description TEXT,
  lead_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Pod Members
-- ========================
CREATE TABLE IF NOT EXISTS pod_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('lead', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (pod_id, user_id)
);

-- ========================
-- Employee Profiles
-- ========================
CREATE TABLE IF NOT EXISTS employee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  title TEXT,
  manager_email TEXT,
  hire_date DATE,
  location TEXT,
  employment_type TEXT DEFAULT 'full-time'
    CHECK (employment_type IN ('full-time', 'part-time', 'contractor', 'intern')),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Productivity Records (weekly)
-- ========================
CREATE TABLE IF NOT EXISTS productivity_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_email TEXT NOT NULL,
  week_start DATE NOT NULL,
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  total_hours NUMERIC(5,2) DEFAULT 0,
  billable_hours NUMERIC(5,2) DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  tasks_assigned INTEGER DEFAULT 0,
  meetings_attended INTEGER DEFAULT 0,
  utilization_pct NUMERIC(5,2) DEFAULT 0,
  efficiency_score NUMERIC(5,2) DEFAULT 0,
  attendance_status TEXT DEFAULT 'present'
    CHECK (attendance_status IN ('present', 'partial', 'absent', 'leave')),
  department TEXT,
  location TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (employee_email, week_start)
);

-- ========================
-- Leave Events
-- ========================
CREATE TABLE IF NOT EXISTS leave_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_email TEXT NOT NULL,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('pto', 'sick', 'personal', 'holiday', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_half_day BOOLEAN DEFAULT false,
  notes TEXT,
  approved_by TEXT,
  status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Process Categories
-- ========================
CREATE TABLE IF NOT EXISTS process_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Process Documents
-- ========================
CREATE TABLE IF NOT EXISTS process_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES process_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT,
  file_url TEXT,
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (category_id, slug)
);

-- ========================
-- Productivity Alerts
-- ========================
CREATE TABLE IF NOT EXISTS productivity_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_email TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('low_utilization', 'declining_trend', 'high_performer', 'absence_pattern', 'workload_imbalance')),
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT,
  week_start DATE,
  is_read BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- AI Productivity Insights
-- ========================
CREATE TABLE IF NOT EXISTS ai_productivity_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_email TEXT,
  department TEXT,
  pod_id UUID REFERENCES pods(id) ON DELETE SET NULL,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('individual', 'department', 'pod', 'company')),
  week_start DATE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  recommendations TEXT[],
  confidence_score NUMERIC(3,2),
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Seed Process Categories
-- ========================
INSERT INTO process_categories (name, slug, description, icon, sort_order) VALUES
  ('Business Development', 'business-dev', 'Sales and client acquisition processes', 'Briefcase', 1),
  ('Human Resources', 'hr', 'HR policies and procedures', 'Users', 2),
  ('Quality Assurance', 'qa', 'Testing and quality standards', 'ShieldCheck', 3),
  ('Engineering', 'engineering', 'Development workflows and standards', 'Code', 4),
  ('Operations', 'operations', 'Operational procedures', 'Settings', 5),
  ('Onboarding', 'onboarding', 'New hire onboarding processes', 'UserPlus', 6)
ON CONFLICT (slug) DO NOTHING;

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_employee_profiles_user ON employee_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_dept ON employee_profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_email ON employee_profiles(email);
CREATE INDEX IF NOT EXISTS idx_productivity_records_email ON productivity_records(employee_email);
CREATE INDEX IF NOT EXISTS idx_productivity_records_week ON productivity_records(week_start);
CREATE INDEX IF NOT EXISTS idx_productivity_records_dept ON productivity_records(department);
CREATE INDEX IF NOT EXISTS idx_pods_department ON pods(department_id);
CREATE INDEX IF NOT EXISTS idx_pod_members_pod ON pod_members(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_members_user ON pod_members(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_events_email ON leave_events(employee_email);
CREATE INDEX IF NOT EXISTS idx_process_docs_category ON process_documents(category_id);
CREATE INDEX IF NOT EXISTS idx_process_docs_status ON process_documents(status);
CREATE INDEX IF NOT EXISTS idx_productivity_alerts_email ON productivity_alerts(employee_email);
CREATE INDEX IF NOT EXISTS idx_ai_insights_employee ON ai_productivity_insights(employee_email);
CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON ai_productivity_insights(insight_type);

-- ========================
-- RLS Policies
-- ========================
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view departments" ON departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage departments" ON departments FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE pods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view pods" ON pods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage pods" ON pods FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE pod_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view pod members" ON pod_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage pod members" ON pod_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE employee_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view employees" ON employee_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage employees" ON employee_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE productivity_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view productivity" ON productivity_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage productivity" ON productivity_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE leave_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view leave" ON leave_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage leave" ON leave_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE process_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view categories" ON process_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage categories" ON process_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE process_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view documents" ON process_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage documents" ON process_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE productivity_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view alerts" ON productivity_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage alerts" ON productivity_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE ai_productivity_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view insights" ON ai_productivity_insights FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage insights" ON ai_productivity_insights FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 20260201_projects_module.sql
-- ============================================================================
-- Projects Module Migration
-- ============================================================================
-- Creates tables for: projects, statuses, members, milestones, comments,
-- files, risks, checklists, billing, and resource projections.
-- ============================================================================

-- ========================
-- Project Statuses (configurable)
-- ========================
CREATE TABLE IF NOT EXISTS project_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Projects
-- ========================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  status_id UUID REFERENCES project_statuses(id) ON DELETE SET NULL,
  client_id UUID,
  source_deal_id UUID,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  budget NUMERIC(12,2),
  currency TEXT DEFAULT 'USD',
  is_archived BOOLEAN DEFAULT false,
  external_id TEXT,
  external_provider TEXT,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Project Members
-- ========================
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'manager', 'member', 'viewer')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, user_id)
);

-- ========================
-- Project Milestones
-- ========================
CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
  completed_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Project Comments
-- ========================
CREATE TABLE IF NOT EXISTS project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES project_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Project Files
-- ========================
CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT,
  source TEXT DEFAULT 'upload' CHECK (source IN ('upload', 'google_drive', 'activecollab')),
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Project Risks
-- ========================
CREATE TABLE IF NOT EXISTS project_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'mitigated', 'resolved', 'accepted')),
  mitigation TEXT,
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Project Favorites
-- ========================
CREATE TABLE IF NOT EXISTS project_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, user_id)
);

-- ========================
-- Project Billing
-- ========================
CREATE TABLE IF NOT EXISTS project_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  billing_type TEXT DEFAULT 'fixed' CHECK (billing_type IN ('fixed', 'hourly', 'monthly', 'per_task')),
  rate NUMERIC(10,2),
  total_budget NUMERIC(12,2),
  invoiced_amount NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  payment_terms TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Project Invoices
-- ========================
CREATE TABLE IF NOT EXISTS project_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status_id);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_project ON project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_project ON project_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_risks_project ON project_risks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_invoices_project ON project_invoices(project_id);

-- ========================
-- RLS Policies
-- ========================
ALTER TABLE project_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view statuses" ON project_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage statuses" ON project_statuses FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view projects" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage projects" ON projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view members" ON project_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage members" ON project_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view milestones" ON project_milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage milestones" ON project_milestones FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view comments" ON project_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage comments" ON project_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view files" ON project_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage files" ON project_files FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_risks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view risks" ON project_risks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage risks" ON project_risks FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own favorites" ON project_favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own favorites" ON project_favorites FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE project_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view billing" ON project_billing FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage billing" ON project_billing FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view invoices" ON project_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage invoices" ON project_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ========================
-- Seed default statuses
-- ========================
INSERT INTO project_statuses (name, slug, color, sort_order, is_default) VALUES
  ('Planning', 'planning', '#6366f1', 1, true),
  ('In Progress', 'in-progress', '#f59e0b', 2, false),
  ('On Hold', 'on-hold', '#ef4444', 3, false),
  ('Completed', 'completed', '#22c55e', 4, false),
  ('Archived', 'archived', '#6b7280', 5, false)
ON CONFLICT (slug) DO NOTHING;


-- 20260202100000_project_client_access.sql
-- ============================================================================
-- Project Client Access - Client portal authentication and related tables
-- ============================================================================
-- Aligned with sj-control-main. Enables token+password client portal access.
-- ============================================================================

-- ========================
-- project_client_access
-- ========================
CREATE TABLE IF NOT EXISTS public.project_client_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  client_email TEXT NOT NULL,
  client_name TEXT,
  password_hash TEXT NOT NULL,
  access_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  project_slug TEXT,
  login_count INTEGER DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(project_id, client_email)
);

-- ========================
-- project_milestones: pm_notes for client-visible notes
-- ========================
ALTER TABLE public.project_milestones
ADD COLUMN IF NOT EXISTS pm_notes TEXT;

-- ========================
-- project_client_comments (PM comments on sprints/milestones)
-- ========================
CREATE TABLE IF NOT EXISTS public.project_client_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  milestone_id UUID REFERENCES public.project_milestones(id) ON DELETE CASCADE,
  sprint_name TEXT,
  comment_text TEXT NOT NULL,
  is_visible BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- client_feedback (client-submitted feedback)
-- ========================
CREATE TABLE IF NOT EXISTS public.client_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  client_access_id UUID REFERENCES public.project_client_access(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT NOT NULL,
  week_number INTEGER,
  year INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- project_risks: is_client_visible
-- ========================
ALTER TABLE public.project_risks
ADD COLUMN IF NOT EXISTS is_client_visible BOOLEAN DEFAULT false;

-- ========================
-- RLS
-- ========================
ALTER TABLE public.project_client_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_client_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view client access"
  ON public.project_client_access FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert client access"
  ON public.project_client_access FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update client access"
  ON public.project_client_access FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage client comments"
  ON public.project_client_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can insert feedback"
  ON public.client_feedback FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view feedback"
  ON public.client_feedback FOR SELECT TO authenticated USING (true);

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_project_client_access_token ON public.project_client_access(access_token);
CREATE INDEX IF NOT EXISTS idx_project_client_access_project ON public.project_client_access(project_id);
CREATE INDEX IF NOT EXISTS idx_project_client_comments_project ON public.project_client_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_client_feedback_project ON public.client_feedback(project_id);
CREATE INDEX IF NOT EXISTS idx_project_risks_client_visible ON public.project_risks(project_id) WHERE is_client_visible = true;

-- ========================
-- Triggers (updated_at)
-- ========================
CREATE TRIGGER update_project_client_access_updated_at
  BEFORE UPDATE ON public.project_client_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_client_comments_updated_at
  BEFORE UPDATE ON public.project_client_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Unique constraint on projects for sync upserts (external_provider + external_id)
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_external_provider_id
  ON public.projects(external_provider, external_id)
  WHERE external_provider IS NOT NULL AND external_id IS NOT NULL;


-- 20260202100100_add_activecollab_provider.sql
-- Add ActiveCollab to Project Management integration providers
DO $$
DECLARE
  cat_pm UUID;
BEGIN
  SELECT id INTO cat_pm FROM public.integration_categories WHERE slug = 'project-management' LIMIT 1;
  IF cat_pm IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.integration_providers WHERE slug = 'activecollab') THEN
    INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, docs_url, is_available, is_coming_soon, display_order)
    VALUES (cat_pm, 'ActiveCollab', 'activecollab', 'Project management and task tracking with time tracking and invoicing', 'api_key', 'https://developers.activecollab.com/', false, true, 5);
  END IF;
END $$;


