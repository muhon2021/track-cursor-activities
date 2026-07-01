# Agent Registry for SJ Control Tower Framework

## Overview

This project has 11 specialized agents for delegating complex tasks. Claude Code automatically selects the appropriate agent based on the user's request. Each agent is deeply customized with this project's actual code patterns, file structure, database schema, and conventions.

## Agent Roster

| #   | Agent                  | Purpose                                                | Tools                               | Mode         |
| --- | ---------------------- | ------------------------------------------------------ | ----------------------------------- | ------------ |
| 1   | react-frontend-dev     | UI components, pages, hooks, forms, routing, styling   | Read, Write, Edit, Bash, Glob, Grep | Builder      |
| 2   | supabase-backend-dev   | Database, Edge Functions, RLS, auth, migrations        | Read, Write, Edit, Bash, Glob, Grep | Builder      |
| 3   | code-reviewer          | Code quality enforcement, convention checks            | Read, Grep, Glob                    | Read-only    |
| 4   | debugger               | Bug investigation, error analysis, RLS debugging       | Read, Edit, Bash, Glob, Grep        | Investigator |
| 5   | documentation-engineer | Specs, docs, implementation guides, CLAUDE.md          | Read, Write, Edit, Glob, Grep       | Writer       |
| 6   | performance-engineer   | Performance optimization, profiling, bundle analysis   | Read, Edit, Bash, Glob, Grep        | Optimizer    |
| 7   | refactoring-specialist | Safe code restructuring, tech debt cleanup             | Read, Write, Edit, Bash, Glob, Grep | Builder      |
| 8   | security-auditor       | Security scanning, vulnerability detection, RLS audit  | Read, Grep, Glob                    | Read-only    |
| 9   | typescript-pro         | Type safety, generics, zero `any`, Zod alignment       | Read, Write, Edit, Glob, Grep       | Builder      |
| 10  | test-automator         | Unit tests, integration tests, RLS tests, Vitest setup | Read, Write, Edit, Bash, Glob, Grep | Builder      |
| 11  | edge-function-doctor   | Edge Function audit, fix, creation, non-2xx diagnosis  | Read, Write, Edit, Bash, Glob, Grep | Specialist   |

## Session Rules

### Pre-Commit Type Safety (MANDATORY)

**Before EVERY Claude Code session is committed:**

1. **Read `.claude/SESSION_TEMPLATE.md`** — use this structure for all prompts
2. **Read `.claude/PRE_COMMIT_CHECKLIST.md`** — verify all 6 sections pass
3. **Read `.claude/skills/type-safety-patterns/SKILL.md`** — follow the 5 patterns
4. **Run `npm run lint && npm run build:dev`** — fix any errors
5. **Commit only when all checks pass** — never merge with TypeScript errors

If a session creates type errors, use the **typescript-pro** agent to audit before commit.

Type safety is non-negotiable.

## Auto-Delegation Rules

### Pre-Commit Type Safety

Before ANY TypeScript code is committed:
- Run the **type-safety-patterns** skill for pattern guidance
- Check `.claude/PRE_COMMIT_CHECKLIST.md` for all verification steps
- Assign to **typescript-pro** agent for review if complex types involved

### Single-Agent Triggers

| User Says                                                                  | Invoke                     |
| -------------------------------------------------------------------------- | -------------------------- |
| "Fix bug / error / broken / crash / blank screen / not working"            | **debugger**               |
| "Review code / check quality / before PR / audit code"                     | **code-reviewer**          |
| "Write spec / create docs / implementation guide / update docs"            | **documentation-engineer** |
| "Create component / page / form / UI / hook / routing"                     | **react-frontend-dev**     |
| "Create table / migration / RLS / database"                                | **supabase-backend-dev**   |
| "Edge Function / non-2xx / CORS error / 500/503/504/546 / function deploy" | **edge-function-doctor**   |
| "Page is slow / optimize / performance / bundle size / re-renders"         | **performance-engineer**   |
| "Refactor / clean up / split component / tech debt / extract hook"         | **refactoring-specialist** |
| "Security review / audit / check vulnerabilities / RLS audit"              | **security-auditor**       |
| "Fix types / remove any / type error / generics / strict types"            | **typescript-pro**         |
| "Write tests / add coverage / test this / unit test / integration test"    | **test-automator**         |

### Multi-Agent Workflows

#### New Feature (full workflow)

1. **documentation-engineer** → write spec first (specs before code, always)
2. **supabase-backend-dev** → create tables, RLS policies, Edge Functions
3. **react-frontend-dev** → build UI components, pages, hooks
4. **typescript-pro** → verify type safety across new code
5. **test-automator** → write unit and integration tests
6. **code-reviewer** → final quality check
7. **security-auditor** → security review (if feature handles sensitive data)

#### Bug Fix

1. **debugger** → investigate root cause (follows sj-bug-fix-workflow skill)
2. **react-frontend-dev** OR **supabase-backend-dev** → apply the fix
3. **test-automator** → write regression test
4. **code-reviewer** → verify fix quality

#### Refactor Sprint

1. **code-reviewer** → identify all issues and anti-patterns
2. **refactoring-specialist** → restructure code safely (zero behavior change)
3. **typescript-pro** → improve types and eliminate `any`
4. **performance-engineer** → verify no performance regression
5. **test-automator** → verify no behavior change
6. **code-reviewer** → final check

#### Pre-Release Checklist

1. **code-reviewer** → full quality scan
2. **security-auditor** → security audit (especially RLS coverage)
3. **performance-engineer** → performance check (bundle, queries, re-renders)
4. **test-automator** → run/verify all tests pass

#### Tech Debt Cleanup

1. **code-reviewer** → identify debt areas
2. **typescript-pro** → fix all type issues (`any`, missing interfaces)
3. **refactoring-specialist** → restructure messy code
4. **performance-engineer** → optimize slow areas
5. **test-automator** → add missing test coverage

#### New Edge Function

1. **edge-function-doctor** → verify config.toml entry exists FIRST (create if missing)
2. **supabase-backend-dev** → create function using gold standard template
3. **edge-function-doctor** → audit new function against mandatory checklist
4. **code-reviewer** → verify CORS, auth, error handling patterns
5. **security-auditor** → verify auth requirements and input validation

#### Database Schema Change

1. **documentation-engineer** → document schema change spec
2. **supabase-backend-dev** → write migration, RLS policies, indexes, FK constraints
3. **supabase-backend-dev** → regenerate Supabase types (`types.ts`)
4. **security-auditor** → verify RLS policies and FK constraints are correct
5. **react-frontend-dev** → update frontend hooks and types
6. **typescript-pro** → ensure new types are integrated, eliminate any `as any` workarounds

## Project-Specific Context

- **Project**: SJ Control Tower Framework (SJ Innovation Framework V1)
- **Domain**: Enterprise business management platform
- **Stack**: React 18.3, TypeScript 5.8, Vite 5.4, Supabase, Tailwind CSS 3.4, shadcn/ui
- **Core Tables**: profiles, user_roles, roles, clients, meetings, meeting_transcripts, knowledge_entries, embeddings, ai_agents, ai_agent_runs, ai_chat_history, tasks, projects, project_milestones, app_config, app_modules, user_module_permissions, activity_logs, notifications, feedback, deals, contacts, zoom_files, knowledge_files, knowledge_categories, knowledge_sources, mcp_servers, oauth_clients, user_integrations, approvals, follow_up_contacts, follow_up_interactions, follow_up_emails
- **Edge Functions**: 118 Deno-based serverless functions in `supabase/functions/`
- **Key Modules**: platform (core), admin (core), eos, meetings, projects, actions, business-dev, lead-followup, knowledge, productivity
- **Custom Hooks**: 70+ in `src/hooks/`
- **Pages**: 26 in `src/pages/`
- **Active Work**: AI agents, lead follow-up, productivity metrics, OKR module
- **Known Debt**: No test suite configured, TypeScript strict mode disabled, some `any` types in hooks, no code splitting/lazy loading, some large components >200 lines
