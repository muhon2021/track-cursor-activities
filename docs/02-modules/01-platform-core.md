# Platform Core — Module Blueprint

## Overview

The Platform Core module provides the application shell that all other modules plug into. It contains authentication, layouts, navigation, the UI component library, contexts, shared hooks, configuration, and the Supabase integration layer.

## Routes Owned

From `src/modules/platform/routes.tsx`:

**Public (no auth required):**

```
/                          → Landing page (Index.tsx)
/login                     → Login page
/signup                    → Signup page
/auth/callback             → Supabase OAuth callback
/auth-callback             → Microsoft MSAL auth callback
```

**Protected (authenticated users):**

```
/dashboard                 → Main dashboard
/profile                   → User profile
/settings                  → User settings
/feedback                  → User feedback
/notifications             → Notifications (feature flag: enableNotifications)
/ai-agents                 → AI agent builder (feature flag: enableAIAgents)
/ai-chat                   → AI chat assistant (feature flag: enableAIChat)
/personal-knowledge        → Personal knowledge base
*                          → 404 Not Found
```

**Public client portal (from App.tsx, no auth required):**

```
/projects/:slug/client-portal/:token → Client portal dashboard
/client/project/:token               → Legacy client project dashboard
```

---

## File Inventory

### Pages (Platform-owned in `src/pages/`)

| File | Purpose | Route |
|------|---------|-------|
| `Index.tsx` | Landing page | `/` |
| `Login.tsx` | Login form | `/login` |
| `Signup.tsx` | Signup form | `/signup` |
| `AuthCallback.tsx` | Supabase OAuth callback handler | `/auth/callback` |
| `MicrosoftAuthCallback.tsx` | Microsoft MSAL auth callback | `/auth-callback` |
| `Dashboard.tsx` | Main user dashboard | `/dashboard` |
| `Profile.tsx` | User profile management | `/profile` |
| `Settings.tsx` | User settings | `/settings` |
| `Feedback.tsx` | User feedback submission | `/feedback` |
| `Notifications.tsx` | Notifications view | `/notifications` |
| `AIAgents.tsx` | AI agent builder and management | `/ai-agents` |
| `AIChat.tsx` | AI chat assistant | `/ai-chat` |
| `NotFound.tsx` | 404 page | `*` |
| `DeploymentStatus.tsx` | Deployment monitoring | (admin route) |

**Legacy pages** (used by module routes but owned by `src/pages/`):

| File | Purpose | Used by |
|------|---------|---------|
| `MeetingForm.tsx` | Create/edit meeting form | Meetings module routes |
| `MeetingDetail.tsx` | Legacy meeting detail | Orphaned — superseded by `MeetingDetailV2Page` |
| `Meetings.tsx` | Legacy meetings list | Orphaned — superseded by `MeetingsSchedulePage` |
| `TaskForm.tsx` | Create/edit task form | Actions module routes |
| `TaskDetail.tsx` | Legacy task detail | Orphaned — superseded by `TaskDetailPage` |
| `Tasks.tsx` | Legacy tasks list | Orphaned — superseded by `TasksPage` |
| `Clients.tsx` | Client listing | Business-dev module routes |
| `ClientForm.tsx` | Create/edit client | Business-dev module routes |
| `ClientDetail.tsx` | Client detail | Business-dev module routes |
| `MCPServers.tsx` | MCP server management | Admin routes |

### Layout Components (`src/components/layout/`)

| File | Purpose |
|------|---------|
| `DashboardLayout.tsx` | Main app layout with sidebar + top nav |
| `AdminLayout.tsx` | Admin panel layout with admin sidebar |
| `AppSidebar.tsx` | Main sidebar navigation (reads `navigationStructure.ts`) |
| `AdminSidebar.tsx` | Admin sidebar navigation |
| `TopNav.tsx` | Top navigation bar with user menu |

### Auth & Routing Components

| File | Location | Purpose |
|------|----------|---------|
| `ProtectedRoute.tsx` | `src/components/auth/` | Route protection — checks auth session |
| `AdminRoute.tsx` | `src/components/auth/` | Admin-only route protection |
| `ModuleRoute.tsx` | `src/components/routing/` | Module-level access control (checks `app_modules` + feature flags) |

### Common Components (`src/components/common/`)

| File | Purpose |
|------|---------|
| `EmptyState.tsx` | Reusable empty state placeholder |
| `LoadingSpinner.tsx` | Loading indicator |

### Other Components

| File | Location | Purpose |
|------|----------|---------|
| `OnboardingWizard.tsx` | `src/components/` | First-run setup wizard (rendered in `DashboardLayout`) |
| `FeatureGrid.tsx` | `src/components/landing/` | Landing page feature grid |
| `HeroSection.tsx` | `src/components/landing/` | Landing page hero |
| `PricingPreview.tsx` | `src/components/landing/` | Landing page pricing |
| `ProblemSolution.tsx` | `src/components/landing/` | Landing page problem/solution |
| `SocialProof.tsx` | `src/components/landing/` | Landing page social proof |
| `ValueProps.tsx` | `src/components/landing/` | Landing page value propositions |
| `FinalCTA.tsx` | `src/components/landing/` | Landing page call to action |
| `Footer.tsx` | `src/components/landing/` | Landing page footer |

### UI Component Library (`src/components/ui/`)

shadcn/ui based, 45+ primitives. Key categories:

- **Form:** button, input, textarea, label, form, select, checkbox, radio-group, switch, toggle, slider, calendar
- **Layout:** card, table, tabs, accordion, separator, scroll-area, resizable, sidebar, aspect-ratio
- **Overlay:** dialog, alert-dialog, sheet, drawer, popover, tooltip, hover-card, dropdown-menu, context-menu
- **Feedback:** progress, skeleton, toast, sonner, badge, avatar
- **Navigation:** navigation-menu, command, pagination, collapsible, carousel
- **Custom:** chart (Recharts), FormRichTextEditor, star-rating, WeekDisplay

### Contexts (`src/contexts/`)

| File | Purpose |
|------|---------|
| `AuthContext.tsx` | Authentication state — user, session, roles, sign in/out, profile management |
| `BrandingContext.tsx` | Dynamic branding — reads `app_config.branding` for logo, colors |

### Core Hooks (`src/hooks/`)

**Platform configuration (5):**

| Hook | Purpose |
|------|---------|
| `useAppConfig.ts` | Read/update `app_config` table — feature flags, branding, email, SSO |
| `useFeatureFlags.ts` | Derived from `useAppConfig` — typed feature flag checks |
| `useAuthConfig.ts` | SSO configuration — SAML, SCIM, SSO domains |
| `usePreferences.ts` | User preferences from `profiles.metadata` |
| `useOnboarding.ts` | Onboarding wizard state |

**Shared module access (`src/shared/hooks/`):**

| Hook | Purpose |
|------|---------|
| `useModuleAccess.ts` | Multi-layer module access: build-time → `app_modules` → feature flags |

**Notifications, roles, dashboard (4):**

| Hook | Purpose |
|------|---------|
| `useNotifications.ts` | Real-time notifications with Postgres subscriptions |
| `useRoles.ts` | Role CRUD (`roles` table) |
| `useDashboard.ts` | Dashboard stats — aggregate queries across modules |
| `useUserInvites.ts` | User invite management |

**AI & agent hooks (5):**

| Hook | Purpose |
|------|---------|
| `useAIAgents.ts` | AI agent CRUD + run management |
| `useAgentChatStream.ts` | Streaming agent chat via edge functions |
| `useAgentConversations.ts` | Agent conversation history |
| `useAgentMemory.ts` | Agent memory management |
| `useAIChatAssistant.ts` | One-shot AI chat assistant |

**Integration hooks (13):**

| Hook | Purpose |
|------|---------|
| `useIntegrations.ts` | Integration provider management, API key validation |
| `useIntegrationStatus.ts` | Connection status monitoring |
| `useIntegrationSync.ts` | Project sync (ActiveCollab, Jira) |
| `useUserIntegrations.ts` | Per-user OAuth connections (connect, disconnect, refresh) |
| `useMicrosoftTeams.ts` | Microsoft Teams integration |
| `useMicrosoftTeamsChannels.ts` | Teams channel listing |
| `useMicrosoftTeamsMessages.ts` | Teams message retrieval |
| `useMicrosoftCalendar.ts` | Microsoft Calendar integration |
| `useCreateTeamsMeeting.ts` | Create Teams meetings |
| `useGraphWebhookSubscription.ts` | Microsoft Graph webhook subscriptions |
| `useSendTeamsChannelMessage.ts` | Send Teams channel messages |
| `useSyncTeamsMeetings.ts` | Sync meetings from Teams |
| `useModelSync.ts` | AI model sync from providers |

**Meeting/file sync hooks (4):**

| Hook | Purpose |
|------|---------|
| `useSyncZoom.ts` | Sync Zoom recordings and files |
| `useZoomFiles.ts` | Zoom file management |
| `useMeetingFiles.ts` | Meeting file management (transcripts, recordings) |
| `useSyncMeetingProvider.ts` | Generic meeting provider sync |

**Other shared hooks (5):**

| Hook | Purpose |
|------|---------|
| `useMCPServers.ts` | MCP server CRUD |
| `useSemanticSearch.ts` | Semantic search via edge function |
| `use-toast.ts` | Toast notification hook (shadcn) |
| `use-mobile.tsx` | Mobile viewport detection |
| `useTasks.ts` | Legacy task CRUD (shared, used by actions module) |

**Project-specific hooks in root (5):**

| Hook | Purpose |
|------|---------|
| `useClientAccess.ts` | Client portal access management |
| `useProjectReports.ts` | Project reporting aggregates |
| `useProjectStatuses.ts` | Project status CRUD |
| `useWorkTypes.ts` | Work type CRUD |
| `useProjectModuleSettings.ts` | Project tab toggles |

### Configuration (`src/shared/config/`)

| File | Purpose |
|------|---------|
| `env.ts` | Environment variable abstraction |
| `modules.ts` | Module registry with `isModuleEnabled()` |
| `api.ts` | API endpoint definitions |
| `index.ts` | Barrel export |

### Data Files (`src/shared/data/`)

| File | Purpose |
|------|---------|
| `navigationStructure.ts` | Main (20 items) and admin (28 items) navigation definitions |
| `implementationStatus.ts` | PM overview — module/feature status tracking |

### Supabase Integration (`src/integrations/supabase/`)

| File | Purpose |
|------|---------|
| `client.ts` | Supabase client initialization with custom auth storage |
| `types.ts` | Auto-generated database types |

### Type Definitions (`src/types/`)

| File | Purpose |
|------|---------|
| `knowledgeBase.ts` | Knowledge base types |

### Utilities (`src/lib/`)

| File | Purpose |
|------|---------|
| `utils.ts` | General utilities (`cn`, `clsx`) |
| `cache.ts` | Centralized cache keys and invalidation helpers |
| `validation.ts` | Input validation |
| `sanitize.ts` | HTML/input sanitization |
| `export-utils.ts` | Data export (CSV, etc.) |
| `activity-logger.ts` | Fire-and-forget activity logging |
| `env-validator.ts` | Environment variable validation |
| `supabase.ts` | Supabase utility helpers |
| `azureAuth.ts` | Azure AD authentication |
| `msalConfig.ts` | MSAL configuration |
| `msalAuthWindow.ts` | MSAL popup auth window |
| `microsoftGraphClient.ts` | Microsoft Graph API client |
| `microsoftGraphWebhooks.ts` | Microsoft Graph webhook management |
| `microsoftTeamsService.ts` | Teams API service |
| `microsoftTeamsMeetingService.ts` | Teams meeting service |
| `microsoftTeamsNotificationService.ts` | Teams notification service |
| `oauth-token-manager.ts` | OAuth token lifecycle (refresh, revoke) |
| `integration-utils.ts` | Integration helper utilities |
| `webhook-handlers.ts` | Incoming webhook handlers |
| `zoom-sync.ts` | Zoom sync utilities |

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (extends Supabase `auth.users`) |
| `roles` | Role definitions |
| `app_config` | Global configuration (feature flags, branding, email, SSO) |
| `app_modules` | Module registry (name, slug, is_active, category, sort_order) |
| `user_module_permissions` | Per-user module access |
| `system_settings` | Key-value system configuration |
| `activity_logs` | User activity audit trail |
| `feedback` | User feedback submissions |
| `notifications` | User notifications |

## Key RPC Functions

- `get_user_modules` — Returns module names accessible to current user (or `*` for admin)

## Permission System

1. `app_modules` table defines available modules
2. `get_user_modules` RPC returns modules for current user (or `*` for admin)
3. `useModuleAccess(moduleName)` hook checks access in components (multi-layer: build-time → DB → feature flags)
4. `AppSidebar` filters navigation items by `item.module` using `useModuleAccess()`
5. `ModuleRoute` component guards routes at the routing level

## Environment Variables

```
VITE_SUPABASE_PROJECT_ID=      # Supabase project ID
VITE_SUPABASE_URL=             # Supabase URL
VITE_SUPABASE_PUBLISHABLE_KEY= # Supabase anon key
VITE_API_BASE_URL=             # Edge Functions base URL
VITE_MICROSOFT_CLIENT_ID=      # Microsoft MSAL client ID (optional, enables Azure AD SSO)
```

## Build Configuration

- `vite.config.ts`: Port 8080, SWC React plugin, path alias `@/` → `src/`
- `tsconfig.json`: `@/*` → `./src/*`, `strict: false`, `skipLibCheck: true`
- `tailwind.config.ts`: Tailwind CSS configuration with shadcn/ui theme
- `package.json`: Dependencies and scripts

## Implementation Notes

- Auth uses Supabase Auth with custom "remember me" storage (localStorage vs sessionStorage)
- Optional Azure AD / MSAL SSO enabled via `VITE_MICROSOFT_CLIENT_ID` env var
- Query caching uses TanStack React Query persist with localStorage
- Cache version tracking (`CACHE_VERSION`) for invalidation on deploys
- Stale time: 5–10 min per hook, GC time: 30 min
- All protected routes wrap with `<ProtectedRoute>` + `<DashboardLayout>`
- Admin routes additionally wrap with `<AdminRoute>` + `<AdminLayout>`
- Navigation structure uses `module` field for permission filtering and `featureFlag` for granular control
- `OnboardingWizard` renders in `DashboardLayout` for first-run setup

## Implementation Status

| Component | Status |
|-----------|--------|
| Auth (Supabase + MSAL) | Done |
| Layouts (Dashboard + Admin) | Done |
| Navigation (Main + Admin sidebars) | Done |
| Module access system | Done |
| Feature flag system | Done |
| UI component library (shadcn/ui) | Done |
| Config system (env, modules, api) | Done |
| Onboarding wizard | Done |
| Landing page | Done |
| Dashboard | Done |
| Profile / Settings | Done |
| Notifications | Done |
| Activity logging | Done |
| AI Agents page | Done |
| AI Chat page | Done |
| Deployment monitoring | Done |

### Known Issues

- 4 legacy pages in `src/pages/` are orphaned (Meetings.tsx, MeetingDetail.tsx, Tasks.tsx, TaskDetail.tsx) — superseded by module-owned pages
- `useAuthConfig.ts` uses `(supabase as any)` casts for SSO tables not in generated types
- Some hooks use `error: any` instead of typed error handling
