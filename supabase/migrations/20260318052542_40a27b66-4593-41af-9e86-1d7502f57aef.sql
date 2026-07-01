
INSERT INTO tasks (title, description, status, priority, created_by)
VALUES (
  'Implement 14 Tier 1 AI Agents — Seed into ai_agents table',
  '## Overview

Review **docs/ai-agent-suggestions.md** for the full analysis of 50+ AI agents from the SJ Innovation catalog mapped against this project''s infrastructure.

This task covers the **14 Tier 1 agents** that can be implemented immediately by seeding rows into the `ai_agents` table — no new tables, no new Edge Functions required.

---

## Agents to Implement

| # | Slug | Category | Priority | What It Does |
|---|------|----------|----------|--------------|
| 1 | deal-ai-chat | Sales & CRM | High | Interactive deal strategy chat using deals, contacts, activities data |
| 2 | deal-daily-briefing | Sales & CRM | Medium | Daily summary of pipeline changes, stale deals, upcoming closes |
| 3 | quick-deal-email | Sales & CRM | High | Generate context-aware follow-up emails for deals |
| 4 | lovable-prototype-builder | Sales & CRM | Medium | Generate Lovable prompts for rapid prototyping from deal/project context |
| 5 | client-call-analyzer | Meetings | High | Analyze meeting transcripts for sentiment, action items, risks |
| 6 | client-communication-coach | Meetings | Medium | Coach on communication style based on meeting history |
| 7 | meeting-efficiency-analyzer | Meetings | High | Score meetings on efficiency, suggest improvements |
| 8 | eos-pattern-detective | EOS | Medium | Find recurring patterns in EOS issues across quarters |
| 9 | eos-pod-health | EOS | Medium | Analyze pod health using issues, scorecards, accountability data |
| 10 | eos-quarterly-digest | EOS | High | Generate quarterly EOS performance digest |
| 11 | bug-feature-planner | Project Mgmt | High | Break down bugs/features into actionable tasks with estimates |
| 12 | code-review-generator | Project Mgmt | Medium | Generate code review checklists based on project context |
| 13 | technical-plan-generator | Project Mgmt | High | Create technical implementation plans from requirements |
| 14 | project-analyzer | Project Mgmt | Medium | Analyze project health, risks, timeline adherence |

---

## Implementation Steps

### Step 1: Craft System Prompts
For each agent, write a system prompt that defines the agent''s role, specifies data sources, sets output format, and includes guardrails.

### Step 2: Insert into ai_agents table
Use this SQL pattern:

INSERT INTO ai_agents (name, slug, description, system_prompt, category, is_enabled, welcome_message, conversation_starters, data_sources) VALUES (''Agent Name'', ''agent-slug'', ''Description'', ''System prompt...'', ''category'', true, ''Welcome message'', ''["Starter 1", "Starter 2"]''::jsonb, ''["table1", "table2"]''::jsonb);

### Step 3: Test via AI Hub
1. Navigate to AI Hub
2. Verify each agent appears
3. Test with sample prompts
4. Iterate on system prompts

---

## Acceptance Criteria
- All 14 agents seeded into ai_agents table
- Each agent has a well-crafted system prompt
- Each agent has conversation starters configured
- Each agent has appropriate data_sources JSON
- All agents visible and runnable in AI Hub
- High-priority agents tested with at least 3 sample prompts each

## Reference
- Full analysis: docs/ai-agent-suggestions.md
- Existing agents: SELECT slug, name FROM ai_agents ORDER BY category;
- Edge function: run-ai-agent (generic agent runner)',
  'todo',
  'high',
  (SELECT id FROM profiles LIMIT 1)
);
