# Automation Engine — Implementation Report

**Date**: 2026-06-23  
**Status**: Complete (Wave 1–6)

## 1. Existing Automation Audit

See [automation-engine-audit.md](./automation-engine-audit.md). Key finding: domain-specific queues and notification router exist; no generic workflow engine until this implementation.

## 2. Workflow Engine Architecture

- Event outbox → trigger evaluator → execution queue → step executor
- Configuration-driven JSONB definitions + normalized `automation_steps`
- Bridge pattern preserves existing cron jobs, notification-router, and agent HITL

## 3. Visual Builder

- Route: `/automation/builder/:id?`
- React Flow (`@xyflow/react`) with trigger, condition, action, delay, approval, loop, branch nodes
- Validation via `workflowValidator.ts`; lazy-loaded for bundle size

## 4. Trigger System

- 14 trigger types mapped to `notification_events` and `TRIGGER_EVENT_MAP`
- Filters via `trigger_config.filters` JSONB
- `automation_emit_event()` RPC + client `emitAutomationEvent()` helper
- Task create/update wired in `useTasksV2.ts`

## 5. Condition Engine

- Server: `_shared/automation-conditions.ts`
- Client: `conditionEvaluator.ts`
- Operators: eq, neq, contains, gt, lt; AND/OR with nested groups

## 6. Action Engine

- Plugin registry: `_shared/automation-actions/index.ts`
- Actions: notifications, email, tasks, AI agent, webhooks, HTTP, Slack/Teams, delays
- AI actions: generate_summary, classify_text, sentiment_analysis, extract_tasks, document_categorize, meeting_summary

## 7. Approval Workflows

- Table: `automation_approvals` (separate from agent HITL)
- UI: `/automation/approvals`
- Multi-level via `level` column; resume executor on approve

## 8. Scheduler

- `automation-scheduler` edge function
- `automation_schedules` table with cron expressions
- pg_cron migration documented (commented for Supabase Pro)

## 9. Execution Engine

- `automation-executor`: sequential step runner, pause/resume, retries, DLQ
- Statuses: pending, running, completed, failed, cancelled, paused
- Idempotency keys on executions

## 10. Logs

- Table: `automation_execution_logs`
- UI: `/automation/logs` with status, duration, retries

## 11. Webhooks

- Incoming: `automation-webhook-receiver` with HMAC/bearer auth
- UI: `/automation/webhooks`
- Outgoing: `call_webhook` / `http_request` actions

## 12. AI Automation

- Thin wrappers over `run-ai-agent` for summary, classify, sentiment, extract tasks, categorization

## 13. Analytics Dashboard

- Route: `/automation/analytics`
- Metrics: total, active, success/failure rate, avg duration, daily chart, top errors

## 14. Database Changes

Migrations:
- `20260623120000_automation_engine.sql`
- `20260623120100_automation_rbac_extensions.sql`
- `20260623120200_automation_pg_cron.sql`

## 15. Permission Changes

Added: `automation.execute`, `automation.logs.view`, `automation.templates.manage`, `automation.webhooks.manage`  
Existing: `automation.view/create/edit/delete/export/admin`

## 16. Performance

- Batch outbox processing (100/tick)
- Lazy-loaded builder chunk (~183KB)
- Partial index on pending/paused executions
- SKIP LOCKED pattern ready for concurrent workers

## 17. Migration Notes

1. Run `npm run migrations:run`
2. Deploy edge functions: automation-manage, automation-trigger-evaluator, automation-executor, automation-scheduler, automation-webhook-receiver
3. Configure pg_cron or external scheduler to invoke `automation-scheduler` every minute
4. Enable `features.enableAutomations` in app_config (seeded true)

## 18. Potential Breaking Changes

**None.** All changes are additive. Existing systems unchanged.

## Manual QA Checklist

- [ ] Create workflow via builder, save draft
- [ ] Enable workflow, create task, verify outbox/execution
- [ ] Clone template to workflow
- [ ] Manual execute workflow
- [ ] View execution logs
- [ ] Create incoming webhook, POST with signature
- [ ] RBAC: member can view/execute, not delete
- [ ] Tenant isolation via RLS
