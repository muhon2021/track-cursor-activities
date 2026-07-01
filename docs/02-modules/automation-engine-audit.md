# Automation Engine — Phase 1 Audit

**Status**: Complete  
**Date**: 2026-06-23  
**Initiative**: Roadmap #11 — Enterprise Automation Engine

## Existing Capabilities

### Scheduled / Background Processing

| Component | Location | Pattern |
|-----------|----------|---------|
| Cron-ready edge functions | `zoom-cron-sync`, `process-embedding-queue`, `notification-digest`, `eos-notification-dispatcher`, etc. | HTTP invoke; empty body = cron mode |
| Domain queues | `embedding_queue`, `notification_digest_queue`, `email_logs`, `kb_reembed_jobs` | Poll-process-retry |
| pg_cron | Documented only | No committed schedules in migrations |

### Event & Notification Routing

| Component | Location | Notes |
|-----------|----------|-------|
| `notification_events` | `20260620120000_notifications_module.sql` | 20 seeded event keys |
| `notification_rules` | Same migration | JSONB conditions, target_roles/departments |
| `notification-router-core.ts` | `_shared/` | Idempotency, multi-channel delivery |
| `eos-notification-dispatcher` | Edge function | Query domain → routeNotification |

### Webhooks

| Component | Location | Notes |
|-----------|----------|-------|
| `webhook-handler` | Edge function | Zoom, Google, Microsoft |
| `webhook_logs` | Migration | Audit trail |
| `email-tracking` | Edge function | SendGrid events |

### AI / Workflow Adjacent

| Component | Location | Notes |
|-----------|----------|-------|
| `agent_execution_plans/steps` | `20260205_agent_multi_step_execution.sql` | AI-only multi-step |
| `approval_workflows/requests` | `20260206_multi_agent_hitl.sql` | Agent HITL only — do not repurpose |

### RBAC

- `automation.view/create/edit/delete/export/admin` seeded in `20260617180000_enterprise_rbac.sql`
- Owner/Admin: all permissions; Manager/Member: view/create/edit via category rules

## Reusable Components

- Notification router + channel adapters (`in-app`, `email`, `slack`)
- Integration Hub (`organization_integrations`, OAuth tokens, 20+ providers)
- `requirePermission()` edge auth middleware
- `get_user_tenant_id()` + `user_in_department()` RLS helpers
- Module system (`MODULE_REGISTRY`, `ModuleRoute`, `PermissionRoute`)
- React Query + `cache.ts` key factories
- `activity-logger.ts` for audit trails
- `embedding_queue` retry/attempts pattern as queue template

## Gaps

| Gap | Severity |
|-----|----------|
| No generic workflow definition/execution tables | High |
| No event outbox / pub-sub | High |
| No visual workflow builder | High |
| Task CRUD does not emit automation events | High |
| `tasks` lacks `tenant_id` | Medium |
| No unified execution observability | Medium |
| Teams/SMS/webhook notification channels stubbed | Low |
| No Initiative #11 spec (until this implementation) | Low |

## Migration Plan (Backward Compatible)

1. CREATE new automation tables — no changes to existing tables except optional outbox triggers
2. Bridge via `automation_event_outbox` — existing cron/notification systems unchanged
3. Actions invoke `notification-router` — do not replace it
4. Separate `automation_approvals` from agent `approval_workflows`
5. Add `enableAutomations` feature flag (additive)
6. Wire task mutations to emit outbox events (fire-and-forget, non-blocking)

## Do Not Delete

- `approval_workflows` / `approval_requests` (agent HITL)
- `agent_execution_plans` / `agent_execution_steps`
- Domain cron functions and queue tables
- `notification-router` and event catalog
