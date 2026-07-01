# Database Schema Reference

> **Last updated:** 2026-02-24 | **Total tables:** 94 | **Views:** 6 | **Enums:** 1

This document provides a comprehensive reference for all database tables in the CollabAi platform, organized by functional module. All tables use PostgreSQL with Row Level Security (RLS) enabled.

---

## Table of Contents

1. [Core / Auth](#1-core--auth)
2. [Activity & Notifications](#2-activity--notifications)
3. [AI Agents & Chat](#3-ai-agents--chat)
4. [Agent Execution & Memory](#4-agent-execution--memory)
5. [MCP Tool Orchestration](#5-mcp-tool-orchestration)
6. [Embeddings & RAG](#6-embeddings--rag)
7. [Knowledge Base](#7-knowledge-base)
8. [Meetings](#8-meetings)
9. [Clients & CRM](#9-clients--crm)
10. [Contact Intelligence](#10-contact-intelligence)
11. [Deals / Business Dev](#11-deals--business-dev)
12. [Projects](#12-projects)
13. [Tasks / Actions](#13-tasks--actions)
14. [EOS / OKRs](#14-eos--okrs)
15. [Productivity & HR](#15-productivity--hr)
16. [Integrations](#16-integrations)
17. [Email & Communications](#17-email--communications)
18. [Microsoft Graph](#18-microsoft-graph)
19. [Process & Documents](#19-process--documents)
20. [System Settings](#20-system-settings)
21. [Views](#21-views)
22. [Enums](#22-enums)
23. [Database Functions](#23-database-functions)

---

## 1. Core / Auth

### `profiles`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | — | PK, references `auth.users` |
| email | text | YES | — | |
| full_name | text | YES | — | |
| avatar_url | text | YES | — | |
| is_active | boolean | YES | — | |
| metadata | jsonb | YES | — | |
| deactivated_at | timestamptz | YES | — | |
| deactivated_by | uuid | YES | — | FK → `profiles.id` |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `user_roles`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | — | FK → `auth.users` |
| role | app_role | NO | — | Enum: admin, moderator, user |
| created_at | timestamptz | NO | now() | |

### `roles`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| description | text | YES | — | |
| created_at | timestamptz | NO | now() | |

### `user_invites`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| email | text | NO | — | |
| token | text | NO | gen_random_uuid() | |
| role | text | YES | — | |
| invited_by | uuid | YES | — | FK → `profiles.id` |
| expires_at | timestamptz | NO | now() + 7 days | |
| used_at | timestamptz | YES | — | |
| created_at | timestamptz | YES | now() | |

### `user_module_permissions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | — | |
| module_id | uuid | NO | — | FK → `app_modules.id` |
| granted_by | uuid | YES | — | |
| granted_at | timestamptz | YES | now() | |

### `app_config`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| key | text | NO | — | UNIQUE |
| value | jsonb | NO | '{}' | |
| category | text | NO | 'general' | |
| description | text | YES | — | |
| is_sensitive | boolean | YES | false | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `app_modules`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| slug | text | NO | — | UNIQUE |
| description | text | YES | — | |
| icon | text | YES | — | |
| category | text | YES | — | |
| is_active | boolean | YES | true | |
| is_core | boolean | YES | false | |
| dependencies | text[] | YES | — | |
| page_route | text | YES | — | |
| sort_order | integer | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

---

## 2. Activity & Notifications

### `activity_logs`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | — | |
| action | text | NO | — | |
| resource_type | text | YES | — | |
| resource_id | text | YES | — | |
| details | jsonb | YES | — | |
| ip_address | text | YES | — | |
| user_agent | text | YES | — | |
| created_at | timestamptz | NO | now() | |

### `notifications`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | — | |
| title | text | NO | — | |
| message | text | NO | — | |
| type | text | YES | — | |
| link | text | YES | — | |
| is_read | boolean | YES | false | |
| read_at | timestamptz | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | NO | now() | |

### `feedback`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | — | |
| type | text | NO | — | |
| subject | text | NO | — | |
| message | text | NO | — | |
| module | text | YES | — | |
| rating | integer | YES | — | |
| status | text | YES | 'new' | |
| admin_notes | text | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

---

## 3. AI Agents & Chat

### `ai_agents`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| slug | text | NO | — | UNIQUE |
| description | text | YES | — | |
| system_prompt | text | NO | — | |
| avatar | text | YES | — | |
| category | text | YES | — | |
| is_enabled | boolean | YES | true | |
| memory_enabled | boolean | YES | false | |
| required_role | app_role | YES | — | |
| provider_config | jsonb | YES | — | |
| data_sources | jsonb | YES | — | |
| conversation_starters | jsonb | YES | — | |
| welcome_message | text | YES | — | |
| metadata | jsonb | YES | — | |
| deleted_at | timestamptz | YES | — | Soft delete |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `ai_agent_categories`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| slug | text | NO | — | |
| description | text | YES | — | |
| icon | text | YES | — | |
| display_order | integer | YES | — | |
| is_active | boolean | YES | true | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `ai_agent_runs`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| agent_id | uuid | NO | — | FK → `ai_agents.id` |
| user_id | uuid | NO | — | |
| input | text | YES | — | |
| output | text | YES | — | |
| status | text | YES | 'pending' | |
| error_message | text | YES | — | |
| context | jsonb | YES | — | |
| metadata | jsonb | YES | — | |
| model_used | text | YES | — | |
| provider_used | text | YES | — | |
| latency_ms | integer | YES | — | |
| token_metrics | jsonb | YES | — | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `ai_chat_history`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | — | |
| agent_id | uuid | YES | — | FK → `ai_agents.id` |
| session_id | text | NO | — | |
| role | text | NO | — | |
| content | text | NO | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | NO | now() | |

### `ai_providers`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| slug | text | NO | — | |
| description | text | YES | — | |
| base_url | text | YES | — | |
| api_key_secret_name | text | YES | — | |
| enabled | boolean | NO | true | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `ai_models`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| provider_id | uuid | NO | — | FK → `ai_providers.id` |
| model_id | text | NO | — | |
| name | text | NO | — | |
| category | text | NO | — | |
| context_window | integer | NO | 4096 | |
| input_cost_per_1k | numeric | NO | 0 | |
| output_cost_per_1k | numeric | NO | 0 | |
| embedding_cost_per_1k | numeric | NO | 0 | |
| features | jsonb | NO | '{}' | |
| enabled | boolean | NO | true | |
| is_default | boolean | NO | false | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `ai_usage_logs`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | — | |
| model_id | uuid | YES | — | FK → `ai_models.id` |
| function_name | text | YES | — | |
| input_tokens | integer | NO | 0 | |
| output_tokens | integer | NO | 0 | |
| embedding_tokens | integer | NO | 0 | |
| estimated_cost | numeric | NO | 0 | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | NO | now() | |

### `ai_productivity_insights`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| title | text | NO | — | |
| content | text | NO | — | |
| insight_type | text | NO | — | |
| employee_email | text | YES | — | |
| department | text | YES | — | |
| pod_id | uuid | YES | — | FK → `pods.id` |
| week_start | date | YES | — | |
| confidence_score | numeric | YES | — | |
| model_used | text | YES | — | |
| recommendations | text[] | YES | — | |
| created_at | timestamptz | YES | now() | |

### `prompt_templates`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| slug | text | NO | — | |
| description | text | YES | — | |
| category | text | NO | 'general' | |
| template_content | text | NO | — | |
| is_active | boolean | YES | true | |
| usage_count | integer | YES | 0 | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `agent_conversations`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| agent_id | uuid | NO | — | FK → `ai_agents.id` |
| user_id | uuid | NO | — | |
| title | text | YES | — | |
| summary | text | YES | — | |
| message_count | integer | NO | 0 | |
| is_pinned | boolean | NO | false | |
| is_archived | boolean | NO | false | |
| last_message_at | timestamptz | YES | — | |
| metadata | jsonb | NO | '{}' | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `agent_messages`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| conversation_id | uuid | NO | — | FK → `agent_conversations.id` |
| role | text | NO | 'user' | |
| content | text | NO | '' | |
| citations | jsonb | NO | '[]' | |
| tool_calls | jsonb | YES | — | |
| tool_results | jsonb | YES | — | |
| model_used | text | YES | — | |
| provider_used | text | YES | — | |
| tokens_input | integer | YES | — | |
| tokens_output | integer | YES | — | |
| latency_ms | integer | YES | — | |
| metadata | jsonb | NO | '{}' | |
| created_at | timestamptz | NO | now() | |

---

## 4. Agent Execution & Memory

### `agent_execution_plans`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| agent_id | uuid | NO | — | FK → `ai_agents.id` |
| user_id | uuid | NO | — | FK → `profiles.id` |
| goal | text | NO | — | |
| input | text | NO | — | |
| status | text | NO | 'planning' | |
| steps | jsonb | NO | '[]' | |
| plan_summary | text | YES | — | |
| total_steps | integer | YES | — | |
| current_step_number | integer | YES | 0 | |
| success | boolean | YES | — | |
| final_output | jsonb | YES | — | |
| total_tokens_used | integer | YES | 0 | |
| total_cost | numeric | YES | 0 | |
| planning_time_ms | integer | YES | — | |
| execution_time_ms | integer | YES | — | |
| started_at | timestamptz | YES | — | |
| completed_at | timestamptz | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `agent_execution_steps`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| plan_id | uuid | NO | — | FK → `agent_execution_plans.id` |
| step_number | integer | NO | — | |
| step_name | text | YES | — | |
| action_type | text | NO | — | |
| description | text | YES | — | |
| status | text | NO | 'pending' | |
| action_details | jsonb | YES | — | |
| result | jsonb | YES | — | |
| error_message | text | YES | — | |
| error_code | text | YES | — | |
| tokens_used | integer | YES | — | |
| cost | numeric | YES | — | |
| execution_time_ms | integer | YES | — | |
| retry_count | integer | YES | 0 | |
| max_retries | integer | YES | 3 | |
| depends_on | integer[] | YES | — | |
| can_run_parallel | boolean | YES | false | |
| output_for_next_step | text | YES | — | |
| parent_step_id | uuid | YES | — | FK → `agent_execution_steps.id` |
| started_at | timestamptz | YES | — | |
| completed_at | timestamptz | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `agent_reasoning_traces`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| plan_id | uuid | NO | — | FK → `agent_execution_plans.id` |
| step_id | uuid | YES | — | FK → `agent_execution_steps.id` |
| reasoning_type | text | NO | — | |
| content | text | NO | — | |
| confidence_score | numeric | YES | — | |
| context | jsonb | YES | — | |
| created_at | timestamptz | YES | now() | |

### `agent_memories`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| agent_id | uuid | NO | — | FK → `ai_agents.id` |
| user_id | uuid | NO | — | FK → `profiles.id` |
| memory_type | text | NO | — | short_term, long_term, episodic |
| content | text | NO | — | |
| summary | text | YES | — | |
| embedding | vector | YES | — | |
| importance_score | numeric | YES | 0.5 | |
| memory_category | text | YES | — | |
| source_type | text | YES | — | |
| source_id | text | YES | — | |
| is_active | boolean | YES | true | |
| consolidated | boolean | YES | false | |
| superseded_by | uuid | YES | — | FK → `agent_memories.id` |
| access_count | integer | YES | 0 | |
| last_accessed_at | timestamptz | YES | — | |
| valid_from | timestamptz | YES | — | |
| valid_until | timestamptz | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `agent_learning_events`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| agent_id | uuid | NO | — | FK → `ai_agents.id` |
| user_id | uuid | NO | — | FK → `profiles.id` |
| event_type | text | NO | — | |
| event_description | text | NO | — | |
| feedback_type | text | YES | — | |
| feedback_text | text | YES | — | |
| agent_action_taken | text | YES | — | |
| behavior_change | jsonb | YES | — | |
| related_conversation_id | uuid | YES | — | |
| related_message_id | uuid | YES | — | |
| related_memory_id | uuid | YES | — | FK → `agent_memories.id` |
| created_at | timestamptz | YES | now() | |

### `user_preferences`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | — | FK → `profiles.id` |
| agent_id | uuid | YES | — | FK → `ai_agents.id` |
| preference_key | text | NO | — | |
| preference_value | jsonb | NO | — | |
| confidence_score | numeric | YES | — | |
| evidence_count | integer | YES | — | |
| learned_from | text | YES | — | |
| is_active | boolean | YES | true | |
| times_used | integer | YES | 0 | |
| last_used_at | timestamptz | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

---

## 5. MCP Tool Orchestration

### `mcp_servers`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| slug | text | NO | — | |
| description | text | YES | — | |
| server_url | text | NO | — | |
| transport_type | text | NO | 'sse' | |
| auth_type | text | NO | 'none' | |
| auth_config | jsonb | YES | — | |
| is_enabled | boolean | YES | true | |
| is_global | boolean | YES | false | |
| is_verified | boolean | YES | false | |
| verification_status | text | YES | — | |
| verification_error | text | YES | — | |
| last_verified_at | timestamptz | YES | — | |
| version | text | YES | — | |
| supports_tools | boolean | YES | true | |
| supports_resources | boolean | YES | false | |
| supports_prompts | boolean | YES | false | |
| supports_sampling | boolean | YES | false | |
| total_tool_calls | integer | YES | 0 | |
| last_used_at | timestamptz | YES | — | |
| homepage_url | text | YES | — | |
| documentation_url | text | YES | — | |
| icon_url | text | YES | — | |
| organization_id | text | YES | — | |
| created_by | uuid | YES | — | FK → `profiles.id` |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `mcp_tools`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| server_id | uuid | NO | — | FK → `mcp_servers.id` |
| name | text | NO | — | |
| description | text | YES | — | |
| input_schema | jsonb | NO | — | |
| is_enabled | boolean | YES | true | |
| total_executions | integer | YES | 0 | |
| successful_executions | integer | YES | 0 | |
| failed_executions | integer | YES | 0 | |
| avg_execution_time_ms | numeric | YES | — | |
| last_executed_at | timestamptz | YES | — | |
| discovered_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `mcp_tool_executions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| tool_id | uuid | NO | — | FK → `mcp_tools.id` |
| server_id | uuid | NO | — | FK → `mcp_servers.id` |
| user_id | uuid | NO | — | FK → `profiles.id` |
| agent_id | uuid | YES | — | FK → `ai_agents.id` |
| status | text | NO | — | |
| input_parameters | jsonb | NO | — | |
| output_result | jsonb | YES | — | |
| error_message | text | YES | — | |
| error_code | text | YES | — | |
| execution_time_ms | integer | YES | — | |
| execution_context | jsonb | YES | — | |
| started_at | timestamptz | YES | — | |
| completed_at | timestamptz | YES | — | |
| created_at | timestamptz | YES | now() | |

---

## 6. Embeddings & RAG

### `embeddings`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| entity_type | text | NO | — | |
| entity_id | text | NO | — | |
| content | text | NO | — | |
| embedding | vector | YES | — | |
| chunk_index | integer | YES | — | |
| user_id | uuid | YES | — | |
| unified_document_id | uuid | YES | — | FK → `unified_documents.id` |
| gemini_corpus_id | text | YES | — | |
| gemini_document_id | text | YES | — | |
| provider_corpus_id | text | YES | — | |
| provider_document_id | text | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | NO | now() | |

### `embedding_queue`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| entity_type | text | NO | — | |
| entity_id | text | NO | — | |
| status | text | YES | 'pending' | |
| priority | integer | YES | 0 | |
| attempts | integer | YES | 0 | |
| max_attempts | integer | YES | 3 | |
| error_message | text | YES | — | |
| scheduled_at | timestamptz | YES | now() | |
| started_at | timestamptz | YES | — | |
| completed_at | timestamptz | YES | — | |
| created_at | timestamptz | YES | now() | |

### `knowledge_embeddings`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| entry_id | uuid | YES | — | |
| file_id | uuid | YES | — | FK → `knowledge_files.id` |
| content | text | NO | — | |
| chunk_index | integer | YES | — | |
| token_count | integer | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | YES | now() | |

### `vector_search_logs`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | YES | — | |
| query | text | NO | — | |
| search_type | text | YES | — | |
| result_count | integer | YES | — | |
| top_score | numeric | YES | — | |
| duration_ms | integer | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | YES | now() | |

### `gemini_corpora`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| display_name | text | YES | — | |
| external_corpus_id | text | YES | — | |
| document_count | integer | YES | 0 | |
| is_active | boolean | YES | true | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `gemini_query_logs`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| corpus_id | uuid | YES | — | FK → `gemini_corpora.id` |
| user_id | uuid | YES | — | |
| query_text | text | NO | — | |
| result_count | integer | YES | — | |
| duration_ms | integer | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | YES | now() | |

### `gemini_sync_logs`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| corpus_id | uuid | NO | — | FK → `gemini_corpora.id` |
| sync_type | text | NO | — | |
| status | text | YES | — | |
| documents_added | integer | YES | 0 | |
| documents_removed | integer | YES | 0 | |
| error_message | text | YES | — | |
| triggered_by | text | YES | — | |
| started_at | timestamptz | YES | — | |
| completed_at | timestamptz | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | YES | now() | |

---

## 7. Knowledge Base

### `knowledge_entries`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| author_id | uuid | NO | — | |
| title | text | NO | — | |
| slug | text | NO | — | |
| content | text | NO | — | |
| summary | text | YES | — | |
| category_id | uuid | YES | — | FK → `knowledge_categories.id` |
| status | text | YES | 'draft' | |
| tags | text[] | YES | — | |
| search_vector | tsvector | YES | — | Auto-generated |
| view_count | integer | YES | 0 | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `knowledge_categories`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| slug | text | NO | — | |
| description | text | YES | — | |
| icon | text | YES | — | |
| color | text | YES | — | |
| parent_id | uuid | YES | — | FK → `knowledge_categories.id` (self-ref) |
| owner_id | uuid | YES | — | |
| sort_order | integer | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `knowledge_sources`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| source_type | text | NO | — | |
| config | jsonb | YES | — | |
| is_active | boolean | YES | true | |
| last_synced_at | timestamptz | YES | — | |
| created_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `knowledge_files`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| title | text | NO | — | |
| file_name | text | NO | — | |
| file_type | text | YES | — | |
| file_size | integer | YES | — | |
| storage_path | text | YES | — | |
| category_id | uuid | YES | — | FK → `knowledge_categories.id` |
| source_id | uuid | YES | — | FK → `knowledge_sources.id` |
| processing_status | text | YES | 'pending' | |
| processing_error | text | YES | — | |
| processed_at | timestamptz | YES | — | |
| embedding_model | text | YES | — | |
| chunk_count | integer | YES | — | |
| uploaded_by | uuid | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `user_knowledge_files`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | — | |
| title | text | NO | — | |
| file_name | text | NO | — | |
| file_type | text | YES | — | |
| file_size | integer | YES | — | |
| storage_path | text | YES | — | |
| processing_status | text | YES | 'pending' | |
| chunk_count | integer | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `common_knowledge`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| title | text | NO | — | |
| content | text | NO | — | |
| category | text | YES | — | |
| tags | text[] | YES | — | |
| is_active | boolean | YES | true | |
| created_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

---

## 8. Meetings

### `meetings`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| title | text | NO | — | |
| description | text | YES | — | |
| slug | text | YES | — | |
| organizer_id | uuid | NO | — | |
| client_id | uuid | YES | — | FK → `clients.id` |
| deal_id | uuid | YES | — | FK → `deals.id` |
| pod_id | uuid | YES | — | FK → `pods.id` |
| series_id | uuid | YES | — | FK → `meeting_series.id` |
| parent_meeting_id | uuid | YES | — | FK → `meetings.id` (self-ref) |
| scheduled_at | timestamptz | YES | — | |
| duration_minutes | integer | YES | — | |
| status | text | YES | 'scheduled' | |
| meeting_type | text | YES | — | |
| location | text | YES | — | |
| provider | text | YES | — | |
| is_recurring | boolean | YES | false | |
| is_external | boolean | YES | false | |
| recurrence_pattern | text | YES | — | |
| recurrence_end_date | timestamptz | YES | — | |
| timezone | text | YES | — | |
| notes | text | YES | — | |
| summary | text | YES | — | |
| ai_summary | text | YES | — | |
| action_items | jsonb | YES | — | |
| agenda_finalized | boolean | YES | false | |
| notify_participants | boolean | YES | true | |
| efficiency_score | numeric | YES | — | |
| embedding_status | text | YES | — | |
| categorization_data | jsonb | YES | — | |
| transcript_content | text | YES | — | |
| transcript_text | text | YES | — | |
| recording_url | text | YES | — | |
| join_url | text | YES | — | |
| host_url | text | YES | — | |
| external_id | text | YES | — | |
| external_meeting_id | text | YES | — | |
| external_uuid | text | YES | — | |
| zoom_id | text | YES | — | |
| zoom_meeting_id | text | YES | — | |
| zoom_join_url | text | YES | — | |
| zoom_start_url | text | YES | — | |
| zoom_uuid | text | YES | — | |
| closed_at | timestamptz | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `meeting_series`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| title | text | NO | — | |
| description | text | YES | — | |
| organizer_id | uuid | NO | — | |
| recurrence_rule | text | NO | — | |
| duration_minutes | integer | YES | — | |
| default_agenda | jsonb | YES | — | |
| is_active | boolean | YES | true | |
| next_occurrence | timestamptz | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `meeting_participants`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| meeting_id | uuid | NO | — | FK → `meetings.id` |
| user_id | uuid | YES | — | |
| email | text | YES | — | |
| name | text | YES | — | |
| role | text | YES | — | |
| rsvp_status | text | YES | — | |
| response_at | timestamptz | YES | — | |
| attended | boolean | YES | — | |
| joined_at | timestamptz | YES | — | |
| left_at | timestamptz | YES | — | |
| created_at | timestamptz | YES | now() | |

### `meeting_external_participants`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| meeting_id | uuid | NO | — | FK → `meetings.id` |
| external_email | text | NO | — | |
| external_name | text | YES | — | |
| role | text | NO | 'attendee' | |
| status | text | YES | — | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `meeting_agenda_items`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| meeting_id | uuid | NO | — | FK → `meetings.id` |
| title | text | NO | — | |
| description | text | YES | — | |
| duration_minutes | integer | YES | — | |
| sort_order | integer | YES | — | |
| is_completed | boolean | YES | false | |
| notes | text | YES | — | |
| presenter_id | uuid | YES | — | |
| assigned_to | uuid | YES | — | |
| created_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `meeting_action_items`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| meeting_id | uuid | NO | — | FK → `meetings.id` |
| text | text | NO | — | |
| assignee_id | uuid | YES | — | |
| assignee_email | text | YES | — | |
| due_date | date | YES | — | |
| priority | text | YES | — | |
| status | text | YES | 'open' | |
| task_id | uuid | YES | — | FK → `tasks.id` |
| extracted_from_transcript | boolean | YES | false | |
| extraction_confidence | numeric | YES | — | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `meeting_takeaways`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| meeting_id | uuid | NO | — | FK → `meetings.id` |
| agenda_item_id | uuid | YES | — | FK → `meeting_agenda_items.id` |
| content | text | NO | — | |
| takeaway_type | text | NO | 'action_item' | |
| priority | text | YES | — | |
| status | text | YES | 'open' | |
| is_completed | boolean | YES | false | |
| assigned_to | uuid | YES | — | |
| due_date | date | YES | — | |
| task_id | uuid | YES | — | |
| created_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `meeting_assignments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| meeting_id | uuid | NO | — | FK → `meetings.id` |
| entity_type | text | NO | — | e.g. 'project', 'client' |
| entity_id | text | NO | — | |
| assigned_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |

### `meeting_assignment_suggestions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| meeting_id | uuid | NO | — | FK → `meetings.id` |
| suggested_type | text | NO | — | |
| suggested_id | text | NO | — | |
| confidence | numeric | YES | — | |
| reasoning | text | YES | — | |
| review_status | text | YES | 'pending' | |
| reviewed_by | uuid | YES | — | |
| reviewed_at | timestamptz | YES | — | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `meeting_categorizations`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| meeting_id | uuid | NO | — | FK → `meetings.id` |
| category | text | NO | — | |
| meeting_type | text | YES | — | |
| confidence | numeric | YES | — | |
| source | text | YES | — | |
| rule_id | text | YES | — | |
| tags | jsonb | YES | — | |
| related_projects | jsonb | YES | — | |
| related_clients | jsonb | YES | — | |
| related_pods | jsonb | YES | — | |
| created_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |

### `meeting_files`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| meeting_id | uuid | YES | — | FK → `meetings.id` |
| file_name | text | NO | — | |
| file_type | text | NO | — | |
| file_size | integer | YES | — | |
| file_path | text | YES | — | |
| storage_path | text | YES | — | |
| download_url | text | YES | — | |
| provider | text | NO | 'manual' | |
| external_meeting_id | text | YES | — | |
| is_processed | boolean | YES | false | |
| processing_status | text | YES | — | |
| has_embeddings | boolean | YES | false | |
| transcript_content | jsonb | YES | — | |
| transcript_text | text | YES | — | |
| assignment_status | text | YES | — | |
| assignment_confidence | numeric | YES | — | |
| assignment_reasoning | text | YES | — | |
| suggested_client_id | uuid | YES | — | FK → `clients.id` |
| suggested_pod_id | uuid | YES | — | FK → `pods.id` |
| suggested_project_id | uuid | YES | — | |
| reviewed_by | uuid | YES | — | |
| reviewed_at | timestamptz | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `meeting_transcripts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| meeting_id | uuid | NO | — | |
| speaker | text | NO | — | |
| content | text | NO | — | |
| created_at | timestamptz | YES | now() | |

### `zoom_files`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| meeting_id | uuid | NO | — | FK → `meetings.id` |
| file_name | text | NO | — | |
| file_type | text | NO | — | |
| file_size | integer | YES | — | |
| file_path | text | YES | — | |
| storage_path | text | YES | — | |
| download_url | text | YES | — | |
| is_processed | boolean | YES | false | |
| processing_status | text | YES | — | |
| has_embeddings | boolean | YES | false | |
| transcript_content | jsonb | YES | — | |
| transcript_text | text | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

---

## 9. Clients & CRM

### `clients`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| email | text | YES | — | UNIQUE |
| phone | text | YES | — | |
| company | text | YES | — | |
| status | text | YES | 'active' | |
| created_by | uuid | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `client_feedback`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| project_id | uuid | NO | — | FK → `projects.id` |
| client_access_id | uuid | YES | — | FK → `project_client_access.id` |
| feedback_text | text | NO | — | |
| rating | integer | YES | — | |
| week_number | integer | YES | — | |
| year | integer | YES | — | |
| created_at | timestamptz | YES | now() | |

### `client_meetings`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| client_id | uuid | NO | — | FK → `clients.id` |
| meeting_id | uuid | NO | — | FK → `meetings.id` |
| created_at | timestamptz | NO | now() | |

### `contacts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| first_name | text | NO | — | |
| last_name | text | YES | — | |
| email | text | YES | — | |
| phone | text | YES | — | |
| company | text | YES | — | |
| title | text | YES | — | |
| department | text | YES | — | |
| linkedin_url | text | YES | — | |
| website | text | YES | — | |
| source | text | YES | — | |
| notes | text | YES | — | |
| tags | text[] | YES | — | |
| client_id | uuid | YES | — | |
| created_by | uuid | YES | — | |
| is_lead_follow_up | boolean | YES | false | |
| is_upwork_lead | boolean | YES | false | |
| hubspot_id | text | YES | — | |
| preferred_contact_channel | text | YES | — | |
| lead_score | integer | YES | — | Auto-calculated |
| lead_temperature | text | YES | — | hot/warm/cold |
| profile_score | integer | YES | — | |
| recency_score | integer | YES | — | |
| engagement_score | integer | YES | — | |
| deal_potential_score | integer | YES | — | |
| current_mood_score | integer | YES | — | |
| current_mood_label | text | YES | — | |
| current_intent_status | text | YES | — | |
| last_contact_date | timestamptz | YES | — | |
| last_contacted_at | timestamptz | YES | — | |
| last_score_calculated_at | timestamptz | YES | — | |
| last_mood_analysis_at | timestamptz | YES | — | |
| last_intent_analysis_at | timestamptz | YES | — | |
| next_followup_date | date | YES | — | |
| followup_status | text | YES | — | |
| followup_notes | text | YES | — | |
| followup_assigned_to | uuid | YES | — | |
| followup_attempt_count | integer | YES | — | |
| followup_interval_days | integer | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

---

## 10. Contact Intelligence

### `contact_activities`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| contact_id | uuid | NO | — | FK → `contacts.id` |
| activity_type | text | NO | — | |
| channel | text | NO | — | |
| direction | text | NO | — | |
| subject | text | YES | — | |
| description | text | YES | — | |
| email_to | text[] | YES | — | |
| email_cc | text[] | YES | — | |
| email_bcc | text[] | YES | — | |
| email_body | text | YES | — | |
| email_sent_at | timestamptz | YES | — | |
| created_by | uuid | YES | — | |
| deleted_at | timestamptz | YES | — | Soft delete |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | YES | now() | |

### `contact_ai_summaries`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| contact_id | uuid | NO | — | FK → `contacts.id` (one-to-one) |
| summary_text | text | YES | — | |
| engagement_level | text | YES | — | |
| lead_score | integer | YES | — | |
| recommended_approach | text | YES | — | |
| talking_points | jsonb | YES | — | |
| data_snapshot | jsonb | YES | — | |
| generated_at | timestamptz | YES | — | |
| expires_at | timestamptz | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `contact_communications`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| contact_id | uuid | NO | — | FK → `contacts.id` |
| channel | text | NO | — | |
| direction | text | YES | — | |
| subject | text | YES | — | |
| content | text | YES | — | |
| user_id | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |

### `contact_email_templates`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| subject | text | NO | — | |
| body | text | NO | — | |
| category | text | YES | — | |
| variables | jsonb | YES | — | |
| is_active | boolean | YES | true | |
| is_system | boolean | YES | false | |
| usage_count | integer | YES | 0 | |
| created_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `contact_meeting_links`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| contact_id | uuid | NO | — | FK → `contacts.id` |
| meeting_id | uuid | NO | — | FK → `meetings.id` |
| created_at | timestamptz | NO | now() | |

### `lead_followup_contacts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| contact_id | uuid | NO | — | FK → `contacts.id` (one-to-one) |
| status | text | YES | 'new' | |
| priority | text | YES | — | |
| assigned_to | uuid | YES | — | |
| next_follow_up | timestamptz | YES | — | |
| follow_up_notes | text | YES | — | |
| converted_deal_id | uuid | YES | — | FK → `deals.id` |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `lead_intent_analysis`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| contact_id | uuid | NO | — | FK → `contacts.id` |
| lead_id | uuid | YES | — | FK → `deals.id` |
| intent_status | text | NO | — | |
| momentum_score | integer | NO | — | |
| confidence | text | YES | — | |
| momentum_signals | jsonb | YES | — | |
| decay_signals | jsonb | YES | — | |
| days_since_activity | integer | YES | — | |
| reasoning | text | YES | — | |
| suggested_action | text | YES | — | |
| agent_run_id | uuid | YES | — | |
| analyzed_at | timestamptz | YES | now() | |
| created_at | timestamptz | YES | now() | |

### `lead_mood_analysis`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| contact_id | uuid | NO | — | FK → `contacts.id` |
| lead_id | uuid | YES | — | FK → `deals.id` |
| mood_score | integer | NO | — | |
| mood_label | text | NO | — | |
| confidence | text | YES | — | |
| key_signals | jsonb | YES | — | |
| reasoning | text | YES | — | |
| suggested_action | text | YES | — | |
| agent_run_id | uuid | YES | — | |
| analyzed_at | timestamptz | YES | now() | |
| created_at | timestamptz | YES | now() | |

---

## 11. Deals / Business Dev

### `deals`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| title | text | NO | — | |
| slug | text | NO | — | |
| description | text | YES | — | |
| stage | text | NO | 'lead' | |
| value | numeric | YES | — | |
| currency | text | YES | 'USD' | |
| probability | integer | YES | — | |
| expected_close_date | date | YES | — | |
| closed_at | timestamptz | YES | — | |
| lost_reason | text | YES | — | |
| source | text | YES | — | |
| tags | text[] | YES | — | |
| client_id | uuid | YES | — | FK → `clients.id` |
| contact_id | uuid | YES | — | FK → `contacts.id` |
| owner_id | uuid | YES | — | FK → `profiles.id` |
| created_by | uuid | YES | — | FK → `profiles.id` |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `deal_activities`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| deal_id | uuid | NO | — | FK → `deals.id` |
| user_id | uuid | YES | — | FK → `profiles.id` |
| activity_type | text | NO | — | |
| content | text | NO | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | YES | now() | |

### `deal_comments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| deal_id | uuid | NO | — | FK → `deals.id` |
| user_id | uuid | NO | — | FK → `profiles.id` |
| content | text | NO | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

---

## 12. Projects

### `projects`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| slug | text | NO | — | |
| description | text | YES | — | |
| status_id | uuid | YES | — | FK → `project_statuses.id` |
| client_id | uuid | YES | — | |
| owner_id | uuid | YES | — | |
| created_by | uuid | YES | — | |
| source_deal_id | uuid | YES | — | |
| budget | numeric | YES | — | |
| currency | text | YES | 'USD' | |
| start_date | date | YES | — | |
| end_date | date | YES | — | |
| is_archived | boolean | YES | false | |
| external_id | text | YES | — | |
| external_provider | text | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `project_statuses`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| slug | text | NO | — | |
| color | text | YES | — | |
| sort_order | integer | YES | — | |
| is_default | boolean | YES | false | |
| is_active | boolean | YES | true | |
| created_at | timestamptz | YES | now() | |

### `project_members`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| project_id | uuid | NO | — | FK → `projects.id` |
| user_id | uuid | NO | — | |
| role | text | YES | — | |
| joined_at | timestamptz | YES | now() | |

### `project_milestones`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| project_id | uuid | NO | — | FK → `projects.id` |
| title | text | NO | — | |
| description | text | YES | — | |
| due_date | date | YES | — | |
| status | text | YES | 'pending' | |
| sort_order | integer | YES | — | |
| pm_notes | text | YES | — | |
| completed_at | timestamptz | YES | — | |
| created_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `project_comments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| project_id | uuid | NO | — | FK → `projects.id` |
| user_id | uuid | NO | — | |
| content | text | NO | — | |
| parent_id | uuid | YES | — | FK → `project_comments.id` (self-ref) |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `project_files`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| project_id | uuid | NO | — | FK → `projects.id` |
| file_name | text | NO | — | |
| file_type | text | YES | — | |
| file_size | integer | YES | — | |
| storage_path | text | YES | — | |
| source | text | YES | — | |
| uploaded_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |

### `project_risks`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| project_id | uuid | NO | — | FK → `projects.id` |
| title | text | NO | — | |
| description | text | YES | — | |
| severity | text | YES | — | |
| status | text | YES | 'open' | |
| mitigation | text | YES | — | |
| is_client_visible | boolean | YES | false | |
| reported_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `project_invoices`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| project_id | uuid | NO | — | FK → `projects.id` |
| invoice_number | text | NO | — | |
| amount | numeric | NO | — | |
| status | text | YES | 'draft' | |
| due_date | date | YES | — | |
| paid_at | timestamptz | YES | — | |
| notes | text | YES | — | |
| created_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `project_billing`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| project_id | uuid | NO | — | FK → `projects.id` (one-to-one) |
| billing_type | text | YES | — | |
| rate | numeric | YES | — | |
| currency | text | YES | 'USD' | |
| total_budget | numeric | YES | — | |
| invoiced_amount | numeric | YES | 0 | |
| payment_terms | text | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `project_backups`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| project_id | uuid | NO | — | FK → `projects.id` |
| backup_type | text | YES | — | |
| snapshot | jsonb | YES | — | |
| status | text | YES | — | |
| notes | text | YES | — | |
| created_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |

### `project_favorites`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| project_id | uuid | NO | — | FK → `projects.id` |
| user_id | uuid | NO | — | |
| created_at | timestamptz | YES | now() | |

### `project_client_access`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| project_id | uuid | NO | — | FK → `projects.id` |
| client_email | text | NO | — | |
| client_name | text | YES | — | |
| password_hash | text | NO | — | |
| access_token | text | NO | gen_random_uuid() | |
| project_slug | text | YES | — | |
| is_active | boolean | YES | true | |
| login_count | integer | YES | 0 | |
| last_login_at | timestamptz | YES | — | |
| revoked_at | timestamptz | YES | — | |
| revoked_by | uuid | YES | — | |
| created_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `project_client_comments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| project_id | uuid | NO | — | FK → `projects.id` |
| milestone_id | uuid | YES | — | FK → `project_milestones.id` |
| comment_text | text | NO | — | |
| sprint_name | text | YES | — | |
| is_visible | boolean | YES | true | |
| created_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

---

## 13. Tasks / Actions

### `tasks`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| title | text | NO | — | |
| description | text | YES | — | |
| slug | text | YES | — | |
| status | text | NO | 'todo' | |
| priority | text | NO | 'medium' | |
| due_date | date | YES | — | |
| position | integer | YES | — | |
| created_by | uuid | NO | — | |
| assigned_to | uuid | YES | — | |
| client_id | uuid | YES | — | FK → `clients.id` |
| meeting_id | uuid | YES | — | FK → `meetings.id` |
| stream_id | uuid | YES | — | FK → `task_streams.id` |
| category_id | uuid | YES | — | FK → `task_categories.id` |
| parent_id | uuid | YES | — | FK → `tasks.id` (self-ref) |
| completed_at | timestamptz | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `task_streams`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| slug | text | YES | — | |
| description | text | YES | — | |
| color | text | YES | — | |
| is_archived | boolean | YES | false | |
| created_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `task_stream_members`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| stream_id | uuid | NO | — | FK → `task_streams.id` |
| user_id | uuid | NO | — | |
| role | text | YES | — | |
| joined_at | timestamptz | YES | now() | |

### `task_categories`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| slug | text | YES | — | |
| color | text | YES | — | |
| sort_order | integer | YES | — | |
| created_at | timestamptz | YES | now() | |

### `task_comments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| task_id | uuid | NO | — | FK → `tasks.id` |
| user_id | uuid | NO | — | |
| content | text | NO | — | |
| is_edited | boolean | YES | false | |
| parent_comment_id | uuid | YES | — | FK → `task_comments.id` (self-ref) |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `task_attachments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| task_id | uuid | NO | — | FK → `tasks.id` |
| file_name | text | NO | — | |
| file_type | text | YES | — | |
| file_size | integer | YES | — | |
| storage_path | text | NO | — | |
| uploaded_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |

### `task_contributors`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| task_id | uuid | NO | — | FK → `tasks.id` |
| user_id | uuid | NO | — | |
| role | text | YES | — | |
| added_at | timestamptz | YES | now() | |

---

## 14. EOS / OKRs

### `eos_vto`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| title | text | NO | — | |
| section | text | NO | — | |
| content | jsonb | YES | — | |
| sort_order | integer | YES | — | |
| updated_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `eos_issues`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| title | text | NO | — | |
| description | text | YES | — | |
| status | text | NO | 'open' | |
| priority | text | NO | 'medium' | |
| category | text | YES | — | |
| source | text | YES | — | |
| is_anonymous | boolean | YES | false | |
| reported_by | uuid | YES | — | |
| assigned_to | uuid | YES | — | |
| pod_id | uuid | YES | — | FK → `eos_pods.id` |
| meeting_id | uuid | YES | — | |
| solved_at | timestamptz | YES | — | |
| archived_at | timestamptz | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `eos_issue_suggestions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| issue_id | uuid | NO | — | FK → `eos_issues.id` |
| suggestion_type | text | NO | — | |
| content | text | NO | — | |
| confidence | numeric | YES | — | |
| ai_model | text | YES | — | |
| status | text | YES | 'pending' | |
| reviewed_by | uuid | YES | — | |
| reviewed_at | timestamptz | YES | — | |
| created_at | timestamptz | YES | now() | |

### `eos_scorecards`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| description | text | YES | — | |
| owner_id | uuid | YES | — | |
| frequency | text | YES | 'weekly' | |
| is_active | boolean | YES | true | |
| created_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `eos_scorecard_metrics`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| scorecard_id | uuid | NO | — | FK → `eos_scorecards.id` |
| name | text | NO | — | |
| description | text | YES | — | |
| metric_type | text | YES | — | |
| target_value | numeric | YES | — | |
| current_value | numeric | YES | — | |
| unit | text | YES | — | |
| goal_direction | text | YES | — | |
| status | text | YES | — | |
| week_of | date | YES | — | |
| sort_order | integer | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `eos_pods`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| description | text | YES | — | |
| color | text | YES | — | |
| lead_id | uuid | YES | — | |
| is_active | boolean | YES | true | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `okrs`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| title | text | NO | — | |
| description | text | YES | — | |
| quarter | text | NO | — | |
| status | text | NO | 'draft' | |
| progress | numeric | YES | 0 | |
| owner_id | uuid | YES | — | |
| pod_id | uuid | YES | — | FK → `eos_pods.id` |
| parent_okr_id | uuid | YES | — | FK → `okrs.id` (self-ref) |
| start_date | date | YES | — | |
| end_date | date | YES | — | |
| created_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `okr_key_results`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| okr_id | uuid | NO | — | FK → `okrs.id` |
| title | text | NO | — | |
| description | text | YES | — | |
| metric_type | text | NO | 'number' | |
| target_value | numeric | NO | — | |
| current_value | numeric | YES | 0 | |
| start_value | numeric | YES | 0 | |
| unit | text | YES | — | |
| status | text | NO | 'not_started' | |
| owner_id | uuid | YES | — | |
| sort_order | integer | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `okr_check_ins`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| key_result_id | uuid | NO | — | FK → `okr_key_results.id` |
| value | numeric | NO | — | |
| notes | text | YES | — | |
| checked_in_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |

### `gwc_assessments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| responsibility_id | uuid | NO | — | FK → `accountability_responsibilities.id` |
| assessor_id | uuid | NO | — | |
| gets_it | boolean | YES | — | |
| wants_it | boolean | YES | — | |
| has_capacity | boolean | YES | — | |
| notes | text | YES | — | |
| assessment_date | date | YES | — | |
| created_at | timestamptz | YES | now() | |

### `accountability_charts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| description | text | YES | — | |
| is_current | boolean | YES | false | |
| version | integer | YES | 1 | |
| published_at | timestamptz | YES | — | |
| published_by | uuid | YES | — | |
| created_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `accountability_responsibilities`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| chart_id | uuid | NO | — | FK → `accountability_charts.id` |
| role_title | text | NO | — | |
| department | text | YES | — | |
| user_id | uuid | YES | — | |
| reports_to | uuid | YES | — | FK → `accountability_responsibilities.id` (self-ref) |
| responsibilities | jsonb | YES | — | |
| sort_order | integer | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

---

## 15. Productivity & HR

### `departments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| description | text | YES | — | |
| manager_id | uuid | YES | — | |
| is_active | boolean | YES | true | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `employee_profiles`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| email | text | NO | — | |
| full_name | text | NO | — | |
| title | text | YES | — | |
| department_id | uuid | YES | — | FK → `departments.id` |
| employment_type | text | YES | — | |
| hire_date | date | YES | — | |
| location | text | YES | — | |
| manager_email | text | YES | — | |
| user_id | uuid | YES | — | |
| is_active | boolean | YES | true | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `employee_skills`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| employee_id | uuid | NO | — | |
| skill_id | uuid | NO | — | FK → `skills.id` |
| proficiency_level | text | YES | — | |
| notes | text | YES | — | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `skills`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| description | text | YES | — | |
| category | text | YES | — | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `pods`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| description | text | YES | — | |
| color | text | YES | — | |
| lead_id | uuid | YES | — | |
| department_id | uuid | YES | — | FK → `departments.id` |
| is_active | boolean | YES | true | |
| show_in_resource_projection | boolean | YES | false | |
| created_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `pod_members`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| pod_id | uuid | NO | — | FK → `pods.id` |
| user_id | uuid | NO | — | |
| role | text | YES | — | |
| joined_at | timestamptz | YES | now() | |

### `pod_employees`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| pod_id | uuid | NO | — | FK → `pods.id` |
| employee_id | uuid | YES | — | |
| user_id | uuid | YES | — | |
| has_login | boolean | YES | — | |
| role | text | YES | — | |
| source | text | YES | — | |
| is_active | boolean | YES | true | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `employee_pods`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| employee_id | uuid | NO | — | |
| pod_id | uuid | NO | — | FK → `pods.id` |
| is_primary | boolean | YES | false | |
| synced_from_hr | boolean | YES | false | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `pod_permissions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| pod_id | uuid | NO | — | FK → `pods.id` |
| module_id | uuid | NO | — | FK → `app_modules.id` |
| created_at | timestamptz | YES | now() | |

### `productivity_records`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| employee_email | text | NO | — | |
| week_start | date | NO | — | |
| week_number | integer | NO | — | |
| year | integer | NO | — | |
| department | text | YES | — | |
| total_hours | numeric | YES | — | |
| billable_hours | numeric | YES | — | |
| utilization_pct | numeric | YES | — | |
| tasks_assigned | integer | YES | — | |
| tasks_completed | integer | YES | — | |
| meetings_attended | integer | YES | — | |
| efficiency_score | numeric | YES | — | |
| attendance_status | text | YES | — | |
| location | text | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `productivity_alerts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| employee_email | text | NO | — | |
| alert_type | text | NO | — | |
| title | text | NO | — | |
| description | text | YES | — | |
| severity | text | YES | — | |
| week_start | date | YES | — | |
| is_read | boolean | YES | false | |
| dismissed_at | timestamptz | YES | — | |
| created_at | timestamptz | YES | now() | |

### `leave_events`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| employee_email | text | NO | — | |
| leave_type | text | NO | — | |
| start_date | date | NO | — | |
| end_date | date | NO | — | |
| is_half_day | boolean | YES | false | |
| status | text | YES | 'approved' | |
| notes | text | YES | — | |
| approved_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |

---

## 16. Integrations

### `integration_categories`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| slug | text | NO | — | |
| description | text | YES | — | |
| icon | text | YES | — | |
| display_order | integer | YES | — | |
| enabled | boolean | YES | true | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `integration_providers`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| category_id | uuid | NO | — | FK → `integration_categories.id` |
| name | text | NO | — | |
| slug | text | NO | — | |
| description | text | YES | — | |
| auth_type | text | NO | 'api_key' | |
| oauth_config | jsonb | YES | — | |
| is_available | boolean | YES | true | |
| is_beta | boolean | YES | false | |
| is_coming_soon | boolean | YES | false | |
| logo_url | text | YES | — | |
| docs_url | text | YES | — | |
| display_order | integer | YES | — | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `integration_fields`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| provider_id | uuid | NO | — | FK → `integration_providers.id` |
| field_key | text | NO | — | |
| label | text | NO | — | |
| field_type | text | NO | 'text' | |
| is_required | boolean | YES | false | |
| is_sensitive | boolean | YES | false | |
| placeholder | text | YES | — | |
| help_text | text | YES | — | |
| default_value | text | YES | — | |
| validation_regex | text | YES | — | |
| select_options | jsonb | YES | — | |
| display_order | integer | YES | — | |
| created_at | timestamptz | NO | now() | |

### `integration_services`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| provider_id | uuid | NO | — | FK → `integration_providers.id` |
| name | text | NO | — | |
| service_key | text | NO | — | |
| description | text | YES | — | |
| features | jsonb | YES | — | |
| cost_model | jsonb | YES | — | |
| has_cost | boolean | YES | false | |
| requires_config | boolean | YES | false | |
| enabled | boolean | YES | true | |
| is_default | boolean | YES | false | |
| is_beta | boolean | YES | false | |
| display_order | integer | YES | — | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `organization_integrations`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | — | FK → `profiles.id` |
| provider_id | uuid | NO | — | FK → `integration_providers.id` |
| config | jsonb | YES | — | |
| oauth_tokens | jsonb | YES | — | |
| connection_status | text | YES | 'pending' | |
| connection_message | text | YES | — | |
| enabled | boolean | YES | true | |
| last_sync_at | timestamptz | YES | — | |
| last_tested_at | timestamptz | YES | — | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `integration_usage_logs`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | YES | — | FK → `profiles.id` |
| provider_id | uuid | YES | — | FK → `integration_providers.id` |
| service_id | uuid | YES | — | FK → `integration_services.id` |
| action | text | NO | — | |
| status | text | NO | 'success' | |
| error_message | text | YES | — | |
| estimated_cost | numeric | YES | — | |
| request_metadata | jsonb | YES | — | |
| response_metadata | jsonb | YES | — | |
| created_at | timestamptz | NO | now() | |

### `oauth_states`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | — | |
| provider_slug | text | NO | — | |
| state | text | NO | — | |
| redirect_url | text | YES | — | |
| metadata | jsonb | YES | — | |
| expires_at | timestamptz | NO | — | |
| created_at | timestamptz | NO | now() | |

### `user_oauth_tokens`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | — | |
| provider_slug | text | NO | — | |
| access_token | text | NO | — | |
| refresh_token | text | YES | — | |
| token_type | text | YES | — | |
| expires_at | timestamptz | YES | — | |
| scopes | text[] | YES | — | |
| account_id | text | YES | — | |
| account_name | text | YES | — | |
| account_email | text | YES | — | |
| account_avatar_url | text | YES | — | |
| is_active | boolean | YES | true | |
| last_refreshed_at | timestamptz | YES | — | |
| last_used_at | timestamptz | YES | — | |
| error_message | text | YES | — | |
| error_at | timestamptz | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

---

## 17. Email & Communications

### `email_logs`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | — | |
| recipient | text | NO | — | |
| recipient_name | text | YES | — | |
| subject | text | NO | — | |
| body_html | text | YES | — | |
| body_text | text | YES | — | |
| cc | text | YES | — | |
| bcc | text | YES | — | |
| status | text | YES | 'pending' | |
| priority | text | YES | — | |
| provider | text | YES | — | |
| provider_message_id | text | YES | — | |
| template_id | uuid | YES | — | FK → `contact_email_templates.id` |
| client_id | uuid | YES | — | FK → `clients.id` |
| contact_id | uuid | YES | — | FK → `contacts.id` |
| scheduled_for | timestamptz | YES | — | |
| sent_at | timestamptz | YES | — | |
| delivered_at | timestamptz | YES | — | |
| opened_at | timestamptz | YES | — | |
| clicked_at | timestamptz | YES | — | |
| error_message | text | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `email_tracking_events`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| contact_id | uuid | YES | — | FK → `contacts.id` |
| activity_id | uuid | YES | — | FK → `contact_activities.id` |
| event_type | text | NO | — | |
| sendgrid_message_id | text | YES | — | |
| sendgrid_event_id | text | YES | — | |
| clicked_url | text | YES | — | |
| user_agent | text | YES | — | |
| ip_address | text | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | YES | now() | |

### `scheduled_emails`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| to_email | text | NO | — | |
| subject | text | NO | — | |
| body | text | NO | — | |
| scheduled_for | timestamptz | NO | — | |
| status | text | YES | 'pending' | |
| sent_at | timestamptz | YES | — | |
| contact_id | uuid | YES | — | FK → `contacts.id` |
| deal_id | uuid | YES | — | FK → `deals.id` |
| created_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |

### `sendgrid_config`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| api_key | text | YES | — | Deprecated |
| api_key_encrypted | text | YES | — | |
| from_email | text | YES | — | |
| from_name | text | YES | — | |
| is_enabled | boolean | YES | false | |
| webhook_url | text | YES | — | |
| webhook_secret | text | YES | — | |
| enable_open_tracking | boolean | YES | true | |
| enable_click_tracking | boolean | YES | true | |
| updated_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

---

## 18. Microsoft Graph

### `graph_webhook_logs`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| subscription_id | text | NO | — | |
| event_type | text | NO | — | |
| processing_status | text | NO | 'pending' | |
| client_state_valid | boolean | NO | true | |
| resource_data | jsonb | YES | — | |
| error_message | text | YES | — | |
| processed_at | timestamptz | YES | — | |
| metadata | jsonb | YES | — | |
| received_at | timestamptz | NO | now() | |

### `graph_webhook_subscriptions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| subscription_id | text | NO | — | |
| resource | text | NO | — | |
| change_types | text[] | NO | — | |
| notification_url | text | NO | — | |
| expiration_datetime | timestamptz | NO | — | |
| client_state | text | NO | — | |
| user_id | uuid | YES | — | |
| is_active | boolean | NO | true | |
| error_count | integer | NO | 0 | |
| last_notification_at | timestamptz | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### `user_microsoft_teams`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | — | |
| team_id | text | NO | — | |
| display_name | text | NO | — | |
| description | text | YES | — | |
| visibility | text | YES | — | |
| web_url | text | YES | — | |
| is_archived | boolean | YES | false | |
| synced_at | timestamptz | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `user_microsoft_teams_channels`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | — | |
| team_id | text | NO | — | |
| channel_id | text | NO | — | |
| display_name | text | NO | — | |
| description | text | YES | — | |
| email | text | YES | — | |
| membership_type | text | YES | — | |
| web_url | text | YES | — | |
| is_favorite | boolean | YES | false | |
| created_date_time | timestamptz | YES | — | |
| synced_at | timestamptz | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

---

## 19. Process & Documents

### `process_categories`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | — | |
| slug | text | NO | — | |
| description | text | YES | — | |
| icon | text | YES | — | |
| sort_order | integer | YES | — | |
| is_active | boolean | YES | true | |
| created_at | timestamptz | YES | now() | |

### `process_documents`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| category_id | uuid | NO | — | FK → `process_categories.id` |
| title | text | NO | — | |
| slug | text | NO | — | |
| content | text | YES | — | |
| file_url | text | YES | — | |
| status | text | YES | 'draft' | |
| version | integer | YES | 1 | |
| tags | text[] | YES | — | |
| published_at | timestamptz | YES | — | |
| created_by | uuid | YES | — | |
| updated_by | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `unified_documents`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| title | text | NO | — | |
| owner_type | text | NO | — | |
| owner_id | text | NO | — | |
| file_name | text | YES | — | |
| file_type | text | YES | — | |
| file_size | integer | YES | — | |
| storage_path | text | YES | — | |
| drive_file_id | text | YES | — | |
| source_id | text | YES | — | |
| processing_status | text | YES | 'pending' | |
| processing_error | text | YES | — | |
| embedding_model | text | YES | — | |
| chunk_count | integer | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

### `processing_queue_history`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| batch_type | text | NO | — | |
| status | text | YES | 'pending' | |
| total_items | integer | YES | — | |
| processed_count | integer | YES | 0 | |
| failed_count | integer | YES | 0 | |
| triggered_by | text | YES | — | |
| started_at | timestamptz | YES | — | |
| completed_at | timestamptz | YES | — | |
| metadata | jsonb | YES | — | |
| created_at | timestamptz | YES | now() | |

---

## 20. System Settings

### `system_settings`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| category | text | NO | — | UNIQUE(category, key) |
| key | text | NO | — | |
| value | jsonb | YES | — | |
| description | text | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

---

## 21. Views

### `pods_with_stats`

Enriched view of `pods` table with member counts.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | |
| name | text | |
| description | text | |
| color | text | |
| is_active | boolean | |
| show_in_resource_projection | boolean | |
| created_by | uuid | |
| rp_members_count | bigint | Members in resource projection |
| hr_synced_count | bigint | HR-synced employees |
| has_login_count | bigint | Employees with login |
| no_login_count | bigint | Employees without login |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `agent_memory_stats`

Per-agent memory statistics.

| Column | Type | Notes |
|--------|------|-------|
| agent_id | uuid | |
| user_id | uuid | |
| total_memories | bigint | |
| active_memories | bigint | |
| short_term_count | bigint | |
| long_term_count | bigint | |
| episodic_count | bigint | |
| avg_importance | numeric | |
| consolidated_count | bigint | |
| recent_memories_7d | bigint | |

### `agent_plan_performance`

Aggregated agent execution plan performance.

| Column | Type | Notes |
|--------|------|-------|
| agent_id | uuid | |
| total_plans | bigint | |
| successful_plans | bigint | |
| failed_plans | bigint | |
| avg_execution_time_ms | numeric | |
| avg_steps | numeric | |
| avg_cost | numeric | |
| avg_tokens | numeric | |
| success_rate | numeric | |

### `agent_learning_summary`

Summary of agent learning events by type.

| Column | Type | Notes |
|--------|------|-------|
| agent_id | uuid | |
| total_events | bigint | |
| feedback_count | bigint | |
| correction_count | bigint | |
| reinforcement_count | bigint | |
| positive_feedback | bigint | |
| negative_feedback | bigint | |

### `contact_email_engagement`

Aggregated email engagement metrics per contact.

| Column | Type | Notes |
|--------|------|-------|
| contact_id | uuid | |
| total_emails | bigint | |
| emails_sent | bigint | |
| emails_opened | bigint | |
| emails_clicked | bigint | |
| open_rate | numeric | |
| click_rate | numeric | |
| last_email_sent | timestamptz | |
| last_email_opened | timestamptz | |
| last_email_clicked | timestamptz | |

### `user_preference_coverage`

Summary of user preference data coverage.

| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid | |
| total_preferences | bigint | |
| explicit_count | bigint | |
| inferred_count | bigint | |
| observed_count | bigint | |
| avg_confidence | numeric | |
| total_usage | bigint | |

---

## 22. Enums

### `app_role`

```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
```

---

## 23. Database Functions

Key database functions (see full definitions in the codebase):

| Function | Purpose |
|----------|---------|
| `handle_new_user()` | Trigger: auto-creates profile on user signup |
| `has_role(user_id, role)` | Check if user has a specific role |
| `get_user_modules()` | Returns active modules for current user |
| `match_embeddings(...)` | Vector similarity search |
| `match_embeddings_admin(...)` | Admin vector search with project/client filters |
| `get_relevant_memories(...)` | Retrieve relevant agent memories by embedding similarity |
| `consolidate_short_term_memories(...)` | Move old short-term memories to long-term |
| `prune_short_term_memories(...)` | Deactivate low-importance old memories |
| `boost_memory_importance(...)` | Increase memory importance score |
| `calculate_contact_lead_score(...)` | Calculate lead score for a contact |
| `update_contact_lead_score()` | Trigger: auto-recalculate on contact update |
| `calculate_next_followup_date()` | Trigger: set next follow-up date |
| `process_sendgrid_event(...)` | Process SendGrid webhook events |
| `sync_pod_employees_from_hr()` | Sync HR employees to pod assignments |
| `admin_exec_sql(...)` | Execute arbitrary SQL (admin only, SECURITY DEFINER) |
| `update_knowledge_search_vector()` | Trigger: update tsvector on knowledge entry change |
| `update_conversation_on_new_message()` | Trigger: update conversation stats on new message |
| `update_mcp_tool_stats()` | Trigger: update tool execution statistics |
| `update_plan_metrics_on_step_completion()` | Trigger: update plan metrics when step completes |
