# Feature: Enterprise Automation Engine

> No-code/low-code workflow automation with triggers, conditions, actions, delays, approvals, scheduling, and execution logs.

**Status**: In Progress  
**Module**: automation  
**Date**: 2026-06-23

## Overview

Configuration-driven automation engine allowing users to build multi-step workflows via a visual builder or templates. Triggers include domain events (task created, meeting scheduled, rock overdue), schedules, webhooks, and manual runs. Actions reuse the notification router, integration hub, and AI agent stack. Multi-tenant via `tenant_id`; RBAC via `automation.*` permissions.

## User Stories

- As a **Manager**, I want to create workflows that notify my team when high-priority tasks are created.
- As an **Admin**, I want to schedule weekly digest workflows and view execution logs.
- As a **Member**, I want to approve expense requests in a multi-level approval workflow.
- As an **Admin**, I want to clone templates and customize them for my department.

## Database Design

See migrations:
- `supabase/migrations/20260623120000_automation_engine.sql`
- `supabase/migrations/20260623120100_automation_rbac_extensions.sql`

### Tables

| Table | Purpose |
|-------|---------|
| `automation_workflows` | Workflow metadata + definition JSONB |
| `automation_steps` | Normalized steps for execution |
| `automation_executions` | Run queue and state machine |
| `automation_execution_logs` | Step-level audit |
| `automation_templates` | Template library |
| `automation_event_outbox` | Decoupled trigger ingestion |
| `automation_schedules` | Cron/time-based triggers |
| `automation_webhooks` | Incoming webhook endpoints |
| `automation_approvals` | Business approval steps |
| `automation_dead_letter` | Failed execution DLQ |

## API Design

### Edge Functions

| Function | Method | Auth | Purpose |
|----------|--------|------|---------|
| `automation-manage` | POST | JWT + automation permissions | CRUD workflows, clone, enable/disable |
| `automation-trigger-evaluator` | POST | Service role | Process outbox, match workflows |
| `automation-executor` | POST | Service role | Run pending executions |
| `automation-scheduler` | POST | Service role | Cron tick, resume delays |
| `automation-webhook-receiver` | POST | HMAC secret | Incoming webhooks |

## Frontend Routes

| Route | Page | Permission |
|-------|------|------------|
| `/automation/workflows` | WorkflowListPage | `automation.view` |
| `/automation/builder/:id?` | WorkflowBuilderPage | `automation.create` / `automation.edit` |
| `/automation/templates` | TemplatesPage | `automation.view` |
| `/automation/logs` | LogsPage | `automation.logs.view` |
| `/automation/webhooks` | WebhooksPage | `automation.webhooks.manage` |
| `/automation/analytics` | AnalyticsPage | `automation.view` |
| `/automation/approvals` | ApprovalsPage | `automation.view` |

## Trigger Types

`task.created`, `task.updated`, `task.completed`, `user.created`, `meeting.scheduled`, `rock.overdue`, `issue.created`, `document.synced`, `integration.error`, `webhook`, `schedule`, `manual`, `ai.agent.completed`, `custom.event`

## Action Types

`create_task`, `update_task`, `send_email`, `send_notification`, `create_meeting`, `create_todo`, `create_issue`, `update_record`, `assign_user`, `trigger_ai_agent`, `generate_summary`, `call_webhook`, `slack_message`, `teams_message`, `delay`, `http_request`, `classify_text`, `sentiment_analysis`, `extract_tasks`

## RBAC Matrix

| Permission | Owner | Admin | Manager | Member | Viewer |
|------------|-------|-------|---------|--------|--------|
| automation.view | ✓ | ✓ | ✓ | ✓ | ✓ |
| automation.create | ✓ | ✓ | ✓ | ✓ | |
| automation.edit | ✓ | ✓ | ✓ | ✓ | |
| automation.delete | ✓ | ✓ | | | |
| automation.execute | ✓ | ✓ | ✓ | ✓ | |
| automation.logs.view | ✓ | ✓ | ✓ | ✓ | ✓ |
| automation.templates.manage | ✓ | ✓ | ✓ | | |
| automation.webhooks.manage | ✓ | ✓ | | | |
| automation.admin | ✓ | ✓ | | | |

## Acceptance Criteria

- [ ] Create/edit/enable/disable/clone/delete workflows
- [ ] Visual builder with trigger, condition, action, delay, approval, branch nodes
- [ ] Event-driven execution via outbox
- [ ] Scheduled workflows via cron
- [ ] Execution logs with step timeline
- [ ] Template library with 10 seeded templates
- [ ] Webhook ingress with signature verification
- [ ] AI action plugins
- [ ] Analytics dashboard
- [ ] Tenant isolation via RLS
- [ ] Backward compatible — no breaking changes to existing systems
