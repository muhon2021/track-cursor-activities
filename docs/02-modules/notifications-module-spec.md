# Feature: Enterprise Notifications Module

> Centralized multi-channel notification system with inbox, preferences, digest, routing rules, delivery logs, and admin dashboard.

**Status**: In Progress  
**Module**: platform (cross-cutting)  
**Date**: 2026-06-19

## Overview

Extends the existing `notifications` table and `useNotifications` hook into a full enterprise notification platform. Supports in-app delivery (implemented), email (SendGrid), and channel stubs for Slack, Teams, SMS, Webhooks, and Push. Multi-tenant via `tenant_id` on new tables; RBAC via existing `notifications.*` permissions.

## User Stories

- As a **Member**, I want a notification center with filters and search so I can find relevant updates quickly.
- As a **Member**, I want to configure email/in-app/digest preferences per event type.
- As an **Admin**, I want routing rules so critical events reach the right channels and roles.
- As an **Admin**, I want delivery logs and metrics to monitor notification health.

## Database Design

See migration: `supabase/migrations/20260620120000_notifications_module.sql`

### New Tables

| Table | Purpose |
|-------|---------|
| `notification_events` | Event catalog with defaults |
| `notification_preferences` | Per-user global settings |
| `notification_event_subscriptions` | Per-user per-event channel overrides |
| `notification_role_defaults` | Role-based default subscriptions |
| `notification_rules` | Admin routing rules |
| `notification_templates` | Channel templates with versioning |
| `notification_logs` | Per-delivery attempt tracking |
| `notification_digest_queue` | Pending digest items |

### Extended: `notifications`

Added: `tenant_id`, `event_key`, `category`, `severity`, `priority`, `archived_at`, `expires_at`

## API Design

### Edge Functions

#### `notification-router`
- **Method**: POST
- **Auth**: Service role (system) or JWT + `notifications.create` (user-initiated)
- **Body**: `{ event_key, user_ids[], title, message, payload?, channels?, severity?, priority?, link?, metadata? }`
- **Flow**: Load event → prefs/subscriptions → rules → channel adapters → logs

#### `notification-digest`
- **Method**: POST (cron)
- **Auth**: Service role
- **Body**: `{ digest_mode?: 'hourly'|'daily'|'weekly', dry_run?: boolean }`

## Frontend Routes

| Route | Page | Permission |
|-------|------|------------|
| `/notifications` | NotificationCenterPage | `notifications.view` |
| `/settings/notifications` | NotificationPreferencesPage | `notifications.view` |
| `/admin/notifications` | AdminNotificationsDashboard | `notifications.admin` |
| `/admin/notification-rules` | NotificationRulesPage | `notifications.admin` |
| `/admin/notification-logs` | NotificationLogsPage | `notifications.export` |

## Event Catalog (seeded)

`user.invited`, `task.assigned`, `task.completed`, `meeting.scheduled`, `meeting.reminder`, `rock.overdue`, `issue.escalated`, `comment.added`, `document.synced`, `sync.failed`, `ai.agent.completed`, `memory.updated`, `integration.error`, `permission.changed`, `role.updated`, `department.created`, `mention.added`, `system.alert`

## Channel Architecture

```
Event → notification-router → Rules Engine → Channel Adapter → Delivery Log
                                    ↓
                              in_app | email | slack | teams | sms | webhook | push
```

## Acceptance Criteria

- [ ] Inbox: filters (all/unread/mentions/tasks/meetings/system/integrations/ai/eos), search, pagination, archive
- [ ] Realtime badge + toast on new notifications
- [ ] User preferences page with digest mode and per-event subscriptions
- [ ] Admin dashboard with metrics charts
- [ ] Routing rules CRUD
- [ ] Delivery logs with export
- [ ] Template engine with preview
- [ ] RBAC enforced on routes and RLS
- [ ] Backward compatible with existing `notifications` rows
