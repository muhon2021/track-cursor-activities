# EOS Revamp — Existing Module Audit

**Date**: 2026-06-19  
**Initiative**: Roadmap #9 — EOS Revamp  
**Status**: Complete (Phase 1 deliverable)

## Executive Summary

The EOS module is ~70% built with 17 user pages, 5 admin pages, 38+ components, 12+ hooks, and 14 database tables. This revamp extends existing assets rather than replacing them. Rocks remain OKR-based; meetings and todos reuse the Meetings and Tasks modules.

---

## 1. Existing Capabilities

| Area | Status | Key Assets |
|------|--------|------------|
| V/TO | Implemented | `VTOPage`, `useVTO`, `eos_vto` (8 sections) |
| Rocks | Partial (as OKRs) | `OKRsPage` at `/eos/rocks`, `EOSRocksCard` |
| Scorecards | Implemented | `ScorecardPage`, admin `ScorecardWorkspace` |
| IDS / Issues | Largely implemented | 10 issue pages, `useEOSIssues`, AI edge functions |
| Accountability | Implemented | `AccountabilityPage`, GWC via `gwc_assessments` |
| Meetings | Cross-module | `meeting_type = 'l10'`; routes under `/eos/meetings/*` |
| Dashboard | Partial | `OwnerDashboardWithEOS` at `/eos/dashboard` |
| Notifications | Platform only | `useNotifications`, `send-notification` — no EOS triggers |
| RBAC | Catalog only | `eos.view/create/edit/delete/export/admin` — not enforced in RLS |

### Database Tables (14 core)

- `eos_pods`, `eos_vto`, `okrs`, `okr_key_results`, `okr_check_ins`
- `eos_issues`, `eos_issue_suggestions`
- `eos_scorecards`, `eos_scorecard_metrics`, `eos_sla_targets`
- `accountability_charts`, `accountability_responsibilities`, `gwc_assessments`
- `key_result_history`

### Edge Functions (11 EOS-related)

- `suggest-okrs`, `extract-meeting-issues`, `quarterly-digest` (wired)
- `eos-triage-assistant`, `analyze-okr-progress`, `okr-update-reminder` (unwired)
- Accountability reminders (cron-oriented, dry_run default)

---

## 2. Missing Features

- Dedicated EOS analytics page (`useEOSIssueInsights` exists but unwired)
- People Analyzer (core values + GWC matrix)
- Level 10 meeting runner (timer, structured agenda, IDS timeboxing)
- EOS-native todos with source links (meetings/IDS/rocks)
- VTO rich text, version history, real-time collaboration
- Rocks: board view, dependencies, attachments, On Track / At Risk / Off Track statuses
- IDS workflow: `in_discussion` label, root cause, resolution history, comments
- EOS event notifications (rock overdue, meeting reminder, etc.)
- Route inconsistency: `IssuesNavTabs` hardcodes `/eos/issues/*` vs Four Spaces `/eos/ids/*`
- Types drift: `eos_sla_targets`, `pod_id`, `notes` missing from generated types
- Multi-tenant: no `tenant_id` on EOS tables
- Enterprise RBAC not wired to EOS RLS or routes

---

## 3. Reusable Components

| Category | Components |
|----------|------------|
| OKR | `OKRCard`, `OKRHealthGrid`, `TeamOKRsByPod`, `KeyResultProgressChart` |
| Issues | `IssuesTable`, `IssueStatsCards`, `IssueFiltersBar`, `CreateIssueDialog` |
| Scorecard | `ScorecardMetricsTable`, `MetricTrendChart` |
| Accountability | `OrgTree`, `GWCAssessmentDialog`, `GWCBadge` |
| Dashboard | `EOSRocksCard`, `EOSIssuesCard`, `EOSScorecardCard`, `QuickActionsCard` |
| Rich text | `RichCommentInput`, `sanitizeRichText` |
| Charts | Recharts patterns in scorecard/OKR components |

---

## 4. Migration Plan

1. Add `tenant_id` + `get_user_tenant_id()` to all EOS tables; tighten RLS
2. Extend `okrs` with `rock_status`, `progress_pct`, `department_id`; backfill VTO JSONB rocks
3. Add supporting tables: `eos_vto_versions`, `eos_issue_comments`, `eos_rock_*`, `eos_l10_meeting_sections`, `eos_people_reviews`, `eos_notification_preferences`
4. Extend `tasks` with `eos_source_type` / `eos_source_id`
5. Wire notifications via `send-notification` + cron
6. Frontend: enhance pages in place; add analytics, people-analyzer, todos, L10 runner routes
7. Fix legacy/Four Spaces route aliases; no deletions

---

## 5. Architecture Decisions

| Decision | Choice |
|----------|--------|
| Rocks | Extend `okrs` — no `eos_rocks` table |
| Multi-tenant | Add `tenant_id` to all EOS tables |
| Meetings / Todos | Extend `meetings` + `tasks` |
| People Analyzer | New `eos_people_reviews` table |
| Routing | Four Spaces primary; legacy redirects preserved |

---

## 6. Potential Breaking Changes

| Change | Mitigation |
|--------|------------|
| RLS tightening | Default tenant + backfill permissions before deploy |
| Status label mapping | Keep DB values; map `in_progress` → "In Discussion" in UI |
| VTO rocks JSONB migration | Idempotent migration with external_id |
| `tenant_id` NOT NULL | Default tenant UUID on all rows |
