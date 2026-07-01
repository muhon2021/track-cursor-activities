# Migrations Summary - Last 48 Hours (Feb 4-6, 2026)

## Overview

This folder contains documentation and scripts to review all database migrations deployed in the last 48 hours.

## Migration Categories

### 1. API & OAuth (Feb 4)
- **API Keys Management** - Programmatic API access with scopes, rate limits, IP whitelisting
- **OAuth Provider** - Control Tower as OAuth 2.0 identity provider

### 2. Integrations (Feb 5-6)
- **Google Drive Provider** - OAuth integration for file sync
- **Google Meet Fields** - Integration configuration

### 3. Agentic AI System (Feb 5-6)
- **MCP Servers & Tools** - Model Context Protocol for tool orchestration
- **Agent Multi-Step Execution** - Workflow plans with reasoning traces
- **Agent Memory System** - Short/long-term memory with vector embeddings

### 4. Safety & Governance (Feb 6)
- **Guardrails & Safety** - Content filtering, cost controls, PII detection
- **Multi-Agent Collaboration** - Team workflows, agent handoffs
- **Human-in-the-Loop (HITL)** - Approval workflows for critical actions

## New Tables Created (25+)

### API & OAuth
- `api_keys`
- `api_key_request_logs`
- `oauth_clients`
- `oauth_authorization_codes`
- `oauth_access_tokens`
- `oauth_user_consents`

### MCP Tool Orchestration
- `mcp_servers`
- `mcp_tools`
- `mcp_tool_executions`

### Agent Execution
- `agent_execution_plans`
- `agent_execution_steps`
- `agent_reasoning_traces`

### Agent Memory
- `agent_memories`
- `user_preferences`
- `agent_learning_events`

### Guardrails
- `agent_guardrails`
- `agent_guardrail_assignments`
- `guardrail_violations`
- `agent_cost_limits`
- `tool_usage_restrictions`
- `tool_usage_tracking`
- `content_filters`

### Multi-Agent Collaboration
- `agent_teams`
- `agent_team_members`
- `agent_collaboration_sessions`
- `agent_collaboration_messages`
- `agent_handoffs`

### Approvals & Observability
- `approval_workflows`
- `approval_requests`
- `approval_delegations`
- `agent_performance_metrics`
- `agent_errors`
- `agent_audit_trail`
- `system_health_metrics`

## New Database Functions

- `generate_api_key()`
- `hash_api_key()`
- `validate_api_key()`
- `update_api_key_usage()`
- `cleanup_expired_api_keys()`
- `generate_oauth_token()`
- `cleanup_expired_oauth_data()`
- `verify_client_secret()`
- `update_mcp_tool_stats()`
- `update_plan_metrics_on_step_completion()`
- `update_plan_status_if_all_steps_done()`
- `get_relevant_memories()`
- `consolidate_short_term_memories()`
- `prune_short_term_memories()`
- `boost_memory_importance()`
- `check_agent_cost_limit()`
- `record_agent_cost()`
- `reset_expired_cost_limits()`
- `check_tool_rate_limit()`
- `record_tool_usage()`
- `get_agent_guardrails()`
- `get_pending_approvals_for_user()`
- `record_agent_performance()`

## New Views

- `agent_memory_stats`
- `user_preference_coverage`
- `agent_learning_summary`
- `agent_plan_performance`
- `agent_step_performance`

## Run Order

Execute migrations in this order:
1. `20260204_api_keys.sql`
2. `20260204_oauth_provider.sql`
3. `20260205000000_add_google_drive_provider.sql`
4. `20260205_mcp_servers_and_tools.sql`
5. `20260205_agent_multi_step_execution.sql`
6. `20260205_agent_memory_system.sql`
7. `20260206_guardrails_safety.sql`
8. `20260206_multi_agent_hitl.sql`

## Verification Query

```sql
-- Check if all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'api_keys', 'api_key_request_logs',
  'oauth_clients', 'oauth_access_tokens',
  'mcp_servers', 'mcp_tools', 'mcp_tool_executions',
  'agent_execution_plans', 'agent_execution_steps',
  'agent_memories', 'user_preferences',
  'agent_guardrails', 'guardrail_violations',
  'agent_teams', 'approval_workflows', 'approval_requests'
);
```

## Duplicate Migrations (Safe to Ignore)

The following migrations are idempotent re-runs:
- `20260206042320_*.sql` (MCP)
- `20260206042419_*.sql` (Multi-Step)
- `20260206042526_*.sql` (Memory)

These use `CREATE TABLE IF NOT EXISTS` and `DROP POLICY IF EXISTS` patterns.
