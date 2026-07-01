# Projects Module (Framework)

## Overview

This framework ships with a **streamlined Projects module** based on the full implementation in `sj-control-main`  
(`docs/modules/projects.md` and `docs/module-blueprints/04-projects.md`).

In this codebase the Projects module focuses on:

- **Project listing** with basic filters
- **Project detail** with URL-driven tabs:
  - `overview` — core project info + recent comments
  - `milestones` — simple milestone list and completion status
  - `members` — project team members
  - `issues` — risk list
  - `integrations` — live integration status from `organization_integrations` + `integration_providers`
  - `tasks` — project tasks via `client_id` lookup against `tasks` table
  - `client_portal` — client access management
- **Client portal** — public, token + password protected dashboard for clients
- **Project sync** from **ActiveCollab** and **Jira** into the local `projects` table
- **Admin pages** for project status management, work types, project module toggles, project reports, and resource utilization

**Module name:** `projects` (in `app_modules` and sidebar).

---

## Permissions & Routes

### Module + access

| Item | Value |
| :--- | :---- |
| **Module name** (`app_modules.slug`) | `projects` |
| **Route guard** | `ProtectedRoute` (auth) + `ModuleRoute module="projects"` |
| **Sidebar visibility** | `useModuleAccess().hasModule("projects")` reading from `app_modules` / `user_module_permissions` |

### Routes owned (framework)

From `src/modules/projects/routes.tsx`:

```text
/projects                              → Projects listing
/projects/new                          → Create project
/projects/:slug/edit                   → Edit project
/projects/:slug/knowledge              → Project knowledge
/projects/:slug/issues/ai/analyze      → Project AI issue analysis
/projects/:slug/:tab                   → Project detail with specific tab
/projects/:slug                        → Project detail (default: overview tab)
```

Public routes (from `App.tsx`, no auth required):

```text
/projects/:slug/client-portal/:token   → Public client portal (token + password)
/client/project/:token                 → Legacy client project dashboard
```

Admin:

- **Integrations:** `Admin → Integrations` → select **ActiveCollab** or **Jira** → configure → **Sync projects**.

---

## File Inventory (Framework)

### Pages (5 files in `src/modules/projects/pages/`)

| File | Purpose | Route |
|------|---------|-------|
| `ProjectsPage.tsx` | Project listing with filters (status, search, archived) | `/projects` |
| `ProjectDetailPage.tsx` | Project detail with URL-driven tabs (overview, milestones, members, issues, integrations, tasks, client_portal) | `/projects/:slug`, `/projects/:slug/:tab` |
| `ProjectFormPage.tsx` | Create/edit project form | `/projects/new`, `/projects/:slug/edit` |
| `ProjectKnowledgePage.tsx` | Project knowledge — documents from `unified_documents` with `owner_type=project` | `/projects/:slug/knowledge` |
| `ProjectIssuesAIAnalyzePage.tsx` | AI issue analysis wizard (placeholder) | `/projects/:slug/issues/ai/analyze` |

Client portal page (in `src/pages/client/`):

- `ClientPortalDashboard.tsx` — Public, token + password protected. Calls `client-dashboard-api` edge function for auth and dashboard data.

### Components (6 files in `src/components/projects/`)

| File | Purpose | Used By |
|------|---------|---------|
| `ClientAccessManagement.tsx` | Client portal access management (create, revoke, reset) | ProjectDetailPage |
| `OverviewTab.tsx` | Project overview with recent comments | ProjectDetailPage |
| `TasksTab.tsx` | Project tasks with priority/status badges | ProjectDetailPage |
| `IntegrationsTab.tsx` | Integration status panel with provider logos | ProjectDetailPage |
| `ProjectsBackupStatus.tsx` | Backup status display | Not used (orphaned) |
| `ProjectsRestoreBackupDialog.tsx` | Backup restore dialog | Not used (orphaned) |

**Client portal (read-only dashboard):**

- `src/components/client-portal/ClientProgressRing.tsx`
- `src/components/client-portal/ClientMilestoneTimeline.tsx`
- `src/components/client-portal/ClientSprintTimeline.tsx`
- `src/components/client-portal/ClientRisksTimeline.tsx`
- `src/components/client-portal/ClientInvoiceSummary.tsx`
- `src/components/client-portal/ClientDeadlineCountdown.tsx`

All of these are used by `ClientPortalDashboard`.

### Hooks

**Module hooks (4 files in `src/modules/projects/hooks/`):**

| Hook | Purpose | Tables Queried |
|------|---------|----------------|
| `useProjects.ts` | Project CRUD with filters and sorting | `projects`, `project_statuses` |
| `useProjectDetail.ts` | Members, milestones, comments, risks | `project_members`, `project_milestones`, `project_comments`, `project_risks` |
| `useProjectIntegrations.ts` | Integration status with provider data | `organization_integrations`, `integration_providers` |
| `useProjectTasks.ts` | Project tasks via client_id lookup | `projects`, `tasks` |

**Additional hooks (from `src/hooks/`):**

| Hook | Purpose | Tables Queried |
|------|---------|----------------|
| `useClientAccess.ts` | Client portal access CRUD | `project_client_access` (3 `supabase as any` casts) |
| `useIntegrationSync.ts` | ActiveCollab/Jira project sync | Invokes edge functions |
| `useProjectReports.ts` | Project reporting aggregates | `projects`, `project_statuses`, `project_milestones`, `project_risks`, `project_billing` |
| `useProjectStatuses.ts` | Status CRUD + reorder | `project_statuses` |
| `useProjectModuleSettings.ts` | Project tab toggles | `system_settings` |

### Admin Pages (3 files in `src/pages/admin/`)

| File | Purpose | Route |
|------|---------|-------|
| `ProjectModules.tsx` | Toggle project detail tabs on/off | `/admin/settings/project-modules` |
| `ProjectStatusSettings.tsx` | Project status CRUD + reorder | `/admin/settings/project-statuses` |
| `ProjectReports.tsx` | Project metrics dashboard | `/admin/reports/projects` |

---

## Database / Schema (Framework)

The Projects module in this framework uses a subset of the full sj-control-main schema. Key tables:

- **`project_statuses`**  
  - Configurable project stages (Planning, Active, Completed, etc.)  
  - Used by `useProjectStatuses` and the create/edit form.

- **`projects`**  
  - Core project records: name, slug, dates, budget, status_id, client_id, owner_id, etc.  
  - Includes `external_provider` and `external_id` and a unique index on `(external_provider, external_id)` for sync upserts from ActiveCollab / Jira.

- **`project_members`**  
  - Project team members used by the **Members** tab.

- **`project_milestones`**  
  - Milestone tracking used by the **Milestones** tab and client portal timeline.

- **`project_comments`**  
  - Internal comments surfaced on the **Overview** tab.

- **`project_risks`**  
  - Risk tracking used by the **Issues** tab and client portal risks timeline.

- **`project_client_access`**  
  - Client access records (email, name, access_token, password_hash, project_slug, is_active, login_count, etc.)  
  - Backing store for client portal login and usage.

- **`project_client_comments`**  
  - Optional client-facing comments shown in the client portal.

- **`client_feedback`**  
  - Stores structured feedback submitted from the client portal.

- **`project_billing`, `project_invoices`**  
  - Present in the schema and seed for future billing UI and reporting.  
  - In this framework’s v1 client portal, invoice summary is a simple stub (0-values) and does not yet query these tables.

All related migrations live under `supabase/migrations/20260201_projects_module.sql` and `20260202100000_project_client_access.sql`.

---

## Edge Functions (Framework)

- **`create-client-access`**  
  - Generates a random password, hashes it with PBKDF2, and inserts/updates `project_client_access`.  
  - Returns `access_token` + the generated password so internal users can share with clients.

- **`client-dashboard-api`**  
  - `authenticate` — validates token + password against `project_client_access`.  
  - `get-dashboard` — returns project, milestones, mapped risks, client comments, and an `invoiceSummary` stub.  
  - `submit-feedback` — inserts into `client_feedback`.  
  - `get-feedback-history` — returns prior feedback for the project.

- **`sync-projects-activecollab`**  
  - Uses `ACTIVE_COLLAB_API_URL`, `ACTIVE_COLLAB_EMAIL`, `ACTIVE_COLLAB_PASSWORD`.  
  - Fetches projects from ActiveCollab and upserts them into `projects` with `external_provider = 'activecollab'`.

- **`sync-projects-jira`**  
  - Uses `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`.  
  - Fetches projects from Jira and upserts them into `projects` with `external_provider = 'jira'`.

---

## Reuse / Replication Checklist

When reusing or deploying the Projects module on a new server or demo:

1. **Migrations**  
   - Apply all core migrations, including:  
     - `20260201_projects_module.sql` (projects + related tables)  
     - `20260202100000_project_client_access.sql` (client portal tables)  
     - `20260201_app_modules.sql` (module registry).

2. **Seed data**  
   - Ensure `project_statuses` has at least one active row (run `supabase/seed/05-projects.sql` or insert minimal statuses manually).  
   - Optionally run `05-projects.sql` for demo projects, milestones, risks, billing, and invoices.

3. **Routes**  
   - Mount `projectsRoutes` in `App.tsx` under the main dashboard layout.  
   - Mount the public route `/projects/:slug/client-portal/:token` **outside** the protected layout so clients can access it without app auth.

4. **Navigation**  
   - Keep the `Projects` item in `mainNavigation` with `module: "projects"`.  
   - If you start using `user_module_permissions`, make sure target users have access to the `projects` module.

5. **Permissions / RLS**  
   - Confirm RLS and policies on `projects`, `project_client_access`, and related tables are applied from migrations.  
   - The client portal accesses data only through the `client-dashboard-api` Edge Function (no Supabase client in the browser).

6. **Hooks & components**  
   - Use the provided hooks (`useProjects`, `useProjectDetail`, `useClientAccess`, `useSyncProjects`) and components (`ClientAccessManagement`, client-portal components) as-is for consistency.

7. **Integrations (optional)**  
   - In Admin → Integrations, connect ActiveCollab or Jira.  
   - From the provider detail page, run **Sync projects** to load projects into the Projects list.

---

## Demo Flow (Framework)

1. **Connect an integration (optional)**  
   - Go to `Admin → Integrations`.  
   - Configure **ActiveCollab** or **Jira** credentials and test the connection.

2. **Sync projects**  
   - On the provider detail page for ActiveCollab or Jira, click **Sync projects**.  
   - The Projects list will populate from the external system.

3. **Create or edit a project**  
   - Navigate to `/projects` and click **New** (or open an existing project and click **Edit**).  
   - The form uses `ProjectFormPage` and `useProjects` hooks.

4. **Manage client portal access**  
   - Open a project detail page (`/projects/:slug` or `/projects/:slug/client_portal`).  
   - In the **Client Portal** tab, use **ClientAccessManagement** to create client access:
     - Enter client email + name, generate access, copy generated URL + password.

5. **Client view**  
   - Open the client portal URL in an incognito window or separate browser.  
   - Enter the password; the client sees a read-only dashboard (project summary, milestones, risks, basic invoice summary).

---

## Cross‑Module Dependencies

- **Depends on:**
  - Platform Core (auth, layouts, navigation)
  - `app_modules` / `user_module_permissions` for module access
  - Optional **Clients** module for `client_id` on projects (projects still work with `client_id = null`).

- **Used by:**
  - **Admin → Integrations** (ActiveCollab / Jira sync buttons)  
  - Future reporting / analytics that read from the `projects` table.

For the **full** Projects blueprint (including tasks, billing UI, resource projection, and extensive ActiveCollab integration), use `sj-control-main` as the reference and adapt from:

- `docs/modules/projects.md`  
- `docs/module-blueprints/04-projects.md`

---

## Full Projects Blueprint (sj-control-main reference)

> **Important:** The section below is copied from the **sj-control-main** implementation.  
> Many of these routes, pages, components, hooks, tables, and edge functions are **not yet implemented** in this framework, but are included here as a **replication / roadmap reference**.

### Overview (full)

The Projects module is the largest module in the system. It handles project lifecycle management including project listing with filters, detailed project views with multiple tabs (overview, tasks, meetings, billing, issues, files, integrations, client portal), milestones, backup/restore, resource projection, and ActiveCollab integration for task synchronization.

### Module Name

`Projects` (in app_modules and navigation)  
Related module: `Resource Projection`

### Routes Owned (full)

```text
/projects                              → Projects listing
/projects/:slug                        → Project detail
/projects/:slug/:tab                   → Project detail with specific tab
/projects/:slug/knowledge              → Project knowledge
/projects/:slug/issues/ai/analyze      → Project AI issue analysis
/projects/:slug/client-portal/:token   → Enhanced client dashboard
/client/project/:token                 → Client project dashboard (public)
/resources                             → Resources page
/resource-projection                   → Resource projection table
/resource-projection/dashboard         → Resource projection dashboard
/reports                               → Reports

Admin routes:
/admin/settings/project-statuses       → Project status management
/admin/settings/project-modules        → Project detail tab toggles
/admin/settings/work-types             → Work type settings
/admin/reports/projects                → Project reports
/admin/reports/resource-utilization    → Resource utilization
/admin/team/employee_projection        → RP team settings
```

### File Inventory (full)

#### Pages (11 files)

- `src/pages/Projects.tsx` — Project listing with filters and toolbar  
- `src/pages/projects/ProjectDetail.tsx` — Project detail (tab-based)  
- `src/pages/projects/ProjectKnowledge.tsx` — Project knowledge base  
- `src/pages/projects/Performance.tsx` — Project performance  
- `src/pages/ProjectIssuesAIAnalyzePage.tsx` — AI issue analysis  
- `src/pages/client/ProjectDashboard.tsx` — Client-facing dashboard  
- `src/pages/client/EnhancedClientDashboard.tsx` — Enhanced client dashboard  
- `src/pages/resourceProjection/Index.tsx` — Resource projection main  
- `src/pages/resourceProjection/Dashboard.tsx` — Resource projection dashboard  
- `src/pages/admin/ProjectStatusSettings.tsx` — Admin status config  
- `src/pages/admin/settings/ProjectModules.tsx` — Admin tab toggles  
- `src/pages/admin/reports/ProjectReports.tsx` — Project reports  

#### Components — projects/ (65+ files)

**Core:**

- OverviewTab.tsx, TasksTab.tsx, ProjectEditDialog.tsx  
- QuickEditProjectDialog.tsx, CreateProjectDialog.tsx  
- ProjectSummaryCard.tsx, ProjectOverviewCard.tsx  
- ProjectMembersDialog.tsx, ClientAccessManagement.tsx  
- ProjectsToolbar.tsx, ProjectsFiltersPanel.tsx, ProjectsPagination.tsx  

**Notes & Comments:**

- ProjectNotes.tsx, NotesEditor.tsx, ProjectComments.tsx  
- QuickCommentsSection.tsx, QuickNotesSection.tsx, PMClientComments.tsx  

**Tasks (project-scoped):**

- ActiveCollabTasks.tsx, ActiveCollabTasksList.tsx, TaskDetailModal.tsx  
- TaskComments.tsx, TaskFiltersPanel.tsx, TaskListVisibilityManager.tsx  
- TaskStatsDashboard.tsx, ProjectMeetingTasksExtractor.tsx  
- ExtractedTaskCard.tsx, SyncTaskListsModal.tsx  

**Milestones:**

- MilestoneManagement.tsx, MilestoneHistoryTimeline.tsx  

**Billing (7+ files in billing/):**

- BillingNotes.tsx, BillingComments.tsx, BillingSummaryCards.tsx  
- PaymentSchedule.tsx, ProjectInvoices.tsx  
- billing/BillingInformationCard.tsx, billing/SetupBillingModal.tsx  
- billing/InvoiceListing.tsx, billing/InvoiceHistoryModal.tsx  
- billing/EditInvoiceModal.tsx, billing/CreateInvoiceDropdown.tsx  
- billing/MonthlyInvoiceModal.tsx, billing/PayPerTaskInvoiceModal.tsx  

**Backup:**

- ProjectsBackupStatus.tsx, ProjectsRestoreBackupDialog.tsx  

**ActiveCollab:**

- ActiveCollabConnection.tsx, ActiveCollabConnectionFlow.tsx  
- ActiveCollabConnectionCard.tsx, ACProjectMatcher.tsx  
- IntegrationBadges.tsx, IntegrationsTab.tsx  

**Integrations (6 files):**

- integrations/ActiveCollabReportCard.tsx, integrations/SlackConfigCard.tsx  
- integrations/GoogleCalendarConfig.tsx, integrations/WeeklyUpdateComposer.tsx  
- integrations/WeeklyEmailUpdateCard.tsx, integrations/AIWeeklyUpdateCard.tsx  

**Meetings & Insights:**

- ProjectMeetingsManager.tsx, ProjectMeetingInsights.tsx  
- LinkMeetingDialog.tsx, MeetingTranscriptPreview.tsx  
- SuggestedMeetingsCard.tsx, SprintUpdateNotes.tsx  

**Issues:**

- ProjectIssuesTab.tsx, ProjectRisks.tsx, ProjectConcerns.tsx  
- issues-ai/PMDataSourcesStep.tsx, issues-ai/PMAnalysisProgressStep.tsx, issues-ai/PMResultsReviewStep.tsx  

**Files:**

- ProjectDrivePanel.tsx, ProjectDriveFilePicker.tsx  
- FilePreviewModal.tsx, LocalFileUploadModal.tsx  
- GoogleDriveFolderConfig.tsx, ProjectChecklistPanel.tsx  

**Client Portal:**

- ClientPortalTab.tsx, ClientFeedbackView.tsx  
- SourceDealCard.tsx, TechStackEditor.tsx  
- SyncMonitoringDashboard.tsx, SyncTestButton.tsx, GitHubTabContent.tsx  

#### Components — resourceProjection/ (31 files)

- ResourceProjectionTable.tsx, ProjectManagement.tsx, ProjectModal.tsx  
- AddRowDialog.tsx, AddMemberDialog.tsx, EmployeeModal.tsx  
- EditTeamDialog.tsx, ResourceRankingList.tsx  
- EditableResourceDropdown.tsx, EditableCell.tsx  
- TableFilters.tsx, SearchableCombobox.tsx, DeleteConfirmationDialog.tsx  
- TeamDetailsDialog.tsx, WorkloadDistributionChart.tsx  
- WeeklyTrendChart.tsx, DashboardMetricsOverview.tsx  
- BackupStatus.tsx, RestoreBackupDialog.tsx, SyncInfoBar.tsx  
- ScrollToButton.tsx, DuplicateBadge.tsx, DatabaseNote.tsx  

**Dashboard:**

- dashboard/EnhancedDashboardTabs.tsx, dashboard/DashboardControls.tsx  
- dashboard/ResourceDetailedSummary.tsx, dashboard/EnhancedKPICard.tsx  
- dashboard/ResourceCapacityTab.tsx, dashboard/PeopleCentricTab.tsx  
- dashboard/TrendsForcastingTab.tsx, dashboard/InfoTooltip.tsx  

#### Components — client-portal/ (6 files)

- ClientDeadlineCountdown.tsx, ClientInvoiceSummary.tsx  
- ClientMilestoneTimeline.tsx, ClientProgressRing.tsx  
- ClientRisksTimeline.tsx, ClientSprintTimeline.tsx  

#### Hooks (48 files)

**Project:**

- useProjects.ts, useProjectStatuses.ts, useProjectComments.ts  
- useProjectMembers.ts, useProjectMeetings.ts, useProjectMeetingSearch.ts  
- useProjectModuleSettings.ts, useProjectDriveFiles.ts  
- useProjectIntegrations.ts, useProjectAIIssues.ts, useProjectAIWeeklyUpdate.ts  

**Milestones:**

- useProjectMilestones.ts, useMilestoneHistory.ts  

**Billing:**

- useProjectBillingSetup.ts, useBillingComments.ts  

**Allocations:**

- useProjectAllocations.ts  

**Backup:**

- projects/useProjectsBackup.ts  

**Resources:**

- useResources.ts, useResourceSync.ts  

**ActiveCollab:**

- useActiveCollabTasks.ts, useActiveCollabBudgetDetails.ts  
- useActiveCollabExpenses.ts, useActiveCollabLookups.ts, useActiveCollabTimeRecords.ts  

**Resource Allocation (4 files):**

- resourceAllocation/useAllocations.ts, useProjectsForAllocation.ts  
- useResourcesForAllocation.ts, useTeamsForAllocation.ts  

**Resource Projection (13 files):**

- resourceProjection/useProjections.ts, useProjects.ts, useTeams.ts  
- useProjectionRows.ts, useProjectionState.ts, useAvailableWeeks.ts  
- useBulkSelection.ts, useDashboardMetrics.ts, useProjectionBackup.ts  
- useResourceProjectionSync.ts, useSendProjectionEmails.ts  
- useTeamResources.ts, useTeamMemberCounts.ts  

#### Types (2 files)

- `src/types/activecollab.ts` — IActiveCollabTask, IActiveCollabProject, ISyncLog  
- `src/types/resourceAllocation.ts` — Allocation types  

#### API Files (7 files)

- `src/api/ProjectsApi.ts` — Projects API  
- `src/api/AllocationApi.ts` — Allocation API  
- `src/api/ResourceApi.ts` — Resource API  
- `src/api/ActiveCollabApi.ts` — ActiveCollab API  
- `src/api/resourcePlanning/EmployeeApi.ts`  
- `src/api/resourcePlanning/TeamsApi.ts`  
- `src/api/resourcePlanning/index.ts`  

#### Edge Functions (45+ functions)

**ActiveCollab (27):**

- ac-create-project, ac-get-projects, ac-search-projects  
- ac-get-project-budget-summary, ac-get-project-budget-details  
- ac-get-project-expenses, ac-project-hours  
- ac-sync-project-tasks, ac-sync-project-budgets  
- ac-sync-tasks, ac-sync-expenses, ac-sync-time-records  
- ac-sync-lookup-tables, ac-get-all-tasks, ac-get-task-comments  
- ac-test-connection, ac-user-authenticate  
- activecollab-integration, activecollab-create-project  
- activecollab-create-task, activecollab-sync-projects  
- activecollab-sync-tasks, activecollab-comprehensive-sync  
- activecollab-test-sync, activecollab-user-auth  
- activecollab-webhook-handler, test-activecollab-connection  

**Project Core:**

- projects, api-v1-projects, notify-project-created  
- restore-project-backup, sync-external-projects  

**Analytics:**

- ai-analyze-project, extract-project-issues, generate-project-report  

**Resources:**

- generate-resource-utilization, sync-resources, sync-resources-native  

**Files & Knowledge:**

- project-drive-sync-files, sync-project-drive-files  
- project-knowledge-sync, index-project-document  
- process-pending-project-documents, reindex-project-files  

#### Database Tables (full)

- `projects` — Project records  
- `project_statuses` — Status definitions (configurable)  
- `project_favorites` — User favorites  
- `project_backups` — Backup snapshots  
- `project_members` — Team members  
- `project_comments` — Comments  
- `project_milestones` — Milestone tracking  
- `project_invoices` — Billing invoices  
- `project_billing` — Billing setup  
- `project_files` — File attachments  
- `project_risks` — Risk tracking  
- `project_checklists` — Checklists  
- `resource_projections` — Resource allocation data  
- `rp_teams` — Resource projection teams  
- `system_settings` (category=project_modules) — Tab toggles  

#### Cross-Module Dependencies (full)

- **Depends on:** Platform Core, Business Dev (client data, source deals), Meetings (project meetings), Knowledge Base (project knowledge)  
- **Used by:** Admin (project settings), Business Dev (deal→project conversion)  

#### Configuration (full)

- `system_settings` (category=`project_modules`): tasks_enabled, files_enabled, billing_enabled, etc.  
- `project_statuses`: Admin-configurable project lifecycle stages  
- ActiveCollab credentials stored as integration secrets  

#### Implementation Status (Framework)

| Component | Status |
|-----------|--------|
| Project listing + CRUD | Done |
| Project detail (7 tabs) | Done |
| ProjectKnowledgePage | Done |
| ProjectIssuesAIAnalyzePage | Placeholder |
| Client portal (auth + dashboard) | Done |
| Admin: ProjectModules | Done |
| Admin: ProjectStatusSettings | Done |
| Admin: ProjectReports | Done |
| All module hooks (4) | Done |
| Edge functions (4) | Done |

#### Known Issues

- 3 instances of `(supabase as any)` casts in `useClientAccess.ts` for `project_client_access` table
- 2 orphaned components (`ProjectsBackupStatus.tsx`, `ProjectsRestoreBackupDialog.tsx`) — not used by any page
- `ProjectIssuesAIAnalyzePage` is a placeholder with no implementation
- Client pages (`Clients.tsx`, `ClientForm.tsx`, `ClientDetail.tsx`) live in legacy `src/pages/` instead of module directory

#### Pending
- Billing/invoicing UI
- ActiveCollab task sync wiring
- Resource projection weekly allocation table
- Project backup/restore

#### Implementation Notes (full)

- Project detail uses tab-based navigation (overview, tasks, meetings, billing, files, integrations, issues, client portal)
- Tabs are toggleable via system_settings → project_modules
- ActiveCollab integration syncs tasks, time records, expenses, budgets
- Resource projection provides capacity planning with weekly allocation table
- Client portal uses token-based access (no auth required)
- Backup/restore creates full project snapshots  

