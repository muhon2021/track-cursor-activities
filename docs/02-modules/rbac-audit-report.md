# RBAC Audit Report

> Pre-implementation audit of authentication, authorization, and user onboarding systems.

**Status**: Complete  
**Module**: admin  
**Date**: 2026-06-17

## Executive Summary

The platform has a **fragmented authorization model** with three parallel role concepts and partial permission enforcement. Auth roles (`app_role` enum) are enforced; custom roles in the `roles` table are UI-only. Invitations exist at the database layer but lack email delivery and accept flows. Onboarding is split between a user modal and an admin deployment wizard.

## Existing Roles

| Layer | Values | Enforced? |
|-------|--------|-----------|
| **`app_role` enum** (`user_roles.role`) | `admin`, `moderator`, `user` | Yes — route guards, RLS, edge functions |
| **`roles` table** (catalog) | `admin`, `moderator`, `user` (seed) | No — UI-only in `RoleManagement.tsx` |
| **Agency roles** (`user_role_preferences`) | `owner`, `pm`, `ic`, `bd` | Dashboard routing only |

## Existing Permission Model

### Enforced Today

- `has_role()` / `is_admin()` PostgreSQL functions
- `user_module_permissions` (DB ready; frontend not wired)
- `kb_source_permissions`, `pod_permissions`, `task_category_roles`

### UI Only / Not Enforced

- `RoleManagement.tsx` `AVAILABLE_PERMISSIONS` constant
- `useRoles.ts` `permissions[]` array (no DB column)
- `ModuleRoute` `requiredRole` prop (unused on any route)

### Hardcoded Frontend Checks

Examples in `AdminRoute.tsx`, `TopNav.tsx`, `Knowledge.tsx`, `useOKRPermissions.ts`, `useMeetingPermissions.ts`:

```typescript
profile?.role === "admin" || profile?.role === "moderator"
```

## Auth Provider & Login Flow

- **Provider**: Supabase Auth via `AuthContext.tsx`
- **Methods**: Email/password, Google OAuth, Microsoft/Azure, generic SSO
- **Post-login**: Profile + `user_roles` fetch; role priority `admin > moderator > first found`
- **SSO**: `sso_configurations` table (not in generated TypeScript types)

## User Management & Invitations

| Feature | Status |
|---------|--------|
| `/admin/users` | Working — enum role assignment |
| Invitations | ~30% — `user_invites` + `useUserInvites.ts`; no email, no accept flow |
| Public `/signup` | Open — not invite-gated |

## Departments

- Implemented: `DepartmentManagement.tsx`, `useDepartments.ts`, `departments`, `department_users`
- Gap: RLS is permissive (`USING (true)`)

## Onboarding

| Flow | Location | Steps |
|------|----------|-------|
| User modal | `OnboardingWizard.tsx` in `DashboardLayout` | Welcome → profile → org → complete |
| Tenant wizard | `/admin/onboarding` | Org → branding → features → seed → admin check → complete |

## Audit Logs

- `activity_logs` at `/admin/logs`
- Written via `audit-log-writer` edge function

## Critical Gaps

1. Dual role systems — `user_roles` enum vs `roles` table
2. No generic `has_permission()` function
3. Invitation pipeline incomplete
4. Moderator inconsistency — allowed in `AdminRoute`, blocked in `TopNav`
5. No multi-tenant isolation (addressed by tenant prep in implementation)

## Recommendations

1. Unify roles via `role_id` FK with `app_role` compatibility shim
2. Create `permissions` + `role_permissions` junction tables
3. Implement server-side permission checks at DB, edge, and UI layers
4. Complete invitation email + accept flow
5. Add `tenant_id` columns with default tenant for future multi-tenancy
