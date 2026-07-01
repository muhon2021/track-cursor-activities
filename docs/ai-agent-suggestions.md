# AI Agent Implementation Suggestions

> **Source:** SJ Innovation Control Tower AI Agents Catalog v1.0  
> **Target:** This Control Tower instance  
> **Analyzed:** March 18, 2026  
> **Analyst Role:** Product Manager

---

## Executive Summary

The SJ Innovation Control Tower catalog defines **50+ AI agents** across 9 categories. After mapping each agent against this project's existing database schema, edge functions, and `run-ai-agent` infrastructure, we categorize them into 4 implementation tiers:

| Tier | Count | Effort | Description |
|------|-------|--------|-------------|
| **Tier 1: Seed Now** | 14 | Zero code — just insert rows into `ai_agents` | Data sources exist, `run-ai-agent` works as-is |
| **Tier 2: Minor Work** | 10 | New edge function or small UI additions | Data tables exist but need specialized logic |
| **Tier 3: Infrastructure Needed** | 12 | New tables or major edge function work | Missing data sources or complex orchestration |
| **Tier 4: Not Applicable** | 14+ | External integrations not present | HubSpot, ActiveCollab-specific, Google Workspace sync |

**The single biggest unlock:** Enhancing `run-ai-agent` to auto-fetch data from the DB based on the agent's `data_sources` JSON config. Currently it just passes user input + system prompt to OpenAI — no context enrichment. Adding a data-fetching layer would convert many Tier 2 agents into Tier 1.

---

## Infrastructure Assessment

### What We Have

| Component | Details |
|-----------|---------|
| **Generic agent runner** | `run-ai-agent` edge function — loads agent config, sends system prompt + user input to OpenAI `gpt-4o-mini`, logs to `ai_agent_runs` |
| **AI provider** | OpenAI only (edge functions). No Gemini/Perplexity/Anthropic wired |
| **Agent chat** | `agent-chat-stream`, `agent-conversation-chat`, `ai-chat-assistant` — streaming multi-turn conversations |
| **Agent memory** | `extract-agent-memories`, `retrieve-agent-memories`, `consolidate-agent-memories` |
| **RAG/Search** | `semantic-search`, `unified-knowledge-search`, `gemini-rag-query`, `generate-embeddings` |
| **Orchestration** | `orchestrate-agent-team` — multi-agent collaboration |
| **Guardrails** | `enforce-guardrails`, `validate-guardrails`, `request-approval`, `respond-to-approval` |
| **MCP** | `execute-mcp-tool`, `verify-mcp-server` |

### Key Database Tables Available

**CRM/Sales:** `clients`, `contacts`, `deals`, `deal_activities`, `deal_comments`  
**Projects:** `projects`, `project_milestones`, `project_billing`, `project_risks`, `project_invoices`, `tasks`  
**Meetings:** `meetings`, `zoom_files`, `meeting_transcripts` (no `meetings_v2` or `meeting_takeaways_v2`)  
**EOS:** `eos_issues`, `accountability_charts`, `accountability_responsibilities`, `okrs` (no `quarterly_rocks`, `eos_issue_comments`)  
**Knowledge:** `knowledge_entries`, `knowledge_files`, `knowledge_categories`, `knowledge_sources`, `common_knowledge`, `embeddings`  
**People:** `employee_profiles`, `pods`, `employee_pods`, `employee_skills`, `departments`  
**AI:** `ai_agents`, `ai_agent_runs`, `ai_agent_categories`, `ai_chat_history`, `ai_models`, `ai_providers`, `ai_usage_logs`, `ai_productivity_insights`  
**Email:** `email_logs`, `contact_email_templates`, `email_tracking_events`

### Tables NOT Present (from catalog's data sources)

`meetings_v2`, `meeting_takeaways_v2`, `activecollab_tasks`, `activecollab_time_records`, `quarterly_rocks`, `eos_issue_comments`, `client_research`, `lead_follow_up_contacts`, `user_knowledge`, `common_knowledge_files`, `client_documents`, `task_ai_cache`, `ai_insights`, `pod_weekly_ai_summaries`, `project_weekly_updates`, `invoices`, `expenses`, `company_goals`, `key_results`

### Existing Edge Functions That Map to Catalog Agents

| Catalog Agent | Existing Edge Function | Status |
|---------------|----------------------|--------|
| Deal Coach | `deal-coach` | ✅ Already exists |
| Lead Follow-Up Research | `lead-followup-research` | ✅ Already exists |
| Meeting Issue Reporter | `extract-meeting-issues` | ✅ Already exists |
| Meeting Efficiency Analyzer | `meeting-efficiency-analyzer` | ✅ Already exists |
| Smart Meeting Categorizer | `categorize-meeting` | ✅ Already exists |
| EOS Triage Assistant | `eos-triage-assistant` | ✅ Already exists |
| Meeting Summary | `generate-meeting-summary`, `generate-meeting-summary-v2` | ✅ Already exists |
| OKR Suggestions | `suggest-okrs` | ✅ Already exists |
| OKR Progress Analysis | `analyze-okr-progress` | ✅ Already exists |
| Unified Knowledge Search | `unified-knowledge-search` | ✅ Already exists |
| Gemini RAG Query | `gemini-rag-query` | ✅ Already exists |
| Quarterly Digest | `quarterly-digest` | ✅ Already exists |

---

## Tier 1: Implement Now (Seed `ai_agents` rows only)

These agents can be implemented by inserting a row into `ai_agents` with a well-crafted `system_prompt`. The user provides context via the "Run Agent" modal or chat interface. No new edge functions or tables required.

| # | Agent Slug | Category | Why It Works | Priority |
|---|-----------|----------|-------------|----------|
| 1 | `deal-ai-chat` | Sales & CRM | `deals`, `clients`, `contacts` all exist. Conversational agent — user pastes deal context, agent responds. Uses `run-ai-agent`. | 🔴 High |
| 2 | `deal-daily-briefing` | Sales & CRM | User can trigger manually, providing deal pipeline summary as input. Agent generates briefing from prompt alone. | 🟡 Medium |
| 3 | `quick-deal-email` | Sales & CRM | Same as email-draft-generator pattern. User provides deal context → agent drafts email. | 🔴 High |
| 4 | `lovable-prototype-builder` | Sales & CRM | Pure prompt-based — user describes deal/project, agent generates prototype spec. No special data needed. | 🟡 Medium |
| 5 | `client-call-analyzer` | Meetings | User pastes transcript or meeting notes → agent analyzes sentiment, concerns, opportunities. `zoom_files` exists for context. | 🔴 High |
| 6 | `client-communication-coach` | Meetings | Advisory agent — user describes client interaction patterns, agent coaches. | 🟡 Medium |
| 7 | `meeting-efficiency-analyzer` | Meetings | Edge function already exists. Seed `ai_agents` row to make it accessible from AI Hub UI. | 🔴 High |
| 8 | `eos-pattern-detective` | EOS | `eos_issues` exists. User provides issue context → agent detects patterns. No `quarterly_rocks` needed for basic version. | 🟡 Medium |
| 9 | `eos-pod-health` | EOS | `accountability_charts`, `eos_issues`, `pods` all exist. User provides pod context. | 🟡 Medium |
| 10 | `eos-quarterly-digest` | EOS | Edge function `quarterly-digest` exists. Seed agent row for UI access. | 🔴 High |
| 11 | `bug-feature-planner` | Project Mgmt | Pure prompt agent — user pastes bug report/feature request, agent generates implementation plan. | 🔴 High |
| 12 | `code-review-generator` | Project Mgmt | User pastes code or PR description → agent generates review. No data dependencies. | 🟡 Medium |
| 13 | `technical-plan-generator` | Project Mgmt | User provides requirements → agent creates technical plan. Prompt-only. | 🔴 High |
| 14 | `project-analyzer` | Project Mgmt | `projects` table exists. User provides project context, agent analyzes. Basic version works without `activecollab_tasks`. | 🟡 Medium |

### Implementation Steps (for the assignee)

1. For each agent above, insert a row into `ai_agents` table:
   ```sql
   INSERT INTO ai_agents (name, slug, description, system_prompt, category, is_enabled)
   VALUES (
     'Agent Name',
     'agent-slug',
     'Description from catalog',
     'Detailed system prompt tailored to this agent''s role...',
     'category-slug',
     true
   );
   ```
2. Craft detailed system prompts that guide the model on expected input format and output structure.
3. Optionally set `data_sources` JSON for future auto-enrichment (when `run-ai-agent` supports it).
4. Test via the AI Hub → Run Agent modal.

---

## Tier 2: Minor Work (New edge function or small enhancements)

These agents need a dedicated edge function because they require server-side data fetching, but the underlying data tables already exist.

| # | Agent Slug | Category | What's Needed | Data Available? | Priority |
|---|-----------|----------|--------------|----------------|----------|
| 1 | `email-draft-generator` | Sales & CRM | New `generate-email-draft` edge function that fetches deal + client + contact data before calling LLM | ✅ `deals`, `clients`, `contacts`, `email_logs` | 🔴 High |
| 2 | `sow-generator` | Sales & CRM | New `generate-sow` edge function with PDF generation (jspdf already installed) | ✅ `deals`, `clients`, `projects` | 🔴 High |
| 3 | `meeting-intelligence` | Meetings | Enhance existing `generate-meeting-summary-v2` to extract issues, action items, sentiment in one pass | ✅ `zoom_files`, `meetings` | 🟡 Medium |
| 4 | `smart-meeting-categorizer` | Meetings | Edge function `categorize-meeting` exists — just needs `ai_agents` row + possibly small enhancements | ✅ `zoom_files`, `meetings` | 🟢 Low |
| 5 | `meeting-issue-reporter` | Meetings | Edge function `extract-meeting-issues` exists — seed agent row + ensure UI integration | ✅ `zoom_files`, `eos_issues` | 🟡 Medium |
| 6 | `accountability-overlap-analyzer` | EOS | New edge function that queries `accountability_responsibilities` and uses LLM to detect overlaps | ✅ `accountability_charts`, `accountability_responsibilities` | 🟡 Medium |
| 7 | `accountability-chart-reminder` | EOS | New edge function for scheduled email reminders (SendGrid exists) | ✅ `accountability_charts`, `employee_profiles` | 🟢 Low |
| 8 | `accountability-manager-nudge` | EOS | Similar to above — monthly nudge edge function | ✅ `accountability_charts`, `employee_profiles` | 🟢 Low |
| 9 | `accountability-revisit-reminder` | EOS | Similar scheduled edge function | ✅ `accountability_charts`, `employee_profiles` | 🟢 Low |
| 10 | `hr-request-processing` | HR | New `process-hr-request` edge function — could use `tasks` table for tracking HR requests | Partial — no dedicated HR tables but `tasks` works | 🟢 Low |

### Implementation Steps

1. Create edge function in `supabase/functions/<name>/index.ts` following existing patterns.
2. Add CORS, auth middleware, OpenAI call.
3. Register in `supabase/config.toml`.
4. Insert `ai_agents` row.
5. Deploy via `supabase functions deploy <name>`.

---

## Tier 3: Infrastructure Needed (New tables or major work)

These agents require database tables or data pipelines that don't exist in this project yet.

| # | Agent Slug | Category | Missing Infrastructure | Effort | Priority |
|---|-----------|----------|----------------------|--------|----------|
| 1 | `company-research` | Sales & CRM | Needs `client_research` table + Perplexity API integration | Medium — new table + new provider | 🟡 Medium |
| 2 | `contact-research` | Sales & CRM | Same as above — `client_research` table + Perplexity provider | Medium | 🟡 Medium |
| 3 | `weekly-update-generator` | Project Mgmt | Needs `project_weekly_updates` table + task aggregation from external PM tools | High — depends on PM tool sync | 🔴 High |
| 4 | `pm-comment-staleness-alert` | Project Mgmt | Rule-based but needs external PM task data (`activecollab_tasks` or equivalent) | Medium | 🟢 Low |
| 5 | `task-ai-chat` | Tasks | Needs `task-ai-agent` edge function + `task_ai_cache` table | Medium — new edge function + table | 🟡 Medium |
| 6 | `task-ai-summary` | Tasks | Same infrastructure as task-ai-chat | Medium | 🟡 Medium |
| 7 | `task-ai-research` | Tasks | Same + web search integration | High | 🟢 Low |
| 8 | `task-ai-planner` | Tasks | Same + subtask creation logic | Medium | 🟡 Medium |
| 9 | `pod-weekly-ai-summary` | Productivity | Needs `pod_weekly_ai_summaries` table + productivity data pipeline | High — complex data aggregation | 🟡 Medium |
| 10 | `employee-productivity` | Productivity | Needs `EmployeeProductivity` equivalent table + time tracking data | High | 🟡 Medium |
| 11 | `ai-productivity-insight` | Productivity | Needs `ai_insights` table + productivity metrics pipeline | High | 🟢 Low |
| 12 | `weekly-productivity-digest` | Productivity | Needs productivity data + scheduled email pipeline | High | 🟢 Low |

### What the Assignee Should Know

- **Task AI Suite (4 agents):** If task management is a priority, create a `task_ai_cache` table and a `task-ai-agent` edge function that handles chat/summary/research/plan actions. This unlocks 4 agents at once.
- **Productivity Suite (4 agents):** Requires employee productivity tracking data. If the project integrates time-tracking tools, these become viable.
- **Research Agents (2 agents):** Requires adding Perplexity as an AI provider and creating a `client_research` table for caching results.

---

## Tier 4: Not Applicable (External dependencies not present)

These agents are tightly coupled to external services or data sources not present in this project.

| # | Agent Slug | Category | Blocker |
|---|-----------|----------|---------|
| 1-8 | HubSpot sync agents (8+) | Integration | No HubSpot integration — `sync-hubspot-*` functions not applicable |
| 9-15 | ActiveCollab sync agents (7+) | Integration | No ActiveCollab — `sync-activecollab-*` not applicable |
| 16-18 | Google Workspace sync (3) | Integration | No Google Drive/Gmail/Calendar sync configured |
| 19-21 | Zoom sync agents (3) | Integration | `sync-zoom-files` exists but `sync-zoom-transcripts` and `process-zoom-recording` may need enhancement |
| 22 | Workboard sync | Integration | No Workboard integration |

**Note:** ClickUp and Workamajig sync functions were just deployed, so agents that reference those integrations may become viable once data flows in.

---

## Infrastructure Recommendations

### Priority 1: Enhance `run-ai-agent` with Data Enrichment

**Impact:** Converts 8+ Tier 2 agents into Tier 1  
**Current limitation:** `run-ai-agent` receives user input and system prompt, calls OpenAI, returns output. It does NOT fetch any data from the database.  
**Recommended change:** Read the agent's `data_sources` JSON config, fetch relevant records from those tables (with user-scoped RLS), and inject them into the system prompt or as a separate context message.

```
// Pseudocode for enhanced run-ai-agent
const agent = await getAgent(agent_id);
let contextData = '';
if (agent.data_sources) {
  for (const source of agent.data_sources) {
    const records = await fetchFromTable(source.table, source.filters);
    contextData += formatRecords(source.table, records);
  }
}
// Send to LLM with enriched context
messages = [
  { role: 'system', content: agent.system_prompt },
  { role: 'system', content: `Context data:\n${contextData}` },
  { role: 'user', content: userInput }
];
```

### Priority 2: Add Perplexity AI Provider

**Impact:** Unlocks research agents (`company-research`, `contact-research`, `lead-followup-research`)  
**Work:** Add `PERPLEXITY_API_KEY` as edge function secret, create a provider entry in `ai_providers`, update `run-ai-agent` to route to Perplexity when agent config specifies it.

### Priority 3: Multi-Model Support in `run-ai-agent`

**Impact:** Better model selection per agent (currently hardcoded to `gpt-4o-mini`)  
**Work:** Read `provider_config` from the `ai_agents` table, route to the appropriate provider/model. The `ai_models` and `ai_providers` tables already exist — just need the edge function to use them.

### Priority 4: Create `task_ai_cache` Table

**Impact:** Unlocks 4 Task AI agents  
**Work:** Simple table with `task_id`, `action` (summary/research/plan/chat), `result`, `created_at`, `expires_at`. Plus a `task-ai-agent` edge function.

---

## Per-Agent Detail Table

| # | Slug | Category | Tier | Existing EF? | Data Ready? | Priority | Notes |
|---|------|----------|------|-------------|-------------|----------|-------|
| 1 | `deal-coach` | Sales | — | ✅ `deal-coach` | ✅ | — | **Already exists** |
| 2 | `deal-ai-chat` | Sales | 1 | `run-ai-agent` | ✅ | 🔴 High | Seed agent row |
| 3 | `deal-daily-briefing` | Sales | 1 | `run-ai-agent` | ✅ | 🟡 Med | Seed agent row |
| 4 | `quick-deal-email` | Sales | 1 | `run-ai-agent` | ✅ | 🔴 High | Seed agent row |
| 5 | `email-draft-generator` | Sales | 2 | Need new | ✅ | 🔴 High | New EF for data fetch |
| 6 | `lead-followup-research` | Sales | — | ✅ exists | Partial | — | **Already exists** — needs Perplexity key |
| 7 | `company-research` | Sales | 3 | Need new | ❌ `client_research` | 🟡 Med | New table + Perplexity |
| 8 | `contact-research` | Sales | 3 | Need new | ❌ `client_research` | 🟡 Med | New table + Perplexity |
| 9 | `lovable-prototype-builder` | Sales | 1 | `run-ai-agent` | ✅ | 🟡 Med | Seed agent row |
| 10 | `sow-generator` | Sales | 2 | Need new | ✅ | 🔴 High | New EF + PDF gen |
| 11 | `meeting-intelligence` | Meetings | 2 | Partial | ✅ | 🟡 Med | Enhance existing summary EF |
| 12 | `client-call-analyzer` | Meetings | 1 | `run-ai-agent` | ✅ | 🔴 High | Seed agent row |
| 13 | `meeting-issue-reporter` | Meetings | 2 | ✅ exists | ✅ | 🟡 Med | Seed row, exists as EF |
| 14 | `meeting-efficiency-analyzer` | Meetings | 1 | ✅ exists | ✅ | 🔴 High | Seed row, EF exists |
| 15 | `smart-meeting-categorizer` | Meetings | 2 | ✅ exists | ✅ | 🟢 Low | Seed row, EF exists |
| 16 | `client-communication-coach` | Meetings | 1 | `run-ai-agent` | ✅ | 🟡 Med | Seed agent row |
| 17 | `project-analyzer` | PM | 1 | `run-ai-agent` | Partial | 🟡 Med | Works without AC tasks |
| 18 | `weekly-update-generator` | PM | 3 | Need new | ❌ | 🔴 High | Needs `project_weekly_updates` + PM tool data |
| 19 | `pm-comment-staleness-alert` | PM | 3 | Need new | ❌ | 🟢 Low | Needs PM tool task data |
| 20 | `bug-feature-planner` | PM | 1 | `run-ai-agent` | ✅ | 🔴 High | Seed agent row |
| 21 | `code-review-generator` | PM | 1 | `run-ai-agent` | ✅ | 🟡 Med | Seed agent row |
| 22 | `technical-plan-generator` | PM | 1 | `run-ai-agent` | ✅ | 🔴 High | Seed agent row |
| 23 | `task-ai-chat` | Tasks | 3 | Need new | ❌ `task_ai_cache` | 🟡 Med | New EF + table |
| 24 | `task-ai-summary` | Tasks | 3 | Need new | ❌ | 🟡 Med | Same infra as above |
| 25 | `task-ai-research` | Tasks | 3 | Need new | ❌ | 🟢 Low | Same + web search |
| 26 | `task-ai-planner` | Tasks | 3 | Need new | ❌ | 🟡 Med | Same infra |
| 27 | `eos-triage-assistant` | EOS | — | ✅ exists | ✅ | — | **Already exists** |
| 28 | `eos-pattern-detective` | EOS | 1 | `run-ai-agent` | Partial | 🟡 Med | Works without `quarterly_rocks` |
| 29 | `eos-pod-health` | EOS | 1 | `run-ai-agent` | ✅ | 🟡 Med | Seed agent row |
| 30 | `eos-quarterly-digest` | EOS | 1 | ✅ `quarterly-digest` | ✅ | 🔴 High | Seed row, EF exists |
| 31 | `accountability-chart-reminder` | EOS | 2 | Need new | ✅ | 🟢 Low | Scheduled email EF |
| 32 | `accountability-manager-nudge` | EOS | 2 | Need new | ✅ | 🟢 Low | Scheduled email EF |
| 33 | `accountability-revisit-reminder` | EOS | 2 | Need new | ✅ | 🟢 Low | Scheduled email EF |
| 34 | `accountability-overlap-analyzer` | EOS | 2 | Need new | ✅ | 🟡 Med | New EF for analysis |
| 35 | `pod-weekly-ai-summary` | Productivity | 3 | Need new | ❌ | 🟡 Med | Complex pipeline |
| 36 | `employee-productivity` | Productivity | 3 | Need new | ❌ | 🟡 Med | Needs productivity data |
| 37 | `ai-productivity-insight` | Productivity | 3 | Need new | Partial | 🟢 Low | `ai_productivity_insights` exists |
| 38 | `weekly-productivity-digest` | Productivity | 3 | Need new | ❌ | 🟢 Low | Needs data pipeline |
| 39 | `unified-knowledge-search` | Knowledge | — | ✅ exists | ✅ | — | **Already exists** |
| 40 | `unified-rag-search` | Knowledge | 2 | Partial | ✅ | 🟡 Med | Enhance existing search |
| 41 | `gemini-rag-query` | Knowledge | — | ✅ exists | ✅ | — | **Already exists** |
| 42 | `hr-request-processing` | HR | 2 | Need new | Partial | 🟢 Low | Can use `tasks` table |
| 43+ | HubSpot sync (8+) | Integration | 4 | ❌ | ❌ | — | Not applicable |
| 50+ | ActiveCollab sync (7+) | Integration | 4 | ❌ | ❌ | — | Not applicable |

---

## Recommended Implementation Order

### Sprint 1: Quick Wins (1-2 days)
Seed 14 Tier 1 agents into `ai_agents` table with crafted system prompts. Immediate value, zero risk.

### Sprint 2: High-Priority Tier 2 (3-5 days)
1. `generate-email-draft` edge function
2. `generate-sow` edge function with PDF
3. Wire existing EFs (`meeting-issue-reporter`, `meeting-efficiency-analyzer`, `categorize-meeting`) to `ai_agents` rows

### Sprint 3: Infrastructure (1-2 weeks)
1. Enhance `run-ai-agent` with data enrichment from `data_sources`
2. Add multi-model support (read `provider_config` from `ai_agents`)
3. Create `task_ai_cache` table + `task-ai-agent` edge function

### Sprint 4: Research & Productivity (2-3 weeks)
1. Add Perplexity AI provider for research agents
2. Create `client_research` table
3. Build productivity data pipeline if time-tracking is available

---

## Appendix: Model Mapping

The SJ Innovation catalog uses Gemini 3.0 as the default model. This project currently uses OpenAI `gpt-4o-mini` exclusively. For Tier 1 agents, `gpt-4o-mini` is sufficient. For production quality, consider:

| SJ Innovation Model | This Project Equivalent | Notes |
|---------------------|------------------------|-------|
| Gemini 3.0 | `gpt-4o-mini` or `gpt-4o` | Upgrade to `gpt-4o` for analysis-heavy agents |
| Gemini 2.5 Flash | `gpt-4o-mini` | Good fit — fast, cheap |
| O3-mini | `gpt-4o-mini` | Similar tier |
| Claude 4.5 Sonnet | Not available | Would need Anthropic provider |
| Perplexity Sonar | Not available | Would need Perplexity provider |

---

*Document prepared for implementation handoff. No database changes, schema modifications, or structural changes are proposed — only agent configurations and edge functions.*
