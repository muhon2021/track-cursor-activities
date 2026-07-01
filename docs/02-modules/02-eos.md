# EOS — Module Blueprint

## Overview

The Entrepreneurial Operating System (EOS) module implements strategic planning and execution tools. It includes the Vision/Traction Organizer (V/TO), OKRs (Objectives & Key Results), Scorecard for metrics, Issues tracking with AI analysis, and the Accountability Chart with GWC assessments.

## Module Name

`EOS` (in `app_modules` and navigation)
Related module: `OKRs` (separate sidebar entry, same module guard)

## Routes Owned

From `src/modules/eos/routes.tsx`:

```
/eos                           → EOS hub page
/eos/vto                       → Vision/Traction Organizer
/eos/issues                    → Issues pod overview
/eos/issues/all                → All issues
/eos/issues/pod/:podId         → Issues by pod
/eos/issues/anonymous          → Anonymous issues
/eos/issues/ai                 → AI-powered issues
/eos/issues/ai/analyze         → AI issue analysis wizard
/eos/issues/solved             → Solved issues
/eos/issues/archived           → Archived issues
/eos/issues/:issueId           → Issue detail
/eos/scorecard                 → Scorecard metrics
/eos/accountability            → Accountability chart
/eos/my-accountability         → Personal accountability
/okrs                          → OKRs management
```

Admin routes (from `src/modules/admin/routes.tsx`):

```
/admin/eos                     → Admin EOS hub
/admin/eos/vto                 → VTO admin
/admin/eos/scorecards          → Scorecard workspace
/admin/eos/accountability      → Accountability admin
```

---

## File Inventory

### Pages (17 files in `src/modules/eos/pages/`)

| File | Purpose | Route |
|------|---------|-------|
| `EOSHubPage.tsx` | EOS hub with section cards | `/eos` |
| `VTOPage.tsx` | Vision/Traction Organizer | `/eos/vto` |
| `OKRsPage.tsx` | OKRs with 5-tab view | `/okrs` |
| `OKRDetailDialog.tsx` | OKR detail dialog (used by OKRsPage) | — |
| `IssuesPage.tsx` | Issues pod overview | `/eos/issues` |
| `IssueDetailPage.tsx` | Issue detail | `/eos/issues/:issueId` |
| `IssuesAllPage.tsx` | All issues (no pre-filter) | `/eos/issues/all` |
| `IssuesSolvedPage.tsx` | Pre-filtered solved issues | `/eos/issues/solved` |
| `IssuesArchivedPage.tsx` | Pre-filtered archived issues | `/eos/issues/archived` |
| `IssuesAnonymousPage.tsx` | Anonymous issues | `/eos/issues/anonymous` |
| `IssuesAIPage.tsx` | AI-sourced issues + suggestions | `/eos/issues/ai` |
| `EOSIssuesAIAnalyzePage.tsx` | Multi-step AI analysis wizard | `/eos/issues/ai/analyze` |
| `IssuesPodOverviewPage.tsx` | Pod dashboard with stats | `/eos/issues` (default) |
| `IssuesByPodPage.tsx` | Pod-scoped issues | `/eos/issues/pod/:podId` |
| `ScorecardPage.tsx` | Scorecard metrics + trend chart | `/eos/scorecard` |
| `AccountabilityPage.tsx` | Org chart with tree view | `/eos/accountability` |
| `MyAccountabilityPage.tsx` | Personal accountability view | `/eos/my-accountability` |

Admin pages (in `src/pages/admin/eos/`):

| File | Purpose | Route |
|------|---------|-------|
| `AdminEOS.tsx` | Admin EOS hub with section cards | `/admin/eos` |
| `VTOAdmin.tsx` | VTO section management | `/admin/eos/vto` |
| `ScorecardWorkspace.tsx` | Scorecard + metrics CRUD | `/admin/eos/scorecards` |
| `AdminEOSAccountability.tsx` | Chart versions, role CRUD, GWC | `/admin/eos/accountability` |

### Components (33 files in `src/modules/eos/components/`)

**OKR (`okr/`, 10 files):**

| File | Purpose |
|------|---------|
| `OKRCard.tsx` | OKR card with key results and progress |
| `CreateOKRDialog.tsx` | Create OKR dialog form |
| `KeyResultProgress.tsx` | Key result progress bar |
| `CheckInDialog.tsx` | Key result check-in dialog |
| `CloseOKRDialog.tsx` | Close/complete OKR with status + notes |
| `ClosedOKRsTable.tsx` | Table of completed/closed OKRs |
| `KeyResultProgressChart.tsx` | Recharts LineChart for KR check-ins |
| `KeyResultsByOwner.tsx` | KRs grouped by owner with progress bars |
| `OKRHealthGrid.tsx` | OKR health cards sorted by urgency |
| `TeamOKRsByPod.tsx` | OKRs grouped by pod with collapsible sections |

**Issues (`issues/`, 8 files):**

| File | Purpose |
|------|---------|
| `IssuesTable.tsx` | Issues data table with sorting/filtering |
| `IssueStatsCards.tsx` | Summary stat cards (total, open, critical, etc.) |
| `CreateIssueDialog.tsx` | Create issue dialog form |
| `IssueFiltersBar.tsx` | Filter bar (status, priority, category, pod) |
| `IssuesNavTabs.tsx` | Navigation tabs across issue sub-pages |
| `PodIssueCard.tsx` | Pod card with colored border and mini stats |
| `PodIssueSummary.tsx` | Pod health overview with totals |

**Issues AI Suggestions (`issues/ai-suggestions/`, 5 files):**

| File | Purpose | Status |
|------|---------|--------|
| `AISuggestionCard.tsx` | Suggestion card with confidence bar | Scaffolded |
| `AISuggestionReviewDialog.tsx` | Full-detail review modal | Scaffolded |
| `AIReviewQueue.tsx` | Pending suggestions queue | Scaffolded |
| `AIWeeklyDigest.tsx` | Weekly summary with acceptance rate | Scaffolded |
| `AISuggestionStats.tsx` | Stats panel with type breakdown | Scaffolded |

> Note: The 5 AI suggestion components are exported from `index.ts` but are not yet wired into any page. They are scaffolding for the planned `eos-triage-assistant` workflow.

**Accountability (`accountability/`, 8 files):**

| File | Purpose |
|------|---------|
| `GWCBadge.tsx` | Get/Want/Capacity badge indicator |
| `OrgTree.tsx` | Org chart tree visualization |
| `ChartForm.tsx` | Create/edit accountability chart form |
| `ChartHistoryTimeline.tsx` | Vertical timeline of chart versions |
| `ChartVersionHistory.tsx` | Table view with publish actions |
| `ResponsibilitiesEditor.tsx` | Inline responsibility list editor |
| `EmployeeAccountabilityModal.tsx` | Role detail modal with GWC display |
| `GWCAssessmentDialog.tsx` | Toggle G/W/C assessment dialog |

**Scorecard (`scorecard/`, 2 files):**

| File | Purpose |
|------|---------|
| `ScorecardMetricsTable.tsx` | Scorecard metrics data table |
| `MetricTrendChart.tsx` | Recharts LineChart for metric trends |

**VTO (`vto/`, 1 file):**

| File | Purpose |
|------|---------|
| `VTOSection.tsx` | VTO section renderer |

### Hooks (11 files in `src/modules/eos/hooks/`)

| Hook | Purpose | Tables Queried |
|------|---------|----------------|
| `useOKRs.ts` | OKR CRUD, key results, check-ins | `okrs`, `okr_key_results`, `okr_check_ins` |
| `useEOSIssues.ts` | Issues CRUD with filters | `eos_issues` |
| `useEOSIssuesByPod.ts` | Issues grouped by pod with stats | `eos_issues`, `eos_pods` |
| `useEOSIssueInsights.ts` | Issue analytics (trends, by-status, by-pod) | `eos_issues`, `eos_issue_suggestions` |
| `useAIIssueSuggestions.ts` | AI suggestion CRUD + stats | `eos_issue_suggestions` |
| `useVTO.ts` | VTO query and update | `eos_vto` |
| `useScorecard.ts` | Scorecard + metrics CRUD | `eos_scorecards`, `eos_scorecard_metrics` |
| `useAccountability.ts` | Chart versions, responsibilities, GWC | `accountability_charts`, `accountability_responsibilities`, `gwc_assessments` |
| `useEOSPods.ts` | Pod CRUD | `eos_pods` |
| `useExtractMeetingIssues.ts` | AI extract issues from meeting transcripts | `eos_issues`, `eos_issue_suggestions` |
| `usePromoteIssueToEOS.ts` | Convert project/meeting issue to EOS issue | `eos_issues` |

### Edge Functions (3 implemented)

| Function | Purpose | Called From |
|----------|---------|-------------|
| `extract-meeting-issues` | AI extraction of issues from transcripts | `useExtractMeetingIssues` |
| `eos-triage-assistant` | Issue triage and categorization | Not yet wired to frontend |
| `suggest-okrs` | AI OKR suggestions | Not yet wired to frontend |

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `okrs` | Objectives with quarter, status, owner, pod |
| `okr_key_results` | Key results linked to OKRs |
| `okr_check_ins` | Check-in history with values and notes |
| `eos_issues` | Issues with priority, category, pod, status |
| `eos_issue_suggestions` | AI-generated issue suggestions |
| `eos_scorecards` | Scorecard definitions |
| `eos_scorecard_metrics` | Scorecard metric entries (weekly) |
| `accountability_charts` | Org chart versions (draft/published/archived) |
| `accountability_responsibilities` | Role definitions with parent hierarchy |
| `gwc_assessments` | Get/Want/Capacity assessments per employee/role |
| `eos_vto` | Vision/Traction Organizer content |
| `eos_pods` | Pod/team definitions for issue organization |

## Cross-Module Dependencies

**Depends on:** Platform Core (auth, layouts, UI)
**Used by:** Admin (4 EOS admin pages)
**Cross-module hooks:**
- `useExtractMeetingIssues` — Meetings → EOS: extracts issues from meeting transcripts (hook + edge function implemented, not yet wired to meeting UI)
- `usePromoteIssueToEOS` — Any module → EOS: promotes an issue to EOS tracking (hook implemented, not yet wired)

## Implementation Status

| Component | Status |
|-----------|--------|
| EOS Hub page | Done |
| VTO page + admin | Done |
| OKRs page (5-tab view) | Done |
| OKR CRUD + check-ins | Done |
| Issues page (7 sub-pages) | Done |
| Issue CRUD + filters | Done |
| Issues pod overview | Done |
| AI issues analysis wizard | Done |
| AI suggestion components | Scaffolded (not wired) |
| Scorecard + metrics | Done |
| MetricTrendChart | Done |
| Accountability chart + tree | Done |
| Accountability admin (versions, roles, GWC) | Done |
| Cross-module hooks | Done (not wired to UI) |
| Edge functions (extract-meeting-issues) | Done |
| Edge functions (eos-triage-assistant, suggest-okrs) | Implemented, not wired |

### Known Issues

- 7 instances of `(supabase as any)` casts in hooks for tables not in generated types
- `OKRDetailDialog.tsx` is in `pages/` directory but functions as a component (used by OKRsPage)
- 5 AI suggestion components are scaffolded but not rendered in any page
- `useExtractMeetingIssues` and `usePromoteIssueToEOS` exist but lack UI integration points
