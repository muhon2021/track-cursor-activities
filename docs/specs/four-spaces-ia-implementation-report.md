# Four Spaces IA — Implementation Report

**Date**: 2026-06-18  
**Status**: Complete (behind feature flag)  
**Spec**: [four-spaces-ia.md](./four-spaces-ia.md)

## 1. Existing IA Audit

Prior state: dual layout shells (`DashboardLayout` + `AdminLayout`), ~185 routes, 7 main sidebar groups + 6 admin groups, no favorites/recents/sidebar search, decentralized breadcrumbs, four parallel access-control systems (module access sidebar-only, feature flags, agency roles, enterprise permissions on admin gate only).

Key issues addressed: admin/app duplication, unclear URL prefixes (`/okrs`, `/process`), nav/route mismatch for `user_module_permissions`, meetings scattered outside EOS.

## 2. New Space Architecture

| Space | Prefix | Dashboard |
|-------|--------|-----------|
| Sales | `/sales/*` | `/sales/dashboard` |
| Knowledge | `/knowledge/*` | `/knowledge/dashboard` |
| Operations | `/operations/*` | `/operations/dashboard` |
| EOS | `/eos/*` | `/eos/dashboard` |

Registry: [`src/shared/config/spaces.ts`](../src/shared/config/spaces.ts)  
Navigation: [`src/shared/data/spaceNavigation.ts`](../src/shared/data/spaceNavigation.ts)

## 3. Modules Assigned to Each Space

See spec and `spaceNavigation.ts` for full mapping. Meetings live **only in EOS** (`/eos/meetings/*`). Unbuilt spec items omitted (Revenue Analytics, Billing, People Analyzer, Quarterly/Annual Planning).

## 4. Space Switcher

[`SpaceSwitcher.tsx`](../src/components/layout/SpaceSwitcher.tsx) in TopNav — tab-style selector filtered by `useSpaceAccess()`. Persists selection via `user_space_preferences.default_space`.

## 5. Dynamic Sidebar

[`SpaceSidebar.tsx`](../src/components/layout/SpaceSidebar.tsx): space-scoped nav, collapse (shadcn sidebar), client-side menu filter, favorites, recently visited (max 8), pin via star on items.

## 6. Route Migration Plan

New routes in [`src/modules/spaces/`](../src/modules/spaces/). Legacy redirects in [`src/lib/space-routes.ts`](../src/lib/space-routes.ts) + [`legacyRedirects.tsx`](../src/modules/spaces/legacyRedirects.tsx).

**Enable**: set `features.enableFourSpaces = true` in `app_config` (key: `features.enableFourSpaces`).

**Rollback**: set flag to `false` — restores legacy `DashboardLayout` + `AdminLayout`.

## 7. Breadcrumb Changes

[`SpaceBreadcrumbs.tsx`](../src/components/layout/SpaceBreadcrumbs.tsx) + [`useSpaceBreadcrumbs`](../src/hooks/useSpaceBreadcrumbs.ts) — format: `{Space} Space > {Page}`.

## 8. Favorites System

Table: `user_space_preferences` ([migration](../supabase/migrations/20260618120000_user_space_preferences.sql))  
Hook: [`useSpacePreferences`](../src/hooks/useSpacePreferences.ts)

## 9. Role Visibility

[`useSpaceAccess`](../src/hooks/useSpaceAccess.ts) combines module access, agency roles, EOS flag, enterprise permissions. Wired to switcher, sidebar, and page search index.

## 10. Performance

- Space dashboards lazy-loaded (`src/pages/spaces/index.tsx`)
- Sidebar nav filtered with `useMemo`
- Space preferences loaded once per session
- Loading gate in `SpaceLayout` prevents permission flicker

## 11. Backward Compatibility

Legacy paths redirect when Four Spaces is enabled. Canonical new paths skip redirect (`resolveLegacyRedirect` returns null for `/sales/*`, etc.). Old layouts remain when flag is off.

## 12. Breaking Changes & Notes

| Change | Impact |
|--------|--------|
| Meetings URLs | `/meetings/*` → `/eos/meetings/*` when flag on |
| Admin URLs | `/admin/*` → space-prefixed paths |
| OKRs | `/okrs` → `/eos/rocks` |
| CRM | `/clients` → `/sales/accounts` |
| Knowledge root | `/knowledge` → `/knowledge/base` |

**ModuleRoute** now enforces `useModuleAccess()` at route level (not sidebar-only).

**Not migrated yet**: remove legacy route definitions (Phase 5 of rollout — intentional).

## Files Created/Modified

**Created**: `docs/specs/four-spaces-ia.md`, `src/shared/config/spaces.ts`, `src/shared/data/spaceNavigation.ts`, `src/contexts/SpaceContext.tsx`, `src/hooks/useSpaceAccess.ts`, `src/hooks/useSpacePreferences.ts`, `src/hooks/useSpaceBreadcrumbs.ts`, `src/hooks/usePageIndex.ts`, `src/lib/space-routes.ts`, `src/components/layout/Space*.tsx`, `src/components/routing/AppRouteTree.tsx`, `src/components/routing/LegacyPathRedirect.tsx`, `src/modules/spaces/*`, `src/pages/spaces/index.tsx`, migration SQL.

**Modified**: `App.tsx`, `TopNav.tsx`, `ModuleRoute.tsx`, `useAppConfig.ts`, `cache.ts`.

## Enabling Four Spaces

```sql
INSERT INTO app_config (key, value, category)
VALUES ('features.enableFourSpaces', 'true', 'features')
ON CONFLICT (key) DO UPDATE SET value = 'true';
```

Or via Admin → Advanced Settings once exposed in UI.

Apply migration: `npm run migrations:run`
