# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# SJ Control Tower Framework

## Project Overview

Full-stack business management platform (also called **SJ Innovation Framework V1**) built as a reusable, modular framework for enterprise applications. Provides authentication, CRM, meetings, knowledge base, AI agents, project management, EOS, lead follow-up, and productivity tracking.

- **Stack**: React 18 + TypeScript + Vite + Supabase + shadcn/ui
- **Backend**: Supabase Edge Functions (Deno-based serverless), PostgreSQL with RLS
- **Dev server**: port 8080 (configured in `vite.config.ts`)

## Quick Commands

```bash
npm run dev                    # Start dev server on port 8080
npm run build                  # Production build
npm run build:dev              # Development build
npm run lint                   # ESLint (typescript-eslint + react-hooks + react-refresh)
npm run preview                # Preview production build
npm run migrations:run         # Apply pending database migrations
npm run migrations:repair      # Fix migration history
npm run migrations:mark-applied # Mark migrations as already applied
npm run migrations:hook        # Setup migration hook
```

**No test runner is configured.** There are no test files, no Jest/Vitest, and no test scripts.

## Project Structure

```
/
├── src/                           # Frontend source code
│   ├── App.tsx                    # Root component — all route definitions
│   ├── main.tsx                   # Entry point
│   ├── components/                # 23 component directories
│   │   ├── admin/                 # Admin panel components
│   │   ├── agent/                 # AI agent UI
│   │   ├── ai/                    # AI chat and assistant components
│   │   ├── auth/                  # ProtectedRoute, AdminRoute
│   │   ├── client-portal/         # Client-facing portal
│   │   ├── common/                # Shared components
│   │   ├── contact-detail-tabs/   # Contact management tabs
│   │   ├── followup/              # Lead follow-up components
│   │   ├── integrations/          # OAuth, Teams, Google Drive UI
│   │   ├── knowledge/             # Knowledge base UI
│   │   ├── landing/               # Public landing page components
│   │   ├── layout/                # DashboardLayout, AdminLayout, AppSidebar, TopNav
│   │   ├── mcp/                   # Model Context Protocol components
│   │   ├── meetings/              # Meeting management UI
│   │   ├── pods/                  # Pod/team management UI
│   │   ├── projects/              # Project management UI
│   │   ├── routing/               # ModuleRoute and routing utilities
│   │   ├── settings/              # User settings
│   │   ├── setup/                 # Onboarding/setup wizard
│   │   ├── tasks/                 # Task/action management UI
│   │   ├── ui/                    # 49 shadcn/ui components
│   │   └── user-knowledge/        # Personal knowledge management
│   ├── contexts/                  # AuthContext, BrandingContext
│   ├── hooks/                     # 93 custom React hooks (useClients, useMeetings, etc.)
│   ├── integrations/              # Supabase client setup (client.ts, types.ts)
│   ├── lib/                       # 28 utility files (validation, cache, auth, integrations)
│   ├── modules/                   # 9 module directories (10 in registry incl. lead-followup)
│   │   ├── platform/              # Core: auth, dashboard, profile, settings
│   │   ├── admin/                 # Admin panel
│   │   ├── actions/               # Task management
│   │   ├── business-dev/          # CRM, deals, contacts, lead follow-up
│   │   ├── eos/                   # V/TO, OKRs, issues, scorecards
│   │   ├── knowledge/             # Knowledge base
│   │   ├── meetings/              # Meeting management
│   │   ├── productivity/          # Team metrics, analytics
│   │   └── projects/              # Project lifecycle, milestones, billing
│   ├── pages/                     # 102 route page components
│   │   ├── *.tsx                  # 30 root pages (Login, Dashboard, Clients, etc.)
│   │   ├── admin/                 # 41 admin pages + 4 subdirectories
│   │   │   ├── ai/                # 8 AI admin pages
│   │   │   ├── eos/               # 5 EOS admin pages
│   │   │   ├── integrations/      # 9 integration admin pages
│   │   │   └── memory/            # 4 memory/analytics admin pages
│   │   ├── client/                # 2 client portal pages
│   │   └── projects/              # 3 project detail pages
│   ├── shared/config/             # env.ts, modules.ts, api.ts, index.ts
│   └── types/                     # knowledgeBase.ts, okr.ts, pods.ts
│
├── supabase/
│   ├── functions/                 # 120 Edge Functions (Deno runtime) + _shared/
│   ├── migrations/                # 135 database migrations
│   ├── seed/                      # Database seeding scripts
│   ├── auth-middleware.ts         # Edge function auth utilities
│   ├── cors.ts                    # CORS headers
│   └── config.toml                # Function-level JWT verification config
│
├── docs/                          # Comprehensive documentation
│   ├── 00-getting-started/        # Setup guides
│   ├── 01-architecture/           # System design and data flow
│   ├── 02-modules/                # Per-module documentation
│   ├── 03-development/            # Developer guides and release process
│   ├── 04-deployment/             # Deployment guides
│   ├── 05-integrations/           # External service integrations
│   ├── 06-ai-features/            # AI capabilities documentation
│   ├── 07-admin/                  # Admin panel and feature flags
│   ├── 08-edge-functions/         # Edge function catalog and deployment
│   ├── archive/                   # Legacy/archived docs
│   ├── backlog/                   # Feature backlog docs
│   └── public_website/            # Public-facing documentation
│
├── .claude/                       # Claude Code configuration
│   ├── agents.md                  # Agent delegation rules & multi-agent workflows
│   ├── agents/                    # 11 specialized agent definitions
│   ├── skills/                    # 8 skill definitions
│   ├── hooks/                     # Session hooks (session-start.sh)
│   └── settings.json              # Hook configuration
│
├── scripts/                       # Shell scripts for migrations and setup
└── public/                        # Static assets
```

## Architecture & Key Patterns

### Module System

Modules are the primary organizational unit. Defined in `src/shared/config/modules.ts`:

| Module | Category | Core? | Dependencies | Feature Flags | Directory |
|--------|----------|-------|--------------|---------------|-----------|
| platform | core | yes | — | — | `src/modules/platform/` |
| admin | core | yes | platform | — | `src/modules/admin/` |
| actions | operations | no | platform | enableTasks | `src/modules/actions/` |
| eos | business | no | platform | — | `src/modules/eos/` |
| meetings | operations | no | platform | enableMeetings | `src/modules/meetings/` |
| knowledge | intelligence | no | platform | enableKnowledgeBase, enablePersonalKnowledge, enableSemanticSearch | `src/modules/knowledge/` |
| projects | business | no | platform | — | `src/modules/projects/` |
| business-dev | business | no | platform | enableClients | `src/modules/business-dev/` |
| lead-followup | business | no | platform, business-dev | — | *(embedded in business-dev)* |
| productivity | operations | no | platform | — | `src/modules/productivity/` |

> **Note:** The `lead-followup` module is registered in MODULE_REGISTRY but does not have its own directory. Its components live in `src/components/followup/` and its routes are part of `business-dev`.

**Three-layer resolution:**
1. **Build-time**: `VITE_MODULE_*` env vars control code bundling
2. **Runtime**: `app_modules` DB table toggles modules (admin UI)
3. **Per-user**: `user_module_permissions` table controls access

### Routing (src/App.tsx)

```
Public routes          → Login, Signup, AuthCallback (no auth)
Client portal routes   → Token-based access, no layout
Protected routes       → ProtectedRoute → DashboardLayout → module routes
Admin routes           → ProtectedRoute → AdminRoute → AdminLayout → admin routes
```

Each module exports its routes from `src/modules/<name>/routes.tsx` using `<ModuleRoute>` for runtime access checks.

### Data Fetching

All data fetching uses **TanStack React Query** with centralized cache keys in `src/lib/cache.ts`:

```typescript
// Query key factories
queryKeys.clients.list(filters)
queryKeys.meetings.detail(id)
queryKeys.knowledge.semanticSearch(query, opts)

// Cache invalidation helpers
invalidateKeys.clients(queryClient)
invalidateKeys.meetings(queryClient)

// Stale time presets
cacheConfig.staleTime.short   // 1 min
cacheConfig.staleTime.medium  // 5 min
cacheConfig.staleTime.long    // 30 min
cacheConfig.staleTime.veryLong // 1 hour
```

Custom hooks encapsulate all business logic (e.g., `useClients`, `useMeetings`, `useKnowledge`). Never fetch data directly in components — use or create a hook.

### Authentication

- **AuthContext** (`src/contexts/AuthContext.tsx`) manages user state
- **ProtectedRoute** checks authentication
- **AdminRoute** checks admin role
- Supports: Email/password, Google OAuth, Microsoft Azure AD
- Profiles auto-created on first login
- Roles stored in `user_roles` table (admin, moderator, user)

### Forms

All forms use **React Hook Form + Zod**:
```typescript
const form = useForm<FormData>({
  resolver: zodResolver(schema),
  defaultValues: { ... }
});
```
Validation schemas live in `src/lib/validation.ts`.

### Edge Functions

120 Deno-based serverless functions in `supabase/functions/`. Standard pattern:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  // Function logic...
});
```

JWT verification is configured per-function in `supabase/config.toml`. Most functions use `verify_jwt = false` with in-code auth validation via `supabase/auth-middleware.ts`. API endpoints (`api-v1-*`) and OAuth functions use `verify_jwt = true`.

## Naming Conventions

| Context | Convention | Examples |
|---------|-----------|----------|
| React components | PascalCase files and exports | `Dashboard.tsx`, `ClientForm.tsx` |
| Custom hooks | `use` prefix, camelCase | `useClients.ts`, `useMeetings.ts` |
| Utility files | camelCase | `validation.ts`, `cache.ts`, `activity-logger.ts` |
| Types/Interfaces | PascalCase | `Client`, `Meeting`, `ModuleDefinition` |
| Type suffixes | `Type` suffix for context types | `AuthContextType` |
| Constants | UPPER_SNAKE_CASE for registries | `MODULE_REGISTRY` |
| Database tables | snake_case | `user_roles`, `knowledge_entries`, `ai_agents` |
| Database columns | snake_case | `created_at`, `user_id`, `full_name` |
| Edge functions | kebab-case directories | `ai-chat-assistant/`, `semantic-search/` |
| Env vars (client) | `VITE_` prefix | `VITE_SUPABASE_URL` |

## Path Aliases

`@` maps to `./src` (configured in `vite.config.ts` and `tsconfig.json`):
```typescript
import { supabase } from "@/integrations/supabase/client";
import { useClients } from "@/hooks/useClients";
```

## Database

- **PostgreSQL** via Supabase with **Row Level Security (RLS)** on all tables
- **No ORM** — direct Supabase client queries (`supabase.from("table").select(...)`)
- Types auto-generated in `src/integrations/supabase/types.ts`
- 135 migrations in `supabase/migrations/` (apply with `npm run migrations:run`)
- Vector extension enabled for embedding-based semantic search

### Core Tables
- `profiles`, `user_roles`, `roles` — Auth & access
- `clients` — CRM/contacts
- `meetings`, `meeting_transcripts`, `zoom_files` — Meeting management
- `knowledge_entries`, `knowledge_files`, `knowledge_categories`, `knowledge_sources` — Knowledge base
- `embeddings` — Vector embeddings for semantic search
- `ai_agents`, `ai_agent_runs`, `ai_chat_history` — AI features
- `tasks`, `projects`, `project_milestones` — Project/task management
- `app_config`, `app_modules`, `user_module_permissions` — Configuration
- `notifications`, `feedback`, `activity_logs` — Operations

## Utility Library (`src/lib/`)

28 utility files organized by domain:

**Core:**
- `cache.ts` — React Query key factories, invalidation helpers, stale time presets
- `validation.ts` — Zod validation schemas for all forms
- `sanitize.ts` — DOMPurify XSS protection for user-generated content
- `activity-logger.ts` — `logCrud()`, `logLogin()`, `logLogout()` activity tracking
- `utils.ts` — General utilities (cn class merger, etc.)
- `slug.ts` — URL slug generation
- `toast-helpers.ts` — Toast notification utilities
- `export-utils.ts` — Data export helpers
- `csv.ts` — CSV parsing/generation
- `componentOptimization.ts` — React performance helpers

**Authentication & OAuth:**
- `azureAuth.ts` — Azure AD authentication
- `msalConfig.ts` — MSAL configuration
- `msalAuthWindow.ts` — MSAL popup auth window
- `oauth-token-manager.ts` — OAuth token lifecycle management

**Integration Services:**
- `microsoftGraphClient.ts` — Microsoft Graph API client
- `microsoftGraphWebhooks.ts` — Graph webhook subscriptions
- `microsoftTeamsService.ts` — Teams integration service
- `microsoftTeamsMeetingService.ts` — Teams meeting creation
- `microsoftTeamsNotificationService.ts` — Teams notifications
- `googleMeetMeetingService.ts` — Google Meet integration
- `zoomMeetingService.ts` — Zoom meeting management
- `zoom-sync.ts` — Zoom data synchronization
- `integration-utils.ts` — Shared integration helpers
- `webhook-handlers.ts` — Webhook processing

**Supabase & Edge Functions:**
- `supabase-helpers.ts` — Supabase query helpers
- `supabase-typed.ts` — Typed Supabase client utilities
- `edge-functions.ts` — Edge Function invocation helpers
- `env-validator.ts` — Environment variable validation

## Environment Variables

Required (see `.env.example`):

```
VITE_SUPABASE_URL          # Supabase project URL
VITE_SUPABASE_PUBLISHABLE_KEY  # Supabase anon key
```

Edge function secrets:
```
OPENAI_API_KEY             # AI features
GOOGLE_CLIENT_ID / SECRET  # Google OAuth + Drive
ZOOM_CLIENT_ID / SECRET    # Zoom integration
SENDGRID_API_KEY           # Email
SLACK_WEBHOOK_URL          # Slack notifications
```

Module toggles (build-time):
```
VITE_MODULE_EOS=true
VITE_MODULE_MEETINGS=true
VITE_MODULE_PROJECTS=true
VITE_MODULE_ACTIONS=true
VITE_MODULE_BUSINESS_DEV=true
VITE_MODULE_KNOWLEDGE=true
VITE_MODULE_PRODUCTIVITY=true
```

## ESLint Configuration

- **Config file**: `eslint.config.js` (flat config format)
- TypeScript ESLint recommended rules
- React hooks plugin (recommended rules)
- React refresh plugin (warns on non-component exports)
- `@typescript-eslint/no-unused-vars` is **off**
- TypeScript `strict: false` in tsconfig (`noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters` all off)

## Tailwind Configuration

- **Dark mode**: class-based (`class` strategy)
- **Custom colors**: AI-specific palette (`ai.glow`, `ai.pulse`), semantic colors (`success`, `warning`, `info`)
- **Custom animations**: `accordion`, `fade-in`, `fade-out`, `scale-in`, `slide-in-right`, `ai-pulse`, `ai-glow`
- **Plugin**: `tailwindcss-animate`

## Security Practices

1. **RLS on all tables** — never bypass Row Level Security
2. **Input validation** — Zod schemas for all forms (`src/lib/validation.ts`)
3. **XSS protection** — DOMPurify for user-generated content (`src/lib/sanitize.ts`)
4. **Activity logging** — `logCrud()`, `logLogin()`, `logLogout()` from `src/lib/activity-logger.ts`
5. **Auth middleware** — `supabase/auth-middleware.ts` for edge functions
6. **No secrets in client code** — all sensitive keys are edge function secrets
7. **CORS** — centralized in `supabase/cors.ts`

## Common Tasks

### Adding a new page
1. Create page component in `src/pages/`
2. Add route in the appropriate module's `routes.tsx`
3. Add navigation item in `src/components/layout/AppSidebar.tsx`
4. Wrap with `<ModuleRoute>` if module-specific

### Adding a new hook
1. Create in `src/hooks/` following `use*` naming
2. Use `queryKeys` from `src/lib/cache.ts` for cache keys
3. Use `invalidateKeys` for cache invalidation after mutations
4. Show errors via toast notifications (sonner)

### Creating a new edge function
1. Create folder in `supabase/functions/<function-name>/`
2. Use CORS headers from the standard pattern
3. Use `auth-middleware.ts` for auth validation
4. Add JWT config to `supabase/config.toml`
5. Deploy: `supabase functions deploy <function-name>`

### Adding a new module
1. Create module directory in `src/modules/<name>/` with `index.ts` and `routes.tsx`
2. Register in `src/shared/config/modules.ts` MODULE_REGISTRY
3. Add routes in `src/App.tsx`
4. Create database tables with RLS policies
5. Add env var toggle `VITE_MODULE_<NAME>` if needed

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/App.tsx` | Root component with all route definitions |
| `src/contexts/AuthContext.tsx` | Authentication state management |
| `src/contexts/BrandingContext.tsx` | Branding/theming state |
| `src/shared/config/modules.ts` | Module registry (source of truth for modules) |
| `src/shared/config/env.ts` | Centralized environment variable access |
| `src/shared/config/api.ts` | API configuration and endpoint definitions |
| `src/lib/cache.ts` | React Query key factories and invalidation helpers |
| `src/lib/validation.ts` | Zod validation schemas |
| `src/lib/activity-logger.ts` | Activity tracking utilities |
| `src/lib/sanitize.ts` | Input sanitization |
| `src/lib/edge-functions.ts` | Edge Function invocation helpers |
| `src/integrations/supabase/client.ts` | Supabase client instance |
| `src/integrations/supabase/types.ts` | Auto-generated database types |
| `supabase/config.toml` | Edge function JWT verification config |
| `supabase/auth-middleware.ts` | Edge function auth utilities |
| `supabase/cors.ts` | CORS configuration for edge functions |
| `vite.config.ts` | Build config (port 8080, `@` alias, react-swc plugin) |
| `tailwind.config.ts` | Tailwind with dark mode, custom colors, AI palette |
| `eslint.config.js` | ESLint flat config |
| `.claude/SESSION_TEMPLATE.md` | Template for all Claude Code session prompts (structure, pre-commit section) |
| `.claude/PRE_COMMIT_CHECKLIST.md` | 6-point checklist to verify before every commit |
| `.claude/skills/type-safety-patterns/SKILL.md` | 5 patterns for safe TypeScript code |

## Specialized Subagents (11 Agents)

Eleven specialized agents are available in `.claude/agents/` for delegating complex tasks. Each agent has deep knowledge of this project's patterns, conventions, and file structure. See `.claude/agents.md` for auto-delegation rules and multi-agent workflows.

| # | Agent | File | Specialization | Tools |
|---|-------|------|---------------|-------|
| 1 | **react-frontend-dev** | `.claude/agents/react-frontend-dev.md` | Pages, components, hooks, forms, routing, UI/styling | Read, Write, Edit, Bash, Glob, Grep |
| 2 | **supabase-backend-dev** | `.claude/agents/supabase-backend-dev.md` | Edge Functions, migrations, RLS policies, auth, DB schema | Read, Write, Edit, Bash, Glob, Grep |
| 3 | **code-reviewer** | `.claude/agents/code-reviewer.md` | Code quality, convention enforcement (read-only) | Read, Grep, Glob |
| 4 | **debugger** | `.claude/agents/debugger.md` | Bug investigation, error analysis, RLS debugging | Read, Edit, Bash, Glob, Grep |
| 5 | **documentation-engineer** | `.claude/agents/documentation-engineer.md` | Specs, API docs, module guides, schema docs | Read, Write, Edit, Glob, Grep |
| 6 | **performance-engineer** | `.claude/agents/performance-engineer.md` | Performance optimization, bundle analysis, query profiling | Read, Edit, Bash, Glob, Grep |
| 7 | **refactoring-specialist** | `.claude/agents/refactoring-specialist.md` | Safe code restructuring, tech debt cleanup | Read, Write, Edit, Bash, Glob, Grep |
| 8 | **security-auditor** | `.claude/agents/security-auditor.md` | Security scanning, RLS audit, vulnerability detection (read-only) | Read, Grep, Glob |
| 9 | **typescript-pro** | `.claude/agents/typescript-pro.md` | Type safety, `any` elimination, Zod/TS alignment, generics | Read, Write, Edit, Glob, Grep |
| 10 | **test-automator** | `.claude/agents/test-automator.md` | Unit tests, integration tests, Vitest setup, fixtures | Read, Write, Edit, Bash, Glob, Grep |
| 11 | **edge-function-doctor** | `.claude/agents/edge-function-doctor.md` | Edge Function audit, non-2xx diagnosis, CORS fixes, function creation | Read, Write, Edit, Bash, Glob, Grep |

### Example Invocations

```
# Build a new page with data fetching
Use the react-frontend-dev agent to create a new Contacts page with list/detail views

# Create an Edge Function with migration
Use the supabase-backend-dev agent to create a new API endpoint for team invitations

# Review code before merge
Use the code-reviewer agent to review the changes in src/hooks/useDeals.ts

# Improve type safety
Use the typescript-pro agent to eliminate all `any` types in src/hooks/useClients.ts

# Write documentation
Use the documentation-engineer agent to document the meetings module API

# Debug an issue
Use the debugger agent to investigate why meetings list returns empty

# Set up tests
Use the test-automator agent to write unit tests for src/lib/validation.ts

# Optimize performance
Use the performance-engineer agent to analyze slow loading on the Projects page

# Refactor safely
Use the refactoring-specialist agent to split the large Dashboard component

# Security audit
Use the security-auditor agent to audit RLS policies on all tables

# Audit Edge Functions for non-2xx errors
Use the edge-function-doctor agent to audit all Edge Functions

# Fix a specific Edge Function error
Use the edge-function-doctor agent to fix the 500 error in send-notification

# Create a new Edge Function
Use the edge-function-doctor agent to create a new Edge Function for team-invitations
```

## Skill Registry

Nine skills are available in `.claude/skills/` providing domain knowledge and workflow standards.

| # | Skill | File | Purpose |
|---|-------|------|---------|
| 1 | **brainstorming** | `.claude/skills/brainstorming/SKILL.md` | Design exploration before implementation |
| 2 | **sj-code-standards** | `.claude/skills/sj-code-standards/SKILL.md` | Coding standards for all code changes |
| 3 | **sj-bug-fix-workflow** | `.claude/skills/sj-bug-fix-workflow/SKILL.md` | 8-step bug fix process |
| 4 | **supabase-patterns** | `.claude/skills/supabase-patterns/SKILL.md` | Database and backend patterns |
| 5 | **project-architecture** | `.claude/skills/project-architecture/SKILL.md` | Full architecture reference |
| 6 | **specs-first-workflow** | `.claude/skills/specs-first-workflow/SKILL.md` | Specs before code workflow |
| 7 | **ai-agents-domain** | `.claude/skills/ai-agents-domain/SKILL.md` | AI agents domain knowledge |
| 8 | **edge-function-patterns** | `.claude/skills/edge-function-patterns/SKILL.md` | Edge Function best practices, CORS-first pattern, error prevention |
| 9 | **type-safety-patterns** | `.claude/skills/type-safety-patterns/SKILL.md` | TypeScript type safety patterns for queries, Records, filters, mutations |

## Session Rules

- Read `.claude/agents.md` for agent delegation rules
- Use **brainstorming** before ANY creative work (features, components, functionality changes)
- Follow **sj-code-standards** for ALL code changes
- Follow **sj-bug-fix-workflow** for ALL bug fixes
- Follow **specs-first-workflow** before ANY new feature
- Follow **supabase-patterns** for ALL database work
- Follow **type-safety-patterns** for ALL TypeScript type definitions
- Load **project-architecture** for architectural decisions
- Run **code-reviewer** before suggesting any PR or merge
- Run **security-auditor** before deploying sensitive features
- Run **edge-function-doctor** for ALL Edge Function work (create, edit, debug, deploy)
- Follow **edge-function-patterns** for ALL Edge Function code
- Create/update docs for any feature work
- Never skip specs

## Pre-Commit Type Safety Protocol

**CRITICAL:** Every Claude Code session MUST follow these pre-commit checks before committing.

### Automated Checks (Required)

```bash
npm run lint      # ESLint + TypeScript
npm run build:dev # Verify build
```

If either fails, DO NOT COMMIT. Fix in the session and re-run.

### Manual Checks (Required)

Read `.claude/PRE_COMMIT_CHECKLIST.md` and verify ALL 6 sections pass:

1. **Supabase Queries → TypeScript Types**
   - Every `.select()` field in type
   - Joined columns included
   - `Pick<>` for partial selects

2. **TypeScript Completeness**
   - `Record<K, V>` has ALL keys
   - No duplicate type exports
   - Enums synced with Record maps

3. **Filter Types → Query Methods**
   - Union types branch with `Array.isArray()`
   - No unvalidated filters passed to queries

4. **Mutation Callbacks**
   - Defined in `useMutation()`, not `mutate()`
   - Context type inferred

5. **Join Type Audits**
   - All join type uses checked
   - Tests/mocks updated

6. **Enum Usage Audit**
   - New enum values added to ALL Record maps

### Skill Reference (Required)

Before writing TypeScript code, read `.claude/skills/type-safety-patterns/SKILL.md`:
- Pattern #1: Query → Type Sync
- Pattern #2: Record Exhaustiveness
- Pattern #3: Union Filter Types
- Pattern #4: Mutation Context Types
- Pattern #5: Partial Join Selects

### Session Template

Every Claude Code session MUST use `.claude/SESSION_TEMPLATE.md` structure:
- Goal, Context, Files to Create/Modify, Implementation phases, Testing Checklist
- END with PRE-COMMIT REQUIREMENTS section (copy from template)

### Never Skip Type Safety

If a session would create TypeScript errors:
- Fix it in the session
- Don't commit broken code
- Use **typescript-pro** agent if stuck

Type safety is non-negotiable.

## Pre-Commit Checklist

Before committing any code changes:
- Run: `npm run lint`
- Run: `npm run build:dev`
- Read: `.claude/PRE_COMMIT_CHECKLIST.md`
- Verify all type safety checks pass

## Documentation

Comprehensive docs in `/docs/` organized by topic:
- `00-getting-started/` — Setup and quickstart
- `01-architecture/` — System design, data flow, security
- `02-modules/` — Per-module feature documentation
- `03-development/` — Developer guides, release process
- `04-deployment/` — Deployment guides
- `05-integrations/` — External service integrations
- `06-ai-features/` — AI capabilities
- `07-admin/` — Admin panel and feature flags
- `08-edge-functions/` — Edge function catalog and deployment
- `archive/` — Legacy/archived documentation
- `backlog/` — Feature backlog and planning docs
- `public_website/` — Public-facing documentation

Additional standalone guides in `docs/` root:
- `AGENTIC_FEATURES_GUIDE.md` — Agentic AI capabilities guide
- `GUARDRAILS_GUIDE.md` — AI guardrails setup
- `HITL_SETUP_GUIDE.md` — Human-in-the-loop configuration
- `MULTI_AGENT_TUTORIAL.md` — Multi-agent orchestration tutorial


# AI Context System

Before starting implementation, read:

- ai-context/project-overview.md
- ai-context/architecture.md
- ai-context/patterns.md
- ai-context/decisions.md
- ai-context/bugs-fixed.md

Follow existing architecture and coding patterns.

After completing work:
- update bugs-fixed.md if bug resolved
- update decisions.md if architecture changed
## gstack (REQUIRED — global install)

**Before doing ANY work, verify gstack is installed:**

```bash
test -d ~/.claude/skills/gstack/bin && echo "GSTACK_OK" || echo "GSTACK_MISSING"
```

If GSTACK_MISSING: STOP. Do not proceed. Tell the user:

> gstack is required for all AI-assisted work in this repo.
> Install it:
> ```bash
> git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
> cd ~/.claude/skills/gstack && ./setup --team
> ```
> For **Cursor**, also run `bun run gen:skill-docs --host cursor` in that directory and copy
> `~/.claude/skills/gstack/.cursor/skills/*` to `~/.cursor/skills/`. See
> `docs/03-development/GSTACK-TEAM-INSTALL.md`.
> Then restart your AI coding tool.

Do not skip skills, ignore gstack errors, or work around missing gstack.

Using gstack skills: After install, skills like /qa, /ship, /review, /investigate,
and /browse are available. Use /browse for all web browsing.
Use ~/.claude/skills/gstack/... for gstack file paths (the global path).
