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