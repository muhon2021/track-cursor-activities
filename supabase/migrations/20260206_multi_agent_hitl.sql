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
