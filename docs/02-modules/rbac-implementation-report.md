# Enterprise RBAC + Onboarding Implementation Report

**Date**: 2026-06-17  
**Status**: Complete

## 1. Existing RBAC Audit

See [rbac-audit-report.md](./rbac-audit-report.md). Key findings: dual role systems, no `has_permission()`, incomplete invitations, permissive department RLS.

## 2. New Role Architecture

- `tenants` table with default tenant
- `permissions` catalog (72 permissions across 12 categories)
- `role_permissions` junction
- `user_roles.role_id` FK with `app_role` compatibility shim via `sync_user_app_role()`
- Five system roles: Owner, Admin, Manager, Member, Viewer

## 3. Permission Matrix

- Route: `/admin/roles/permissions`
- Page: `PermissionMatrix.tsx`
- Edge function: `rbac-manage` for bulk permission updates

## 4. Invitation System

- Route: `/admin/users/invitations`
- Edge functions: `send-user-invite`, `validate-user-invite`, `accept-user-invite`
- Accept flow: `/invite/accept?token=...`
- Extended `user_invites` with status, department, pod, welcome message

## 5. User Onboarding Wizard

- Route: `/onboarding` (5 steps)
- Table: `onboarding_progress`
- DashboardLayout redirects incomplete users to `/onboarding`

## 6. Tenant Onboarding Wizard

- Extended `/admin/onboarding` to 8 steps with progress tracking in `tenant.onboarding_progress`

## 7. Department Assignment

- Invite form + user onboarding include department selection
- `department_users` RLS tightened to permission-based access

## 8. SSO Readiness

- Extended `sso_configurations` for Okta
- Doc: [sso-readiness.md](../05-integrations/sso-readiness.md)

## 9. Group Mapping

- Table: `sso_group_mappings`
- Admin UI: Group Mapping tab in Security Settings

## 10. Audit Logging

- Extended `activity_logs` action types for RBAC events
- Route alias: `/admin/audit-logs`
- Helpers in `activity-logger.ts`: `logRbacEvent()`

## 11. Database Changes

Migration: `supabase/migrations/20260617180000_enterprise_rbac.sql`

## 12. API Protection

- `has_permission()` / `get_user_permissions()` PostgreSQL functions
- `_shared/permission-auth.ts` for edge functions
- `AdminRoute` uses permission checks
- `useModuleAccess` wired to `get_user_modules()`

## 13. Security Improvements

- Server-side permission enforcement at DB, edge, and UI layers
- Department write access requires `departments.edit` or admin
- Invite operations require `users.create` permission

## 14. Migration Notes

```bash
npm run migrations:run
```

Deploy edge functions: `rbac-manage`, `send-user-invite`, `validate-user-invite`, `accept-user-invite`

Set env: `APP_URL`, `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`

## 15. Breaking Changes

- `useRoles` no longer uses inline `permissions[]` — use Permission Matrix
- Moderators mapped to Manager role permissions
- `department_users` writes require department permissions
- Admin panel access uses `settings.admin` when RBAC migration applied (fallback to legacy roles)

## Manual QA Matrix

| Role | Expected Access |
|------|-----------------|
| Owner | Full access all routes/APIs |
| Admin | Administrative access |
| Manager | Department-scoped + limited admin |
| Member | Standard module access |
| Viewer | Read-only (view permissions only) |

Test: UI visibility, route guards, edge function 403s, RLS denial on direct queries.
