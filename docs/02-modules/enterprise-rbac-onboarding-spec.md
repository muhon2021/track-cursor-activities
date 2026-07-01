# Feature: Enterprise RBAC + User Onboarding

> Database-driven role-based access control with invitations, onboarding wizards, SSO readiness, and audit logging.

**Status**: Approved  
**Module**: admin  
**Date**: 2026-06-17

## Overview

This feature unifies fragmented authorization into a centralized RBAC model with five default roles (Owner, Admin, Manager, Member, Viewer), a permission matrix, user invitations with email workflow, user and tenant onboarding wizards, SSO/group-mapping foundations, and server-side enforcement.

**Architectural decisions:**
- Single-tenant now with `tenants` table + `tenant_id` columns
- Map existing roles: admin→Admin, moderator→Manager, user→Member; add Owner and Viewer
- Keep `app_role` enum as compatibility shim synced from assigned roles

## User Stories

- As an admin, I want to manage roles and permissions so that access is controlled centrally
- As an admin, I want to invite users with role and department assignment so that provisioning is controlled
- As a new user, I want an onboarding wizard so that I can set up my profile and learn the platform
- As a tenant admin, I want a setup wizard so that I can configure the platform step by step
- As a security auditor, I want RBAC events logged so that changes are traceable

## Database Design

### New Tables

| Table | Purpose |
|-------|---------|
| `tenants` | Tenant registry (default tenant for single-tenant mode) |
| `permissions` | Global permission catalog |
| `role_permissions` | Role-to-permission junction |
| `onboarding_progress` | User onboarding step tracking |
| `sso_group_mappings` | IdP group to role/department mapping |

### Extend Existing Tables

| Table | Changes |
|-------|---------|
| `roles` | `tenant_id`, `is_system`, `slug`, `cloned_from_id` |
| `user_roles` | `role_id` FK to `roles.id` |
| `user_invites` | `status`, `department_id`, `pod_id`, `welcome_message`, `role_id`, `tenant_id` |
| `sso_configurations` | `tenant_id`, Okta provider type |

### DB Functions

- `has_permission(user_id, permission_key)` → boolean
- `get_user_permissions(user_id)` → setof text
- `sync_user_app_role(user_id)` → void

## API Design

### Edge Functions

| Function | Purpose |
|----------|---------|
| `send-user-invite` | Create invite + send email |
| `validate-user-invite` | Validate token, return invite details |
| `accept-user-invite` | Mark accepted, assign role/dept |
| `rbac-manage` | Admin CRUD for role permissions |

## UI Routes

| Route | Page |
|-------|------|
| `/admin/roles` | Role catalog |
| `/admin/roles/permissions` | Permission matrix |
| `/admin/users/invitations` | Invitation management |
| `/admin/audit-logs` | Audit log viewer |
| `/onboarding` | User onboarding wizard |
| `/admin/onboarding` | Tenant setup wizard (8 steps) |
| `/invite/accept` | Accept invitation |

## Default Roles

| Role | Slug | Access |
|------|------|--------|
| Owner | owner | Full access |
| Admin | admin | Administrative |
| Manager | manager | Department/team management |
| Member | member | Standard user |
| Viewer | viewer | Read-only |

## Permission Categories

Users, Departments, Knowledge Base, AI Hub, Integrations, Settings, Analytics, EOS, Automation, Memory, MCP, Notifications

Actions: view, create, edit, delete, export, admin

## Security Requirements

- All permission checks enforced at DB (RLS), edge functions, and UI
- No client-side-only authorization
- RLS on all new tables
- Audit logging for all RBAC mutations

## Testing Checklist

- [ ] Owner has full access
- [ ] Admin has administrative access
- [ ] Manager has department-scoped access
- [ ] Member has standard access
- [ ] Viewer is read-only
- [ ] Invite send → accept → onboarding flow works
- [ ] Permission matrix saves correctly
- [ ] Audit logs capture RBAC events
