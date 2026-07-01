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
