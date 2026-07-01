# Productivity Module — Replication & Reuse Plan

This document describes **how the Productivity module works** in the sj-control-tower-framework and gives a **step-by-step plan to replicate or reuse it** in a new demo project so a client can see and use the productivity features.

---

## 1. What the Productivity Module Does

The Productivity module has **two main areas**:

| Area | Purpose | Routes |
|------|---------|--------|
| **Productivity** | Team and individual productivity metrics: weekly records, utilization, efficiency, attendance, department overview, charts | `/productivity`, `/productivity/employee/:email` |
| **Process** | Process documentation (SOP library): categories, documents, create/edit/delete | `/process`, `/process/:category`, `/process/:category/:slug`, `/process/new`, `/process/:category/new`, `/process/:category/:slug/edit` |

**User flows:**
- **Dashboard** (`/productivity`): Summary cards (employees, avg utilization, avg efficiency, tasks completed), department overview cards, department utilization bar chart, attendance donut chart, filterable table of weekly records. Clicking a row goes to employee detail.
- **Employee detail** (`/productivity/employee/:email`): Profile info, aggregate metrics, weekly productivity history with utilization/efficiency bars.
- **Process docs** (`/process`): Category cards with document counts; drill into category → document list → document view; create/edit/delete documents.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  App.tsx                                                                │
│  - Renders productivityRoutes inside ProtectedRoute + DashboardLayout   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ModuleRoute (module="productivity")                                     │
│  - Checks isModuleBundled("productivity") via VITE_MODULE_PRODUCTIVITY   │
│  - If disabled → redirect to /dashboard                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  productivity/routes.tsx                                                │
│  - /productivity              → ProductivityPage                        │
│  - /productivity/employee/:email → EmployeeDetailPage                    │
│  - /process, /process/new, /process/:category, ... → ProcessPage /       │
│    ProcessFormPage                                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ProductivityPage  EmployeeDetailPage  ProcessPage / ProcessFormPage
                    │               │               │
                    ▼               ▼               ▼
            useProductivity    useEmployees    useProcesses
            useDepartments     useEmployeeByEmail  useProcessCategories
            useAvailableWeeks  useEmployeeProductivity  useProcessDocument(s)
                    │               │               │
                    └───────────────┴───────────────┘
                                    │
                                    ▼
                    Supabase client → productivity_records,
                    employee_profiles, departments, pods, pod_members,
                    leave_events, process_categories, process_documents,
                    productivity_alerts, ai_productivity_insights
```

---

## 3. File Inventory (What to Copy)

All paths below are relative to the **framework repo** (`sj-control-tower-framework`).

### 3.1 Module package (copy entire folder)

```
src/modules/productivity/
├── index.ts              # exports productivityRoutes
├── routes.tsx            # Route definitions + ModuleRoute wrapper
├── types/
│   └── index.ts         # Department, Pod, EmployeeProfile, ProductivityRecord,
│                        # LeaveEvent, ProcessCategory, ProcessDocument,
│                        # ProductivityAlert, AIProductivityInsight, etc.
├── hooks/
│   ├── useProductivity.ts   # useProductivityRecords, useProductivitySummary,
│   │                        # useDepartments, useAvailableWeeks
│   ├── useEmployees.ts      # useEmployeeProfiles, useEmployeeByEmail,
│   │                        # useEmployeeProductivity
│   └── useProcesses.ts     # useProcessCategories, useProcessDocuments,
│                           # useProcessDocument, useCreate/Update/DeleteProcessDocument
└── pages/
    ├── ProductivityPage.tsx   # Main dashboard (summary, charts, table)
    ├── EmployeeDetailPage.tsx # Employee profile + weekly history
    ├── ProcessPage.tsx       # Process index / category / document view
    └── ProcessFormPage.tsx   # Create/edit process document form
```

### 3.2 Shared / app integration (reference or copy)

| File | Purpose |
|------|---------|
| `src/components/routing/ModuleRoute.tsx` | Wraps module routes; checks `module` (build-time), auth, optional feature flag/role. **Required** if you use `ModuleRoute`. |
| `src/shared/config/modules.ts` | `MODULE_REGISTRY.productivity` and `isModuleBundled()` including `productivity`. Add or extend for your app. |
| `src/shared/config/env.ts` | `env.modules.productivity` from `VITE_MODULE_PRODUCTIVITY`. Add if you use env-based module toggles. |
| `src/shared/data/navigationStructure.ts` | Nav items for "Productivity" and "Processes" with `module: "productivity"`. Add entries so sidebar shows links when module is enabled. |
| `src/App.tsx` | Import `productivityRoutes` from `@/modules/productivity` and render inside dashboard layout (see snippet below). |

### 3.3 Database

| Asset | Path | Purpose |
|-------|------|---------|
| Migration | `supabase/migrations/20260201_productivity_module.sql` | Creates all tables, indexes, RLS, seed categories. |
| Seed | `supabase/seed/07-productivity.sql` | Departments, pods, pod_members, employee_profiles, productivity_records (e.g. 4 weeks), leave_events, process docs, productivity_alerts. |

### 3.4 UI dependencies

The module uses these from the rest of the app (must exist in demo project):

- `@/components/ui/*`: Card, Button, Input, Badge, Select, Table, Label, Textarea, AlertDialog, etc.
- `@/components/ui/chart`: ChartContainer, ChartTooltip, ChartTooltipContent (and Recharts: BarChart, PieChart, etc.)
- `@/integrations/supabase/client`: `supabase` client
- `@/contexts/AuthContext`: `useAuth()`
- `react-router-dom`: Route, useNavigate, useParams
- `@tanstack/react-query`: useQuery, useMutation, useQueryClient
- `sonner`: toast
- `lucide-react`: icons

---

## 4. Database Schema (Summary)

Tables created by `20260201_productivity_module.sql`:

| Table | Purpose |
|-------|---------|
| `departments` | Department name, description, manager_id, is_active |
| `pods` | Pod name, department_id, lead_id, is_active |
| `pod_members` | pod_id, user_id, role (lead/member) |
| `employee_profiles` | user_id, email, full_name, department_id, title, manager_email, hire_date, location, employment_type, is_active, metadata |
| `productivity_records` | employee_email, week_start, week_number, year, total_hours, billable_hours, tasks_completed, tasks_assigned, meetings_attended, utilization_pct, efficiency_score, attendance_status, department, location |
| `leave_events` | employee_email, leave_type, start_date, end_date, is_half_day, notes, approved_by, status |
| `process_categories` | name, slug, description, icon, sort_order, is_active (seed: Business Dev, HR, QA, Engineering, Operations, Onboarding) |
| `process_documents` | category_id, title, slug, content, file_url, version, status, tags, created_by, updated_by, published_at |
| `productivity_alerts` | employee_email, alert_type, severity, title, description, week_start, is_read, dismissed_at |
| `ai_productivity_insights` | employee_email, department, pod_id, insight_type, week_start, title, content, recommendations, confidence_score, model_used |

RLS: all tables have SELECT + ALL for `authenticated` (simplified; you can tighten for demo).

---

## 5. App Integration Snippets

### 5.1 Register routes (App.tsx)

```tsx
import { productivityRoutes } from "@/modules/productivity";

// Inside your router, after other protected routes:
<Route element={<ProtectedRoute />}>
  <Route element={<DashboardLayout />}>
    {/* ...other routes... */}
    {productivityRoutes}
  </Route>
</Route>
```

### 5.2 Module config (modules.ts)

Ensure `productivity` is in `ModuleId` and in `MODULE_REGISTRY`:

```ts
productivity: {
  id: "productivity",
  name: "Productivity",
  description: "Team and individual productivity metrics, department analysis, AI insights",
  icon: "BarChart3",
  category: "operations",
  isCore: false,
  dependencies: ["platform"],
  defaultEnabled: true,
  featureFlags: [],
},
```

In `isModuleBundled()`:

```ts
productivity: env.modules.productivity,
```

### 5.3 Env (env.ts)

```ts
modules: {
  // ...
  productivity: envBool("VITE_MODULE_PRODUCTIVITY", true),
},
```

### 5.4 Navigation (navigationStructure.ts)

```ts
{ title: "Productivity", href: "/productivity", icon: "BarChart3", module: "productivity" },
{ title: "Processes",     href: "/process",     icon: "FileText",    module: "productivity" },
```

Sidebar should filter by `module` (e.g. `hasModule("productivity")`) so these only show when the productivity module is enabled.

---

## 6. Step-by-Step Replication Checklist for a New Demo Project

Use this to add the Productivity module to a new repo (e.g. client demo).

### Phase 1: Database

1. Copy `supabase/migrations/20260201_productivity_module.sql` into your project’s `supabase/migrations/` (rename if you need to avoid timestamp clashes).
2. Run migrations (e.g. `supabase db push` or apply via dashboard).
3. (Optional) Copy `supabase/seed/07-productivity.sql` and run it so the app has departments, employees, productivity records, and process docs. Adjust emails/names if you need to match your auth users.

### Phase 2: Frontend module

4. Copy the whole folder `src/modules/productivity/` (index, routes, types, hooks, pages) into your project.
5. Fix imports:
   - Ensure `@/components/ui/*`, `@/components/ui/chart`, `@/integrations/supabase/client`, `@/contexts/AuthContext`, `@/components/routing/ModuleRoute` resolve. Create stubs or align paths to your demo app structure.
   - If you don’t use `ModuleRoute`, replace the wrapper in `routes.tsx` with a plain `<Outlet />` or your own guard.

### Phase 3: Routing and layout

6. In your main router (e.g. `App.tsx`), import `productivityRoutes` and render them inside your protected dashboard layout (see 5.1).
7. If you use `ModuleRoute`: ensure `ModuleRoute` exists and that `modules.ts` + `env.ts` define `productivity` and `isModuleBundled("productivity")` so the module is visible when `VITE_MODULE_PRODUCTIVITY=true` (or your default).

### Phase 4: Navigation and config

8. Add "Productivity" and "Processes" to your sidebar nav config with `module: "productivity"` (or equivalent) and ensure the sidebar shows them when the productivity module is enabled.
9. Set `VITE_MODULE_PRODUCTIVITY=true` in `.env` (or your default) so the module is bundled and nav/routes are active.

### Phase 5: Verification

10. Log in and open `/productivity`: you should see the dashboard (summary, department overview, charts, table). If you didn’t seed, you’ll see “No productivity records” and can add data via SQL or a future CSV/import.
11. Open `/process`: you should see process categories (and docs if seed was run). Create a document from `/process/new` or `/process/<category>/new`.
12. Click an employee row on `/productivity` to go to `/productivity/employee/:email` and see profile + weekly history (again, data from seed or your own).

---

## 7. Minimal Reuse (Copy-Paste)

If you want the **smallest set of files** to get the same behavior in a demo:

1. **DB:** `20260201_productivity_module.sql` + optionally `07-productivity.sql`.
2. **Code:** Entire `src/modules/productivity/` directory.
3. **Integration:**  
   - Register `productivityRoutes` in the app router.  
   - Add `productivity` to your module registry and env so `ModuleRoute` allows access.  
   - Add Productivity and Processes to sidebar nav with `module: "productivity"`.

After that, the client can use the Productivity dashboard, employee detail, and Process documentation as in the framework.

---

## 8. Optional Enhancements (Not in Framework Today)

The framework’s current implementation does **not** include:

- CSV import for productivity data (only DB seed / manual SQL).
- AI productivity insights UI (table exists; no page/hook in module).
- Productivity alerts UI (table exists; no dedicated list in module).
- Admin sub-routes (e.g. employee management, productivity import) — those are listed in the blueprint but are not part of the current `productivity` module routes.

To replicate the **exact** current behavior, you only need the files and steps above. You can add CSV import, alerts, or AI insights later in the demo if needed.

---

## 9. Quick Reference — Routes

| Path | Page | Description |
|------|------|-------------|
| `/productivity` | ProductivityPage | Dashboard: summary cards, department overview, bar chart, attendance donut, records table |
| `/productivity/employee/:email` | EmployeeDetailPage | Employee profile + weekly productivity history |
| `/process` | ProcessPage (index) | Process category cards |
| `/process/new` | ProcessFormPage | New document (category chosen in form) |
| `/process/:category` | ProcessPage (category) | Documents in category |
| `/process/:category/new` | ProcessFormPage | New document in category |
| `/process/:category/:slug` | ProcessPage (document) | View document |
| `/process/:category/:slug/edit` | ProcessFormPage | Edit document |

---

## 10. Repo and Path Reference

- **GitHub:** https://github.com/sjinnovation/sj-control-tower-framework  
- **Local path:** `/Users/ziauddin/Desktop/react/sj-control-tower-framework`  
- **Module path:** `src/modules/productivity/`  
- **Migration:** `supabase/migrations/20260201_productivity_module.sql`  
- **Seed:** `supabase/seed/07-productivity.sql`

If you need to extend this plan (e.g. role-based access, different RLS, or adding CSV import), we can add a follow-up section or document.
