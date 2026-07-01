# Notifications Module — Phase 1 Audit

**Status**: Complete  
**Date**: 2026-06-19  
**Initiative**: Roadmap #10 — Enterprise Notifications Module

## Existing Capabilities

### Database

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `notifications` | In-app notification store | `user_id`, `title`, `message`, `type`, `is_read`, `read_at`, `link`, `metadata` |
| `eos_notification_preferences` | EOS per-event channel prefs | `user_id`, `event_type`, `in_app`, `email`, `tenant_id` |
| `email_logs` | Outbound email audit | `recipient`, `status`, `sent_at`, `provider` |
| `sendgrid_config` | SendGrid integration | `from_email`, `is_enabled`, `api_key` |
| `email_tracking_events` | SendGrid engagement | `event_type`, `sendgrid_message_id` |
| `activity_logs` | User action audit | `action`, `resource_type`, `details` |
| `productivity_alerts` | Productivity module alerts | `employee_email`, `severity`, `is_read` |
| `ai_digest_logs` | AI digest history | `digest_type`, `summary`, `was_read` |

### Edge Functions

| Function | Channels | Notes |
|----------|----------|-------|
| `send-notification` | in_app, slack | No auth check; service role |
| `eos-notification-dispatcher` | in_app only | Ignores `eos_notification_preferences` |
| `send-email` / `send-email-with-tracking` | email | SendGrid |
| `send-meeting-notification` | email | No `notifications` insert |
| `send-feedback-notification` | in_app, slack | May violate `type` CHECK |

### Frontend

| File | Capability |
|------|------------|
| `src/hooks/useNotifications.ts` | Fetch, mark read, delete, realtime, poll |
| `src/pages/Notifications.tsx` | All/unread filter, delete |
| `src/components/layout/TopNav.tsx` | Bell dropdown, unread badge |
| `src/hooks/usePreferences.ts` | Metadata toggles (not enforced) |
| `src/pages/admin/settings/NotificationSettings.tsx` | Email sender config |

### RBAC (seeded, not wired)

- `notifications.view`, `.create`, `.edit`, `.delete`, `.export`, `.admin`

## Reusable Components & Patterns

- React Query + `queryKeys.notifications` / `invalidateKeys.notifications()`
- Supabase Realtime `postgres_changes` on `notifications`
- `PermissionRoute` + `usePermissions()` + `EOSPermissionGate` pattern
- `sendgrid-email.ts` shared helper
- `requirePermission()` in `_shared/permission-auth.ts`
- `get_user_tenant_id()` + `has_permission()` RLS (EOS revamp)

## Gaps

| Gap | Severity |
|-----|----------|
| No event catalog, rules, logs, global preferences tables | High |
| No `tenant_id`, `category`, `event_key`, `severity`, `priority`, `archived_at` on notifications | High |
| No category filters, search, pagination, archive | High |
| Preferences not enforced by send pipeline | High |
| RBAC not wired to routes/UI/RLS | Medium |
| No digest engine, template versioning, admin metrics | Medium |
| No DELETE RLS on `notifications` | Medium |
| Wide-open INSERT policy on `notifications` | High |
| No dedicated notifications module | Low |

## Migration Plan (Backward Compatible)

1. ALTER `notifications` — add nullable columns with defaults
2. CREATE new tables; seed `notification_events`
3. Copy `eos_notification_preferences` → `notification_event_subscriptions`
4. Migrate `profiles.metadata.preferences.notifications` on first save
5. Refactor dispatchers to call `notification-router`; keep direct inserts during transition
6. Add DELETE policy; tighten INSERT to `notifications.create` + service role

## Do Not Delete

- `notifications` table (extend only)
- `eos_notification_preferences` (deprecate via compat view)
- `send-notification` (delegate to router)
- `useNotifications.ts` (re-export from module)
- `NotificationSettings.tsx` (redirect to admin hub)
