# Admin AI Agent Categories – Implementation Reference

Admin UI for managing AI agent categories (grouping/organizing AI agents). This doc serves as the replication checklist and implementation reference.

## Purpose

- **CRUD**: Create, read, update, delete categories.
- **Stats**: Total categories, active categories, total agents, active agents (per category and overall).
- **Views**: Cards and table.
- **Actions**: Add category, edit, toggle active/inactive, delete (**only when category has no agents**).
- **Relationship**: Categories are referenced by agents via slug (`ai_agents.category` = `ai_agent_categories.slug`). Counts are computed by matching in the app.

## Data Source

- **Supabase (PostgreSQL)**. No Edge Functions; all reads/writes via Supabase client.
- **Tables**:
  - `ai_agent_categories`: id, name, slug, description, icon, is_active, display_order, created_at, updated_at.
  - `ai_agents`: at least id, category, is_enabled; optional `deleted_at` for excluding soft-deleted agents from counts.

## Data Flow

| Operation | Hook / method | Behavior |
|-----------|----------------|----------|
| List with counts | `useAIAgentCategoriesWithCounts()` | Fetches `ai_agent_categories` (order by display_order), fetches `ai_agents` where `deleted_at IS NULL` (id, category, is_enabled); in app code: for each category, agent_count = agents where category === slug, active_agent_count = those with is_enabled. |
| Create | `useCreateAIAgentCategory()` | Insert into `ai_agent_categories`; invalidate list. |
| Update | `useUpdateAIAgentCategory()` | Update by id; invalidate list. |
| Toggle active | `useToggleAIAgentCategoryStatus()` | Set is_active to !current; invalidate list. |
| Delete | `useDeleteAIAgentCategory()` | Server checks agent count by slug; if > 0 throw; else delete by id. UI disables Delete when agent_count > 0 and uses confirm AlertDialog. |

**Cache**: TanStack Query; key `aiAgentCategoriesKeys.all` / `withCounts()`. After any mutation, invalidate `aiAgentCategoriesKeys.all`.

## Database Schema

- **ai_agent_categories**: Migrations `20260218120000`, `20260218130000`, `20260220100000_agent_categories_spec.sql` (name UNIQUE, icon default 'folder', RLS SELECT for authenticated: active-only or admin). Trigger sets updated_at on UPDATE.
- **ai_agents**: id, category, is_enabled, deleted_at (nullable). Counts use rows where deleted_at IS NULL.

## Files

| Role | File |
|------|------|
| Page | `src/pages/admin/ai/AgentCategories.tsx` – header, stats cards, Cards/Table view, Add/Edit dialogs, Delete AlertDialog, toasts. |
| Hook | `src/hooks/useAIAgentCategories.ts` – useAIAgentCategoriesWithCounts, useCreate, useUpdate, useDelete, useToggle; typedQuery/typedInsert/typedUpdate. |
| Helpers | `src/lib/supabase-helpers.ts` – typedQuery, typedInsert, typedUpdate (optional; page uses direct Supabase client). |
| Route | `/admin/ai/agent-categories` → `AgentCategories` (ProtectedRoute + AdminRoute). |
| Nav | `src/shared/data/navigationStructure.ts` – "Agent Categories" → `/admin/ai/agent-categories` under AI Hub. |

## UI Dependencies

- shadcn/ui: Card, Button, Badge, Input, Textarea, Label, Switch, Table, ToggleGroup, Dialog, Select, Tooltip, AlertDialog.
- lucide-react icons; sonner toasts; date-fns format.

## Checklist (Replication)

- [x] `ai_agent_categories` table and optional `updated_at` trigger.
- [x] `ai_agents` has id, category, is_enabled (and optional deleted_at).
- [x] RLS: admins can INSERT/UPDATE/DELETE categories.
- [x] Hook: fetch categories + agents, compute agent_count and active_agent_count per category; create/update/delete/toggle with list invalidation.
- [x] Delete allowed **only when category has no agents** (server check + disabled Delete button in UI).
- [x] Page: stats, cards/table, add/edit dialogs, wired to hook.
- [x] Route `/admin/ai/agent-categories` and "Agent Categories" in admin nav.
