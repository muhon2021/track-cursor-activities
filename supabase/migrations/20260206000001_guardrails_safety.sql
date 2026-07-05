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
