-- 20260206042320_b2a263c1-c1fc-4636-a9fc-be626a1ef480.sql
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
CREATE INDEX IF NOT EXISTS idx_mcp_servers_slug ON mcp_servers(slug);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_created_by ON mcp_servers(created_by);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_is_global ON mcp_servers(is_global);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_is_enabled ON mcp_servers(is_enabled);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_transport ON mcp_servers(transport_type);

-- RLS Policies
ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;

-- Users can view global servers and their own servers
DROP POLICY IF EXISTS "Users can view accessible MCP servers" ON mcp_servers;
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
DROP POLICY IF EXISTS "Users can create their own MCP servers" ON mcp_servers;
CREATE POLICY "Users can create their own MCP servers"
  ON mcp_servers
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Users can update their own servers, admins can update global servers
DROP POLICY IF EXISTS "Users can update their MCP servers" ON mcp_servers;
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
DROP POLICY IF EXISTS "Users can delete their MCP servers" ON mcp_servers;
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
CREATE INDEX IF NOT EXISTS idx_mcp_tools_server_id ON mcp_tools(server_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tools_name ON mcp_tools(name);
CREATE INDEX IF NOT EXISTS idx_mcp_tools_is_enabled ON mcp_tools(is_enabled);

-- RLS Policies
ALTER TABLE mcp_tools ENABLE ROW LEVEL SECURITY;

-- Users can view tools from servers they have access to
DROP POLICY IF EXISTS "Users can view accessible MCP tools" ON mcp_tools;
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
DROP POLICY IF EXISTS "System can manage MCP tools" ON mcp_tools;
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
CREATE INDEX IF NOT EXISTS idx_mcp_executions_tool_id ON mcp_tool_executions(tool_id);
CREATE INDEX IF NOT EXISTS idx_mcp_executions_server_id ON mcp_tool_executions(server_id);
CREATE INDEX IF NOT EXISTS idx_mcp_executions_agent_id ON mcp_tool_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_mcp_executions_user_id ON mcp_tool_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_executions_status ON mcp_tool_executions(status);
CREATE INDEX IF NOT EXISTS idx_mcp_executions_created_at ON mcp_tool_executions(created_at DESC);

-- RLS Policies
ALTER TABLE mcp_tool_executions ENABLE ROW LEVEL SECURITY;

-- Users can view their own tool executions
DROP POLICY IF EXISTS "Users can view their MCP tool executions" ON mcp_tool_executions;
CREATE POLICY "Users can view their MCP tool executions"
  ON mcp_tool_executions
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all executions
DROP POLICY IF EXISTS "Admins can view all MCP tool executions" ON mcp_tool_executions;
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
DROP POLICY IF EXISTS "System can create MCP tool executions" ON mcp_tool_executions;
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

DROP TRIGGER IF EXISTS update_mcp_tool_stats_trigger ON mcp_tool_executions;
CREATE TRIGGER update_mcp_tool_stats_trigger
  AFTER UPDATE OF status ON mcp_tool_executions
  FOR EACH ROW
  WHEN (OLD.status != NEW.status AND NEW.status IN ('success', 'failed'))
  EXECUTE FUNCTION update_mcp_tool_stats();

-- Auto-update updated_at timestamp
DROP TRIGGER IF EXISTS update_mcp_servers_updated_at ON mcp_servers;
CREATE TRIGGER update_mcp_servers_updated_at
  BEFORE UPDATE ON mcp_servers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_mcp_tools_updated_at ON mcp_tools;
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

-- 20260206042419_17db2545-21ee-45e1-8181-4c5a89af8f6e.sql
/**
 * Multi-Step Agent Execution Tables
 *
 * Enables agents to plan and execute complex workflows with multiple steps.
 * Agents can now:
 * - Decompose goals into actionable steps
 * - Execute steps sequentially or in parallel
 * - Capture reasoning at each decision point
 * - Handle errors and retries
 * - Track progress through multi-step workflows
 *
 * This is Phase 1 of the Agentic Evolution Roadmap.
 */

-- ============================================================================
-- Agent Execution Plans Table
-- Stores high-level workflow plans created by agents
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_execution_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Plan details
  input TEXT NOT NULL, -- User's original input/goal
  goal TEXT NOT NULL, -- Extracted/clarified goal
  plan_summary TEXT, -- High-level description of the plan

  -- Execution state
  status TEXT NOT NULL DEFAULT 'planning', -- 'planning', 'executing', 'paused', 'completed', 'failed', 'cancelled'
  current_step_number INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 0,

  -- Plan structure (array of step objects)
  steps JSONB NOT NULL DEFAULT '[]', -- [{ step_number, action_type, description, depends_on }]

  -- Results
  final_output JSONB,
  success BOOLEAN,

  -- Performance metrics
  total_tokens_used INTEGER DEFAULT 0,
  total_cost DECIMAL(10, 6) DEFAULT 0,
  planning_time_ms INTEGER,
  execution_time_ms INTEGER,

  -- Metadata
  metadata JSONB, -- Additional context (conversation_id, session_id, etc.)

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_plans_agent_id ON agent_execution_plans(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_plans_user_id ON agent_execution_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_plans_status ON agent_execution_plans(status);
CREATE INDEX IF NOT EXISTS idx_agent_plans_created_at ON agent_execution_plans(created_at DESC);

-- RLS Policies
ALTER TABLE agent_execution_plans ENABLE ROW LEVEL SECURITY;

-- Users can view their own execution plans
DROP POLICY IF EXISTS "Users can view their agent execution plans" ON agent_execution_plans;
CREATE POLICY "Users can view their agent execution plans"
  ON agent_execution_plans
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all plans
DROP POLICY IF EXISTS "Admins can view all agent execution plans" ON agent_execution_plans;
CREATE POLICY "Admins can view all agent execution plans"
  ON agent_execution_plans
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- System can create and update plans
DROP POLICY IF EXISTS "System can manage agent execution plans" ON agent_execution_plans;
CREATE POLICY "System can manage agent execution plans"
  ON agent_execution_plans
  FOR ALL
  USING (user_id = auth.uid());

-- ============================================================================
-- Agent Execution Steps Table
-- Individual steps within an execution plan
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_execution_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  plan_id UUID NOT NULL REFERENCES agent_execution_plans(id) ON DELETE CASCADE,
  parent_step_id UUID REFERENCES agent_execution_steps(id), -- For sub-steps/nested workflows

  -- Step details
  step_number INTEGER NOT NULL,
  step_name TEXT,
  description TEXT,

  -- Action details
  action_type TEXT NOT NULL, -- 'tool_call', 'reasoning', 'user_input', 'data_retrieval', 'api_call'
  action_details JSONB, -- Tool name, parameters, etc.

  -- Dependencies
  depends_on INTEGER[], -- Array of step numbers this step depends on
  can_run_parallel BOOLEAN DEFAULT FALSE,

  -- Execution
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'skipped', 'blocked'
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Results
  result JSONB,
  output_for_next_step TEXT, -- Simplified output passed to next step

  -- Error handling
  error_message TEXT,
  error_code TEXT,

  -- Performance metrics
  tokens_used INTEGER DEFAULT 0,
  cost DECIMAL(10, 6) DEFAULT 0,
  execution_time_ms INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_steps_plan_id ON agent_execution_steps(plan_id);
CREATE INDEX IF NOT EXISTS idx_agent_steps_parent_id ON agent_execution_steps(parent_step_id);
CREATE INDEX IF NOT EXISTS idx_agent_steps_status ON agent_execution_steps(status);
CREATE INDEX IF NOT EXISTS idx_agent_steps_plan_step ON agent_execution_steps(plan_id, step_number);

-- RLS Policies
ALTER TABLE agent_execution_steps ENABLE ROW LEVEL SECURITY;

-- Users can view steps from their plans
DROP POLICY IF EXISTS "Users can view their agent execution steps" ON agent_execution_steps;
CREATE POLICY "Users can view their agent execution steps"
  ON agent_execution_steps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agent_execution_plans
      WHERE agent_execution_plans.id = plan_id
      AND agent_execution_plans.user_id = auth.uid()
    )
  );

-- Admins can view all steps
DROP POLICY IF EXISTS "Admins can view all agent execution steps" ON agent_execution_steps;
CREATE POLICY "Admins can view all agent execution steps"
  ON agent_execution_steps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- System can manage steps
DROP POLICY IF EXISTS "System can manage agent execution steps" ON agent_execution_steps;
CREATE POLICY "System can manage agent execution steps"
  ON agent_execution_steps
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM agent_execution_plans
      WHERE agent_execution_plans.id = plan_id
      AND agent_execution_plans.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Agent Reasoning Traces Table
-- Captures agent's reasoning/thinking at each decision point
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_reasoning_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  plan_id UUID NOT NULL REFERENCES agent_execution_plans(id) ON DELETE CASCADE,
  step_id UUID REFERENCES agent_execution_steps(id) ON DELETE CASCADE,

  -- Reasoning details
  reasoning_type TEXT NOT NULL, -- 'planning', 'decision', 'reflection', 'error_analysis', 'verification'
  content TEXT NOT NULL, -- The actual reasoning/thinking

  -- Context
  context JSONB, -- What information was available when this reasoning occurred

  -- Confidence
  confidence_score FLOAT, -- 0.0 - 1.0

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reasoning_plan_id ON agent_reasoning_traces(plan_id);
CREATE INDEX IF NOT EXISTS idx_reasoning_step_id ON agent_reasoning_traces(step_id);
CREATE INDEX IF NOT EXISTS idx_reasoning_type ON agent_reasoning_traces(reasoning_type);
CREATE INDEX IF NOT EXISTS idx_reasoning_created_at ON agent_reasoning_traces(created_at DESC);

-- RLS Policies
ALTER TABLE agent_reasoning_traces ENABLE ROW LEVEL SECURITY;

-- Users can view reasoning from their plans
DROP POLICY IF EXISTS "Users can view their agent reasoning traces" ON agent_reasoning_traces;
CREATE POLICY "Users can view their agent reasoning traces"
  ON agent_reasoning_traces
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agent_execution_plans
      WHERE agent_execution_plans.id = plan_id
      AND agent_execution_plans.user_id = auth.uid()
    )
  );

-- Admins can view all reasoning
DROP POLICY IF EXISTS "Admins can view all agent reasoning traces" ON agent_reasoning_traces;
CREATE POLICY "Admins can view all agent reasoning traces"
  ON agent_reasoning_traces
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- System can create reasoning traces
DROP POLICY IF EXISTS "System can create agent reasoning traces" ON agent_reasoning_traces;
CREATE POLICY "System can create agent reasoning traces"
  ON agent_reasoning_traces
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agent_execution_plans
      WHERE agent_execution_plans.id = plan_id
      AND agent_execution_plans.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Update plan metrics when step completes
CREATE OR REPLACE FUNCTION update_plan_metrics_on_step_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE agent_execution_plans
    SET
      total_tokens_used = total_tokens_used + COALESCE(NEW.tokens_used, 0),
      total_cost = total_cost + COALESCE(NEW.cost, 0),
      current_step_number = GREATEST(current_step_number, NEW.step_number),
      updated_at = NOW()
    WHERE id = NEW.plan_id;
  END IF;

  -- Check if all steps are completed, then mark plan as completed
  IF NEW.status = 'completed' THEN
    PERFORM update_plan_status_if_all_steps_done(NEW.plan_id);
  END IF;

  -- If step failed and no more retries, mark plan as failed
  IF NEW.status = 'failed' AND NEW.retry_count >= NEW.max_retries THEN
    UPDATE agent_execution_plans
    SET
      status = 'failed',
      completed_at = NOW(),
      updated_at = NOW()
    WHERE id = NEW.plan_id
    AND status = 'executing';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_plan_metrics_trigger ON agent_execution_steps;
CREATE TRIGGER update_plan_metrics_trigger
  AFTER UPDATE OF status ON agent_execution_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_plan_metrics_on_step_completion();

-- Check if all steps are done and update plan status
CREATE OR REPLACE FUNCTION update_plan_status_if_all_steps_done(p_plan_id UUID)
RETURNS void AS $$
DECLARE
  total_steps_count INTEGER;
  completed_steps_count INTEGER;
  failed_steps_count INTEGER;
BEGIN
  -- Count total steps
  SELECT COUNT(*) INTO total_steps_count
  FROM agent_execution_steps
  WHERE plan_id = p_plan_id;

  -- Count completed steps
  SELECT COUNT(*) INTO completed_steps_count
  FROM agent_execution_steps
  WHERE plan_id = p_plan_id
  AND status = 'completed';

  -- Count failed steps (that exhausted retries)
  SELECT COUNT(*) INTO failed_steps_count
  FROM agent_execution_steps
  WHERE plan_id = p_plan_id
  AND status = 'failed'
  AND retry_count >= max_retries;

  -- If all steps are completed, mark plan as completed
  IF completed_steps_count = total_steps_count THEN
    UPDATE agent_execution_plans
    SET
      status = 'completed',
      success = TRUE,
      completed_at = NOW(),
      execution_time_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
      updated_at = NOW()
    WHERE id = p_plan_id
    AND status = 'executing';
  END IF;

  -- If any step failed, mark plan as failed
  IF failed_steps_count > 0 THEN
    UPDATE agent_execution_plans
    SET
      status = 'failed',
      success = FALSE,
      completed_at = NOW(),
      execution_time_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
      updated_at = NOW()
    WHERE id = p_plan_id
    AND status = 'executing';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Auto-update timestamps
DROP TRIGGER IF EXISTS update_agent_plans_updated_at ON agent_execution_plans;
CREATE TRIGGER update_agent_plans_updated_at
  BEFORE UPDATE ON agent_execution_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agent_steps_updated_at ON agent_execution_steps;
CREATE TRIGGER update_agent_steps_updated_at
  BEFORE UPDATE ON agent_execution_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Views for Analytics
-- ============================================================================

-- Agent performance by plan success rate
DROP VIEW IF EXISTS agent_plan_performance;
CREATE VIEW agent_plan_performance AS
SELECT
  agent_id,
  COUNT(*) as total_plans,
  SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END) as successful_plans,
  SUM(CASE WHEN success = FALSE THEN 1 ELSE 0 END) as failed_plans,
  AVG(total_steps) as avg_steps_per_plan,
  AVG(execution_time_ms) as avg_execution_time_ms,
  AVG(total_tokens_used) as avg_tokens_per_plan,
  AVG(total_cost) as avg_cost_per_plan,
  SUM(total_cost) as total_cost
FROM agent_execution_plans
WHERE status IN ('completed', 'failed')
GROUP BY agent_id;

-- Step performance by action type
DROP VIEW IF EXISTS agent_step_performance;
CREATE VIEW agent_step_performance AS
SELECT
  action_type,
  COUNT(*) as total_steps,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_steps,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_steps,
  AVG(execution_time_ms) as avg_execution_time_ms,
  AVG(retry_count) as avg_retry_count
FROM agent_execution_steps
WHERE status IN ('completed', 'failed')
GROUP BY action_type;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE agent_execution_plans IS 'Multi-step workflow plans created and executed by agents';
COMMENT ON TABLE agent_execution_steps IS 'Individual steps within agent execution plans';
COMMENT ON TABLE agent_reasoning_traces IS 'Agent reasoning/thinking captured at decision points';

COMMENT ON COLUMN agent_execution_plans.status IS 'planning, executing, paused, completed, failed, cancelled';
COMMENT ON COLUMN agent_execution_plans.steps IS 'JSONB array of planned steps with descriptions and dependencies';

COMMENT ON COLUMN agent_execution_steps.action_type IS 'tool_call, reasoning, user_input, data_retrieval, api_call';
COMMENT ON COLUMN agent_execution_steps.depends_on IS 'Array of step numbers this step depends on';
COMMENT ON COLUMN agent_execution_steps.can_run_parallel IS 'Whether this step can run in parallel with others';

COMMENT ON COLUMN agent_reasoning_traces.reasoning_type IS 'planning, decision, reflection, error_analysis, verification';
COMMENT ON COLUMN agent_reasoning_traces.confidence_score IS 'Agent confidence in this reasoning (0.0 - 1.0)';

-- 20260206042526_81b698de-93c8-4e9b-9117-11d748dd7b1a.sql
/**
 * Agent Memory System Migration
 *
 * Enables agents to remember context, preferences, and past interactions.
 * Memory types:
 * - Short-term: Recent conversation context (last N messages)
 * - Long-term: Persistent facts, preferences, learned patterns
 * - Episodic: Key events, milestones, important conversations
 * - Semantic: Embedded knowledge for semantic search
 *
 * This is Phase 1 of the Agentic Evolution Roadmap - Memory & Context.
 */

-- ============================================================================
-- Agent Memories Table
-- Stores all types of agent memories with vector embeddings
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Memory classification
  memory_type TEXT NOT NULL, -- 'short_term', 'long_term', 'episodic', 'semantic'
  memory_category TEXT, -- 'preference', 'fact', 'skill', 'goal', 'relationship', 'context'

  -- Content
  content TEXT NOT NULL, -- The actual memory content
  summary TEXT, -- Short summary for quick lookup

  -- Embedding for semantic search
  embedding vector(1536), -- OpenAI ada-002 dimension

  -- Source context
  source_type TEXT, -- 'conversation', 'feedback', 'observation', 'explicit'
  source_id UUID, -- Conversation ID, message ID, etc.

  -- Importance and relevance
  importance_score FLOAT DEFAULT 0.5, -- 0.0 (trivial) to 1.0 (critical)
  access_count INTEGER DEFAULT 0, -- How many times this memory was retrieved
  last_accessed_at TIMESTAMPTZ,

  -- Temporal relevance
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ, -- NULL means indefinite

  -- Memory lifecycle
  is_active BOOLEAN DEFAULT TRUE,
  consolidated BOOLEAN DEFAULT FALSE, -- Has been consolidated into long-term
  superseded_by UUID REFERENCES agent_memories(id), -- If replaced by newer memory

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional context

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_memories_agent_id ON agent_memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_user_id ON agent_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_type ON agent_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_agent_memories_category ON agent_memories(memory_category);
CREATE INDEX IF NOT EXISTS idx_agent_memories_importance ON agent_memories(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memories_active ON agent_memories(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_agent_memories_created_at ON agent_memories(created_at DESC);

-- Vector similarity search index (using ivfflat)
CREATE INDEX IF NOT EXISTS idx_agent_memories_embedding ON agent_memories
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- RLS Policies
ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;

-- Users can view their own agent memories
DROP POLICY IF EXISTS "Users can view their agent memories" ON agent_memories;
CREATE POLICY "Users can view their agent memories"
  ON agent_memories
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all memories
DROP POLICY IF EXISTS "Admins can view all agent memories" ON agent_memories;
CREATE POLICY "Admins can view all agent memories"
  ON agent_memories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- System can manage memories
DROP POLICY IF EXISTS "System can manage agent memories" ON agent_memories;
CREATE POLICY "System can manage agent memories"
  ON agent_memories
  FOR ALL
  USING (user_id = auth.uid());

-- ============================================================================
-- User Preferences Table
-- Learned preferences from user interactions
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL, -- NULL means global preference

  -- Preference details
  preference_key TEXT NOT NULL, -- 'communication_style', 'preferred_time', 'task_priority_order', etc.
  preference_value JSONB NOT NULL, -- The preference value (flexible structure)

  -- Source and confidence
  learned_from TEXT, -- 'explicit', 'observed', 'inferred'
  confidence_score FLOAT DEFAULT 0.5, -- 0.0 (uncertain) to 1.0 (certain)
  evidence_count INTEGER DEFAULT 1, -- Number of observations supporting this

  -- Impact tracking
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Lifecycle
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one preference key per user per agent (or global)
  UNIQUE(user_id, agent_id, preference_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_agent_id ON user_preferences(agent_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_key ON user_preferences(preference_key);
CREATE INDEX IF NOT EXISTS idx_user_preferences_active ON user_preferences(is_active) WHERE is_active = TRUE;

-- RLS Policies
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
DROP POLICY IF EXISTS "Users can view their preferences" ON user_preferences;
CREATE POLICY "Users can view their preferences"
  ON user_preferences
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all preferences
DROP POLICY IF EXISTS "Admins can view all preferences" ON user_preferences;
CREATE POLICY "Admins can view all preferences"
  ON user_preferences
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- System can manage preferences
DROP POLICY IF EXISTS "System can manage preferences" ON user_preferences;
CREATE POLICY "System can manage preferences"
  ON user_preferences
  FOR ALL
  USING (user_id = auth.uid());

-- ============================================================================
-- Agent Learning Events Table
-- Tracks feedback, corrections, and learning opportunities
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL, -- 'user_feedback', 'correction', 'reinforcement', 'rejection'
  event_description TEXT NOT NULL,

  -- Context
  related_memory_id UUID REFERENCES agent_memories(id),
  related_conversation_id UUID, -- Link to agent_conversations if exists
  related_message_id UUID, -- Link to agent_messages if exists

  -- Feedback details
  feedback_type TEXT, -- 'positive', 'negative', 'neutral', 'correction'
  feedback_text TEXT,

  -- Agent response
  agent_action_taken TEXT, -- What the agent did in response
  behavior_change JSONB, -- What changed as a result

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_learning_events_agent_id ON agent_learning_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_learning_events_user_id ON agent_learning_events(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_events_type ON agent_learning_events(event_type);
CREATE INDEX IF NOT EXISTS idx_learning_events_created_at ON agent_learning_events(created_at DESC);

-- RLS Policies
ALTER TABLE agent_learning_events ENABLE ROW LEVEL SECURITY;

-- Users can view their learning events
DROP POLICY IF EXISTS "Users can view their learning events" ON agent_learning_events;
CREATE POLICY "Users can view their learning events"
  ON agent_learning_events
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all learning events
DROP POLICY IF EXISTS "Admins can view all learning events" ON agent_learning_events;
CREATE POLICY "Admins can view all learning events"
  ON agent_learning_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- System can create learning events
DROP POLICY IF EXISTS "System can create learning events" ON agent_learning_events;
CREATE POLICY "System can create learning events"
  ON agent_learning_events
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to retrieve relevant memories using semantic search
CREATE OR REPLACE FUNCTION get_relevant_memories(
  p_agent_id UUID,
  p_user_id UUID,
  p_query_embedding vector(1536),
  p_memory_types TEXT[] DEFAULT ARRAY['short_term', 'long_term', 'episodic'],
  p_limit INTEGER DEFAULT 10,
  p_similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  memory_id UUID,
  content TEXT,
  memory_type TEXT,
  similarity FLOAT,
  importance_score FLOAT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.memory_type,
    1 - (m.embedding <=> p_query_embedding) AS similarity,
    m.importance_score,
    m.created_at
  FROM agent_memories m
  WHERE
    m.agent_id = p_agent_id
    AND m.user_id = p_user_id
    AND m.is_active = TRUE
    AND m.memory_type = ANY(p_memory_types)
    AND (1 - (m.embedding <=> p_query_embedding)) >= p_similarity_threshold
  ORDER BY
    (1 - (m.embedding <=> p_query_embedding)) DESC,
    m.importance_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to consolidate short-term memories into long-term
CREATE OR REPLACE FUNCTION consolidate_short_term_memories(
  p_agent_id UUID,
  p_user_id UUID,
  p_days_old INTEGER DEFAULT 7
)
RETURNS INTEGER AS $$
DECLARE
  consolidated_count INTEGER := 0;
BEGIN
  -- Mark old short-term memories for consolidation
  UPDATE agent_memories
  SET
    memory_type = 'long_term',
    consolidated = TRUE,
    updated_at = NOW()
  WHERE
    agent_id = p_agent_id
    AND user_id = p_user_id
    AND memory_type = 'short_term'
    AND is_active = TRUE
    AND created_at < NOW() - (p_days_old || ' days')::INTERVAL
    AND importance_score >= 0.3 -- Only consolidate somewhat important memories
    AND access_count > 0; -- Only consolidate accessed memories

  GET DIAGNOSTICS consolidated_count = ROW_COUNT;

  RETURN consolidated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to prune low-value short-term memories
CREATE OR REPLACE FUNCTION prune_short_term_memories(
  p_agent_id UUID,
  p_user_id UUID,
  p_days_old INTEGER DEFAULT 30,
  p_importance_threshold FLOAT DEFAULT 0.2
)
RETURNS INTEGER AS $$
DECLARE
  pruned_count INTEGER := 0;
BEGIN
  -- Deactivate old, low-importance, rarely-accessed short-term memories
  UPDATE agent_memories
  SET
    is_active = FALSE,
    updated_at = NOW()
  WHERE
    agent_id = p_agent_id
    AND user_id = p_user_id
    AND memory_type = 'short_term'
    AND is_active = TRUE
    AND created_at < NOW() - (p_days_old || ' days')::INTERVAL
    AND importance_score < p_importance_threshold
    AND access_count < 2;

  GET DIAGNOSTICS pruned_count = ROW_COUNT;

  RETURN pruned_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update memory access statistics
CREATE OR REPLACE FUNCTION update_memory_access()
RETURNS TRIGGER AS $$
BEGIN
  -- This trigger would be called when a memory is accessed
  -- (Implementation depends on how you track access)
  NEW.access_count = OLD.access_count + 1;
  NEW.last_accessed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to boost importance of frequently accessed memories
CREATE OR REPLACE FUNCTION boost_memory_importance(
  p_memory_id UUID,
  p_boost_amount FLOAT DEFAULT 0.1
)
RETURNS VOID AS $$
BEGIN
  UPDATE agent_memories
  SET
    importance_score = LEAST(1.0, importance_score + p_boost_amount),
    access_count = access_count + 1,
    last_accessed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_memory_id;
END;
$$ LANGUAGE plpgsql;

-- Auto-update timestamps
DROP TRIGGER IF EXISTS update_agent_memories_updated_at ON agent_memories;
CREATE TRIGGER update_agent_memories_updated_at
  BEFORE UPDATE ON agent_memories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Views for Analytics
-- ============================================================================

-- Memory usage by agent
DROP VIEW IF EXISTS agent_memory_stats;
CREATE VIEW agent_memory_stats AS
SELECT
  agent_id,
  COUNT(*) as total_memories,
  COUNT(*) FILTER (WHERE memory_type = 'short_term') as short_term_count,
  COUNT(*) FILTER (WHERE memory_type = 'long_term') as long_term_count,
  COUNT(*) FILTER (WHERE memory_type = 'episodic') as episodic_count,
  COUNT(*) FILTER (WHERE memory_type = 'semantic') as semantic_count,
  AVG(importance_score) as avg_importance,
  SUM(access_count) as total_accesses,
  MAX(last_accessed_at) as last_memory_access
FROM agent_memories
WHERE is_active = TRUE
GROUP BY agent_id;

-- User preference coverage
DROP VIEW IF EXISTS user_preference_coverage;
CREATE VIEW user_preference_coverage AS
SELECT
  user_id,
  COUNT(*) as total_preferences,
  COUNT(*) FILTER (WHERE learned_from = 'explicit') as explicit_count,
  COUNT(*) FILTER (WHERE learned_from = 'observed') as observed_count,
  COUNT(*) FILTER (WHERE learned_from = 'inferred') as inferred_count,
  AVG(confidence_score) as avg_confidence,
  SUM(times_used) as total_usage
FROM user_preferences
WHERE is_active = TRUE
GROUP BY user_id;

-- Learning event summary
DROP VIEW IF EXISTS agent_learning_summary;
CREATE VIEW agent_learning_summary AS
SELECT
  agent_id,
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE event_type = 'user_feedback') as feedback_count,
  COUNT(*) FILTER (WHERE event_type = 'correction') as correction_count,
  COUNT(*) FILTER (WHERE event_type = 'reinforcement') as reinforcement_count,
  COUNT(*) FILTER (WHERE feedback_type = 'positive') as positive_feedback,
  COUNT(*) FILTER (WHERE feedback_type = 'negative') as negative_feedback
FROM agent_learning_events
GROUP BY agent_id;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE agent_memories IS 'Agent memory store with vector embeddings for semantic search';
COMMENT ON TABLE user_preferences IS 'Learned user preferences from interactions';
COMMENT ON TABLE agent_learning_events IS 'Tracks feedback and learning opportunities';

COMMENT ON COLUMN agent_memories.memory_type IS 'short_term, long_term, episodic, semantic';
COMMENT ON COLUMN agent_memories.memory_category IS 'preference, fact, skill, goal, relationship, context';
COMMENT ON COLUMN agent_memories.importance_score IS 'Relevance score from 0.0 (trivial) to 1.0 (critical)';
COMMENT ON COLUMN agent_memories.embedding IS 'Vector embedding for semantic similarity search';

COMMENT ON COLUMN user_preferences.learned_from IS 'How the preference was learned: explicit, observed, inferred';
COMMENT ON COLUMN user_preferences.confidence_score IS 'Confidence in this preference from 0.0 (uncertain) to 1.0 (certain)';

COMMENT ON COLUMN agent_learning_events.event_type IS 'user_feedback, correction, reinforcement, rejection';
COMMENT ON COLUMN agent_learning_events.feedback_type IS 'positive, negative, neutral, correction';

-- 20260206093132_74e3f84c-7a85-4917-88e6-68fa5307a2ad.sql
-- Insert integration fields for Google Drive
INSERT INTO integration_fields (
  id, provider_id, field_key, field_type, label, 
  placeholder, help_text, is_required, is_sensitive, display_order
) VALUES 
  (
    gen_random_uuid(),
    'b5c092ce-f08f-4510-8299-0369e6195477',
    'client_id',
    'text',
    'Client ID',
    'Enter your Google OAuth Client ID',
    'Get this from the Google Cloud Console under APIs & Services > Credentials',
    true,
    false,
    1
  ),
  (
    gen_random_uuid(),
    'b5c092ce-f08f-4510-8299-0369e6195477',
    'client_secret',
    'password',
    'Client Secret',
    'Enter your Google OAuth Client Secret',
    'Get this from the Google Cloud Console under APIs & Services > Credentials',
    true,
    true,
    2
  );

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- 20260206_guardrails_safety.sql
/**
 * Phase 3.2: Guardrails & Safety System
 *
 * Implements safety controls for agent executions including:
 * - Content safety (PII, offensive content, confidential keywords)
 * - Tool usage limits (max calls, restricted tools, rate limits)
 * - Cost controls (max tokens, max cost per agent/day)
 * - Data access restrictions (sensitive tables, RLS enforcement)
 */

-- ============================================================================
-- GUARDRAILS TABLES
-- ============================================================================

/**
 * Agent Guardrails
 * Defines safety rules and constraints for agent behavior
 */
CREATE TABLE IF NOT EXISTS agent_guardrails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  guardrail_type TEXT NOT NULL, -- input_validation, output_filtering, tool_restriction, cost_control, data_access
  rules JSONB NOT NULL DEFAULT '{}',
  severity TEXT NOT NULL DEFAULT 'block', -- warning, block
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE, -- System guardrails cannot be deleted
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_guardrails_type ON agent_guardrails(guardrail_type);
CREATE INDEX idx_guardrails_active ON agent_guardrails(is_active) WHERE is_active = TRUE;

/**
 * Agent Guardrail Assignments
 * Links guardrails to specific agents
 */
CREATE TABLE IF NOT EXISTS agent_guardrail_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  guardrail_id UUID NOT NULL REFERENCES agent_guardrails(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT TRUE,
  override_rules JSONB, -- Agent-specific rule overrides
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, guardrail_id)
);

CREATE INDEX idx_guardrail_assignments_agent ON agent_guardrail_assignments(agent_id);
CREATE INDEX idx_guardrail_assignments_guardrail ON agent_guardrail_assignments(guardrail_id);

/**
 * Guardrail Violations
 * Logs all guardrail violations for auditing
 */
CREATE TABLE IF NOT EXISTS guardrail_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardrail_id UUID NOT NULL REFERENCES agent_guardrails(id),
  agent_id UUID NOT NULL REFERENCES ai_agents(id),
  user_id UUID REFERENCES profiles(id),
  execution_step_id UUID REFERENCES agent_execution_steps(id),
  execution_id TEXT, -- From tool executions
  violation_details JSONB NOT NULL,
  action_taken TEXT NOT NULL, -- blocked, warned, logged
  input_content TEXT,
  output_content TEXT,
  severity TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_violations_agent ON guardrail_violations(agent_id);
CREATE INDEX idx_violations_guardrail ON guardrail_violations(guardrail_id);
CREATE INDEX idx_violations_created ON guardrail_violations(created_at DESC);
CREATE INDEX idx_violations_severity ON guardrail_violations(severity);

/**
 * Agent Cost Limits
 * Tracks and enforces cost budgets per agent
 */
CREATE TABLE IF NOT EXISTS agent_cost_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  limit_type TEXT NOT NULL, -- per_execution, hourly, daily, weekly, monthly
  max_cost DECIMAL(10, 6) NOT NULL,
  current_spend DECIMAL(10, 6) DEFAULT 0,
  reset_at TIMESTAMPTZ,
  alert_threshold DECIMAL(5, 2) DEFAULT 0.80, -- Alert at 80% of limit
  alert_sent BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, limit_type)
);

CREATE INDEX idx_cost_limits_agent ON agent_cost_limits(agent_id);
CREATE INDEX idx_cost_limits_type ON agent_cost_limits(limit_type);

/**
 * Tool Usage Restrictions
 * Defines which tools can be used by which agents
 */
CREATE TABLE IF NOT EXISTS tool_usage_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_name TEXT NOT NULL,
  restriction_type TEXT NOT NULL, -- blacklist, whitelist, rate_limit
  agent_id UUID REFERENCES ai_agents(id), -- NULL means applies to all agents
  allowed_agents UUID[], -- For whitelist mode
  denied_agents UUID[], -- For blacklist mode
  max_calls_per_hour INTEGER,
  max_calls_per_day INTEGER,
  requires_approval BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tool_restrictions_tool ON tool_usage_restrictions(tool_name);
CREATE INDEX idx_tool_restrictions_agent ON tool_usage_restrictions(agent_id);

/**
 * Tool Usage Tracking
 * Tracks tool usage for rate limiting
 */
CREATE TABLE IF NOT EXISTS tool_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id),
  tool_name TEXT NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  execution_id TEXT,
  success BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tool_tracking_agent_tool ON tool_usage_tracking(agent_id, tool_name);
CREATE INDEX idx_tool_tracking_used_at ON tool_usage_tracking(used_at DESC);

/**
 * Content Filters
 * Patterns and keywords for content filtering
 */
CREATE TABLE IF NOT EXISTS content_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  filter_type TEXT NOT NULL, -- pii, offensive, confidential, custom
  pattern TEXT, -- Regex pattern
  keywords TEXT[], -- Array of keywords
  severity TEXT NOT NULL DEFAULT 'block', -- warning, block
  applies_to TEXT NOT NULL DEFAULT 'both', -- input, output, both
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_filters_type ON content_filters(filter_type);
CREATE INDEX idx_content_filters_active ON content_filters(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

/**
 * Check if agent has exceeded cost limit
 */
CREATE OR REPLACE FUNCTION check_agent_cost_limit(
  p_agent_id UUID,
  p_estimated_cost DECIMAL(10, 6),
  p_limit_type TEXT DEFAULT 'per_execution'
)
RETURNS TABLE (
  can_proceed BOOLEAN,
  limit_exceeded BOOLEAN,
  current_spend DECIMAL(10, 6),
  max_cost DECIMAL(10, 6),
  remaining_budget DECIMAL(10, 6)
) AS $$
DECLARE
  v_limit RECORD;
BEGIN
  -- Get active cost limit
  SELECT * INTO v_limit
  FROM agent_cost_limits
  WHERE agent_id = p_agent_id
    AND limit_type = p_limit_type
    AND is_active = TRUE
  LIMIT 1;

  -- No limit configured
  IF NOT FOUND THEN
    RETURN QUERY SELECT TRUE, FALSE, 0::DECIMAL(10,6), NULL::DECIMAL(10,6), NULL::DECIMAL(10,6);
    RETURN;
  END IF;

  -- Check if adding this cost would exceed limit
  IF (v_limit.current_spend + p_estimated_cost) > v_limit.max_cost THEN
    RETURN QUERY SELECT
      FALSE,
      TRUE,
      v_limit.current_spend,
      v_limit.max_cost,
      v_limit.max_cost - v_limit.current_spend;
  ELSE
    RETURN QUERY SELECT
      TRUE,
      FALSE,
      v_limit.current_spend,
      v_limit.max_cost,
      v_limit.max_cost - v_limit.current_spend;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Record agent cost and update limits
 */
CREATE OR REPLACE FUNCTION record_agent_cost(
  p_agent_id UUID,
  p_cost DECIMAL(10, 6)
)
RETURNS VOID AS $$
BEGIN
  -- Update per_execution limit (always)
  UPDATE agent_cost_limits
  SET current_spend = current_spend + p_cost,
      updated_at = NOW()
  WHERE agent_id = p_agent_id
    AND limit_type = 'per_execution'
    AND is_active = TRUE;

  -- Update hourly limit
  UPDATE agent_cost_limits
  SET current_spend = current_spend + p_cost,
      updated_at = NOW()
  WHERE agent_id = p_agent_id
    AND limit_type = 'hourly'
    AND is_active = TRUE
    AND reset_at > NOW();

  -- Update daily limit
  UPDATE agent_cost_limits
  SET current_spend = current_spend + p_cost,
      updated_at = NOW()
  WHERE agent_id = p_agent_id
    AND limit_type = 'daily'
    AND is_active = TRUE
    AND reset_at > NOW();

  -- Update weekly limit
  UPDATE agent_cost_limits
  SET current_spend = current_spend + p_cost,
      updated_at = NOW()
  WHERE agent_id = p_agent_id
    AND limit_type = 'weekly'
    AND is_active = TRUE
    AND reset_at > NOW();

  -- Update monthly limit
  UPDATE agent_cost_limits
  SET current_spend = current_spend + p_cost,
      updated_at = NOW()
  WHERE agent_id = p_agent_id
    AND limit_type = 'monthly'
    AND is_active = TRUE
    AND reset_at > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Reset expired cost limits
 */
CREATE OR REPLACE FUNCTION reset_expired_cost_limits()
RETURNS INTEGER AS $$
DECLARE
  v_reset_count INTEGER;
BEGIN
  UPDATE agent_cost_limits
  SET current_spend = 0,
      alert_sent = FALSE,
      reset_at = CASE
        WHEN limit_type = 'hourly' THEN NOW() + INTERVAL '1 hour'
        WHEN limit_type = 'daily' THEN NOW() + INTERVAL '1 day'
        WHEN limit_type = 'weekly' THEN NOW() + INTERVAL '1 week'
        WHEN limit_type = 'monthly' THEN NOW() + INTERVAL '1 month'
        ELSE reset_at
      END,
      updated_at = NOW()
  WHERE reset_at < NOW()
    AND is_active = TRUE
    AND limit_type != 'per_execution';

  GET DIAGNOSTICS v_reset_count = ROW_COUNT;
  RETURN v_reset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Check tool usage rate limit
 */
CREATE OR REPLACE FUNCTION check_tool_rate_limit(
  p_agent_id UUID,
  p_tool_name TEXT
)
RETURNS TABLE (
  can_use BOOLEAN,
  limit_type TEXT,
  usage_count INTEGER,
  max_allowed INTEGER,
  resets_at TIMESTAMPTZ
) AS $$
DECLARE
  v_restriction RECORD;
  v_hourly_count INTEGER;
  v_daily_count INTEGER;
BEGIN
  -- Get tool restriction
  SELECT * INTO v_restriction
  FROM tool_usage_restrictions
  WHERE tool_name = p_tool_name
    AND (agent_id IS NULL OR agent_id = p_agent_id)
    AND is_active = TRUE
  ORDER BY agent_id NULLS LAST  -- Prefer agent-specific restrictions
  LIMIT 1;

  -- No restrictions
  IF NOT FOUND THEN
    RETURN QUERY SELECT TRUE, NULL::TEXT, 0, NULL::INTEGER, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Check hourly limit
  IF v_restriction.max_calls_per_hour IS NOT NULL THEN
    SELECT COUNT(*) INTO v_hourly_count
    FROM tool_usage_tracking
    WHERE agent_id = p_agent_id
      AND tool_name = p_tool_name
      AND used_at > NOW() - INTERVAL '1 hour';

    IF v_hourly_count >= v_restriction.max_calls_per_hour THEN
      RETURN QUERY SELECT
        FALSE,
        'hourly'::TEXT,
        v_hourly_count,
        v_restriction.max_calls_per_hour,
        DATE_TRUNC('hour', NOW()) + INTERVAL '1 hour';
      RETURN;
    END IF;
  END IF;

  -- Check daily limit
  IF v_restriction.max_calls_per_day IS NOT NULL THEN
    SELECT COUNT(*) INTO v_daily_count
    FROM tool_usage_tracking
    WHERE agent_id = p_agent_id
      AND tool_name = p_tool_name
      AND used_at > NOW() - INTERVAL '1 day';

    IF v_daily_count >= v_restriction.max_calls_per_day THEN
      RETURN QUERY SELECT
        FALSE,
        'daily'::TEXT,
        v_daily_count,
        v_restriction.max_calls_per_day,
        DATE_TRUNC('day', NOW()) + INTERVAL '1 day';
      RETURN;
    END IF;
  END IF;

  -- No limits exceeded
  RETURN QUERY SELECT TRUE, NULL::TEXT, 0, NULL::INTEGER, NULL::TIMESTAMPTZ;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Record tool usage
 */
CREATE OR REPLACE FUNCTION record_tool_usage(
  p_agent_id UUID,
  p_tool_name TEXT,
  p_execution_id TEXT,
  p_success BOOLEAN DEFAULT TRUE
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO tool_usage_tracking (agent_id, tool_name, execution_id, success)
  VALUES (p_agent_id, p_tool_name, p_execution_id, p_success);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Get agent guardrails
 */
CREATE OR REPLACE FUNCTION get_agent_guardrails(p_agent_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  guardrail_type TEXT,
  rules JSONB,
  severity TEXT,
  is_enabled BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id,
    g.name,
    g.guardrail_type,
    COALESCE(aga.override_rules, g.rules) as rules,
    g.severity,
    COALESCE(aga.is_enabled, TRUE) as is_enabled
  FROM agent_guardrails g
  LEFT JOIN agent_guardrail_assignments aga ON aga.guardrail_id = g.id AND aga.agent_id = p_agent_id
  WHERE g.is_active = TRUE
    AND (aga.agent_id = p_agent_id OR g.is_system = TRUE)
    AND (aga.is_enabled IS NULL OR aga.is_enabled = TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PRE-BUILT GUARDRAILS
-- ============================================================================

/**
 * 1. Content Safety - PII Detection
 */
INSERT INTO agent_guardrails (name, description, guardrail_type, rules, severity, is_system, is_active)
VALUES (
  'PII Detection',
  'Blocks personally identifiable information (emails, phone numbers, SSNs) in agent outputs',
  'output_filtering',
  '{
    "patterns": [
      "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b",
      "\\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b",
      "\\b\\d{3}-\\d{2}-\\d{4}\\b",
      "\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b"
    ],
    "pii_types": ["email", "phone", "ssn", "credit_card"],
    "action": "redact"
  }'::JSONB,
  'block',
  TRUE,
  TRUE
);

/**
 * 2. Content Safety - Offensive Content Filter
 */
INSERT INTO agent_guardrails (name, description, guardrail_type, rules, severity, is_system, is_active)
VALUES (
  'Offensive Content Filter',
  'Blocks offensive, discriminatory, or harmful content',
  'output_filtering',
  '{
    "categories": ["hate_speech", "violence", "sexual_content", "harassment"],
    "action": "block",
    "provide_explanation": true
  }'::JSONB,
  'block',
  TRUE,
  TRUE
);

/**
 * 3. Content Safety - Confidential Keywords
 */
INSERT INTO agent_guardrails (name, description, guardrail_type, rules, severity, is_system, is_active)
VALUES (
  'Confidential Keywords Filter',
  'Blocks common confidential information keywords',
  'output_filtering',
  '{
    "keywords": ["password", "api_key", "secret", "token", "private_key", "access_token", "client_secret"],
    "case_sensitive": false,
    "action": "block"
  }'::JSONB,
  'block',
  TRUE,
  TRUE
);

/**
 * 4. Tool Usage Limits - Max Tool Calls Per Execution
 */
INSERT INTO agent_guardrails (name, description, guardrail_type, rules, severity, is_system, is_active)
VALUES (
  'Max Tool Calls Per Execution',
  'Limits the number of tool calls in a single agent execution to prevent runaway loops',
  'tool_restriction',
  '{
    "max_calls": 20,
    "action": "block",
    "error_message": "Maximum tool calls per execution exceeded. This may indicate an infinite loop."
  }'::JSONB,
  'block',
  TRUE,
  TRUE
);

/**
 * 5. Cost Controls - Max Cost Per Execution
 */
INSERT INTO agent_guardrails (name, description, guardrail_type, rules, severity, is_system, is_active)
VALUES (
  'Max Cost Per Execution',
  'Limits the maximum cost for a single agent execution',
  'cost_control',
  '{
    "max_cost": 1.0,
    "currency": "USD",
    "action": "block",
    "error_message": "Estimated cost exceeds maximum allowed per execution"
  }'::JSONB,
  'block',
  TRUE,
  TRUE
);

/**
 * 6. Cost Controls - Daily Budget Limit
 */
INSERT INTO agent_guardrails (name, description, guardrail_type, rules, severity, is_system, is_active)
VALUES (
  'Daily Budget Alert',
  'Sends warning when agent approaches daily budget limit',
  'cost_control',
  '{
    "threshold_percent": 80,
    "action": "warn",
    "send_notification": true
  }'::JSONB,
  'warning',
  TRUE,
  TRUE
);

/**
 * 7. Data Access - Sensitive Table Protection
 */
INSERT INTO agent_guardrails (name, description, guardrail_type, rules, severity, is_system, is_active)
VALUES (
  'Sensitive Table Protection',
  'Restricts agent access to sensitive database tables',
  'data_access',
  '{
    "blocked_tables": ["user_credentials", "payment_methods", "audit_logs", "encryption_keys"],
    "blocked_schemas": ["auth", "vault"],
    "action": "block",
    "error_message": "Access to sensitive tables is not allowed"
  }'::JSONB,
  'block',
  TRUE,
  TRUE
);

/**
 * 8. Input Validation - Prompt Injection Detection
 */
INSERT INTO agent_guardrails (name, description, guardrail_type, rules, severity, is_system, is_active)
VALUES (
  'Prompt Injection Detection',
  'Detects and blocks common prompt injection attempts',
  'input_validation',
  '{
    "patterns": [
      "ignore (previous|all) (instructions|prompts)",
      "you are now",
      "system:\\s*you are",
      "disregard",
      "override your"
    ],
    "case_sensitive": false,
    "action": "block",
    "error_message": "Potential prompt injection detected"
  }'::JSONB,
  'block',
  TRUE,
  TRUE
);

/**
 * 9. Tool Restriction - Dangerous Operations
 */
INSERT INTO agent_guardrails (name, description, guardrail_type, rules, severity, is_system, is_active)
VALUES (
  'Dangerous Operations Protection',
  'Requires approval for potentially dangerous tool operations',
  'tool_restriction',
  '{
    "restricted_tools": ["execute_sql", "delete_file", "system_command", "modify_permissions"],
    "action": "require_approval",
    "approval_timeout_minutes": 30
  }'::JSONB,
  'block',
  TRUE,
  TRUE
);

/**
 * 10. Rate Limiting - Prevent Abuse
 */
INSERT INTO agent_guardrails (name, description, guardrail_type, rules, severity, is_system, is_active)
VALUES (
  'Agent Execution Rate Limit',
  'Limits how frequently an agent can be executed per user',
  'tool_restriction',
  '{
    "max_executions_per_minute": 10,
    "max_executions_per_hour": 100,
    "action": "block",
    "error_message": "Rate limit exceeded. Please wait before trying again."
  }'::JSONB,
  'block',
  TRUE,
  TRUE
);

-- ============================================================================
-- CONTENT FILTERS
-- ============================================================================

/**
 * Email Address Pattern
 */
INSERT INTO content_filters (name, filter_type, pattern, severity, applies_to, is_active)
VALUES (
  'Email Address',
  'pii',
  '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
  'block',
  'output',
  TRUE
);

/**
 * Phone Number Pattern (US)
 */
INSERT INTO content_filters (name, filter_type, pattern, severity, applies_to, is_active)
VALUES (
  'Phone Number (US)',
  'pii',
  '\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
  'block',
  'output',
  TRUE
);

/**
 * SSN Pattern
 */
INSERT INTO content_filters (name, filter_type, pattern, severity, applies_to, is_active)
VALUES (
  'Social Security Number',
  'pii',
  '\b\d{3}-\d{2}-\d{4}\b',
  'block',
  'output',
  TRUE
);

/**
 * Credit Card Pattern
 */
INSERT INTO content_filters (name, filter_type, pattern, severity, applies_to, is_active)
VALUES (
  'Credit Card Number',
  'pii',
  '\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b',
  'block',
  'output',
  TRUE
);

/**
 * Confidential Keywords
 */
INSERT INTO content_filters (name, filter_type, keywords, severity, applies_to, is_active)
VALUES (
  'Confidential Keywords',
  'confidential',
  ARRAY['password', 'api_key', 'api-key', 'apikey', 'secret', 'token', 'private_key', 'private-key', 'access_token', 'access-token', 'client_secret', 'client-secret'],
  'warning',
  'both',
  TRUE
);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE agent_guardrails ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_guardrail_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardrail_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_cost_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_usage_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_filters ENABLE ROW LEVEL SECURITY;

-- Users can view their own agents' guardrails
CREATE POLICY guardrails_select_policy ON agent_guardrails
  FOR SELECT USING (
    is_system = TRUE OR
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM ai_agents
      WHERE ai_agents.created_by = auth.uid()
    )
  );

-- Only admins can create/update/delete non-system guardrails
CREATE POLICY guardrails_modify_policy ON agent_guardrails
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
    AND (is_system = FALSE OR current_setting('role') = 'service_role')
  );

-- Users can view violations for their agents
CREATE POLICY violations_select_policy ON guardrail_violations
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM ai_agents
      WHERE ai_agents.id = guardrail_violations.agent_id
      AND ai_agents.created_by = auth.uid()
    )
  );

-- Service role can insert violations
CREATE POLICY violations_insert_policy ON guardrail_violations
  FOR INSERT WITH CHECK (current_setting('role') = 'service_role');

-- Users can manage cost limits for their agents
CREATE POLICY cost_limits_policy ON agent_cost_limits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM ai_agents
      WHERE ai_agents.id = agent_cost_limits.agent_id
      AND ai_agents.created_by = auth.uid()
    )
  );

-- Users can view tool restrictions
CREATE POLICY tool_restrictions_select_policy ON tool_usage_restrictions
  FOR SELECT USING (TRUE);

-- Only admins can modify tool restrictions
CREATE POLICY tool_restrictions_modify_policy ON tool_usage_restrictions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Users can view tool tracking for their agents
CREATE POLICY tool_tracking_select_policy ON tool_usage_tracking
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_agents
      WHERE ai_agents.id = tool_usage_tracking.agent_id
      AND ai_agents.created_by = auth.uid()
    )
  );

-- Users can view content filters
CREATE POLICY content_filters_select_policy ON content_filters
  FOR SELECT USING (TRUE);

-- Only admins can modify content filters
CREATE POLICY content_filters_modify_policy ON content_filters
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_violations_agent_created ON guardrail_violations(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_tracking_cleanup ON tool_usage_tracking(used_at) WHERE used_at < NOW() - INTERVAL '30 days';

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON agent_guardrails TO authenticated;
GRANT SELECT ON agent_guardrail_assignments TO authenticated;
GRANT SELECT ON guardrail_violations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON agent_cost_limits TO authenticated;
GRANT SELECT ON tool_usage_restrictions TO authenticated;
GRANT SELECT ON tool_usage_tracking TO authenticated;
GRANT SELECT ON content_filters TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE agent_guardrails IS 'Safety rules and constraints for agent behavior';
COMMENT ON TABLE agent_guardrail_assignments IS 'Links guardrails to specific agents';
COMMENT ON TABLE guardrail_violations IS 'Audit log of all guardrail violations';
COMMENT ON TABLE agent_cost_limits IS 'Cost budgets and limits per agent';
COMMENT ON TABLE tool_usage_restrictions IS 'Restrictions on tool usage by agents';
COMMENT ON TABLE tool_usage_tracking IS 'Tracks tool usage for rate limiting';
COMMENT ON TABLE content_filters IS 'Content filtering patterns and keywords';

COMMENT ON FUNCTION check_agent_cost_limit IS 'Validates if agent can proceed based on cost limit';
COMMENT ON FUNCTION record_agent_cost IS 'Records agent cost and updates all applicable limits';
COMMENT ON FUNCTION reset_expired_cost_limits IS 'Resets cost limits that have expired (run via cron)';
COMMENT ON FUNCTION check_tool_rate_limit IS 'Validates if tool can be used based on rate limits';
COMMENT ON FUNCTION record_tool_usage IS 'Records tool usage for rate limiting';
COMMENT ON FUNCTION get_agent_guardrails IS 'Returns all active guardrails for an agent';


-- 20260206_multi_agent_hitl.sql
/**
 * Phase 2: Multi-Agent Collaboration & HITL Migration
 *
 * Enables:
 * - Multiple agents working together on complex tasks
 * - Agent-to-agent communication and handoffs
 * - Human approval workflows for critical actions
 * - Enhanced observability and monitoring
 *
 * Part of the Agentic Evolution Roadmap - Phase 2: Core Features
 */

-- ============================================================================
-- Agent Teams & Collaboration
-- ============================================================================

-- Agent Teams: Groups of agents that can work together
CREATE TABLE IF NOT EXISTS agent_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Team details
  name TEXT NOT NULL,
  description TEXT,
  team_type TEXT NOT NULL, -- 'specialized', 'general', 'hierarchy', 'swarm'

  -- Team configuration
  collaboration_strategy TEXT, -- 'sequential', 'parallel', 'hierarchical', 'consensus'
  coordinator_agent_id UUID REFERENCES ai_agents(id), -- Optional coordinator/lead agent

  -- Ownership
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID, -- For multi-tenant support

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  team_config JSONB DEFAULT '{}'::jsonb, -- Team-specific settings

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Team Members: Which agents belong to which teams
CREATE TABLE IF NOT EXISTS agent_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  team_id UUID NOT NULL REFERENCES agent_teams(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,

  -- Member role
  role TEXT, -- 'lead', 'specialist', 'support', 'reviewer'
  expertise_tags TEXT[], -- What this agent is good at

  -- Capabilities
  can_initiate BOOLEAN DEFAULT FALSE, -- Can this agent start team workflows
  can_approve BOOLEAN DEFAULT FALSE, -- Can this agent approve actions
  priority_order INTEGER DEFAULT 0, -- Order for sequential workflows

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  joined_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(team_id, agent_id)
);

-- Collaboration Sessions: A team working on a specific goal
CREATE TABLE IF NOT EXISTS agent_collaboration_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  team_id UUID NOT NULL REFERENCES agent_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Session details
  goal TEXT NOT NULL,
  session_type TEXT, -- 'task_delegation', 'consensus_building', 'parallel_execution', 'review_chain'

  -- Status
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'failed', 'paused'
  current_stage TEXT, -- Custom stages based on workflow
  current_agent_id UUID REFERENCES ai_agents(id), -- Which agent is currently active

  -- Results
  final_output JSONB,
  outcome TEXT, -- 'success', 'partial_success', 'failure', 'cancelled'

  -- Metrics
  total_messages INTEGER DEFAULT 0,
  total_handoffs INTEGER DEFAULT 0,
  total_cost DECIMAL(10, 6) DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,

  -- Context
  session_context JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Messages: Communication between agents
CREATE TABLE IF NOT EXISTS agent_collaboration_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  session_id UUID NOT NULL REFERENCES agent_collaboration_sessions(id) ON DELETE CASCADE,
  from_agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  to_agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,

  -- Message details
  message_type TEXT NOT NULL, -- 'request', 'response', 'handoff', 'question', 'approval_request'
  content TEXT NOT NULL,

  -- Attachments
  attachments JSONB, -- Files, data, context
  metadata JSONB,

  -- Processing
  requires_response BOOLEAN DEFAULT FALSE,
  parent_message_id UUID REFERENCES agent_collaboration_messages(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Handoffs: When one agent passes work to another
CREATE TABLE IF NOT EXISTS agent_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  session_id UUID NOT NULL REFERENCES agent_collaboration_sessions(id) ON DELETE CASCADE,
  from_agent_id UUID NOT NULL REFERENCES ai_agents(id),
  to_agent_id UUID NOT NULL REFERENCES ai_agents(id),

  -- Handoff details
  handoff_reason TEXT NOT NULL, -- 'expertise_needed', 'task_complete', 'escalation', 'review_required'
  handoff_type TEXT, -- 'full_transfer', 'parallel_work', 'review_only'

  -- Context passed
  context_summary TEXT,
  work_completed JSONB, -- What was done so far
  work_remaining JSONB, -- What still needs to be done

  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'completed'
  acceptance_note TEXT,

  -- Timestamps
  handed_off_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes for collaboration tables
CREATE INDEX idx_agent_teams_created_by ON agent_teams(created_by);
CREATE INDEX idx_agent_team_members_team ON agent_team_members(team_id);
CREATE INDEX idx_agent_team_members_agent ON agent_team_members(agent_id);
CREATE INDEX idx_collaboration_sessions_team ON agent_collaboration_sessions(team_id);
CREATE INDEX idx_collaboration_sessions_user ON agent_collaboration_sessions(user_id);
CREATE INDEX idx_collaboration_sessions_status ON agent_collaboration_sessions(status);
CREATE INDEX idx_collaboration_messages_session ON agent_collaboration_messages(session_id);
CREATE INDEX idx_collaboration_messages_agents ON agent_collaboration_messages(from_agent_id, to_agent_id);
CREATE INDEX idx_handoffs_session ON agent_handoffs(session_id);
CREATE INDEX idx_handoffs_status ON agent_handoffs(status);

-- ============================================================================
-- Human-in-the-Loop (HITL) Approval System
-- ============================================================================

-- Approval Workflows: Define what needs approval
CREATE TABLE IF NOT EXISTS approval_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Workflow details
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL, -- 'tool_execution', 'data_modification', 'external_api', 'cost_threshold'

  -- Conditions
  trigger_conditions JSONB NOT NULL, -- When to trigger approval

  -- Approvers
  approver_type TEXT NOT NULL, -- 'specific_user', 'role', 'agent', 'any_user'
  approver_config JSONB, -- Who can approve

  -- Workflow settings
  require_reason BOOLEAN DEFAULT FALSE,
  timeout_minutes INTEGER, -- Auto-reject after timeout
  auto_approve_threshold DECIMAL(5, 2), -- Confidence score for auto-approval

  -- Status
  is_enabled BOOLEAN DEFAULT TRUE,

  -- Ownership
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approval Requests: Individual requests for approval
CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  workflow_id UUID REFERENCES approval_workflows(id) ON DELETE SET NULL,
  agent_id UUID NOT NULL REFERENCES ai_agents(id),
  user_id UUID NOT NULL REFERENCES profiles(id), -- User who initiated the agent action

  -- Request details
  request_type TEXT NOT NULL, -- 'tool_execution', 'data_modification', etc.
  action_description TEXT NOT NULL,

  -- Action details
  tool_name TEXT,
  tool_parameters JSONB,
  estimated_cost DECIMAL(10, 6),
  risk_level TEXT, -- 'low', 'medium', 'high', 'critical'

  -- Agent reasoning
  agent_reasoning TEXT, -- Why the agent wants to do this
  confidence_score DECIMAL(5, 2), -- Agent's confidence (0-1)
  alternatives_considered JSONB, -- Other options the agent evaluated

  -- Approval status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'expired', 'cancelled'
  approved_by UUID REFERENCES profiles(id),
  approval_note TEXT,

  -- Execution
  execution_id UUID, -- Link to execution after approval
  execution_result JSONB,

  -- Timestamps
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Approval Delegations: Delegate approval authority
CREATE TABLE IF NOT EXISTS approval_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who delegates to whom
  delegator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  delegate_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Scope
  workflow_id UUID REFERENCES approval_workflows(id), -- NULL = all workflows
  agent_id UUID REFERENCES ai_agents(id), -- NULL = all agents

  -- Constraints
  max_cost_limit DECIMAL(10, 6), -- Maximum cost they can approve
  allowed_risk_levels TEXT[], -- ['low', 'medium']

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for HITL tables
CREATE INDEX idx_approval_workflows_trigger ON approval_workflows(trigger_type);
CREATE INDEX idx_approval_workflows_enabled ON approval_workflows(is_enabled) WHERE is_enabled = TRUE;
CREATE INDEX idx_approval_requests_status ON approval_requests(status);
CREATE INDEX idx_approval_requests_user ON approval_requests(user_id);
CREATE INDEX idx_approval_requests_agent ON approval_requests(agent_id);
CREATE INDEX idx_approval_requests_pending ON approval_requests(status, expires_at) WHERE status = 'pending';
CREATE INDEX idx_approval_delegations_delegate ON approval_delegations(delegate_id);

-- ============================================================================
-- Enhanced Observability & Monitoring
-- ============================================================================

-- Agent Performance Metrics: Track agent performance over time
CREATE TABLE IF NOT EXISTS agent_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,

  -- Time window
  metric_date DATE NOT NULL,
  metric_hour INTEGER, -- For hourly metrics (0-23)

  -- Usage metrics
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,

  -- Performance metrics
  avg_latency_ms INTEGER,
  p95_latency_ms INTEGER,
  p99_latency_ms INTEGER,

  -- Cost metrics
  total_cost DECIMAL(10, 6) DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,

  -- Quality metrics
  avg_user_rating DECIMAL(3, 2),
  total_ratings INTEGER DEFAULT 0,
  positive_feedback_count INTEGER DEFAULT 0,
  negative_feedback_count INTEGER DEFAULT 0,

  -- Tool usage
  tools_used JSONB DEFAULT '{}'::jsonb, -- Tool name -> count

  -- Memory metrics
  memories_created INTEGER DEFAULT 0,
  memories_accessed INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(agent_id, metric_date, metric_hour)
);

-- Agent Errors: Detailed error tracking
CREATE TABLE IF NOT EXISTS agent_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  execution_id UUID, -- Link to agent run, tool execution, etc.

  -- Error details
  error_type TEXT NOT NULL, -- 'api_error', 'timeout', 'validation_error', 'tool_error', etc.
  error_code TEXT,
  error_message TEXT NOT NULL,
  error_stack TEXT,

  -- Context
  context JSONB, -- What was happening when error occurred
  input_data JSONB, -- What input caused the error

  -- Classification
  severity TEXT, -- 'low', 'medium', 'high', 'critical'
  is_user_facing BOOLEAN DEFAULT TRUE,
  is_recoverable BOOLEAN,

  -- Resolution
  resolution_status TEXT DEFAULT 'open', -- 'open', 'investigating', 'resolved', 'wont_fix'
  resolution_note TEXT,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,

  -- Timestamps
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Audit Trail: Comprehensive logging of agent actions
CREATE TABLE IF NOT EXISTS agent_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_id UUID, -- Collaboration session, conversation, etc.

  -- Action details
  action_type TEXT NOT NULL, -- 'tool_execution', 'memory_access', 'configuration_change', etc.
  action_description TEXT NOT NULL,

  -- Before/After state
  before_state JSONB,
  after_state JSONB,

  -- Result
  action_result TEXT, -- 'success', 'failure', 'partial'

  -- Security
  ip_address INET,
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System Health Metrics: Overall system health
CREATE TABLE IF NOT EXISTS system_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Time window
  metric_timestamp TIMESTAMPTZ NOT NULL,

  -- System metrics
  total_active_agents INTEGER,
  total_active_sessions INTEGER,
  total_pending_approvals INTEGER,

  -- Performance
  avg_response_time_ms INTEGER,
  error_rate DECIMAL(5, 4), -- Errors per request

  -- Resource usage
  total_api_calls INTEGER,
  total_cost DECIMAL(10, 6),
  total_tokens_used BIGINT,

  -- Database metrics
  db_connections INTEGER,
  db_query_time_ms INTEGER,

  -- Created
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(metric_timestamp)
);

-- Indexes for observability tables
CREATE INDEX idx_performance_metrics_agent_date ON agent_performance_metrics(agent_id, metric_date DESC);
CREATE INDEX idx_agent_errors_agent ON agent_errors(agent_id, occurred_at DESC);
CREATE INDEX idx_agent_errors_severity ON agent_errors(severity, resolution_status);
CREATE INDEX idx_audit_trail_agent ON agent_audit_trail(agent_id, created_at DESC);
CREATE INDEX idx_audit_trail_user ON agent_audit_trail(user_id, created_at DESC);
CREATE INDEX idx_system_health_timestamp ON system_health_metrics(metric_timestamp DESC);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Get pending approvals for a user
CREATE OR REPLACE FUNCTION get_pending_approvals_for_user(p_user_id UUID)
RETURNS TABLE (
  request_id UUID,
  agent_name TEXT,
  action_description TEXT,
  risk_level TEXT,
  estimated_cost DECIMAL(10, 6),
  requested_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ar.id,
    ag.name,
    ar.action_description,
    ar.risk_level,
    ar.estimated_cost,
    ar.requested_at,
    ar.expires_at
  FROM approval_requests ar
  JOIN ai_agents ag ON ar.agent_id = ag.id
  WHERE ar.status = 'pending'
  AND (
    -- Direct approver
    ar.approved_by = p_user_id
    OR
    -- Delegated approver
    EXISTS (
      SELECT 1 FROM approval_delegations ad
      WHERE ad.delegate_id = p_user_id
      AND ad.is_active = TRUE
      AND (ad.workflow_id = ar.workflow_id OR ad.workflow_id IS NULL)
      AND (ad.agent_id = ar.agent_id OR ad.agent_id IS NULL)
      AND (ad.max_cost_limit IS NULL OR ar.estimated_cost <= ad.max_cost_limit)
      AND (ad.allowed_risk_levels IS NULL OR ar.risk_level = ANY(ad.allowed_risk_levels))
    )
  )
  AND (ar.expires_at IS NULL OR ar.expires_at > NOW())
  ORDER BY ar.requested_at;
END;
$$ LANGUAGE plpgsql;

-- Record agent performance metrics
CREATE OR REPLACE FUNCTION record_agent_performance(
  p_agent_id UUID,
  p_execution_time_ms INTEGER,
  p_was_successful BOOLEAN,
  p_cost DECIMAL(10, 6),
  p_tokens_used INTEGER,
  p_tool_name TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_metric_date DATE := CURRENT_DATE;
  v_metric_hour INTEGER := EXTRACT(HOUR FROM NOW());
BEGIN
  INSERT INTO agent_performance_metrics (
    agent_id,
    metric_date,
    metric_hour,
    total_executions,
    successful_executions,
    failed_executions,
    avg_latency_ms,
    total_cost,
    total_tokens_used,
    tools_used
  ) VALUES (
    p_agent_id,
    v_metric_date,
    v_metric_hour,
    1,
    CASE WHEN p_was_successful THEN 1 ELSE 0 END,
    CASE WHEN p_was_successful THEN 0 ELSE 1 END,
    p_execution_time_ms,
    p_cost,
    p_tokens_used,
    CASE WHEN p_tool_name IS NOT NULL THEN jsonb_build_object(p_tool_name, 1) ELSE '{}'::jsonb END
  )
  ON CONFLICT (agent_id, metric_date, metric_hour)
  DO UPDATE SET
    total_executions = agent_performance_metrics.total_executions + 1,
    successful_executions = agent_performance_metrics.successful_executions + CASE WHEN p_was_successful THEN 1 ELSE 0 END,
    failed_executions = agent_performance_metrics.failed_executions + CASE WHEN p_was_successful THEN 0 ELSE 1 END,
    avg_latency_ms = (agent_performance_metrics.avg_latency_ms * agent_performance_metrics.total_executions + p_execution_time_ms) / (agent_performance_metrics.total_executions + 1),
    total_cost = agent_performance_metrics.total_cost + p_cost,
    total_tokens_used = agent_performance_metrics.total_tokens_used + p_tokens_used,
    tools_used = CASE
      WHEN p_tool_name IS NOT NULL THEN
        jsonb_set(
          agent_performance_metrics.tools_used,
          ARRAY[p_tool_name],
          to_jsonb(COALESCE((agent_performance_metrics.tools_used->>p_tool_name)::integer, 0) + 1)
        )
      ELSE agent_performance_metrics.tools_used
    END;
END;
$$ LANGUAGE plpgsql;

-- Auto-expire old approval requests
CREATE OR REPLACE FUNCTION expire_old_approval_requests()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE approval_requests
  SET status = 'expired'
  WHERE status = 'pending'
  AND expires_at IS NOT NULL
  AND expires_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Auto-update timestamps
CREATE TRIGGER update_agent_teams_updated_at
  BEFORE UPDATE ON agent_teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_approval_workflows_updated_at
  BEFORE UPDATE ON approval_workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Views for Analytics
-- ============================================================================

-- Agent collaboration summary
CREATE VIEW agent_collaboration_summary AS
SELECT
  t.id as team_id,
  t.name as team_name,
  COUNT(DISTINCT tm.agent_id) as agent_count,
  COUNT(DISTINCT cs.id) as total_sessions,
  COUNT(DISTINCT cs.id) FILTER (WHERE cs.status = 'active') as active_sessions,
  COUNT(DISTINCT cs.id) FILTER (WHERE cs.status = 'completed') as completed_sessions,
  SUM(cs.total_messages) as total_messages,
  SUM(cs.total_handoffs) as total_handoffs,
  SUM(cs.total_cost) as total_cost
FROM agent_teams t
LEFT JOIN agent_team_members tm ON t.id = tm.team_id AND tm.is_active = TRUE
LEFT JOIN agent_collaboration_sessions cs ON t.id = cs.team_id
WHERE t.is_active = TRUE
GROUP BY t.id, t.name;

-- Approval workflow metrics
CREATE VIEW approval_workflow_metrics AS
SELECT
  aw.id as workflow_id,
  aw.name as workflow_name,
  COUNT(ar.id) as total_requests,
  COUNT(ar.id) FILTER (WHERE ar.status = 'pending') as pending_requests,
  COUNT(ar.id) FILTER (WHERE ar.status = 'approved') as approved_requests,
  COUNT(ar.id) FILTER (WHERE ar.status = 'rejected') as rejected_requests,
  COUNT(ar.id) FILTER (WHERE ar.status = 'expired') as expired_requests,
  AVG(EXTRACT(EPOCH FROM (ar.responded_at - ar.requested_at))/60) as avg_response_time_minutes,
  COUNT(ar.id) FILTER (WHERE ar.status = 'approved')::DECIMAL / NULLIF(COUNT(ar.id), 0) as approval_rate
FROM approval_workflows aw
LEFT JOIN approval_requests ar ON aw.id = ar.workflow_id
WHERE aw.is_enabled = TRUE
GROUP BY aw.id, aw.name;

-- Agent performance overview
CREATE VIEW agent_performance_overview AS
SELECT
  ag.id as agent_id,
  ag.name as agent_name,
  SUM(apm.total_executions) as total_executions,
  SUM(apm.successful_executions) as successful_executions,
  SUM(apm.failed_executions) as failed_executions,
  CASE
    WHEN SUM(apm.total_executions) > 0
    THEN (SUM(apm.successful_executions)::DECIMAL / SUM(apm.total_executions)) * 100
    ELSE 0
  END as success_rate,
  AVG(apm.avg_latency_ms) as avg_latency_ms,
  SUM(apm.total_cost) as total_cost,
  SUM(apm.total_tokens_used) as total_tokens_used,
  AVG(apm.avg_user_rating) as avg_user_rating
FROM ai_agents ag
LEFT JOIN agent_performance_metrics apm ON ag.id = apm.agent_id
WHERE ag.is_enabled = TRUE
GROUP BY ag.id, ag.name;

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE agent_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_collaboration_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_audit_trail ENABLE ROW LEVEL SECURITY;

-- Users can view teams they created or are part of
CREATE POLICY "Users can view their teams"
  ON agent_teams FOR SELECT
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM agent_team_members tm
      JOIN ai_agents ag ON tm.agent_id = ag.id
      WHERE tm.team_id = agent_teams.id
    )
  );

-- Users can manage teams they created
CREATE POLICY "Users can manage their teams"
  ON agent_teams FOR ALL
  USING (created_by = auth.uid());

-- Users can view approval requests they created or can approve
CREATE POLICY "Users can view relevant approval requests"
  ON approval_requests FOR SELECT
  USING (
    user_id = auth.uid()
    OR approved_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM approval_delegations
      WHERE delegate_id = auth.uid()
      AND is_active = TRUE
    )
  );

-- Users can create approval requests
CREATE POLICY "Users can create approval requests"
  ON approval_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can view all metrics
CREATE POLICY "Admins can view all metrics"
  ON agent_performance_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE agent_teams IS 'Groups of agents that work together';
COMMENT ON TABLE agent_collaboration_sessions IS 'Tracks multi-agent collaboration workflows';
COMMENT ON TABLE agent_handoffs IS 'Records when agents pass work to each other';
COMMENT ON TABLE approval_workflows IS 'Defines what actions require human approval';
COMMENT ON TABLE approval_requests IS 'Individual requests for human approval';
COMMENT ON TABLE agent_performance_metrics IS 'Hourly performance metrics for each agent';
COMMENT ON TABLE agent_errors IS 'Detailed error tracking and resolution';
COMMENT ON TABLE agent_audit_trail IS 'Comprehensive audit log of all agent actions';


-- 20260207_add_contact_followup_fields.sql
-- ============================================================================
-- Add Contact Follow-Up Fields Migration
-- ============================================================================
-- Extends contacts table with comprehensive follow-up tracking, AI analysis
-- cache, and lead scoring fields.
-- ============================================================================

-- Add follow-up tracking columns to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_lead_follow_up BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS followup_status TEXT DEFAULT 'pending'
  CHECK (followup_status IN ('pending', 'contacted', 'scheduled', 'on_hold', 'completed', 'inactive', 'new', 'awaiting_response', 'follow_up_needed', 'engaged', 'nurturing'));

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS followup_interval_days INTEGER DEFAULT 7;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS next_followup_date TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS followup_notes TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS followup_assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS followup_attempt_count INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS preferred_contact_channel TEXT DEFAULT 'email'
  CHECK (preferred_contact_channel IN ('email', 'phone', 'linkedin', 'whatsapp', 'upwork'));
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_upwork_lead BOOLEAN DEFAULT false;

-- Add AI analysis cache columns
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS current_mood_label TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS current_mood_score INTEGER;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS current_intent_status TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_mood_analysis_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_intent_analysis_at TIMESTAMPTZ;

-- Add additional contact fields
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS hubspot_id TEXT;

-- Create indexes for follow-up tracking
CREATE INDEX IF NOT EXISTS idx_contacts_is_lead_follow_up ON contacts(is_lead_follow_up);
CREATE INDEX IF NOT EXISTS idx_contacts_next_followup_date ON contacts(next_followup_date)
  WHERE is_lead_follow_up = true;
CREATE INDEX IF NOT EXISTS idx_contacts_followup_status ON contacts(followup_status);
CREATE INDEX IF NOT EXISTS idx_contacts_followup_assigned ON contacts(followup_assigned_to, next_followup_date);
CREATE INDEX IF NOT EXISTS idx_contacts_last_contact_date ON contacts(last_contact_date DESC);

-- Update RLS policies if needed
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can manage contacts" ON contacts;
CREATE POLICY "Authenticated users can view contacts" ON contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage contacts" ON contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 20260207_add_lead_scoring_system.sql
-- ============================================================================
-- Add Lead Scoring System Migration
-- ============================================================================
-- Extends contacts table with a 100-point lead scoring system including
-- engagement, deal potential, profile completeness, and recency scores.
-- ============================================================================

-- Add lead scoring columns to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_temperature TEXT DEFAULT 'cold'
  CHECK (lead_temperature IN ('hot', 'warm', 'cold'));
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS profile_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deal_potential_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS recency_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_score_calculated_at TIMESTAMPTZ;

-- Create indexes for lead scoring
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score ON contacts(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_temperature ON contacts(lead_temperature);
CREATE INDEX IF NOT EXISTS idx_contacts_score_temp ON contacts(lead_score DESC, lead_temperature);

-- Create helper function to calculate lead score
CREATE OR REPLACE FUNCTION calculate_contact_lead_score(contact_id UUID)
RETURNS TABLE (
  total_score INTEGER,
  temperature TEXT,
  engagement_score INTEGER,
  profile_score INTEGER,
  deal_potential_score INTEGER,
  recency_score INTEGER
) AS $$
DECLARE
  v_profile_score INTEGER := 0;
  v_recency_score INTEGER := 0;
  v_engagement_score INTEGER;
  v_deal_potential_score INTEGER;
  v_total_score INTEGER;
  v_temperature TEXT;
  v_last_contact TIMESTAMPTZ;
  v_days_since NUMERIC;
BEGIN
  -- Get current engagement and deal potential scores
  SELECT
    COALESCE(engagement_score, 0),
    COALESCE(deal_potential_score, 0),
    last_contact_date
  INTO v_engagement_score, v_deal_potential_score, v_last_contact
  FROM contacts WHERE id = contact_id;

  -- Calculate profile score (0-20)
  -- Email: 4 points, Phone: 4 points, LinkedIn: 6 points, Title: 3 points, Dept: 3 points
  IF (SELECT email IS NOT NULL FROM contacts WHERE id = contact_id) THEN
    v_profile_score := v_profile_score + 4;
  END IF;
  IF (SELECT phone IS NOT NULL FROM contacts WHERE id = contact_id) THEN
    v_profile_score := v_profile_score + 4;
  END IF;
  IF (SELECT linkedin_url IS NOT NULL FROM contacts WHERE id = contact_id) THEN
    v_profile_score := v_profile_score + 6;
  END IF;
  IF (SELECT title IS NOT NULL FROM contacts WHERE id = contact_id) THEN
    v_profile_score := v_profile_score + 3;
  END IF;
  IF (SELECT department IS NOT NULL FROM contacts WHERE id = contact_id) THEN
    v_profile_score := v_profile_score + 3;
  END IF;

  -- Calculate recency score (0-10)
  IF v_last_contact IS NOT NULL THEN
    v_days_since := EXTRACT(DAY FROM NOW() - v_last_contact);
    IF v_days_since <= 7 THEN
      v_recency_score := 10;
    ELSIF v_days_since <= 14 THEN
      v_recency_score := 8;
    ELSIF v_days_since <= 30 THEN
      v_recency_score := 6;
    ELSIF v_days_since <= 60 THEN
      v_recency_score := 4;
    ELSIF v_days_since <= 90 THEN
      v_recency_score := 2;
    ELSE
      v_recency_score := 0;
    END IF;
  ELSE
    v_recency_score := 0;
  END IF;

  -- Calculate total score (0-100)
  v_total_score := v_profile_score + v_recency_score + v_engagement_score + v_deal_potential_score;
  IF v_total_score > 100 THEN
    v_total_score := 100;
  END IF;

  -- Determine temperature
  IF v_total_score >= 67 THEN
    v_temperature := 'hot';
  ELSIF v_total_score >= 34 THEN
    v_temperature := 'warm';
  ELSE
    v_temperature := 'cold';
  END IF;

  RETURN QUERY SELECT v_total_score, v_temperature, v_engagement_score, v_profile_score, v_deal_potential_score, v_recency_score;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create function to update lead score automatically
CREATE OR REPLACE FUNCTION update_contact_lead_score()
RETURNS TRIGGER AS $$
DECLARE
  score_data RECORD;
BEGIN
  -- Only calculate for lead follow-up contacts
  IF NEW.is_lead_follow_up THEN
    SELECT * INTO score_data FROM calculate_contact_lead_score(NEW.id);
    NEW.lead_score := score_data.total_score;
    NEW.lead_temperature := score_data.temperature;
    NEW.profile_score := score_data.profile_score;
    NEW.recency_score := score_data.recency_score;
    NEW.last_score_calculated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for lead score calculation
DROP TRIGGER IF EXISTS update_contact_lead_score_trigger ON contacts;
CREATE TRIGGER update_contact_lead_score_trigger
BEFORE INSERT OR UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION update_contact_lead_score();

-- Create function to calculate next followup date
CREATE OR REPLACE FUNCTION calculate_next_followup_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Only calculate if is_lead_follow_up is true and last_contact_date exists
  IF NEW.is_lead_follow_up AND NEW.last_contact_date IS NOT NULL THEN
    NEW.next_followup_date := NEW.last_contact_date + (COALESCE(NEW.followup_interval_days, 7) || ' days')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for next followup date calculation
DROP TRIGGER IF EXISTS update_contact_followup_date_trigger ON contacts;
CREATE TRIGGER update_contact_followup_date_trigger
BEFORE INSERT OR UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION calculate_next_followup_date();


-- 20260207_create_contact_activities_table.sql
-- ============================================================================
-- Create Contact Activities Table
-- ============================================================================
-- Tracks all interactions with a contact across multiple channels. Designed
-- to replace contact_communications for more comprehensive activity logging.
-- ============================================================================

CREATE TABLE IF NOT EXISTS contact_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL
    CHECK (activity_type IN (
      'email_sent', 'email_received', 'phone_call', 'meeting',
      'note_added', 'status_changed', 'linkedin_message',
      'linkedin_view', 'linkedin_research', 'whatsapp_message',
      'upwork_message', 'follow_up_logged'
    )),
  subject TEXT,
  description TEXT,
  channel TEXT NOT NULL
    CHECK (channel IN ('email', 'phone', 'linkedin', 'whatsapp', 'upwork', 'in_person', 'other')),
  direction TEXT NOT NULL
    CHECK (direction IN ('outbound', 'inbound', 'internal')),
  email_to TEXT[] DEFAULT '{}',
  email_cc TEXT[] DEFAULT '{}',
  email_bcc TEXT[] DEFAULT '{}',
  email_body TEXT,
  email_sent_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contact_activities_contact_id ON contact_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_activities_type ON contact_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_contact_activities_created ON contact_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_activities_channel ON contact_activities(channel);
CREATE INDEX IF NOT EXISTS idx_contact_activities_not_deleted ON contact_activities(deleted_at) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE contact_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view activities" ON contact_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage activities" ON contact_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create trigger to update contact's last_contact_date when activity is created
CREATE OR REPLACE FUNCTION update_contact_on_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contacts
  SET last_contact_date = NOW(),
      updated_at = NOW()
  WHERE id = NEW.contact_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_contact_on_activity_trigger ON contact_activities;
CREATE TRIGGER update_contact_on_activity_trigger
AFTER INSERT ON contact_activities
FOR EACH ROW
EXECUTE FUNCTION update_contact_on_activity();


-- 20260207_create_contact_ai_summaries_table.sql
-- ============================================================================
-- Create Contact AI Summaries Table
-- ============================================================================
-- Caches AI-generated executive summaries for contacts. Used for performance
-- optimization, with auto-refresh after 24 hours.
-- ============================================================================

CREATE TABLE IF NOT EXISTS contact_ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
  summary_text TEXT,
  talking_points JSONB DEFAULT '[]',
  recommended_approach TEXT,
  data_snapshot JSONB DEFAULT '{}',
  engagement_level TEXT
    CHECK (engagement_level IN ('limited', 'moderate', 'strong')),
  lead_score INTEGER,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contact_ai_summaries_contact ON contact_ai_summaries(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_ai_summaries_expires_at ON contact_ai_summaries(expires_at);

-- Enable RLS
ALTER TABLE contact_ai_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view summaries" ON contact_ai_summaries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage summaries" ON contact_ai_summaries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create function to refresh summary expiration
CREATE OR REPLACE FUNCTION refresh_contact_ai_summary(contact_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE contact_ai_summaries
  SET expires_at = NOW() + INTERVAL '24 hours',
      updated_at = NOW()
  WHERE contact_id = $1;
END;
$$ LANGUAGE plpgsql;

-- Create function to check if summary is expired
CREATE OR REPLACE FUNCTION is_contact_ai_summary_expired(contact_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  expired BOOLEAN;
BEGIN
  SELECT (expires_at < NOW())
  INTO expired
  FROM contact_ai_summaries
  WHERE contact_id = $1
  LIMIT 1;

  RETURN COALESCE(expired, true);
END;
$$ LANGUAGE plpgsql STABLE;


-- 20260207_create_contact_email_templates_table.sql
-- ============================================================================
-- Create Contact Email Templates Table
-- ============================================================================
-- Pre-written email templates for follow-ups with variable substitution.
-- Includes both system templates and custom user templates.
-- ============================================================================

CREATE TABLE IF NOT EXISTS contact_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT DEFAULT 'custom'
    CHECK (category IN (
      'initial_outreach', 'follow_up', 'check_in',
      'proposal', 'thank_you', 'custom', 'sales',
      'upsell', 'reengage'
    )),
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  variables JSONB DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON contact_email_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON contact_email_templates(category);
CREATE INDEX IF NOT EXISTS idx_email_templates_usage ON contact_email_templates(usage_count DESC);

-- Enable RLS
ALTER TABLE contact_email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view templates" ON contact_email_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage templates" ON contact_email_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create function to increment template usage
CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE contact_email_templates
  SET usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to replace template variables
CREATE OR REPLACE FUNCTION replace_template_variables(
  template_body TEXT,
  variables_json JSONB
)
RETURNS TEXT AS $$
DECLARE
  result TEXT := template_body;
  var_key TEXT;
  var_value TEXT;
BEGIN
  FOR var_key, var_value IN
    SELECT key, value
    FROM jsonb_each_text(variables_json)
  LOOP
    result := REPLACE(result, '{{' || var_key || '}}', var_value);
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Seed system templates
INSERT INTO contact_email_templates (
  name,
  subject,
  body,
  category,
  is_system,
  is_active,
  variables
) VALUES
  (
    'Initial Outreach',
    'Introducing {{company_name}} - {{contact_name}}',
    'Hi {{first_name}},

I hope this message finds you well. I wanted to reach out to you personally about how {{company_name}} can help {{contact_company}}.

{{company_name}} specializes in {{service_area}}, and I think we could create significant value for your team.

Would you be open to a brief 15-minute call next week to explore this further?

Best regards,
{{sender_name}}',
    'initial_outreach',
    true,
    true,
    '["first_name", "contact_name", "company_name", "contact_company", "service_area", "sender_name"]'::jsonb
  ),
  (
    'Follow-Up Check-In',
    'Quick Check-In - {{contact_name}}',
    'Hi {{first_name}},

I wanted to follow up on my previous message. I believe {{company_name}} could really make a difference for {{contact_company}}, especially in {{area_of_interest}}.

Would you have 15 minutes this week to chat?

Looking forward to connecting,
{{sender_name}}',
    'follow_up',
    true,
    true,
    '["first_name", "contact_name", "company_name", "contact_company", "area_of_interest", "sender_name"]'::jsonb
  ),
  (
    'Thank You Note',
    'Thank you for your time, {{contact_name}}',
    'Hi {{first_name}},

Thank you so much for taking the time to meet with me today. I really appreciated learning about {{discussion_topic}}.

As we discussed, {{next_step}}. I''ll follow up with the details by {{follow_up_date}}.

Best regards,
{{sender_name}}',
    'thank_you',
    true,
    true,
    '["first_name", "contact_name", "discussion_topic", "next_step", "follow_up_date", "sender_name"]'::jsonb
  ),
  (
    'Project Proposal',
    'Proposal for {{contact_company}} - {{project_name}}',
    'Hi {{first_name}},

Attached is the proposal we discussed for {{project_name}} at {{contact_company}}.

The proposal outlines {{key_points}} and we estimate a timeline of {{timeline}} with an investment of {{investment}}.

Please review at your convenience, and let''s schedule a time to discuss any questions you may have.

Best regards,
{{sender_name}}',
    'proposal',
    true,
    true,
    '["first_name", "contact_company", "project_name", "key_points", "timeline", "investment", "sender_name"]'::jsonb
  )
ON CONFLICT (name) DO NOTHING;


