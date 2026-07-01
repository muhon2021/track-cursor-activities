# Control Tower Technical System Guide (Current State)

_Last updated: 2026-04-16_

This is the **single source of truth** for how the platform is currently implemented across frontend features, agent capabilities, backend services, and system design.

## 1) Product + Technical Architecture (at a glance)

Control Tower is a modular React + Supabase platform with:

- **Frontend shell** built in React 18 + TypeScript with route-level module composition.
- **9 functional modules** (platform core, EOS, meetings, projects, actions, business-dev, knowledge, productivity, admin).
- **Supabase backend** for auth, Postgres data, storage, and edge functions.
- **AI/Agent layer** for chat, orchestration, semantic retrieval, memory, guardrails, and meeting intelligence.
- **Integration layer** for Zoom, Google, Microsoft, ActiveCollab, ClickUp, Jira, Zoho, and OAuth provider plumbing.

## 2) Frontend Design and Route Architecture

The app root (`src/App.tsx`) composes routing in a predictable sequence:

1. Public routes (login/signup/callback pages).
2. Client portal public dashboards.
3. Protected dashboard routes (core + feature modules).
4. Admin-only route tree.
5. Catch-all 404.

### Shared UX/infra providers

- `QueryClientProvider` for data caching.
- `ThemeProvider` + `ThemeSync` for dark/light consistency.
- `AuthProvider` and protected route wrappers.
- `BrandingProvider` for organization-level brand customization.
- Global toasts/notifications (`Toaster`, `Sonner`).

## 3) Module Feature Inventory

### Platform Core

Core routes include dashboard, profile, settings, sessions, help, feedback, notifications, and auth/legal pages.

AI agent browsing routes (`/ai-agents`, `/agents`, `/agents/:slug`) are owned by platform but gated by feature flags.

### EOS

- EOS hub (`/eos`)
- VTO (`/eos/vto`)
- OKRs (`/okrs`)
- Issues suite (all/solved/archived/anonymous/AI/pod views)
- Scorecard + Accountability views

### Meetings

- Schedule + meeting detail (slug/id support)
- Transcripts + transcript detail
- Series, AI matching, pending assignment queues
- Fellow action item workflow
- Knowledge-meetings integration routes

### Projects

- Project list and create/edit
- Project detail tabs and performance
- Project knowledge workspace
- AI issue analysis routes

### Actions (Task System)

- My Tasks workspace (`/tasks`)
- Stream catalog + stream-specific views
- Task detail by id or slug
- Legacy route redirects preserved for backwards compatibility

### Business Development

- Clients CRUD + client knowledge
- Deals pipeline with detail + edit
- Contacts directory + contact detail
- Lead follow-up AI workflow (drafting, analysis, communication, admin)

### Knowledge Base

- Org knowledge list/detail/create/edit
- Upload pipeline
- Category browsing
- Personal knowledge and semantic search

### Productivity

- Productivity dashboard
- Employee detail
- Pod management
- Process documentation with nested category/slug routes

### Admin

The `/admin/*` surface is extensive and includes:

- Users, roles, logs
- System settings + module settings + widgets
- Integrations administration and analytics
- AI model/admin analytics + prompt templates
- Memory analytics and embedding exploration
- EOS admin workspaces
- Knowledge admin operations (categories/sources/files/sync)
- Team operations (employees, pods, projections, departments)
- Environment/deployment/onboarding checklists

## 4) Agent-First Capability Model

Agent functionality is delivered through both frontend workflows and backend edge functions:

- **Interactive agent execution:** `run-ai-agent`, `agent-chat-stream`, `agent-conversation-chat`
- **Multi-agent orchestration:** `orchestrate-agent-team`
- **Memory lifecycle:** extraction, consolidation, retrieval (`extract-agent-memories`, `consolidate-agent-memories`, `retrieve-agent-memories`)
- **Guardrails + policy checks:** `enforce-guardrails`, `validate-guardrails`
- **Domain assistants:** EOS triage, deal coach, business doc generation, meeting issue extraction

Design principle: workflows are built as modular APIs so teams can compose single-agent and multi-agent automations without coupling to one page.

## 5) Backend Architecture (Supabase)

### Core backend layers

1. **Postgres schema + migrations** (`supabase/migrations/*`).
2. **Edge functions** (`supabase/functions/*`) for AI, integrations, and secured operations.
3. **Auth + security middleware** in shared backend utilities.
4. **Config/feature toggles** via `app_config` keys surfaced in frontend hooks.

### Feature flags currently represented in app config

- `enableAIChat`
- `enableKnowledgeBase`
- `enableMeetings`
- `enableTasks`
- `enableNotifications`
- `enableSemanticSearch`
- `enableClients`
- `enableAIAgents`
- `enablePersonalKnowledge`
- `enableFeedback`
- `enableGoogleDrive`
- `enableZoomSync`
- `useGenericMeetings`

## 6) Edge Function Coverage (Current)

Current codebase contains **151 deployed-function directories** (counted from `supabase/functions/*/index.ts`).

High-level capability areas:

- AI chat, summarization, RAG, embeddings, semantic search
- Agent execution, orchestration, memory extraction/retrieval
- Meetings intelligence and transcript processing
- OAuth lifecycle and API auth endpoints
- Integrations sync jobs (Zoom/Google/Microsoft/ClickUp/Jira/Zoho/ActiveCollab)
- Notification and email pipelines
- Admin and system utility jobs (checks, seeding, logs, validation)

> The previous edge function catalog was stale (historically listed 64). Use this count as the current baseline.

## 7) Code Review Notes (Clarity + Scalability)

### Strengths

- Route decomposition by module is clear and maintainable.
- Module gating pattern (`ModuleRoute`) supports phased rollouts.
- Extensive admin surface for operational control.
- Agent and memory primitives are reusable across product surfaces.

### Risks / follow-up suggestions

1. **Admin route file scale:** `src/modules/admin/routes.tsx` is very large and should be split by domain to reduce merge conflicts.
2. **Documentation drift risk:** high volume of edge functions + pages requires generated indexes to stay current.
3. **AI surface governance:** maintain a clear owner map for each function to avoid overlapping behavior.
4. **Flag consistency:** ensure frontend feature flags and backend entitlement checks are aligned for sensitive flows.

## 8) Recommended Documentation Maintenance Workflow

When features ship:

1. Update this guide and affected module docs in same PR.
2. Update edge function count + capability categories.
3. Add migration notes if schema changed.
4. Record any removed/deprecated docs in `docs/archive/README.md`.

