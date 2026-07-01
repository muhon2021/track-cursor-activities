# Feature: EOS Revamp — Enterprise Strategic Execution Platform

> Transform EOS into a complete strategic execution platform for leadership teams.

**Status**: Approved  
**Module**: eos  
**Author**: AI-assisted implementation  
**Date**: 2026-06-19

## Overview

Extends the existing EOS module with dashboard widgets, rock board views, Level 10 meeting runner, People Analyzer, EOS todos, analytics, notifications, VTO collaboration, and tenant-scoped RBAC — while preserving all existing routes and OKR-based rocks.

## User Stories

- As an Owner, I want a unified EOS dashboard so I can see vision progress, rocks, scorecards, meetings, and issues at a glance.
- As a Manager, I want department-scoped visibility so my team sees only relevant EOS data.
- As a leadership team member, I want to run Level 10 meetings with timers and structured sections.
- As an HR lead, I want People Analyzer reviews with core values and GWC scoring.
- As any EOS user, I want notifications when rocks are overdue or todos are assigned.

## Database Design

### New Tables

| Table | Purpose |
|-------|---------|
| `eos_vto_versions` | VTO section version history |
| `eos_issue_comments` | IDS issue discussion threads |
| `eos_rock_dependencies` | Rock-to-rock dependencies |
| `eos_rock_attachments` | File attachments on rocks |
| `eos_rock_comments` | Comments on rocks |
| `eos_l10_meeting_sections` | L10 meeting section state |
| `eos_people_reviews` | People Analyzer quarterly reviews |
| `eos_notification_preferences` | Per-user EOS notification settings |

### Schema Changes to Existing Tables

| Table | Changes |
|-------|---------|
| All EOS tables | `tenant_id UUID NOT NULL DEFAULT default tenant` |
| `okrs` | `rock_status`, `progress_pct`, `department_id` |
| `eos_issues` | `root_cause JSONB`, `resolution_history JSONB`, FK on `meeting_id` |
| `tasks` | `eos_source_type`, `eos_source_id` |
| `meetings` | `l10_timer_state JSONB` |
| `accountability_responsibilities` | `department_id UUID FK` |

### RLS Policies

- SELECT/INSERT/UPDATE/DELETE gated by `tenant_id = get_user_tenant_id()` AND `has_permission(auth.uid(), 'eos.view|create|edit|delete')`
- Scorecard write remains admin-only (`eos.admin` or `is_admin()`)

## Routes

| Route | Page |
|-------|------|
| `/eos/dashboard` | Enhanced EOS dashboard |
| `/eos/vto` | VTO with rich text + versions |
| `/eos/rocks` | OKRs with board/table/dept views |
| `/eos/scorecards` | Scorecards with trend toggles |
| `/eos/ids/*` | IDS (alias `/eos/issues/*`) |
| `/eos/meetings/l10/:id` | L10 meeting runner |
| `/eos/accountability-chart` | Alias to accountability |
| `/eos/people-analyzer` | People Analyzer |
| `/eos/todos` | EOS todos |
| `/eos/analytics` | EOS analytics |

## Acceptance Criteria

- [ ] All existing EOS pages remain functional
- [ ] Legacy `/okrs` and `/eos/issues/*` redirects work
- [ ] Dashboard shows 8+ widgets with trend charts
- [ ] Rocks board view groups by rock_status
- [ ] L10 runner completes all 8 sections with timer
- [ ] People Analyzer saves and displays historical reviews
- [ ] Todos link back to meeting/IDS/rock sources
- [ ] Notifications fire for rock overdue and todo assigned
- [ ] Analytics page renders 5 metrics with chart toggles
- [ ] Tenant isolation verified via RLS
