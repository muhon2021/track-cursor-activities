---
name: sj-control-tower-architecture
description: "Architecture of SJ Control Tower Framework. Triggers: architecture, structure, how does, where is, which file, overview, understand, codebase."
---

# SJ Control Tower Framework — Architecture Reference

## Project Identity

- **Name**: SJ Control Tower Framework (SJ Innovation Framework V1)
- **Purpose**: Reusable full-stack business management platform for enterprise applications
- **Domain**: Enterprise operations — CRM, meetings, knowledge base, AI agents, project management, EOS, productivity
- **Stack**: React 18.3 + TypeScript 5.8 + Vite 5.4 + Supabase + shadcn/ui + Tailwind CSS 3.4

## Directory Tree

```
/
├── src/                               # Frontend source code
│   ├── App.tsx                        # Root — all route definitions
│   ├── main.tsx                       # Entry point
│   │
│   ├── pages/                         # 26 route page components
│   │   ├── Dashboard.tsx              # Main dashboard
│   │   ├── Clients.tsx                # Client list
│   │   ├── ClientDetail.tsx           # Client detail view
│   │   ├── ClientForm.tsx             # Client create/edit form
│   │   ├── ClientKnowledge.tsx        # Client knowledge base
│   │   ├── Projects.tsx               # Project list
│   │   ├── ProjectIssuesAIAnalyzePage.tsx  # AI issue analysis
│   │   ├── AIChat.tsx                 # AI chat interface
│   │   ├── AIAgents.tsx               # AI agent management
│   │   ├── MCPServers.tsx             # MCP server config
│   │   ├── Settings.tsx               # User settings
│   │   ├── Profile.tsx                # User profile
│   │   ├── Admin.tsx                  # Admin panel
│   │   ├── Login.tsx                  # Login page
│   │   ├── Signup.tsx                 # Signup page
│   │   ├── AuthCallback.tsx           # OAuth callback
│   │   ├── MicrosoftAuthCallback.tsx  # Azure AD callback
│   │   ├── MeetingForm.tsx            # Meeting create/edit
│   │   ├── TaskForm.tsx               # Task create/edit
│   │   ├── DeploymentStatus.tsx       # Deployment monitoring
│   │   ├── Feedback.tsx               # User feedback
│   │   ├── Notifications.tsx          # Notification center
│   │   ├── PrivacyPolicy.tsx          # Legal page
│   │   ├── TermsAndConditions.tsx     # Legal page
│   │   ├── Index.tsx                  # Landing/redirect
│   │   └── NotFound.tsx               # 404 page
│   │
│   ├── components/
│   │   ├── ui/                        # 51 shadcn/ui primitives (DO NOT modify)
│   │   ├── layout/                    # DashboardLayout, AdminLayout, AppSidebar, TopNav
│   │   ├── auth/                      # ProtectedRoute, AdminRoute
│   │   ├── routing/                   # ModuleRoute
│   │   ├── admin/                     # Admin panel components
│   │   ├── ai/                        # AI chat and assistant UI
│   │   ├── agent/                     # AI agent UI components
│   │   ├── meetings/                  # Meeting management components
│   │   ├── integrations/              # OAuth, Teams, Google Drive UI
│   │   ├── client-portal/             # Client-facing portal
│   │   ├── mcp/                       # MCP server components
│   │   ├── followup/                  # Lead follow-up components
│   │   ├── user-knowledge/            # Personal knowledge management
│   │   ├── settings/                  # User settings components
│   │   └── common/                    # Shared reusable components
│   │
│   ├── hooks/                         # 70+ custom React hooks
│   │   ├── useClients.ts             # Client CRUD
│   │   ├── useMeetings.ts            # Meeting CRUD
│   │   ├── useProjects.ts            # Project CRUD
│   │   ├── useTasks.ts               # Task CRUD
│   │   ├── useAIAgents.ts            # AI agent management
│   │   ├── useAIChatAssistant.ts     # AI chat
│   │   ├── useAgentChatStream.ts     # Streaming AI responses
│   │   ├── useSemanticSearch.ts      # Vector search
│   │   ├── useDashboard.ts           # Dashboard stats
│   │   ├── useNotifications.ts       # Notifications
│   │   ├── useAppConfig.ts           # Feature flags
│   │   ├── useFeatureFlags.ts        # Feature flag checks
│   │   ├── useIntegrations.ts        # Integration status
│   │   ├── useRoles.ts               # Role management
│   │   └── ...                       # 55+ more hooks
│   │
│   ├── contexts/
│   │   ├── AuthContext.tsx            # Auth state (user, session, sign in/out)
│   │   └── BrandingContext.tsx        # Branding/theming state
│   │
│   ├── modules/                       # 10 feature modules
│   │   ├── platform/                  # Core: auth, dashboard, profile, settings
│   │   ├── admin/                     # Admin panel
│   │   ├── eos/                       # V/TO, OKRs, issues, scorecards
│   │   ├── meetings/                  # Meeting management
│   │   ├── projects/                  # Project lifecycle, milestones, billing
│   │   ├── actions/                   # Task management
│   │   ├── business-dev/              # CRM, deals, contacts
│   │   ├── lead-followup/             # Lead follow-up workflows
│   │   ├── knowledge/                 # Knowledge base, semantic search
│   │   └── productivity/              # Team metrics, analytics
│   │
│   ├── shared/config/
│   │   ├── env.ts                     # Centralized env var access
│   │   ├── modules.ts                 # MODULE_REGISTRY (source of truth)
│   │   ├── api.ts                     # API endpoint registry
│   │   └── navigationStructure.ts     # Sidebar navigation config
│   │
│   ├── lib/
│   │   ├── cache.ts                   # React Query key factories + invalidation
│   │   ├── validation.ts              # Zod schemas for all forms
│   │   ├── sanitize.ts               # DOMPurify sanitization utilities
│   │   ├── activity-logger.ts         # CRUD activity logging
│   │   └── utils.ts                   # cn() class name utility
│   │
│   ├── integrations/supabase/
│   │   ├── client.ts                  # Supabase client setup
│   │   └── types.ts                   # Auto-generated database types
│   │
│   └── types/                         # TypeScript type definitions
│
├── supabase/
│   ├── functions/                     # 118 Edge Functions (Deno)
│   │   ├── _shared/                   # Shared utilities
│   │   └── [function-name]/index.ts   # One per function
│   ├── migrations/                    # 105+ SQL migrations
│   ├── seed/                          # Database seeding scripts
│   ├── auth-middleware.ts             # Auth validation utilities
│   ├── cors.ts                        # CORS configuration
│   └── config.toml                    # JWT verification per function
│
├── docs/                              # Comprehensive documentation
│   ├── 00-getting-started/            # Setup guides
│   ├── 01-architecture/               # System design
│   ├── 02-modules/                    # Per-module docs
│   ├── 03-development/                # Dev guides
│   ├── 04-deployment/                 # Deployment
│   ├── 05-integrations/               # External services
│   ├── 06-ai-features/                # AI capabilities
│   ├── 07-admin/                      # Admin panel
│   ├── 08-edge-functions/             # Edge Function catalog
│   ├── archive/                       # Historical docs
│   ├── backlog/                       # Feature backlog
│   └── original/                      # Original design docs
│
├── scripts/                           # Shell scripts (migrations, setup)
├── public/                            # Static assets
├── CLAUDE.md                          # Claude Code project instructions
├── package.json                       # Dependencies + scripts
├── vite.config.ts                     # Build config (port 8080, @ alias)
├── tailwind.config.ts                 # Tailwind + dark mode
├── tsconfig.json                      # TypeScript config
└── .claude/                           # Claude Code config
    ├── agents/                        # 10 specialized agents
    ├── skills/                        # 6 skills
    ├── agents.md                      # Agent registry + workflows
    └── settings.json                  # Claude Code settings
```

## Routing Architecture

### Route Hierarchy
```
Public routes (no auth required)
├── /login                    → Login.tsx
├── /signup                   → Signup.tsx
├── /auth/callback            → AuthCallback.tsx
├── /auth/microsoft/callback  → MicrosoftAuthCallback.tsx
├── /privacy-policy           → PrivacyPolicy.tsx
└── /terms-and-conditions     → TermsAndConditions.tsx

Protected routes (ProtectedRoute → DashboardLayout)
├── /                         → Index.tsx (redirects to /dashboard)
├── /dashboard                → Dashboard.tsx
├── /clients                  → Clients.tsx
├── /clients/:id              → ClientDetail.tsx
├── /clients/new              → ClientForm.tsx
├── /clients/:id/edit         → ClientForm.tsx
├── /clients/:id/knowledge    → ClientKnowledge.tsx
├── /meetings/new             → MeetingForm.tsx
├── /meetings/:id/edit        → MeetingForm.tsx
├── /projects                 → Projects.tsx
├── /projects/:id/issues/ai   → ProjectIssuesAIAnalyzePage.tsx
├── /tasks/new                → TaskForm.tsx
├── /tasks/:id/edit           → TaskForm.tsx
├── /ai-chat                  → AIChat.tsx
├── /ai-agents                → AIAgents.tsx
├── /mcp-servers              → MCPServers.tsx
├── /settings                 → Settings.tsx
├── /profile                  → Profile.tsx
├── /notifications            → Notifications.tsx
├── /feedback                 → Feedback.tsx
├── /deployment-status        → DeploymentStatus.tsx
└── [module routes]           → Each module's routes.tsx

Admin routes (ProtectedRoute → AdminRoute → AdminLayout)
└── /admin/*                  → Admin.tsx (admin panel with sub-routes)
```

### Module System (Three-Layer Resolution)
1. **Build-time**: `VITE_MODULE_*` env vars control code bundling
2. **Runtime**: `app_modules` DB table toggles modules (admin UI)
3. **Per-user**: `user_module_permissions` table controls individual access

## Data Flow

```
User Action → React Component → Custom Hook → React Query → Supabase Client → Edge Function/DB
                                                                    ↓
                                                              RLS Policy Check
                                                                    ↓
                                                              PostgreSQL Query
                                                                    ↓
                                                              Response → Cache → UI Update
```

## Authentication Flow

```
Login → Supabase Auth (email/Google/Azure AD) → JWT Token
  ↓
AuthContext.tsx (stores session, auto-refresh)
  ↓
ProtectedRoute (checks auth state)
  ↓
AdminRoute (checks user_roles for admin)
  ↓
Edge Functions (verify JWT via config.toml or validateAuth())
```

## Module Status

| Module | Status | Notes |
|--------|--------|-------|
| platform | Complete | Auth, dashboard, profile, settings |
| admin | Complete | User management, feature flags, modules |
| eos | Active | V/TO, OKRs, issues, scorecards, accountability |
| meetings | Complete | Scheduling, AI summaries, Zoom/Teams/Google Meet |
| projects | Complete | Lifecycle, milestones, billing, ActiveCollab/Jira sync |
| actions | Complete | Tasks, streams, comments, subtasks |
| business-dev | Complete | Clients, deals, contacts, pipeline |
| lead-followup | Active | Contact management, AI sentiment, email automation |
| knowledge | Complete | KB entries, vector search, embeddings, file upload |
| productivity | Active | Team metrics, department analysis, AI insights |

## External Integrations

| Integration | Purpose | Auth Method |
|-------------|---------|-------------|
| Supabase | Database, Auth, Edge Functions, Storage | Service role key |
| OpenAI | AI chat, summaries, embeddings | API key (Edge Function) |
| Google (OAuth) | SSO, Drive, Meet, Calendar | OAuth 2.0 |
| Microsoft (Azure AD) | SSO, Teams, Calendar, OneDrive | OAuth 2.0 / MSAL |
| Zoom | Meetings, recordings, transcripts | OAuth 2.0 |
| SendGrid | Email sending, tracking | API key |
| Slack | Webhook notifications | Webhook URL |
| ActiveCollab | Project sync | API key |
| Jira | Project sync | API key |
| Google Gemini | RAG queries | API key |

## Known Technical Debt

- No test suite configured (no Vitest/Jest, no test files)
- TypeScript strict mode disabled (`strict: false`, `noImplicitAny: false`)
- Some `any` types in hooks and utility functions
- No code splitting/lazy loading (all modules eagerly loaded)
- Some components exceed 200 lines
- ESLint `no-unused-vars` rule disabled
- Some direct Supabase calls in components instead of hooks
