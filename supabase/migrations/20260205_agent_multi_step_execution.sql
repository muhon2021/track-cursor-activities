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
CREATE INDEX idx_agent_plans_agent_id ON agent_execution_plans(agent_id);
CREATE INDEX idx_agent_plans_user_id ON agent_execution_plans(user_id);
CREATE INDEX idx_agent_plans_status ON agent_execution_plans(status);
CREATE INDEX idx_agent_plans_created_at ON agent_execution_plans(created_at DESC);

-- RLS Policies
ALTER TABLE agent_execution_plans ENABLE ROW LEVEL SECURITY;

-- Users can view their own execution plans
CREATE POLICY "Users can view their agent execution plans"
  ON agent_execution_plans
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all plans
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
CREATE INDEX idx_agent_steps_plan_id ON agent_execution_steps(plan_id);
CREATE INDEX idx_agent_steps_parent_id ON agent_execution_steps(parent_step_id);
CREATE INDEX idx_agent_steps_status ON agent_execution_steps(status);
CREATE INDEX idx_agent_steps_plan_step ON agent_execution_steps(plan_id, step_number);

-- RLS Policies
ALTER TABLE agent_execution_steps ENABLE ROW LEVEL SECURITY;

-- Users can view steps from their plans
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
CREATE INDEX idx_reasoning_plan_id ON agent_reasoning_traces(plan_id);
CREATE INDEX idx_reasoning_step_id ON agent_reasoning_traces(step_id);
CREATE INDEX idx_reasoning_type ON agent_reasoning_traces(reasoning_type);
CREATE INDEX idx_reasoning_created_at ON agent_reasoning_traces(created_at DESC);

-- RLS Policies
ALTER TABLE agent_reasoning_traces ENABLE ROW LEVEL SECURITY;

-- Users can view reasoning from their plans
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
CREATE TRIGGER update_agent_plans_updated_at
  BEFORE UPDATE ON agent_execution_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_steps_updated_at
  BEFORE UPDATE ON agent_execution_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Views for Analytics
-- ============================================================================

-- Agent performance by plan success rate
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
