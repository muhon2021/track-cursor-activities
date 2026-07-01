-- Validation Script for Agentic AI Migrations
-- Run this in Supabase SQL Editor to verify all tables and functions exist

-- Check if all required tables exist
DO $$
DECLARE
  tables_exist BOOLEAN;
BEGIN
  SELECT COUNT(*) = 9 INTO tables_exist
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'mcp_servers',
    'mcp_tools',
    'mcp_tool_executions',
    'agent_execution_plans',
    'agent_execution_steps',
    'agent_reasoning_traces',
    'agent_memories',
    'user_preferences',
    'agent_learning_events'
  );

  IF tables_exist THEN
    RAISE NOTICE '✓ All 9 agentic tables exist';
  ELSE
    RAISE WARNING '✗ Some agentic tables are missing';
  END IF;
END $$;

-- List all agentic tables with row counts
SELECT
  schemaname,
  tablename,
  n_tup_ins as rows_inserted,
  n_tup_upd as rows_updated
FROM pg_stat_user_tables
WHERE tablename IN (
  'mcp_servers',
  'mcp_tools',
  'mcp_tool_executions',
  'agent_execution_plans',
  'agent_execution_steps',
  'agent_reasoning_traces',
  'agent_memories',
  'user_preferences',
  'agent_learning_events'
)
ORDER BY tablename;

-- Check if helper functions exist
SELECT
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'get_relevant_memories',
  'consolidate_short_term_memories',
  'prune_short_term_memories',
  'increment_memory_access',
  'boost_memory_importance'
)
ORDER BY routine_name;

-- Check if vector extension is enabled (required for memory system)
SELECT
  CASE
    WHEN COUNT(*) > 0 THEN '✓ pgvector extension is installed'
    ELSE '✗ pgvector extension is NOT installed - run: CREATE EXTENSION vector;'
  END as vector_status
FROM pg_extension
WHERE extname = 'vector';

-- Check if pre-seeded MCP tools exist
SELECT
  COUNT(*) as preseeded_tools,
  CASE
    WHEN COUNT(*) >= 10 THEN '✓ Pre-seeded Control Tower tools exist'
    ELSE '✗ Pre-seeded tools missing - check migration'
  END as tools_status
FROM mcp_tools
WHERE server_id IN (
  SELECT id FROM mcp_servers WHERE server_url = 'internal://control-tower'
);

-- Check RLS policies
SELECT
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN (
  'mcp_servers',
  'mcp_tools',
  'mcp_tool_executions',
  'agent_execution_plans',
  'agent_execution_steps',
  'agent_memories',
  'user_preferences',
  'agent_learning_events'
)
GROUP BY schemaname, tablename
ORDER BY tablename;

-- Check indexes for performance
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN (
  'agent_memories',
  'mcp_tools',
  'mcp_tool_executions',
  'agent_execution_steps'
)
AND indexname LIKE '%embedding%' OR indexname LIKE '%agent%'
ORDER BY tablename, indexname;

-- Summary
SELECT
  '================================================' as separator
UNION ALL
SELECT 'VALIDATION SUMMARY'
UNION ALL
SELECT '================================================'
UNION ALL
SELECT CONCAT('Tables created: ', COUNT(*))
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'mcp_servers',
  'mcp_tools',
  'mcp_tool_executions',
  'agent_execution_plans',
  'agent_execution_steps',
  'agent_reasoning_traces',
  'agent_memories',
  'user_preferences',
  'agent_learning_events'
)
UNION ALL
SELECT CONCAT('Functions created: ', COUNT(*))
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'get_relevant_memories',
  'consolidate_short_term_memories',
  'prune_short_term_memories',
  'increment_memory_access',
  'boost_memory_importance'
)
UNION ALL
SELECT CONCAT('Views created: ', COUNT(*))
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name IN (
  'agent_memory_stats',
  'user_preference_coverage',
  'agent_learning_summary'
);
