# SSO Readiness Architecture

> Foundation for enterprise SSO and IdP group-to-role mapping (no full IdP sync yet).

**Status**: Complete (architecture + admin settings)  
**Date**: 2026-06-17

## Overview

SSO configuration uses the existing `sso_configurations` table (aliased from spec's `sso_providers`). Admin settings support Google Workspace, Azure AD, SAML, OIDC, and **Okta** provider types.

## Tables

| Table | Purpose |
|-------|---------|
| `sso_configurations` | Provider credentials and settings |
| `sso_domain_allowlist` | Domain restrictions |
| `sso_login_logs` | SSO login audit |
| `sso_group_mappings` | External group → Control Tower role/department |

## Group Mapping Flow (Future)

```
Azure/Okta/Google Group → sso_group_mappings → roles + department_users
```

Runtime sync is **not implemented** in this phase. Mappings are stored for future provisioning jobs.

## Admin UI

- Security Settings (`/admin/settings/security`) — SSO provider config
- Group Mapping tab — CRUD for `sso_group_mappings`

## Environment

- `SENDGRID_API_KEY` — invitation emails
- `APP_URL` / `VITE_APP_URL` — invite accept links
- Supabase Auth — OAuth providers configured in Supabase dashboard
