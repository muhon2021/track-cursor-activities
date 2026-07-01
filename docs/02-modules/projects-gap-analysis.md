# Projects Module — Gap Analysis Report

**Date**: February 11, 2026
**Compared Against**: Projects Module Replication Guide v2.0

---

## Executive Summary

The current codebase implements **core project management functionality** but is missing significant portions of the original module. Out of the full replication guide scope:

| Category | Expected | Implemented | Gap |
|----------|----------|-------------|-----|
| Database tables | 22 | 14 | 8 missing |
| Migrations | 31 | 3 | 28 missing |
| Edge functions | 27 | 3 | 24 missing |
| Hooks | 15 | 10 | 6 missing (some consolidated) |
| Pages | 6 | 7 | Mostly covered (different structure) |
| Components | 50+ | ~18 | 30+ missing |

**Overall completion: ~40-45% of the original module scope.**

---

## 1. Database Tables — Gap Analysis

### Tables That EXIST (14)

| # | Table | Notes |
|---|-------|-------|
| 1 | `projects` | Core table — exists but missing several columns (see below) |
| 2 | `project_statuses` | Configurable status definitions |
| 3 | `project_milestones` | Milestone/sprint tracking with `pm_notes` column |
| 4 | `project_risks` | Risk register with `is_client_visible` flag |
| 5 | `project_comments` | Discussion threads with reply support |
| 6 | `project_favorites` | User bookmark system |
| 7 | `project_billing` | Named `project_billing` (not `project_billing_setup`) |
| 8 | `project_invoices` | Invoice generation and tracking (bonus — not in guide) |
| 9 | `project_backups` | JSONB snapshot metadata |
| 10 | `project_client_access` | Token-based portal auth |
| 11 | `project_members` | Team roles (bonus — replaces allocations partially) |
| 12 | `project_files` | Multi-source file attachments (bonus — not in guide) |
| 13 | `project_client_comments` | PM comments visible to clients (bonus) |
| 14 | `client_feedback` | Client feedback submissions (maps to `project_feedback`) |

### Tables That Are MISSING (8)

| # | Table | Impact | Description |
|---|-------|--------|-------------|
| 1 | **`project_concerns`** | Medium | Concern tracking separate from risks |
| 2 | **`project_notes`** | Medium | Internal project documentation/notes |
| 3 | **`project_checklists`** | High | Role-based PM/CS/Manager checklists — core workflow feature |
| 4 | **`project_allocations`** | High | Resource allocation percentages — capacity planning |
| 5 | **`project_integrations`** | High | Per-project Slack, Google Calendar, email config |
| 6 | **`project_knowledge_files`** | Medium | Google Drive/uploaded docs linked to projects |
| 7 | **`project_audit_logs`** | Medium | Status change history and audit trail |
| 8 | **`project_feedback`** | Low | Exists as `client_feedback` with different naming |

### Projects Table — Column Gaps

| Expected Column | Current Column | Status |
|----------------|---------------|--------|
| `project_name` | `name` | Renamed (functionally equivalent) |
| `client_name` | — | Missing (denormalized field) |
| `progress_percentage` | — | **Missing** — no progress tracking |
| `project_budget` | `budget` | Renamed (functionally equivalent) |
| `activecollab_project_id` | `external_id` + `external_provider` | Generalized (supports multiple providers) |
| `manager_id` | `owner_id` | Renamed (functionally equivalent) |
| `team_id` | — | **Missing** — no pod/team linkage |
| `drive_url` | — | **Missing** — no Google Drive folder link |
| `billing_url` | — | **Missing** — no billing URL field |
| `deleted_at` | `is_archived` | Different approach (boolean vs timestamp soft delete) |

---

## 2. Edge Functions — Gap Analysis

### Functions That EXIST (3 of 27)

| # | Function | Purpose |
|---|----------|---------|
| 1 | `match-meeting-to-project` | AI-powered meeting-to-project matching |
| 2 | `sync-projects-activecollab` | ActiveCollab project sync |
| 3 | `sync-projects-jira` | Jira project sync (bonus — not in guide) |

### Functions That Are MISSING (24)

#### Core API (2 missing)
| Function | Impact | Description |
|----------|--------|-------------|
| `api-v1-projects` | High | RESTful project CRUD API |
| `projects/index` | High | Project listing/management endpoint |

#### ActiveCollab Integration (6 missing)
| Function | Impact | Description |
|----------|--------|-------------|
| `ac-get-projects` | Medium | Fetch projects from ActiveCollab |
| `ac-create-project` | Medium | Create project in ActiveCollab |
| `ac-sync-project-budgets` | Medium | Sync budget data from ActiveCollab |
| `ac-sync-project-tasks` | Medium | Sync tasks from ActiveCollab |
| `ac-get-project-budget-details` | Medium | Detailed budget breakdown |
| `ac-get-project-budget-summary` | Medium | Budget overview data |

#### Budget/Financial (2 missing)
| Function | Impact | Description |
|----------|--------|-------------|
| `ac-get-project-expenses` | Medium | Expense tracking from ActiveCollab |
| `ac-project-hours` | Medium | Time tracking / hours logged |

#### AI & Analysis (3 missing)
| Function | Impact | Description |
|----------|--------|-------------|
| `ai-analyze-project` | High | AI-powered project health analysis |
| `extract-project-issues` | High | AI extraction of issues from meetings/data |
| `generate-project-report` | Medium | Automated project report generation |

#### Document Management (5 missing)
| Function | Impact | Description |
|----------|--------|-------------|
| `project-knowledge-sync` | Medium | Sync knowledge base for projects |
| `sync-project-drive-files` | Medium | Google Drive file sync |
| `index-project-document` | Medium | Document indexing for search |
| `reindex-project-files` | Low | Re-index existing documents |
| `process-pending-project-documents` | Low | Background document processing |

#### Notifications & Backup (2 missing)
| Function | Impact | Description |
|----------|--------|-------------|
| `notify-project-created` | Low | New project notification dispatch |
| `restore-project-backup` | Medium | Server-side backup restoration |

#### External Sync (2 missing)
| Function | Impact | Description |
|----------|--------|-------------|
| `activecollab-sync-projects` | Low | Partially covered by `sync-projects-activecollab` |
| `sync-external-projects` | Medium | Generic external project sync |

---

## 3. Frontend Hooks — Gap Analysis

### Hooks That EXIST (10)

| # | Hook | Location |
|---|------|----------|
| 1 | `useProjects` | `src/modules/projects/hooks/useProjects.ts` |
| 2 | `useProjectDetail` (includes Members, Milestones, Comments, Risks) | `src/modules/projects/hooks/useProjectDetail.ts` |
| 3 | `useProjectTasks` | `src/modules/projects/hooks/useProjectTasks.ts` |
| 4 | `useProjectIntegrations` | `src/modules/projects/hooks/useProjectIntegrations.ts` |
| 5 | `useProjectStatuses` | `src/hooks/useProjectStatuses.ts` |
| 6 | `useProjectModuleSettings` | `src/hooks/useProjectModuleSettings.ts` |
| 7 | `useProjectReports` | `src/hooks/useProjectReports.ts` |
| 8 | `useProjectMeetings` | `src/modules/meetings/hooks/useProjectMeetings.ts` |
| 9 | `useProjectMeetingSearch` | `src/modules/meetings/hooks/useProjectMeetingSearch.ts` |
| 10 | `useCrossModuleMeetings` | `src/modules/meetings/hooks/useCrossModuleMeetings.ts` |

### Hooks That Are MISSING (6)

| # | Hook | Impact | Description |
|---|------|--------|-------------|
| 1 | **`useProjectDriveFiles`** | Medium | Google Drive file management for projects |
| 2 | **`useProjectAIIssues`** | High | AI-extracted issue management |
| 3 | **`useProjectBillingReport`** | Medium | Billing metrics and reporting |
| 4 | **`useProjectBillingSetup`** | Medium | Payment configuration management |
| 5 | **`useProjectAllocations`** | High | Resource allocation tracking |
| 6 | **`useProjectAIWeeklyUpdate`** | Medium | AI-generated weekly progress updates |

### Hook Consolidation Notes

The current codebase consolidated some hooks differently than the original:
- `useProjectMembers`, `useProjectMilestones`, `useProjectComments`, `useProjectRisks` are all inside `useProjectDetail.ts` rather than separate files
- `useProjectStatuses` exists in both `src/hooks/` and inside `useProjects.ts`
- No dedicated `useProjectsBackup` hook (backup functionality is inline in components)

---

## 4. Frontend Pages — Gap Analysis

### Pages That EXIST (7)

| # | Page | Route | Notes |
|---|------|-------|-------|
| 1 | `ProjectsPage.tsx` | `/projects` | Main list view with search and filters |
| 2 | `ProjectDetailPage.tsx` | `/projects/:slug` | Tab-based detail view |
| 3 | `ProjectFormPage.tsx` | `/projects/new`, `/projects/:slug/edit` | Create/edit form (bonus — not in guide) |
| 4 | `ProjectKnowledgePage.tsx` | `/projects/:slug/knowledge` | Knowledge base view |
| 5 | `ProjectIssuesAIAnalyzePage.tsx` | `/projects/:slug/issues/ai/analyze` | **Placeholder only** — not implemented |
| 6 | `ClientPortalDashboard.tsx` | `/projects/:slug/client-portal/:token` | Client-facing dashboard |
| 7 | `ProjectDashboard.tsx` | `/client/project/:token` | Legacy client portal (placeholder) |

### Pages — Functional Gaps

| Feature | Status | Details |
|---------|--------|---------|
| Project listing with metrics | Partial | Search and status filter exist; **missing**: favorites toggle, advanced filters panel |
| Configurable tab system | Exists | URL-driven tabs via `:tab` parameter |
| AI Analysis wizard | **Stub only** | Page exists but multi-step wizard (DataSources → Progress → Results) is not implemented |
| Enhanced Client Dashboard | Partial | Basic dashboard exists; missing the "Enhanced" version with full feature set |

---

## 5. Frontend Components — Gap Analysis

### Components That EXIST (~18)

**Module Components:**
- `OverviewTab` — Project overview display
- `BillingTab` — Read-only billing overview
- `TasksTab` — Task listing for project
- `IntegrationsTab` — Integration status and sync
- `ClientAccessManagement` — Portal credential management
- `GlobalProjectsRestoreDialog` — Bulk project restore

**Client Portal Components:**
- `ClientProgressRing` — Progress visualization
- `ClientMilestoneTimeline` — Milestone display
- `ClientRisksTimeline` — Risk display for clients
- `ClientInvoiceSummary` — Invoice overview
- `ClientDeadlineCountdown` — Deadline tracker
- `ClientSprintTimeline` — Sprint visualization

**Admin Pages (project-related):**
- `ProjectReports` — Admin reporting
- `ProjectModules` — Module configuration
- `ProjectStatusSettings` — Status management

### Components That Are MISSING (~30+)

#### Core Project Components (7 missing)
| Component | Impact | Description |
|-----------|--------|-------------|
| `ProjectOverviewCard` | Medium | Summary card for project list items |
| `ProjectSummaryCard` | Medium | Compact project summary widget |
| `CreateProjectDialog` | Low | Dialog-based creation (uses `ProjectFormPage` instead) |
| `ProjectEditDialog` | Low | Dialog-based editing (uses `ProjectFormPage` instead) |
| `ProjectMembersDialog` | Medium | Team member management dialog |
| `ProjectsToolbar` | Medium | Advanced toolbar with bulk actions |
| `ProjectsFiltersPanel` | Medium | Advanced filtering panel (status, team, date range, etc.) |

#### Tab Components (3 missing)
| Component | Impact | Description |
|-----------|--------|-------------|
| `ChecklistPanel` | **High** | Role-based PM/CS/Manager checklists — entire feature missing |
| `RisksTab` | Medium | Dedicated risks tab (risks exist in `useProjectDetail` but no standalone tab) |
| `DocsTab` | Medium | Unified document management tab (Drive + uploads) |

#### Billing Components (5 missing)
| Component | Impact | Description |
|-----------|--------|-------------|
| `BillingInformationCard` | Medium | Detailed billing configuration display |
| `ProjectInvoices` | Medium | Invoice list with CRUD operations |
| `CreateInvoiceModal` | Medium | Invoice creation form |
| `PaymentSchedule` | Medium | Payment schedule management |
| `BillingReportPanel` | Medium | Financial reporting dashboard |

#### AI Analysis Components (3 missing)
| Component | Impact | Description |
|-----------|--------|-------------|
| `PMDataSourcesStep` | **High** | Step 1: Select data sources for AI analysis |
| `PMAnalysisProgressStep` | **High** | Step 2: Show AI analysis progress |
| `PMResultsReviewStep` | **High** | Step 3: Review and act on AI findings |

#### Integration Components (4 missing)
| Component | Impact | Description |
|-----------|--------|-------------|
| `ActiveCollabConnection` | Medium | ActiveCollab setup and connection management |
| `GoogleCalendarConfig` | Medium | Google Calendar integration config |
| `SlackConfig` | Medium | Slack channel/notification config |
| `SyncTasksModal` | Medium | Task sync confirmation and mapping |

#### Client Portal Components (1 missing)
| Component | Impact | Description |
|-----------|--------|-------------|
| `EnhancedClientDashboard` | Medium | Full-featured client dashboard (current version is basic) |

---

## 6. Routes — Gap Analysis

### Routes That EXIST

| Route | Status |
|-------|--------|
| `/projects` | Exists |
| `/projects/new` | Exists (bonus) |
| `/projects/:slug` | Exists |
| `/projects/:slug/edit` | Exists (bonus) |
| `/projects/:slug/:tab` | Exists (tab-based navigation) |
| `/projects/:slug/knowledge` | Exists |
| `/projects/:slug/issues/ai/analyze` | Exists (placeholder) |
| `/projects/:slug/client-portal/:token` | Exists |
| `/client/project/:token` | Exists (legacy) |

All expected routes are present. The codebase adds `/projects/new` and `/projects/:slug/edit` routes not in the original guide.

---

## 7. Migrations — Gap Analysis

### Current State: 3 migrations
1. `20260201_projects_module.sql` — Core tables
2. `20260202100000_project_client_access.sql` — Client portal
3. `20260203_project_backups.sql` — Backup system

### Expected: 31 migrations
The original system has 31 incremental migrations spanning from January 2025 to January 2026. The current codebase consolidated these into 3 large migration files. While the consolidated approach covers much of the schema, the following migration-level features are missing:

- Checklist tables and seed data
- Allocation tables
- Integration config tables
- Knowledge file tables
- Audit log tables
- Concern tracking tables
- Note tables
- Several column additions (progress_percentage, team_id, drive_url, etc.)

---

## 8. Feature Completeness Summary

### Implemented Features

| Feature | Status | Notes |
|---------|--------|-------|
| Project CRUD | ✅ Complete | List, create, edit, delete |
| Dynamic Stages | ✅ Complete | Admin-configurable statuses |
| Configurable Tabs | ✅ Complete | URL-driven tab system |
| Client Portal | ✅ Partial | Basic dashboard with milestones, risks, billing |
| Team Members | ✅ Complete | Role-based membership |
| Milestones | ✅ Complete | CRUD with status tracking |
| Comments | ✅ Complete | Threaded discussions |
| Risk Tracking | ✅ Partial | Data model exists, dedicated tab component missing |
| Billing Config | ✅ Partial | Read-only overview, missing invoice CRUD |
| Invoices | ✅ Partial | Table exists, no creation/management UI |
| Backup/Restore | ✅ Partial | Global restore dialog exists, no per-project backup hook |
| Favorites | ✅ Partial | Table exists, UI integration unclear |
| ActiveCollab Sync | ✅ Partial | Sync function exists, missing budget/task/hours sync |
| Jira Sync | ✅ Bonus | Not in original guide but implemented |
| Meeting Matching | ✅ Complete | AI-powered matching function |

### Missing Features

| Feature | Impact | Description |
|---------|--------|-------------|
| **Multi-role Checklists** | **Critical** | PM/CS/Manager checklists — entire feature missing (table + components + hooks) |
| **Resource Allocation** | **Critical** | Team allocation percentages — no table, no hook, no UI |
| **AI Analysis Wizard** | **High** | 3-step wizard is placeholder only — no step components implemented |
| **AI Weekly Updates** | **High** | AI-generated progress updates — no hook or UI |
| **AI Issue Extraction** | **High** | Extract issues from meetings — no edge function or hook |
| **Document Management** | **High** | Google Drive integration, document indexing — 5 edge functions missing |
| **Project Knowledge Sync** | **High** | Knowledge file sync and indexing pipeline missing |
| **Advanced Billing** | **Medium** | Invoice creation, payment schedules, billing reports missing |
| **Integration Config** | **Medium** | Per-project Slack/Calendar/Email config — table and components missing |
| **Audit Logging** | **Medium** | Status change history — table and logging mechanism missing |
| **Concerns Tracking** | **Medium** | Separate from risks — table missing |
| **Project Notes** | **Medium** | Internal documentation — table missing |
| **Budget Sync** | **Medium** | ActiveCollab budget/expense/hours sync — 4 edge functions missing |
| **Notifications** | **Low** | Project creation notification — edge function missing |
| **Progress Percentage** | **Low** | Column missing from projects table |

---

## 9. Priority Recommendations

### Phase 1 — Critical Gaps (Core Workflow)
1. Add `project_checklists` table + `ChecklistPanel` component + hook
2. Add `project_allocations` table + `useProjectAllocations` hook + UI
3. Add `progress_percentage` and `team_id` columns to `projects` table

### Phase 2 — High Impact (AI & Documents)
4. Implement AI analysis wizard step components (PMDataSourcesStep, PMAnalysisProgressStep, PMResultsReviewStep)
5. Deploy `ai-analyze-project` and `extract-project-issues` edge functions
6. Deploy `generate-project-report` edge function
7. Implement `useProjectAIIssues` and `useProjectAIWeeklyUpdate` hooks
8. Deploy document management edge functions (5 functions)
9. Add `project_knowledge_files` table

### Phase 3 — Medium Impact (Integration & Billing)
10. Add `project_integrations` table + integration config components
11. Implement invoice CRUD (CreateInvoiceModal, ProjectInvoices)
12. Add `project_audit_logs` table + logging mechanism
13. Deploy ActiveCollab budget sync functions (4 functions)
14. Add `project_concerns` and `project_notes` tables
15. Implement PaymentSchedule and BillingReportPanel components

### Phase 4 — Polish & Enhancement
16. Add ProjectsToolbar and ProjectsFiltersPanel for advanced filtering
17. Implement ProjectMembersDialog for team management
18. Deploy notification edge function
19. Enhance client portal to "EnhancedClientDashboard" level
20. Add dedicated RisksTab and DocsTab components

---

*Generated by gap analysis audit — February 11, 2026*
