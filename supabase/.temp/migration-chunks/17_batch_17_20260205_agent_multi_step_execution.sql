-- 20260205_agent_memory_system.sql
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
CREATE INDEX idx_agent_memories_agent_id ON agent_memories(agent_id);
CREATE INDEX idx_agent_memories_user_id ON agent_memories(user_id);
CREATE INDEX idx_agent_memories_type ON agent_memories(memory_type);
CREATE INDEX idx_agent_memories_category ON agent_memories(memory_category);
CREATE INDEX idx_agent_memories_importance ON agent_memories(importance_score DESC);
CREATE INDEX idx_agent_memories_active ON agent_memories(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_agent_memories_created_at ON agent_memories(created_at DESC);

-- Vector similarity search index (using ivfflat)
CREATE INDEX idx_agent_memories_embedding ON agent_memories
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- RLS Policies
ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;

-- Users can view their own agent memories
CREATE POLICY "Users can view their agent memories"
  ON agent_memories
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all memories
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
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_user_preferences_agent_id ON user_preferences(agent_id);
CREATE INDEX idx_user_preferences_key ON user_preferences(preference_key);
CREATE INDEX idx_user_preferences_active ON user_preferences(is_active) WHERE is_active = TRUE;

-- RLS Policies
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view their preferences"
  ON user_preferences
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all preferences
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
CREATE INDEX idx_learning_events_agent_id ON agent_learning_events(agent_id);
CREATE INDEX idx_learning_events_user_id ON agent_learning_events(user_id);
CREATE INDEX idx_learning_events_type ON agent_learning_events(event_type);
CREATE INDEX idx_learning_events_created_at ON agent_learning_events(created_at DESC);

-- RLS Policies
ALTER TABLE agent_learning_events ENABLE ROW LEVEL SECURITY;

-- Users can view their learning events
CREATE POLICY "Users can view their learning events"
  ON agent_learning_events
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all learning events
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

-- Function to increment access count for multiple memories
CREATE OR REPLACE FUNCTION increment_memory_access(memory_ids UUID[])
RETURNS VOID AS $$
BEGIN
  UPDATE agent_memories
  SET
    access_count = access_count + 1,
    last_accessed_at = NOW()
  WHERE id = ANY(memory_ids);
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
    updated_at = NOW()
  WHERE id = p_memory_id;
END;
$$ LANGUAGE plpgsql;

-- Auto-update timestamps
CREATE TRIGGER update_agent_memories_updated_at
  BEFORE UPDATE ON agent_memories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Views for Analytics
-- ============================================================================

-- Memory usage by agent
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


-- 20260205_agent_multi_step_execution.sql
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


