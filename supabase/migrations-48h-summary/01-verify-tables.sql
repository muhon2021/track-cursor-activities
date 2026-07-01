-- ============================================================
-- VERIFICATION SCRIPT: Check all tables from 48h migrations
-- Run this in Supabase SQL Editor to verify migration status
-- ============================================================

DO $$
DECLARE
  missing_tables TEXT[] := '{}';
  table_name TEXT;
  expected_tables TEXT[] := ARRAY[
    -- API & OAuth (Feb 4)
    'api_keys',
    'api_key_request_logs',
    'oauth_clients',
    'oauth_authorization_codes',
    'oauth_access_tokens',
    'oauth_user_consents',
    -- MCP (Feb 5)
    'mcp_servers',
    'mcp_tools',
    'mcp_tool_executions',
    -- Agent Execution (Feb 5)
    'agent_execution_plans',
    'agent_execution_steps',
    'agent_reasoning_traces',
    -- Agent Memory (Feb 5)
    'agent_memories',
    'user_preferences',
    'agent_learning_events',
    -- Guardrails (Feb 6)
    'agent_guardrails',
    'agent_guardrail_assignments',
    'guardrail_violations',
    'agent_cost_limits',
    'tool_usage_restrictions',
    'tool_usage_tracking',
    'content_filters',
    -- Multi-Agent (Feb 6)
    'agent_teams',
    'agent_team_members',
    'agent_collaboration_sessions',
    'agent_collaboration_messages',
    'agent_handoffs',
    -- Approvals (Feb 6)
    'approval_workflows',
    'approval_requests',
    'approval_delegations',
    -- Observability (Feb 6)
    'agent_performance_metrics',
    'agent_errors',
    'agent_audit_trail',
    'system_health_metrics'
  ];
BEGIN
  FOREACH table_name IN ARRAY expected_tables
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND tables.table_name = table_name
    ) THEN
      missing_tables := array_append(missing_tables, table_name);
    END IF;
  END LOOP;

  IF array_length(missing_tables, 1) > 0 THEN
    RAISE NOTICE 'MISSING TABLES: %', array_to_string(missing_tables, ', ');
    RAISE NOTICE 'Total missing: %', array_length(missing_tables, 1);
  ELSE
    RAISE NOTICE '✓ All 32 tables from 48h migrations exist!';
  END IF;
END $$;

-- Also list RLS status for new tables
SELECT 
  c.relname as table_name,
  CASE WHEN c.relrowsecurity THEN '✓ Enabled' ELSE '✗ Disabled' END as rls_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relkind = 'r'
AND c.relname IN (
  'api_keys', 'mcp_servers', 'agent_execution_plans', 
  'agent_memories', 'agent_guardrails', 'agent_teams', 
  'approval_requests'
)
ORDER BY c.relname;
