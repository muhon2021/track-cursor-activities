/**
 * MCP (Model Context Protocol) Server & Tool Tables
 *
 * Enables agents to discover and execute tools from MCP servers.
 * MCP is an open protocol that standardizes how AI systems connect to external tools,
 * data sources, and services.
 *
 * References:
 * - MCP Specification: https://modelcontextprotocol.io/
 * - Claude Code MCP Servers: https://github.com/anthropics/mcp-servers
 */

-- ============================================================================
-- MCP Servers Table
-- Stores registered MCP server configurations
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Server identification
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon_url TEXT,

  -- Server endpoint configuration
  server_url TEXT NOT NULL,
  transport_type TEXT NOT NULL DEFAULT 'http', -- 'http', 'stdio', 'websocket', 'sse'

  -- Authentication
  auth_type TEXT NOT NULL DEFAULT 'none', -- 'none', 'api_key', 'bearer', 'oauth', 'basic'
  auth_config JSONB, -- Stores credentials and auth settings

  -- Capabilities
  supports_tools BOOLEAN DEFAULT TRUE,
  supports_resources BOOLEAN DEFAULT FALSE,
  supports_prompts BOOLEAN DEFAULT FALSE,
  supports_sampling BOOLEAN DEFAULT FALSE,

  -- Server metadata
  version TEXT,
  homepage_url TEXT,
  documentation_url TEXT,

  -- Ownership & visibility
  is_global BOOLEAN DEFAULT FALSE, -- If true, available to all users
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID, -- Future multi-org support

  -- Status
  is_verified BOOLEAN DEFAULT FALSE, -- Has been tested and confirmed working
  is_enabled BOOLEAN DEFAULT TRUE,
  last_verified_at TIMESTAMPTZ,
  verification_status TEXT, -- 'pending', 'success', 'failed', 'unknown'
  verification_error TEXT,

  -- Usage tracking
  total_tool_calls INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_mcp_servers_slug ON mcp_servers(slug);
CREATE INDEX idx_mcp_servers_created_by ON mcp_servers(created_by);
CREATE INDEX idx_mcp_servers_is_global ON mcp_servers(is_global);
CREATE INDEX idx_mcp_servers_is_enabled ON mcp_servers(is_enabled);
CREATE INDEX idx_mcp_servers_transport ON mcp_servers(transport_type);

-- RLS Policies
ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;

-- Users can view global servers and their own servers
CREATE POLICY "Users can view accessible MCP servers"
  ON mcp_servers
  FOR SELECT
  USING (
    is_global = TRUE
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'moderator')
    )
  );

-- Users can create their own servers
CREATE POLICY "Users can create their own MCP servers"
  ON mcp_servers
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Users can update their own servers, admins can update global servers
CREATE POLICY "Users can update their MCP servers"
  ON mcp_servers
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR (is_global = TRUE AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    ))
  );

-- Users can delete their own servers, admins can delete global servers
CREATE POLICY "Users can delete their MCP servers"
  ON mcp_servers
  FOR DELETE
  USING (
    created_by = auth.uid()
    OR (is_global = TRUE AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    ))
  );

-- ============================================================================
-- MCP Tools Table
-- Discovered tools from MCP servers
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Server reference
  server_id UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,

  -- Tool identification
  name TEXT NOT NULL,
  description TEXT,

  -- Input schema (JSON Schema format)
  input_schema JSONB NOT NULL, -- { type: "object", properties: {...}, required: [...] }

  -- Tool metadata
  is_enabled BOOLEAN DEFAULT TRUE,

  -- Usage tracking
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,
  avg_execution_time_ms INTEGER,
  last_executed_at TIMESTAMPTZ,

  -- Timestamps
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: server + tool name
  UNIQUE(server_id, name)
);

-- Indexes
CREATE INDEX idx_mcp_tools_server_id ON mcp_tools(server_id);
CREATE INDEX idx_mcp_tools_name ON mcp_tools(name);
CREATE INDEX idx_mcp_tools_is_enabled ON mcp_tools(is_enabled);

-- RLS Policies
ALTER TABLE mcp_tools ENABLE ROW LEVEL SECURITY;

-- Users can view tools from servers they have access to
CREATE POLICY "Users can view accessible MCP tools"
  ON mcp_tools
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM mcp_servers
      WHERE mcp_servers.id = server_id
      AND (
        mcp_servers.is_global = TRUE
        OR mcp_servers.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_roles.user_id = auth.uid()
          AND user_roles.role IN ('admin', 'moderator')
        )
      )
    )
  );

-- Only system can insert/update tools (via discovery process)
CREATE POLICY "System can manage MCP tools"
  ON mcp_tools
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- ============================================================================
-- MCP Tool Executions Table
-- Tracks all tool invocations for analytics and debugging
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  tool_id UUID NOT NULL REFERENCES mcp_tools(id) ON DELETE CASCADE,
  server_id UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Execution details
  input_parameters JSONB NOT NULL,
  output_result JSONB,
  status TEXT NOT NULL, -- 'pending', 'running', 'success', 'failed', 'timeout'

  -- Error tracking
  error_message TEXT,
  error_code TEXT,

  -- Performance metrics
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  execution_time_ms INTEGER,

  -- Context
  execution_context JSONB, -- Agent run ID, conversation ID, etc.

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_mcp_executions_tool_id ON mcp_tool_executions(tool_id);
CREATE INDEX idx_mcp_executions_server_id ON mcp_tool_executions(server_id);
CREATE INDEX idx_mcp_executions_agent_id ON mcp_tool_executions(agent_id);
CREATE INDEX idx_mcp_executions_user_id ON mcp_tool_executions(user_id);
CREATE INDEX idx_mcp_executions_status ON mcp_tool_executions(status);
CREATE INDEX idx_mcp_executions_created_at ON mcp_tool_executions(created_at DESC);

-- RLS Policies
ALTER TABLE mcp_tool_executions ENABLE ROW LEVEL SECURITY;

-- Users can view their own tool executions
CREATE POLICY "Users can view their MCP tool executions"
  ON mcp_tool_executions
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all executions
CREATE POLICY "Admins can view all MCP tool executions"
  ON mcp_tool_executions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- System can insert execution records
CREATE POLICY "System can create MCP tool executions"
  ON mcp_tool_executions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Update mcp_tools statistics after execution
CREATE OR REPLACE FUNCTION update_mcp_tool_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'success' THEN
    UPDATE mcp_tools
    SET
      total_executions = total_executions + 1,
      successful_executions = successful_executions + 1,
      avg_execution_time_ms = (
        COALESCE(avg_execution_time_ms * total_executions, 0) + NEW.execution_time_ms
      ) / (total_executions + 1),
      last_executed_at = NEW.completed_at,
      updated_at = NOW()
    WHERE id = NEW.tool_id;
  ELSIF NEW.status = 'failed' THEN
    UPDATE mcp_tools
    SET
      total_executions = total_executions + 1,
      failed_executions = failed_executions + 1,
      updated_at = NOW()
    WHERE id = NEW.tool_id;
  END IF;

  -- Update server stats
  UPDATE mcp_servers
  SET
    total_tool_calls = total_tool_calls + 1,
    last_used_at = NEW.completed_at,
    updated_at = NOW()
  WHERE id = NEW.server_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_mcp_tool_stats_trigger
  AFTER UPDATE OF status ON mcp_tool_executions
  FOR EACH ROW
  WHEN (OLD.status != NEW.status AND NEW.status IN ('success', 'failed'))
  EXECUTE FUNCTION update_mcp_tool_stats();

-- Auto-update updated_at timestamp
CREATE TRIGGER update_mcp_servers_updated_at
  BEFORE UPDATE ON mcp_servers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mcp_tools_updated_at
  BEFORE UPDATE ON mcp_tools
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Seed Data - Pre-built Control Tower MCP Tools
-- ============================================================================

-- Insert global Control Tower MCP Server
INSERT INTO mcp_servers (
  name,
  slug,
  description,
  icon_url,
  server_url,
  transport_type,
  auth_type,
  supports_tools,
  is_global,
  is_verified,
  verification_status
) VALUES (
  'Control Tower Tools',
  'control-tower-tools',
  'Built-in tools for managing tasks, meetings, projects, deals, knowledge, and EOS workflows',
  NULL,
  'internal://control-tower-tools',
  'http',
  'none',
  TRUE,
  TRUE,
  TRUE,
  'success'
) ON CONFLICT (slug) DO NOTHING;

-- Get the server ID for inserting tools
DO $$
DECLARE
  server_uuid UUID;
BEGIN
  SELECT id INTO server_uuid FROM mcp_servers WHERE slug = 'control-tower-tools';

  -- Insert pre-built tools
  INSERT INTO mcp_tools (server_id, name, description, input_schema) VALUES

  -- Task Management Tools
  (server_uuid, 'create_task', 'Create a new task in Control Tower', '{
    "type": "object",
    "properties": {
      "title": {"type": "string", "description": "Task title"},
      "description": {"type": "string", "description": "Task description"},
      "stream_id": {"type": "string", "description": "Task stream UUID (optional)"},
      "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"]},
      "due_date": {"type": "string", "format": "date-time", "description": "Due date (optional)"}
    },
    "required": ["title"]
  }'),

  (server_uuid, 'search_tasks', 'Search tasks with filters', '{
    "type": "object",
    "properties": {
      "query": {"type": "string", "description": "Search query"},
      "status": {"type": "string", "enum": ["open", "in_progress", "completed", "archived"]},
      "assignee_id": {"type": "string", "description": "Assignee UUID"},
      "stream_id": {"type": "string", "description": "Task stream UUID"},
      "limit": {"type": "integer", "default": 10}
    }
  }'),

  (server_uuid, 'update_task', 'Update an existing task', '{
    "type": "object",
    "properties": {
      "task_id": {"type": "string", "description": "Task UUID"},
      "title": {"type": "string"},
      "description": {"type": "string"},
      "status": {"type": "string"},
      "priority": {"type": "string"}
    },
    "required": ["task_id"]
  }'),

  -- Meeting Tools
  (server_uuid, 'schedule_meeting', 'Schedule a new meeting (Zoom/Teams/Google Meet)', '{
    "type": "object",
    "properties": {
      "title": {"type": "string", "description": "Meeting title"},
      "description": {"type": "string"},
      "start_time": {"type": "string", "format": "date-time"},
      "duration_minutes": {"type": "integer", "default": 60},
      "provider": {"type": "string", "enum": ["zoom", "teams", "google_meet"]},
      "participant_emails": {"type": "array", "items": {"type": "string"}}
    },
    "required": ["title", "start_time", "provider"]
  }'),

  (server_uuid, 'get_meeting_transcript', 'Get meeting transcript and AI summary', '{
    "type": "object",
    "properties": {
      "meeting_id": {"type": "string", "description": "Meeting UUID"}
    },
    "required": ["meeting_id"]
  }'),

  -- Project Tools
  (server_uuid, 'create_project', 'Create a new project', '{
    "type": "object",
    "properties": {
      "name": {"type": "string"},
      "description": {"type": "string"},
      "client_id": {"type": "string", "description": "Client UUID"},
      "start_date": {"type": "string", "format": "date"},
      "end_date": {"type": "string", "format": "date"},
      "budget": {"type": "number"}
    },
    "required": ["name"]
  }'),

  (server_uuid, 'get_project_status', 'Get project health and status', '{
    "type": "object",
    "properties": {
      "project_id": {"type": "string", "description": "Project UUID"}
    },
    "required": ["project_id"]
  }'),

  -- Knowledge Tools
  (server_uuid, 'search_knowledge', 'Search knowledge base with semantic search', '{
    "type": "object",
    "properties": {
      "query": {"type": "string", "description": "Search query"},
      "limit": {"type": "integer", "default": 5},
      "category_id": {"type": "string", "description": "Filter by category UUID"}
    },
    "required": ["query"]
  }'),

  (server_uuid, 'create_knowledge_article', 'Create a new knowledge base article', '{
    "type": "object",
    "properties": {
      "title": {"type": "string"},
      "content": {"type": "string"},
      "category_id": {"type": "string", "description": "Category UUID"},
      "tags": {"type": "array", "items": {"type": "string"}}
    },
    "required": ["title", "content"]
  }'),

  -- Business Development Tools
  (server_uuid, 'create_deal', 'Create a new deal in pipeline', '{
    "type": "object",
    "properties": {
      "title": {"type": "string"},
      "value": {"type": "number"},
      "stage": {"type": "string"},
      "expected_close_date": {"type": "string", "format": "date"},
      "contact_id": {"type": "string", "description": "Contact UUID"}
    },
    "required": ["title", "value"]
  }'),

  (server_uuid, 'search_contacts', 'Search contacts in CRM', '{
    "type": "object",
    "properties": {
      "query": {"type": "string"},
      "limit": {"type": "integer", "default": 10}
    }
  }')

  ON CONFLICT (server_id, name) DO NOTHING;
END $$;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE mcp_servers IS 'MCP (Model Context Protocol) servers that provide tools to agents';
COMMENT ON TABLE mcp_tools IS 'Tools discovered from MCP servers';
COMMENT ON TABLE mcp_tool_executions IS 'Execution history for all MCP tool invocations';

COMMENT ON COLUMN mcp_servers.transport_type IS 'Communication protocol: http, stdio, websocket, sse';
COMMENT ON COLUMN mcp_servers.auth_type IS 'Authentication method: none, api_key, bearer, oauth, basic';
COMMENT ON COLUMN mcp_servers.is_global IS 'If true, available to all users; if false, only to creator';
COMMENT ON COLUMN mcp_servers.is_verified IS 'Server has been tested and confirmed working';

COMMENT ON COLUMN mcp_tools.input_schema IS 'JSON Schema defining tool parameters';
COMMENT ON COLUMN mcp_tools.total_executions IS 'Total number of times this tool has been called';
COMMENT ON COLUMN mcp_tools.avg_execution_time_ms IS 'Average execution time in milliseconds';
