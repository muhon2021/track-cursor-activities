# Control Tower — Modular Architecture Blueprint

## Purpose

This documentation set provides complete blueprints for extracting the Control Tower monolithic application into 9 independent, deployable modules. Each module document contains the full file inventory, route definitions, database dependencies, and implementation guidance needed to replicate the module in a new project.

---

## Target Architecture

The monolith (single React app) is decomposed into these modules:

| # | Module | Slug | Description |
|---|--------|------|-------------|
| 1 | Platform Core | platform | Auth, layouts, navigation, UI library, shared infrastructure |
| 2 | EOS | eos | V/TO, OKRs, Scorecard, Issues, Accountability Chart |
| 3 | Meetings | meetings | Meeting scheduling, transcripts, agendas, takeaways, Zoom |
| 4 | Projects | projects | Projects, milestones, billing, resource projection, ActiveCollab |
| 5 | Actions | actions | Standalone task management (My Tasks), streams |
| 6 | Business Development | business-dev | Deals, leads, contacts, clients, email, HubSpot |
| 7 | Knowledge Base | knowledge-base | Organization & personal knowledge, documents, embeddings, RAG |
| 8 | Productivity | productivity | Team metrics, employee tracking, process documentation |
| 9 | Admin | admin | Admin panel, user management, integrations, settings, reports |

---

## Technology Stack

- **Frontend:** React 18 + TypeScript, Vite (port 8080), React Router v6
- **Backend:** Supabase (PostgreSQL, Edge Functions, Auth, Storage)
- **Styling:** Tailwind CSS + shadcn/ui component library
- **State:** TanStack React Query with localStorage persist
- **Path Alias:** `@/*` maps to `./src/*`
- **Build:** Vite with `@vitejs/plugin-react-swc`

---

## Recommended Directory Structure (New Project)

```
src/
├── modules/
│   ├── platform/          # Auth, layouts, UI, shared
│   │   ├── index.ts
│   │   ├── routes.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   └── types/
│   ├── eos/
│   │   ├── index.ts
│   │   ├── routes.tsx
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── types/
│   ├── meetings/
│   ├── projects/
│   ├── actions/
│   ├── business-dev/
│   ├── knowledge-base/
│   ├── productivity/
│   └── admin/
├── shared/
│   ├── config/
│   │   ├── env.ts         # Environment variable abstraction
│   │   ├── modules.ts     # Module registry (enable/disable)
│   │   └── api.ts         # API endpoint configuration
│   ├── components/        # Shared UI (from shadcn/ui)
│   ├── contexts/          # AuthContext, etc.
│   ├── integrations/      # Supabase client
│   ├── lib/               # Utilities
│   └── types/             # Shared types
├── App.tsx                # Assembles module routes
└── main.tsx               # Entry point
```

---

## Module Enable/Disable System

Each module should be toggleable via environment variables and/or database:

```
# .env
VITE_MODULE_EOS_ENABLED=true
VITE_MODULE_MEETINGS_ENABLED=true
VITE_MODULE_PROJECTS_ENABLED=true
VITE_MODULE_ACTIONS_ENABLED=true
VITE_MODULE_BUSINESS_DEV_ENABLED=true
VITE_MODULE_KNOWLEDGE_BASE_ENABLED=true
VITE_MODULE_PRODUCTIVITY_ENABLED=true
```

The Admin panel provides a UI for this. The `app_modules` database table + `get_user_modules` RPC control per-user module visibility.

---

## App Shell Pattern

The refactored `App.tsx` should import routes from each module:

```tsx
import { platformRoutes } from '@/modules/platform/routes';
import { eosRoutes } from '@/modules/eos/routes';
// ... etc

function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {platformRoutes}
            {isModuleEnabled('eos') && eosRoutes}
            {isModuleEnabled('meetings') && meetingsRoutes}
            {/* ... */}
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </AppProviders>
  );
}
```

---

## Cross-Module Dependency Map

```
Platform Core <- (all modules depend on this)
  ├── Auth (AuthContext, ProtectedRoute)
  ├── Layouts (DashboardLayout, AdminLayout)
  ├── UI Library (shadcn/ui components)
  ├── Navigation (navigationStructure.ts)
  └── Supabase Client

EOS <- standalone (uses Platform only)
Meetings <- standalone (uses Platform only)
  └── optional: Projects (link meetings to projects)
  └── optional: Contacts (participant matching)
Projects <- depends on:
  └── Meetings (project meetings tab)
  └── Business Dev (source deal, client)
  └── Knowledge Base (project knowledge)
Actions <- standalone (uses Platform only)
  └── optional: Meetings (convert takeaway to task)
Business Development <- depends on:
  └── Meetings (deal meetings, client meetings)
  └── Knowledge Base (deal knowledge sync)
Knowledge Base <- standalone (uses Platform only)
  └── optional: Meetings (embedded meetings)
  └── optional: Clients (client knowledge)
Productivity <- standalone (uses Platform only)
Admin <- imports settings from ALL modules
```

---

## Environment Variables (Deployment)

```
# Required: Supabase
VITE_SUPABASE_PROJECT_ID=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_API_BASE_URL=

# Module Toggles
VITE_MODULE_EOS_ENABLED=true
VITE_MODULE_MEETINGS_ENABLED=true
VITE_MODULE_PROJECTS_ENABLED=true
VITE_MODULE_ACTIONS_ENABLED=true
VITE_MODULE_BUSINESS_DEV_ENABLED=true
VITE_MODULE_KNOWLEDGE_BASE_ENABLED=true
VITE_MODULE_PRODUCTIVITY_ENABLED=true

# Integration Feature Flags
VITE_HUBSPOT_ENABLED=false
VITE_ACTIVECOLLAB_ENABLED=false
VITE_ZOOM_ENABLED=false
VITE_GOOGLE_DRIVE_ENABLED=false
VITE_GMAIL_ENABLED=false
VITE_SENDGRID_ENABLED=false
```

---

## Deployment Checklist (New Client)

1. Create new Supabase project
2. Run all migrations (schema + seed)
3. Deploy frontend (Vite build to static hosting)
4. Set environment variables
5. Log in as admin
6. Configure module enablement via Admin -> Settings
7. Set up integrations (HubSpot, ActiveCollab, Zoom, etc.)
8. Configure project statuses, work types, project modules
9. Assign user roles and module permissions

---

## Document Index

| Document | Module |
|----------|--------|
| [01-platform-core.md](../02-modules/01-platform-core.md) | Platform Core (auth, layouts, UI, config) |
| [02-eos.md](../02-modules/02-eos.md) | EOS (V/TO, OKRs, Scorecard, Issues, Accountability) |
| [03-meetings.md](../02-modules/03-meetings.md) | Meetings (schedule, transcripts, agendas, takeaways) |
| [04-projects.md](../02-modules/04-projects.md) | Projects (projects, milestones, billing, resources) |
| [05-actions.md](../02-modules/05-actions.md) | Actions (My Tasks, streams) |
| [06-business-development.md](../02-modules/06-business-development.md) | Business Development (deals, leads, clients, contacts, email) |
| [07-knowledge-base.md](../02-modules/07-knowledge-base.md) | Knowledge Base (documents, embeddings, RAG) |
| [08-productivity.md](../02-modules/08-productivity.md) | Productivity (team metrics, process documentation) |
| [09-admin.md](../02-modules/09-admin.md) | Admin Panel (user mgmt, integrations, settings, reports) |
