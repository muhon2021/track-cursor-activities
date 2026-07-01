# User Management Module — V2 Enhancement: Implementation Summary

**Status:** Complete (Sprints 1–4)
**Branch:** `claude/optimistic-rubin-14n0jk`

This document summarizes what was actually built for the "User Management Module — V2
Enhancement Plan," adapted from a multi-tenant spec onto this codebase's single-tenant
`tenants + roles + permissions + role_permissions + user_roles` schema. It also records
every sub-feature that was dropped or reinterpreted, and why, so future sessions don't
re-litigate the same architectural mismatches.

## Sprint 1 — Custom Role Builder

- Added `permissions.is_assignable` flag and a fuller permission catalog (`org.*` keys),
  including several keys reserved for later sprints (`org.manage_mfa_policy`,
  `org.view_sessions`, `org.terminate_sessions`, `org.manage_scim`, `org.delete_org`,
  `org.transfer_ownership`).
- New role builder UI (`RoleBuilder.tsx`) for creating/editing roles and assigning
  permissions, with non-assignable permissions (`org.delete_org`, `org.transfer_ownership`)
  excluded from the picker.
- Migration: `20260623120000_role_builder_v2.sql`.

## Sprint 2 — MFA Enforcement

- `mfa_policies` (org-wide policy: required, grace period, allowed factors) and
  `mfa_enrollment_status` (per-user enrollment/grace tracking) tables.
- `mfa-policy` and `mfa-enrollment` edge functions (action-based POST, since
  `supabase.functions.invoke` cannot send GET/PUT — see "Lessons learned" below).
- `useMfaGate()` hook + `ProtectedRoute` integration: force-redirects users past their
  grace period to `/mfa/enroll` (a standalone, no-sidebar page); shows an amber
  `MfaGraceBanner` while still in grace.
- Admin UI at `/admin/security/mfa` (policy toggle + per-user enrollment table with
  remind/reset actions); self-service UI at `/settings/security` (enroll/verify/unenroll
  TOTP via Supabase Auth's native MFA API).
- Migration: `20260623130000_mfa_enforcement.sql`.

**Dropped: SSO Certificate Rotation.** The original plan assumed SAML-style X.509
certificates. This app's SSO is OAuth-based (Google / Azure AD) — there are no
certificates anywhere in the integration layer to rotate. Skipped entirely rather than
building a feature with no underlying concept to attach to.

## Sprint 3 — Self-Signup Domain Whitelist (+ Notification Center)

- **Notification Center required no new work** — it was already a complete, fully wired
  module (`src/modules/notifications/`) before this plan started.
- New `signup_domain_allowlist` table + `org.manage_signup_policy` permission.
- `AFTER INSERT ON auth.users` trigger (`enforce_signup_domain_whitelist`) that
  **hard-rejects** signups from non-whitelisted domains (per explicit decision — the
  alternative considered was queuing for manual admin approval instead of rejecting
  outright). The trigger always exempts:
  - the bootstrap first user (so the chicken-and-egg admin problem isn't reintroduced),
  - anyone with a matching `user_invites` row (invited users reuse the same `Signup.tsx`
    flow as organic self-signups, differentiated only by URL query params).
  - If no domains are configured, the whitelist is a no-op (open signup) — turning the
    feature on requires deliberately adding at least one domain.
- `signup-domain-whitelist` edge function: admin CRUD (`list`/`add`/`toggle`/`remove`,
  permission-gated) plus a public `check` action used by `Signup.tsx` for a friendly
  client-side pre-check before hitting the Auth API (fails open on error — the DB trigger
  is the real authority, not this pre-check).
- Admin UI at `/admin/security/signup-whitelist`, linked from Security Settings.
- Migration: `20260623140000_signup_domain_whitelist.sql`.

## Sprint 4 — Admin Session Management

- New SECURITY DEFINER SQL functions — `admin_list_user_sessions`,
  `admin_terminate_session`, `admin_terminate_user_sessions` — operating directly on the
  internal `auth.sessions` / `auth.refresh_tokens` tables, exposed as plain RPCs (no edge
  function needed). Each function checks `org.view_sessions` / `org.terminate_sessions`
  internally.
- **Why direct table access instead of the admin REST API:** Supabase's `auth.admin.*`
  client surface has no method to list or selectively terminate another user's sessions.
  `auth.admin.signOut(jwt, scope)` requires the *target's own* JWT, not a user ID, so it's
  unusable from an admin context. The only admin-safe way to revoke a specific session is
  to manipulate the session/refresh-token rows directly via a SECURITY DEFINER function.
- Caveat surfaced in the UI: revoking a refresh token blocks future token *refreshes*, but
  a still-valid access token keeps working until it naturally expires (Supabase JWT
  validation is stateless by default — there's no per-request session-table check).
- Admin UI at `/admin/security/sessions`, linked from Security Settings.
- Migration: `20260623150000_admin_session_management.sql`.

**Dropped: Ownership Transfer.** The original plan models transferring an *organization*
to a new owner — a multi-tenant concept. This app has exactly one tenant
(`00000000-0000-0000-0000-000000000001`) and no "owner" role distinct from "admin" (any
number of admins can exist, all with equal standing). There is nothing to transfer.
`org.transfer_ownership` and `org.delete_org` permission keys exist in the catalog
(non-assignable) for forward compatibility if multi-tenancy is ever introduced, but no
feature was built against them.

**Dropped (deferred): SCIM Provisioning.** Building a SCIM 2.0 server (`/scim/v2/Users`,
`/scim/v2/Groups`, bearer-token auth, IdP-driven provisioning/deprovisioning) is a
substantial, well-defined feature — not a mismatch like the two items above, just out of
scope for this round. Deferred until there's a concrete IdP integration requirement.
`org.manage_scim` permission key exists in the catalog, unused.

## Lessons learned / conventions reinforced

- **Edge functions must be action-based, not method-based.** `supabase.functions.invoke()`
  always sends POST; there's no way to dispatch GET/PUT from the client. Every new
  function in this plan (`mfa-policy`, `mfa-enrollment`, `signup-domain-whitelist`)
  branches on a `{ action: "..." }` body field, matching the pre-existing `rbac-manage`
  convention.
- **DB triggers that gate `auth.users` inserts must explicitly account for**: the
  bootstrap first-user case, and any flow that creates users through means other than the
  organic signup form (here, admin-issued invites reusing the same signup page).
- **Direct SQL access via SECURITY DEFINER functions is sometimes the only option** when
  a feature needs capabilities the Supabase client SDK doesn't expose (per-session
  termination). Always gate these functions with an internal `has_permission()` check
  since they're reachable as RPCs by any authenticated user.
- Permission keys for not-yet-built features were added to the catalog ahead of time in
  Sprint 1 (`org.view_sessions`, `org.manage_scim`, etc.) — useful as a forward-compatible
  scaffold, but don't assume a catalog entry means the feature exists; always check for an
  actual consumer (edge function, RPC, or UI) before relying on one.

## Where to look

| Concern | Files |
|---|---|
| Role Builder | `src/pages/admin/RoleBuilder.tsx`, `20260623120000_role_builder_v2.sql` |
| MFA | `src/hooks/useMfa.ts`, `useMfaGate.ts`, `src/pages/MFAEnroll.tsx`, `src/pages/admin/MFAPolicyPage.tsx`, `supabase/functions/mfa-policy/`, `supabase/functions/mfa-enrollment/`, `20260623130000_mfa_enforcement.sql` |
| Signup whitelist | `src/hooks/useSignupWhitelist.ts`, `src/pages/admin/SignupWhitelistPage.tsx`, `supabase/functions/signup-domain-whitelist/`, `20260623140000_signup_domain_whitelist.sql` |
| Admin sessions | `src/hooks/useAdminSessions.ts`, `src/pages/admin/AdminSessions.tsx`, `20260623150000_admin_session_management.sql` |
