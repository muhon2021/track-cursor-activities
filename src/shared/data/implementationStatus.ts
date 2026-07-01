/**
 * Implementation Tracker — Single source of truth for all module status.
 *
 * Updated by developers after each batch of work.
 * Rendered at /admin/implementation-status for the whole team.
 *
 * Status values:
 *   "done"       — Built, code-reviewed, merged
 *   "qa-ready"   — Built and pushed, ready for QA testing
 *   "in-progress" — Currently being worked on
 *   "planned"    — Scoped and assigned, not started
 *   "blocked"    — Waiting on a dependency
 *   "not-started" — Not yet scoped
 *
 * Pipeline (4-phase delivery):
 *   Development → QA (via Lovable QA module) → Data Seeding → Sign-off (Jairaj)
 */

export type ItemStatus = "done" | "qa-ready" | "in-progress" | "planned" | "blocked" | "not-started";

export type PipelineStatus = "not-started" | "in-progress" | "done" | "blocked";

export interface PipelinePhase {
  status: PipelineStatus;
  owner?: string;
  notes?: string;
}

export interface Pipeline {
  development: PipelinePhase;
  qa: PipelinePhase;
  dataSeeding: PipelinePhase;
  signOff: PipelinePhase;
}

export interface TeamMember {
  id: string;
  name: string;
  modules: string[];
}

export interface StatusItem {
  name: string;
  status: ItemStatus;
  notes?: string;
}

export interface DocReference {
  title: string;
  path: string;
  description: string;
}

export interface ModuleStatus {
  id: string;
  name: string;
  phase: number;
  owner: string;
  summary: string;
  docs: DocReference[];
  pipeline: Pipeline;
  database: { tables: number; status: ItemStatus; notes?: string };
  types: { status: ItemStatus };
  routes: { status: ItemStatus; notes?: string };
  navigation: { status: ItemStatus; notes?: string };
  pages: StatusItem[];
  hooks: StatusItem[];
  components: StatusItem[];
  edgeFunctions: StatusItem[];
  qaChecklist: { description: string; tested: boolean; approvedBy?: string }[];
  nextSteps: string[];
  blockers?: string[];
}

// ─── Team ──────────────────────────────────────────────────────────────────────

export const TEAM: TeamMember[] = [
  { id: "shahed", name: "Shahed", modules: ["platform", "knowledge", "admin", "ai-agents"] },
  { id: "abesh", name: "Abesh", modules: ["actions", "eos", "meetings"] },
  { id: "zia", name: "Zia", modules: ["projects", "business-dev", "productivity"] },
];

export const SIGN_OFF_OWNER = "Jairaj";

// ─── Last updated: 2026-02-04 ─────────────────────────────────────────────────

export const implementationStatus: ModuleStatus[] = [
  // ── Phase 0: Foundation ──────────────────────────────────────────────────────
  {
    id: "platform",
    name: "Platform Core",
    phase: 0,
    owner: "Shahed",
    summary: "Auth, layout, routing, module access, config, shared UI. OAuth flows for Zoom/Google/Microsoft added. Google Meet integration complete.",
    pipeline: {
      development: { status: "done", owner: "Shahed" },
      qa: { status: "not-started", owner: "Shahed", notes: "Test via Lovable QA module" },
      dataSeeding: { status: "done", owner: "Shahed", notes: "supabase/seed/00-platform-core.sql — clients, app_modules, system_settings, feature flags, notifications, activity logs" },
      signOff: { status: "not-started", owner: "Jairaj" },
    },
    docs: [
      { title: "Platform Core Blueprint", path: "docs/02-modules/01-platform-core.md", description: "Pages, components, hooks, routes, DB tables for platform core" },
      { title: "Architecture Overview", path: "docs/01-architecture/00-architecture-overview.md", description: "V2 architecture: 4-layer framework, component hierarchy, AI, integrations" },
      { title: "Implementation Plan", path: "docs/IMPLEMENTATION_PLAN.md", description: "Chief Architect review: gap analysis, 8 phases, architectural decisions" },
    ],
    database: { tables: 8, status: "done", notes: "profiles, app_modules, user_module_permissions, system_settings, user_roles, announcements, feedback, sessions" },
    types: { status: "done" },
    routes: { status: "done" },
    navigation: { status: "done" },
    pages: [
      { name: "Dashboard", status: "done" },
      { name: "Profile / Settings", status: "done" },
      { name: "Login / Register / Forgot Password", status: "done" },
    ],
    hooks: [
      { name: "useAuth / useFeatureFlags / useModuleAccess", status: "done" },
      { name: "useBranding / useToast", status: "done" },
    ],
    components: [
      { name: "DashboardLayout / AppSidebar / AdminSidebar", status: "done" },
      { name: "ModuleRoute / ProtectedRoute / AdminRoute", status: "done" },
      { name: "shadcn/ui component library (49 components)", status: "done" },
    ],
    edgeFunctions: [
      { name: "user-oauth-connect — initiate OAuth flow (Google/Zoom/Microsoft)", status: "done" },
      { name: "user-oauth-callback — OAuth token exchange and storage", status: "done" },
    ],
    qaChecklist: [
      { description: "Login/logout flow works", tested: true, approvedBy: "—" },
      { description: "Module toggle in app_modules hides/shows sidebar items", tested: false },
      { description: "Feature flags gate routes correctly", tested: false },
      { description: "Admin-only routes reject non-admin users", tested: false },
      { description: "OAuth connect flow initiates correctly", tested: false },
      { description: "OAuth callback exchanges code for tokens", tested: false },
    ],
    nextSteps: [],
  },

  // ── Phase 1: Actions ─────────────────────────────────────────────────────────
  {
    id: "actions",
    name: "Actions (Tasks & Streams)",
    phase: 1,
    owner: "Abesh",
    summary: "Task CRUD, streams, comments, subtasks. Core flows complete.",
    pipeline: {
      development: { status: "done", owner: "Abesh" },
      qa: { status: "not-started", owner: "Abesh", notes: "Test via Lovable QA module" },
      dataSeeding: { status: "done", owner: "Abesh", notes: "supabase/seed/01-actions.sql — 5 streams, 6 categories, 20 tasks, comments, stream members" },
      signOff: { status: "not-started", owner: "Jairaj" },
    },
    docs: [
      { title: "Actions Blueprint", path: "docs/02-modules/05-actions.md", description: "8 pages, 22 components, 16 hooks, 7 tables, 12 edge functions" },
    ],
    database: { tables: 6, status: "done", notes: "task_streams, task_stream_members, task_categories, task_comments, task_attachments, task_contributors" },
    types: { status: "done" },
    routes: { status: "done" },
    navigation: { status: "done" },
    pages: [
      { name: "TasksPage — list with filters", status: "qa-ready" },
      { name: "TaskDetailPage — detail with comments", status: "qa-ready" },
      { name: "StreamsPage — stream listing", status: "qa-ready" },
      { name: "StreamTasksPage — tasks within a stream", status: "qa-ready" },
    ],
    hooks: [
      { name: "useTasksV2 — CRUD, filters (including category_id)", status: "done" },
      { name: "useTaskComments — comment thread", status: "done" },
      { name: "useTaskStreams — stream CRUD + members", status: "done" },
      { name: "useTaskCategories — CRUD for task categories", status: "done" },
    ],
    components: [
      { name: "TasksTable, CreateTaskDialog (with category selector), TaskFiltersBar (with category filter), TaskViewTabs", status: "done" },
      { name: "SubTasksList (with creation + toggle), CommentThread", status: "done" },
      { name: "StreamCard, CreateStreamDialog", status: "done" },
    ],
    edgeFunctions: [
      { name: "Task API (api-v1-tasks) — full CRUD with filters, pagination", status: "done" },
      { name: "AI task assistant", status: "not-started" },
      { name: "ActiveCollab sync (sync-projects-activecollab)", status: "done" },
    ],
    qaChecklist: [
      { description: "Create a task from /tasks, verify it appears in the list", tested: false },
      { description: "Open task detail, add a comment, verify it persists", tested: false },
      { description: "Create a stream, assign tasks to it, verify stream view", tested: false },
      { description: "Filter tasks by status and assignee", tested: false },
      { description: "Delete a task and verify removal", tested: false },
      { description: "Create a task with a category, verify category badge shows", tested: false },
      { description: "Filter tasks by category from the filters bar", tested: false },
      { description: "Change task category from the detail page sidebar", tested: false },
    ],
    nextSteps: [
      "Implement task assignment notifications (edge function)",
    ],
  },

  // ── Phase 2: EOS ─────────────────────────────────────────────────────────────
  {
    id: "eos",
    name: "EOS (V/TO, OKRs, Issues, Scorecard, Accountability)",
    phase: 2,
    owner: "Abesh",
    summary: "Full EOS framework. 17 user pages, 4 admin pages, 32 components, 11 hooks. OKRsPage: 5-tab view (cards, health grid, by-pod, by-owner, closed). ScorecardPage: MetricTrendChart wired below table. IssuesPodOverviewPage: PodIssueCard + PodIssueSummary replacing inline cards. AdminEOSAccountability: ChartHistoryTimeline + EmployeeAccountabilityModal + GWCAssessmentDialog wired. AI: suggestion review, analyze wizard. Cross-module: promote/extract issues.",
    pipeline: {
      development: { status: "done", owner: "Abesh" },
      qa: { status: "not-started", owner: "Abesh", notes: "Test via Lovable QA module" },
      dataSeeding: { status: "done", owner: "Abesh", notes: "supabase/seed/02-eos.sql — 3 pods, 8 VTO sections, 3 OKRs, 9 KRs, check-ins, 5 issues, scorecard, org chart, GWC" },
      signOff: { status: "not-started", owner: "Jairaj" },
    },
    docs: [
      { title: "EOS Blueprint", path: "docs/02-modules/02-eos.md", description: "24 pages, 40+ components, 15 hooks, 12 tables, 12 edge functions" },
    ],
    database: { tables: 12, status: "done", notes: "eos_pods, eos_vto, okrs, okr_key_results, okr_check_ins, eos_issues, eos_issue_suggestions, eos_scorecards, eos_scorecard_metrics, accountability_charts, accountability_responsibilities, gwc_assessments" },
    types: { status: "done" },
    routes: { status: "done" },
    navigation: { status: "done" },
    pages: [
      { name: "EOSHubPage — module landing", status: "qa-ready" },
      { name: "VTOPage — vision/traction organizer", status: "qa-ready" },
      { name: "OKRsPage — 5-tab view (cards, health grid, by-pod, by-owner, closed) with close dialog", status: "qa-ready" },
      { name: "OKRDetailDialog — key results + check-ins", status: "qa-ready" },
      { name: "IssuesPage — IDS issue tracker", status: "qa-ready" },
      { name: "IssueDetailPage — issue detail", status: "qa-ready" },
      { name: "ScorecardPage — scorecard metrics table + MetricTrendChart", status: "qa-ready" },
      { name: "AccountabilityPage — org chart", status: "qa-ready" },
      { name: "MyAccountabilityPage — personal view", status: "qa-ready" },
      { name: "IssuesAllPage — all issues (unfiltered)", status: "done" },
      { name: "IssuesSolvedPage — pre-filtered solved issues", status: "done" },
      { name: "IssuesArchivedPage — pre-filtered archived issues", status: "done" },
      { name: "IssuesAnonymousPage — anonymous issues (client-side filter)", status: "done" },
      { name: "IssuesAIPage — AI-sourced issues + suggestion review queue", status: "done" },
      { name: "IssuesByPodPage — pod-scoped issues with create", status: "done" },
      { name: "IssuesPodOverviewPage — pod dashboard with PodIssueCard, PodIssueSummary, stats cards", status: "done" },
      { name: "EOSIssuesAIAnalyzePage — multi-step AI analysis wizard (sources → analyze → review)", status: "done" },
      { name: "AdminEOS — admin hub with section cards", status: "done" },
      { name: "VTOAdmin — VTO section management with edit/reset", status: "done" },
      { name: "ScorecardWorkspace — scorecard + metrics CRUD", status: "done" },
      { name: "AdminEOSAccountability — chart versions + role CRUD + timeline + employee modal + GWC dialog", status: "done" },
    ],
    hooks: [
      { name: "useVTO — vision/traction CRUD", status: "done" },
      { name: "useOKRs — OKR + key results + check-ins", status: "done" },
      { name: "useEOSIssues — issue tracker CRUD", status: "done" },
      { name: "useScorecard — scorecard + metrics", status: "done" },
      { name: "useAccountability — org chart + responsibilities", status: "done" },
      { name: "useEOSPods — pod management", status: "done" },
      { name: "useEOSIssuesByPod — group issues by pod with per-pod stats", status: "done" },
      { name: "useAIIssueSuggestions — CRUD + review workflow + stats", status: "done" },
      { name: "useEOSIssueInsights — analytics: by status/priority/category/pod/source, trends", status: "done" },
      { name: "usePromoteIssueToEOS — convert project/meeting issue to EOS issue", status: "done" },
      { name: "useExtractMeetingIssues — AI extract issues from transcripts + batch create", status: "done" },
    ],
    components: [
      { name: "VTOSection", status: "done" },
      { name: "OKRCard, KeyResultProgress, CreateOKRDialog, CheckInDialog", status: "done" },
      { name: "IssuesTable, IssueStatsCards, CreateIssueDialog, IssueFiltersBar", status: "done" },
      { name: "ScorecardMetricsTable", status: "done" },
      { name: "OrgTree, GWCBadge", status: "done" },
      { name: "AISuggestionCard — suggestion card with confidence bar, accept/reject", status: "done" },
      { name: "AISuggestionReviewDialog — full-detail review modal", status: "done" },
      { name: "AIReviewQueue — pending suggestions queue", status: "done" },
      { name: "AIWeeklyDigest — weekly AI suggestion summary", status: "done" },
      { name: "AISuggestionStats — stats panel with type breakdown", status: "done" },
      { name: "ChartForm — create/edit accountability chart form", status: "done" },
      { name: "ChartHistoryTimeline — vertical timeline of chart versions", status: "done" },
      { name: "ChartVersionHistory — table view of chart versions with publish", status: "done" },
      { name: "ResponsibilitiesEditor — inline responsibility list editor", status: "done" },
      { name: "EmployeeAccountabilityModal — role detail modal with GWC", status: "done" },
      { name: "GWCAssessmentDialog — GWC toggle assessment dialog", status: "done" },
      { name: "MetricTrendChart — recharts line chart for scorecard metrics over time", status: "done" },
      { name: "CloseOKRDialog — close/complete OKR with status + notes", status: "done" },
      { name: "ClosedOKRsTable — table of completed/closed OKRs", status: "done" },
      { name: "KeyResultProgressChart — recharts line chart for KR check-ins over time", status: "done" },
      { name: "KeyResultsByOwner — KRs grouped by owner with progress", status: "done" },
      { name: "OKRHealthGrid — responsive OKR health cards sorted by urgency", status: "done" },
      { name: "TeamOKRsByPod — OKRs grouped by pod with collapsible sections", status: "done" },
      { name: "PodIssueCard — pod card with colored border, mini stats, recent issues", status: "done" },
      { name: "PodIssueSummary — pod health overview with totals and health indicators", status: "done" },
    ],
    edgeFunctions: [
      { name: "extract-meeting-issues — AI issue extraction from transcripts", status: "done" },
      { name: "suggest-okrs — AI OKR suggestions based on issues/context", status: "done" },
      { name: "eos-triage-assistant — AI issue triage (priority, category, pod)", status: "done" },
      { name: "quarterly-digest — AI quarterly digest report", status: "done" },
    ],
    qaChecklist: [
      { description: "Navigate /eos hub and verify all section links work", tested: false },
      { description: "Edit V/TO sections and verify persistence", tested: false },
      { description: "Create an OKR, add key results, record check-ins", tested: false },
      { description: "Create an issue, change priority, resolve it", tested: false },
      { description: "View scorecard metrics table with data", tested: false },
      { description: "View accountability chart and GWC badges", tested: false },
      { description: "Navigate /eos/issues/all and verify full list renders", tested: false },
      { description: "Navigate /eos/issues/solved and verify only solved issues shown", tested: false },
      { description: "Navigate /eos/issues/archived and verify only archived issues shown", tested: false },
      { description: "Navigate /eos/issues/anonymous and verify anonymous filter", tested: false },
      { description: "Navigate /eos/issues/ai — view AI-sourced issues and suggestion stats", tested: false },
      { description: "Accept/reject an AI suggestion from the AI issues page", tested: false },
      { description: "Navigate /eos/issues/pod-overview — see pod cards with stats", tested: false },
      { description: "Click a pod card to navigate to /eos/issues/pod/:podId", tested: false },
      { description: "Create an issue from pod view with defaultPodId pre-filled", tested: false },
      { description: "View MetricTrendChart on scorecard page with weekly data", tested: false },
      { description: "Use ChartForm to create a new accountability chart version", tested: false },
      { description: "View ChartHistoryTimeline with version dots and badges", tested: false },
      { description: "Edit responsibilities inline with ResponsibilitiesEditor", tested: false },
      { description: "Open EmployeeAccountabilityModal and see role detail + GWC", tested: false },
      { description: "Run GWCAssessmentDialog — toggle G/W/C switches and save", tested: false },
      { description: "Navigate /eos/issues/ai/analyze — run 3-step wizard", tested: false },
      { description: "Select sources, run analysis, review extracted issues", tested: false },
      { description: "Accept extracted issues and create them from wizard", tested: false },
      { description: "View OKRHealthGrid with status-sorted OKR cards", tested: false },
      { description: "View TeamOKRsByPod with collapsible pod sections", tested: false },
      { description: "View KeyResultsByOwner grouped KR list", tested: false },
      { description: "View KeyResultProgressChart with check-in trend line", tested: false },
      { description: "Close an OKR via CloseOKRDialog with status and notes", tested: false },
      { description: "View ClosedOKRsTable with completed/closed OKRs", tested: false },
      { description: "View PodIssueCard with colored border and recent issues", tested: false },
      { description: "View PodIssueSummary health indicators across pods", tested: false },
      { description: "OKRsPage: switch between Cards, Health, By Pod, By Owner, Closed tabs", tested: false },
      { description: "OKRsPage: close an OKR via CloseOKRDialog from card context", tested: false },
      { description: "ScorecardPage: see MetricTrendChart below metrics table", tested: false },
      { description: "IssuesPodOverviewPage: see PodIssueCard with colored border and recent issues", tested: false },
      { description: "IssuesPodOverviewPage: see PodIssueSummary health panel above pod grid", tested: false },
      { description: "AdminEOSAccountability: see ChartHistoryTimeline visual timeline", tested: false },
      { description: "AdminEOSAccountability: click role name to open EmployeeAccountabilityModal", tested: false },
      { description: "AdminEOSAccountability: click GWC button to open GWCAssessmentDialog", tested: false },
    ],
    nextSteps: [
      "Deploy edge functions to Supabase (needs API keys in secrets)",
      "OKR permissions (owner vs viewer)",
    ],
  },

  // ── Phase 3: Meetings ────────────────────────────────────────────────────────
  {
    id: "meetings",
    name: "Meetings V2",
    phase: 3,
    owner: "Abesh",
    summary: "Extended meetings with agenda, takeaways, participants, recurring series. Detail page with 7 tabs. MeetingsSchedulePage: 3-tab view (schedule, efficiency dashboard, action items). Transcripts page with nav item. AI summary generation, task extraction, cross-module linking (client/deal/project meetings).",
    pipeline: {
      development: { status: "done", owner: "Abesh" },
      qa: { status: "not-started", owner: "Abesh", notes: "Test via Lovable QA module" },
      dataSeeding: { status: "done", owner: "Abesh", notes: "supabase/seed/03-meetings.sql — 2 series, 6 meetings, participants, agenda items, takeaways, transcript" },
      signOff: { status: "not-started", owner: "Jairaj" },
    },
    docs: [
      { title: "Meetings Blueprint", path: "docs/02-modules/03-meetings.md", description: "7 pages, 46 components, 30 hooks, 9 tables, 33 edge functions" },
    ],
    database: { tables: 7, status: "done", notes: "meeting_series, meeting_agenda_items, meeting_takeaways, meeting_participants, meeting_transcripts, meeting_categorizations, meeting_assignments" },
    types: { status: "done" },
    routes: { status: "done" },
    navigation: { status: "done" },
    pages: [
      { name: "MeetingsSchedulePage — 3-tab (schedule with list/calendar, efficiency dashboard, action items)", status: "qa-ready" },
      { name: "MeetingDetailV2Page — tabbed detail (details, agenda, takeaways, participants, transcript, tasks, series)", status: "qa-ready" },
      { name: "MeetingSeriesPage — recurring series", status: "qa-ready" },
      { name: "MeetingTranscriptsPage — transcript browser with search, status filter, preview dialog", status: "done" },
    ],
    hooks: [
      { name: "useMeetingAgenda — CRUD + reorder", status: "done" },
      { name: "useMeetingTakeaways — CRUD + toggle", status: "done" },
      { name: "useMeetingParticipants — CRUD + attendance", status: "done" },
      { name: "useRecurringMeetings — series CRUD", status: "done" },
      { name: "useMeetingEfficiency — efficiency score, agenda/takeaway rates, monthly trend", status: "done" },
      { name: "useMeetingActionItems — action items query, my items, stats (total/completed/overdue/upcoming)", status: "done" },
      { name: "useMeetingAssignment — link meetings to client/project/deal, entity queries", status: "done" },
      { name: "useGenerateMeetingSummary — invoke AI edge function for meeting summary", status: "done" },
      { name: "useExtractMeetingTasks — AI extract action items from transcript + batch create", status: "done" },
      { name: "useCrossModuleMeetings — useClientMeetings, useDealMeetings, useProjectMeetings", status: "done" },
    ],
    components: [
      { name: "AgendaTab, TakeawaysTab, ParticipantsTab", status: "done" },
      { name: "MeetingsCalendar", status: "done" },
      { name: "SeriesCard", status: "done" },
      { name: "AddParticipantDialog — dialog with name, email, role selector", status: "done" },
      { name: "MeetingParticipantSelector — inline participant list with avatars, role badges, remove", status: "done" },
      { name: "PreviousAgendaViewer — read-only agenda from previous meeting in series", status: "done" },
      { name: "SeriesHistoryTab — timeline of all meetings in a series", status: "done" },
      { name: "RelatedTasksTab — action items and linked tasks from takeaways", status: "done" },
      { name: "TranscriptTab — transcript viewer with AI summary (+ generate button), speaker segments, search", status: "done" },
      { name: "ActionItemsPanel — pending action items with due date urgency, completion toggle", status: "done" },
      { name: "MeetingEfficiencyDashboard — user-facing efficiency dashboard with trend chart", status: "done" },
    ],
    edgeFunctions: [
      { name: "Meeting summarization AI (generate-meeting-summary)", status: "done" },
      { name: "Categorization engine (categorize-meeting)", status: "done" },
      { name: "Task extraction from transcripts (extract-meeting-tasks)", status: "done" },
      { name: "Zoom integration — OAuth + meeting sync (admin pages built)", status: "done" },
    ],
    qaChecklist: [
      { description: "Create a meeting, add agenda items, reorder them", tested: false },
      { description: "Add takeaways and toggle completion", tested: false },
      { description: "Add participants and mark attendance", tested: false },
      { description: "Create a recurring series", tested: false },
      { description: "Switch between list and calendar views", tested: false },
      { description: "View Related Tasks tab in meeting detail", tested: false },
      { description: "View Series History tab for a series meeting", tested: false },
      { description: "Add participant via AddParticipantDialog", tested: false },
      { description: "View PreviousAgendaViewer in agenda tab for series meeting", tested: false },
      { description: "Navigate /meetings/transcripts and see transcript list", tested: false },
      { description: "Search transcripts by meeting title or content", tested: false },
      { description: "Preview transcript via eye icon dialog", tested: false },
      { description: "View Meeting Analytics efficiency score and monthly trend", tested: false },
      { description: "View Transcript tab — see AI summary, speaker segments, search", tested: false },
      { description: "View ActionItemsPanel — see pending items with due date badges", tested: false },
      { description: "Toggle action item completion from panel", tested: false },
      { description: "Assign meeting to a client/project/deal via useMeetingAssignment", tested: false },
      { description: "Generate AI summary via useGenerateMeetingSummary", tested: false },
      { description: "Extract tasks from transcript via useExtractMeetingTasks", tested: false },
      { description: "Query client/deal/project meetings via cross-module hooks", tested: false },
      { description: "View Meetings tab in DealDetailPage with linked meetings", tested: false },
      { description: "View Meetings tab in ProjectDetailPage with linked meetings", tested: false },
      { description: "View linked meetings count + list in ClientDetail Related Data", tested: false },
      { description: "Click Generate AI Summary button in TranscriptTab", tested: false },
      { description: "Extract tasks from transcript in Tasks tab, review and create", tested: false },
      { description: "View MeetingEfficiencyDashboard with trend chart and stats", tested: false },
      { description: "Switch to Efficiency tab on MeetingsSchedulePage", tested: false },
      { description: "Switch to Action Items tab on MeetingsSchedulePage and see pending items", tested: false },
      { description: "Navigate to Transcripts from sidebar nav", tested: false },
    ],
    nextSteps: [
      "Deploy edge functions to Supabase production (set OPENAI_API_KEY in secrets)",
      "Zoom/Teams calendar sync",
    ],
  },

  // ── Phase 4: Knowledge Base ──────────────────────────────────────────────────
  {
    id: "knowledge",
    name: "Knowledge Base",
    phase: 4,
    owner: "Shahed",
    summary: "Fully modularized with pages, hooks, edge functions. Unified documents layer, semantic search, embeddings pipeline, agent personalizations all wired.",
    pipeline: {
      development: { status: "done", owner: "Shahed", notes: "All pages built, hooks wired, unified docs layer merged, semantic search + embeddings explorer live." },
      qa: { status: "not-started", owner: "Shahed", notes: "Test via Lovable QA module" },
      dataSeeding: { status: "done", owner: "Shahed", notes: "supabase/seed/04-knowledge.sql — 4 categories, 7 articles, 3 sources, 3 common knowledge items" },
      signOff: { status: "not-started", owner: "Jairaj" },
    },
    docs: [
      { title: "Knowledge Base Blueprint", path: "docs/02-modules/07-knowledge-base.md", description: "20 pages, 17+ components, 20 hooks, 9 tables, 22 edge functions" },
    ],
    database: { tables: 10, status: "done", notes: "knowledge_sources, knowledge_files, knowledge_embeddings, user_knowledge_files, embedding_queue, common_knowledge, vector_search_logs, unified_documents, user_agent_personalizations, knowledge_categories" },
    types: { status: "done" },
    routes: { status: "done" },
    navigation: { status: "done" },
    pages: [
      { name: "Knowledge — hub listing with search and categories", status: "done" },
      { name: "KnowledgeDetail — article view with markdown, bookmarks", status: "done" },
      { name: "KnowledgeForm — create/edit with live preview, AI summary", status: "done" },
      { name: "KnowledgeUpload — batch file upload with metadata", status: "done" },
      { name: "KnowledgeByCategory — browse by category", status: "done" },
      { name: "PersonalKnowledge — user knowledge file management", status: "done" },
      { name: "SemanticSearch — AI-powered vector search with similarity scores", status: "done" },
      { name: "EmbeddingsExplorer — admin embedding queue, coverage, search logs", status: "done" },
    ],
    hooks: [
      { name: "useKnowledge — entries CRUD, search, embedding, bookmarks (13 hooks, bookmarks wired)", status: "done" },
      { name: "useKnowledgeAdmin — categories CRUD, tree, stats, embedding stats (10 hooks)", status: "done" },
      { name: "useUserKnowledge — file CRUD, sources, unified docs, stats, process pending (11 hooks)", status: "done" },
      { name: "useKnowledgeBase — admin categories/sources/files CRUD via edge function", status: "done" },
      { name: "useAgentPersonalizations — user-level agent knowledge config", status: "done" },
      { name: "useSemanticMemorySearch — semantic search hook for embeddings", status: "done" },
      { name: "Embedding pipeline hooks (inline in EmbeddingsExplorer)", status: "done" },
    ],
    components: [
      { name: "RelatedArticles — related article suggestions", status: "done" },
      { name: "GoogleDriveFilePicker — Drive integration", status: "done" },
    ],
    edgeFunctions: [
      { name: "auto-embed-knowledge-entry — batch + single entry embedding", status: "done" },
      { name: "auto-embed-knowledge-files — file embedding pipeline", status: "done" },
      { name: "semantic-search — pgvector similarity search", status: "done" },
      { name: "unified-knowledge-search — combined text + semantic", status: "done" },
      { name: "user-knowledge-upload — user file upload handler", status: "done" },
      { name: "user-knowledge-process — background file processor with embedding", status: "done" },
      { name: "generate-embeddings — shared chunking + embedding", status: "done" },
      { name: "knowledge-base — admin CRUD API for categories/sources/files", status: "done" },
      { name: "api-v1-documents — REST API for unified_documents", status: "done" },
      { name: "gemini-rag-query — RAG with vector search + AI answer generation", status: "done" },
      { name: "google-drive-upload — upload files to Google Drive via OAuth", status: "done" },
      { name: "user-knowledge-drive-sync — sync Drive folder to knowledge base", status: "done" },
    ],
    qaChecklist: [
      { description: "Navigate to /knowledge and see listing", tested: false },
      { description: "Create a knowledge article and verify it saves", tested: false },
      { description: "Upload a file to knowledge base", tested: false },
      { description: "Browse by category", tested: false },
      { description: "Navigate /knowledge/search and run a semantic query", tested: false },
      { description: "Upload a personal file in /knowledge/personal", tested: false },
      { description: "Navigate /admin/knowledge/embeddings and see stats", tested: false },
      { description: "Trigger batch embedding from embeddings explorer", tested: false },
    ],
    nextSteps: [
      "RAG Enhancement complete — see docs/06-ai-features/RAG-ENHANCEMENT-REPORT.md",
      "Deploy kb-* edge functions and run migration 20260617120000_kb_rag_enhancement.sql",
      "Set COHERE_API_KEY / VOYAGE_API_KEY for reranking",
    ],
  },

  // ── Phase 5: Projects ────────────────────────────────────────────────────────
  {
    id: "projects",
    name: "Projects",
    phase: 5,
    owner: "Zia",
    summary: "Full CRUD with milestones, members, risks, billing. Client portal, ActiveCollab/Jira sync. IntegrationsTab, TasksTab, KnowledgePage all wired to real data.",
    pipeline: {
      development: { status: "done", owner: "Zia", notes: "Core done, client portal live, integrations + tasks wired to real Supabase, knowledge tab wired to unified_documents" },
      qa: { status: "not-started", owner: "Zia", notes: "Test via Lovable QA module" },
      dataSeeding: { status: "done", owner: "Zia", notes: "supabase/seed/05-projects.sql — 5 statuses, 4 projects, members, milestones, comments, risks, billing, invoices" },
      signOff: { status: "not-started", owner: "Jairaj" },
    },
    docs: [
      { title: "Projects Blueprint", path: "docs/02-modules/04-projects.md", description: "11 pages, 100+ components, 48 hooks, 14 tables, 45+ edge functions" },
    ],
    database: { tables: 13, status: "done", notes: "project_statuses, projects, project_members, project_milestones, project_comments, project_files, project_risks, project_favorites, project_billing, project_invoices, project_client_access, project_client_comments, client_feedback" },
    types: { status: "done" },
    routes: { status: "done" },
    navigation: { status: "done" },
    pages: [
      { name: "ProjectsPage — listing with status cards", status: "qa-ready" },
      { name: "ProjectFormPage — create + edit", status: "qa-ready" },
      { name: "ProjectDetailPage — tabbed (overview/tasks/milestones/members/risks/integrations/meetings/client portal)", status: "qa-ready" },
      { name: "ProjectKnowledgePage — project-scoped knowledge tab with unified_documents", status: "done" },
      { name: "ProjectIssuesAIAnalyzePage — AI issue analysis", status: "planned" },
      { name: "ClientPortalDashboard — client-facing project dashboard", status: "done" },
    ],
    hooks: [
      { name: "useProjects — CRUD, statuses, filters", status: "done" },
      { name: "useProjectDetail — members, milestones, comments, risks", status: "done" },
      { name: "useClientAccess — create/revoke/restore client portal access", status: "done" },
      { name: "useIntegrationSync — ActiveCollab/Jira project sync", status: "done" },
      { name: "useProjectModuleSettings — toggle project detail tabs", status: "done" },
      { name: "useProjectReports — real Supabase aggregates from projects/milestones/risks/billing", status: "done" },
      { name: "useProjectIntegrations — real org_integrations + providers query", status: "done" },
      { name: "useProjectTasks — real tasks via project client_id lookup", status: "done" },
      { name: "useProjectDocuments — unified_documents query with owner_type=project filter", status: "done" },
    ],
    components: [
      { name: "ClientAccessManagement — client portal credential management", status: "done" },
      { name: "IntegrationsTab — connection badges, logos, sync time, empty state", status: "done" },
      { name: "TasksTab — priority badges, assigned user, status config, empty state", status: "done" },
      { name: "OverviewTab, ProjectsBackupStatus, ProjectsRestoreBackupDialog", status: "done" },
      { name: "ClientPortal components (6) — progress ring, milestones, invoices, risks, sprints, deadlines", status: "done" },
      { name: "ProjectKnowledgePage — unified_documents query with search, file type, processing status, chunk count", status: "done" },
    ],
    edgeFunctions: [
      { name: "sync-projects-activecollab — sync projects from ActiveCollab", status: "done" },
      { name: "sync-projects-jira — sync projects from Jira", status: "done" },
      { name: "create-client-access — generate client portal credentials", status: "done" },
      { name: "client-dashboard-api — client portal auth + data", status: "done" },
      { name: "client-documents — client-scoped document CRUD", status: "done" },
      { name: "Resource projection", status: "not-started" },
    ],
    qaChecklist: [
      { description: "Create a project via /projects/new with all fields", tested: false },
      { description: "Edit a project from the detail page Edit button", tested: false },
      { description: "Delete a project via confirmation dialog", tested: false },
      { description: "Add milestones and toggle completion", tested: false },
      { description: "Add comments on overview tab", tested: false },
      { description: "View risks tab", tested: false },
      { description: "Create client portal access and verify credential generation", tested: false },
      { description: "Access client portal dashboard with token and password", tested: false },
      { description: "Sync projects from ActiveCollab", tested: false },
      { description: "View IntegrationsTab — see connection badges, logos, last sync times", tested: false },
      { description: "View TasksTab — see priority badges, status badges, assigned users", tested: false },
      { description: "View ProjectKnowledgePage — see document list, search, file type badges, processing status", tested: false },
    ],
    nextSteps: [
      "Billing/invoicing UI",
    ],
  },

  // ── Phase 6: Business Development ────────────────────────────────────────────
  {
    id: "business-dev",
    name: "Business Development (Deals, Contacts, Clients)",
    phase: 6,
    owner: "Zia",
    summary: "Deals pipeline, contacts with lead follow-ups, legacy client management. Full CRUD for deals. Stage changes auto-log to deal_activities.",
    pipeline: {
      development: { status: "done", owner: "Zia" },
      qa: { status: "not-started", owner: "Zia", notes: "Test via Lovable QA module" },
      dataSeeding: { status: "done", owner: "Zia", notes: "supabase/seed/06-business-dev.sql — 6 contacts, 5 deals, activities, comments, lead follow-ups, communications, scheduled emails" },
      signOff: { status: "not-started", owner: "Jairaj" },
    },
    docs: [
      { title: "Business Dev Blueprint", path: "docs/02-modules/06-business-development.md", description: "42 pages, 134 components, 68 hooks, 15 tables, 75+ edge functions" },
    ],
    database: { tables: 7, status: "done", notes: "deals, deal_activities, deal_comments, contacts, lead_followup_contacts, contact_communications, scheduled_emails" },
    types: { status: "done" },
    routes: { status: "done" },
    navigation: { status: "done" },
    pages: [
      { name: "DealsPage — pipeline kanban view", status: "qa-ready" },
      { name: "DealFormPage — create + edit deal", status: "qa-ready" },
      { name: "DealDetailPage — tabbed (overview/activities/comments/meetings) with stage progress", status: "qa-ready" },
      { name: "ContactsPage — listing with create dialog, clickable rows", status: "qa-ready" },
      { name: "ContactDetailPage — view/edit/delete with lead follow-up management", status: "qa-ready" },
      { name: "Clients (legacy) — client CRUD", status: "done" },
    ],
    hooks: [
      { name: "useDeals — CRUD, pipeline stats, activities, comments", status: "done" },
      { name: "useUpdateDealStage — stage transition with auto deal_activities logging", status: "done" },
      { name: "useUpdateDeal — full field updates", status: "done" },
      { name: "useDeleteDeal — with cache invalidation", status: "done" },
      { name: "useContacts — CRUD + lead follow-ups", status: "done" },
      { name: "useDeleteContact — with cache invalidation", status: "done" },
      { name: "useClients (legacy) — client CRUD", status: "done" },
    ],
    components: [],
    edgeFunctions: [
      { name: "HubSpot sync", status: "not-started" },
      { name: "Deal coaching AI", status: "not-started" },
      { name: "Email automation", status: "not-started" },
      { name: "Lead scoring", status: "not-started" },
    ],
    qaChecklist: [
      { description: "Create a deal via /deals/new, verify it shows in pipeline", tested: false },
      { description: "Click deal to view detail, change stage via progress bar", tested: false },
      { description: "Edit deal from detail page Edit button", tested: false },
      { description: "Delete deal via confirmation dialog", tested: false },
      { description: "Create a contact via dialog on /contacts", tested: false },
      { description: "Click a contact row to view /contacts/:id detail page", tested: false },
      { description: "Edit contact inline from detail page, save changes", tested: false },
      { description: "Delete contact via confirmation dialog", tested: false },
      { description: "Create and update lead follow-up from detail sidebar", tested: false },
      { description: "Verify lead follow-up status badge renders on contacts", tested: false },
      { description: "Legacy: create/edit/view clients at /clients/*", tested: false },
      { description: "Change deal stage and verify deal_activities entry logged with from/to stages", tested: false },
    ],
    nextSteps: [
      "HubSpot integration (edge function)",
    ],
  },

  // ── Phase 7: Productivity ────────────────────────────────────────────────────
  {
    id: "productivity",
    name: "Productivity (Metrics, Employees, Process Docs)",
    phase: 7,
    owner: "Zia",
    summary: "Department + pod-level productivity dashboard, employee detail, process documentation library. Pod breakdown with utilization/efficiency/tasks.",
    pipeline: {
      development: { status: "done", owner: "Zia" },
      qa: { status: "not-started", owner: "Zia", notes: "Test via Lovable QA module" },
      dataSeeding: { status: "done", owner: "Zia", notes: "supabase/seed/07-productivity.sql — 3 depts, 3 pods, 6 employees, 4 weeks records, leave events, 4 process docs, alerts" },
      signOff: { status: "not-started", owner: "Jairaj" },
    },
    docs: [
      { title: "Productivity Blueprint", path: "docs/02-modules/08-productivity.md", description: "13 pages, 40 components, 19 hooks, 10 tables, 12 edge functions" },
    ],
    database: { tables: 10, status: "done", notes: "departments, pods, pod_members, employee_profiles, productivity_records, leave_events, process_categories, process_documents, productivity_alerts, ai_productivity_insights" },
    types: { status: "done" },
    routes: { status: "done" },
    navigation: { status: "done" },
    pages: [
      { name: "ProductivityPage — dashboard with dept overview, bar chart, attendance donut", status: "qa-ready" },
      { name: "EmployeeDetailPage — profile + weekly history", status: "qa-ready" },
      { name: "ProcessPage — index / category / document views with New/Edit buttons", status: "qa-ready" },
      { name: "ProcessFormPage — create + edit process document with tags", status: "qa-ready" },
    ],
    hooks: [
      { name: "useProductivity — records, summary, departments, weeks", status: "done" },
      { name: "usePodProductivity — pod-level utilization/efficiency/tasks aggregation", status: "done" },
      { name: "useEmployees — profiles, productivity history", status: "done" },
      { name: "useProcesses — categories, documents, create/read", status: "done" },
      { name: "useUpdateProcessDocument — update with cache invalidation", status: "done" },
      { name: "useDeleteProcessDocument — delete with cache invalidation", status: "done" },
    ],
    components: [
      { name: "Department utilization bar chart (recharts)", status: "done" },
      { name: "Attendance distribution donut chart (recharts)", status: "done" },
      { name: "Pod Breakdown panel — per-pod utilization, efficiency, tasks", status: "done" },
    ],
    edgeFunctions: [
      { name: "Productivity CSV import", status: "not-started" },
      { name: "HR employee sync", status: "not-started" },
      { name: "AI productivity insights", status: "not-started" },
      { name: "Weekly digest email", status: "not-started" },
    ],
    qaChecklist: [
      { description: "Navigate /productivity and see department cards", tested: false },
      { description: "Verify department utilization bar chart renders with data", tested: false },
      { description: "Verify attendance donut chart renders with data", tested: false },
      { description: "Verify Pod Breakdown shows pods with utilization bars and task counts", tested: false },
      { description: "Click an employee to see /productivity/employee/:email", tested: false },
      { description: "Navigate /process and see category cards", tested: false },
      { description: "Click a category to see documents list", tested: false },
      { description: "Click a document to see full content", tested: false },
      { description: "Create a new process doc via /process/new or category New button", tested: false },
      { description: "Edit a document from the detail view Edit button", tested: false },
      { description: "Delete a document via confirmation dialog", tested: false },
      { description: "Add and remove tags on a process document", tested: false },
    ],
    nextSteps: [
      "CSV import page for productivity data",
    ],
  },

  // ── Phase 8: Admin ───────────────────────────────────────────────────────────
  {
    id: "admin",
    name: "Admin Panel Extensions",
    phase: 8,
    owner: "Shahed",
    summary: "37 admin pages. Team management, knowledge admin, embeddings explorer, seed runner, Zoom integration, project settings, reports. EOS admin: VTO, Scorecard workspace, Accountability with timeline + employee modal + GWC dialog. Meeting analytics with efficiency scoring.",
    pipeline: {
      development: { status: "done", owner: "Shahed", notes: "All admin pages built. Data sync dashboard deferred to post-MVP." },
      qa: { status: "not-started", owner: "Shahed", notes: "Test via Lovable QA module" },
      dataSeeding: { status: "done", owner: "Shahed", notes: "Covered by supabase/seed/00-platform-core.sql (system_settings, app_config, activity_logs)" },
      signOff: { status: "not-started", owner: "Jairaj" },
    },
    docs: [
      { title: "Admin Blueprint", path: "docs/02-modules/09-admin.md", description: "95+ pages, 60+ components, 40+ hooks, 11 tables" },
      { title: "Admin Guide", path: "docs/07-admin/admin-guide.md", description: "Admin guide for system administration" },
      { title: "Feature Flags", path: "docs/07-admin/feature-flags.md", description: "Feature flags configuration and module toggles" },
    ],
    database: { tables: 0, status: "done", notes: "Uses tables from other modules" },
    types: { status: "done" },
    routes: { status: "done" },
    navigation: { status: "done" },
    pages: [
      { name: "DepartmentManagement — full CRUD with user assignment", status: "qa-ready" },
      { name: "PODManagement — admin POD CRUD at /admin/pods", status: "qa-ready" },
      { name: "KnowledgeDashboard — unified KB admin command center", status: "qa-ready" },
      { name: "KnowledgeCategories (existing, newly routed)", status: "qa-ready" },
      { name: "EmbeddingsExplorer — embedding coverage, queue, search logs", status: "done" },
      { name: "ImplementationStatus — full module tracker", status: "done" },
      { name: "ZoomIntegration — Zoom OAuth setup + user connection", status: "done" },
      { name: "ZoomMeetings — synced Zoom meetings list", status: "done" },
      { name: "ProjectStatusSettings — full CRUD with color picker, reorder, active/default toggle", status: "done" },
      { name: "ProjectModules — toggle project detail tabs, persisted to system_settings", status: "done" },
      { name: "WorkTypesSettings — full CRUD with category, billable flag, default rate, reorder", status: "done" },
      { name: "ProjectReports — summary cards + project table with real aggregates", status: "done" },
      { name: "ResourceUtilizationReports — utilization dashboard with dept chart, employee table, billable ratio", status: "done" },
      { name: "AdminEOS — EOS admin hub with section cards", status: "done" },
      { name: "VTOAdmin — VTO section mgmt (edit title, reset template, preview)", status: "done" },
      { name: "ScorecardWorkspace — scorecard + metrics full CRUD", status: "done" },
      { name: "AdminEOSAccountability — chart versions + role CRUD + timeline + employee modal + GWC dialog", status: "done" },
      { name: "All other admin pages (21 total)", status: "done" },
    ],
    hooks: [
      { name: "useProjectStatuses — CRUD + reorder for project_statuses table", status: "done" },
      { name: "useWorkTypes — CRUD + reorder for work_types table", status: "done" },
      { name: "useProjectModuleSettings — system_settings persistence + useToggleProjectModule mutation", status: "done" },
      { name: "useMeetingEfficiency — efficiency scoring wired to MeetingAnalytics", status: "done" },
    ],
    components: [],
    edgeFunctions: [],
    qaChecklist: [
      { description: "Navigate /admin/department — create, edit, delete departments and assign users", tested: false },
      { description: "Navigate /admin/pods — verify POD management loads", tested: false },
      { description: "Navigate /admin/knowledge/dashboard and see all 4 sections", tested: false },
      { description: "Navigate /admin/knowledge/categories", tested: false },
      { description: "Navigate /admin/knowledge/embeddings and see embedding stats", tested: false },
      { description: "Verify admin sidebar shows Team & Knowledge sections", tested: false },
      { description: "Navigate /admin/integrations/zoom and configure Zoom", tested: false },
      { description: "Navigate /admin/settings/project-modules and toggle tabs", tested: false },
      { description: "Navigate /admin/reports/projects — verify summary cards + real project data table", tested: false },
      { description: "Navigate /admin/settings/project-statuses — create, edit, delete, reorder statuses", tested: false },
      { description: "Navigate /admin/settings/work-types — create billable/non-billable types with rates", tested: false },
      { description: "Navigate /admin/reports/resource-utilization — verify summary cards, dept chart, employee table", tested: false },
      { description: "Filter resource utilization by department and week", tested: false },
      { description: "Toggle project modules on/off and verify persistence (page reload keeps state)", tested: false },
      { description: "Navigate /admin/eos and see EOS admin hub with section cards", tested: false },
      { description: "Navigate /admin/eos/vto — edit section titles, reset to template, preview content", tested: false },
      { description: "Navigate /admin/eos/scorecards — create/edit/delete scorecards and metrics", tested: false },
      { description: "Navigate /admin/eos/accountability — publish charts, add/edit/delete roles", tested: false },
      { description: "View MeetingAnalytics efficiency section with score, rates, monthly trend", tested: false },
    ],
    nextSteps: [
      "Data sync dashboard (HR, HubSpot, ActiveCollab)",
      "Notification management admin page",
    ],
  },
  // ── Phase 9: AI Agents Framework ───────────────────────────────────────────
  {
    id: "ai-agents",
    name: "AI Agents Framework",
    phase: 9,
    owner: "Shahed",
    summary: "AI agent management, chat interface, model config, usage analytics, MCP servers. Agent personalizations + conversation chat added.",
    pipeline: {
      development: { status: "done", owner: "Shahed", notes: "Admin + user-facing routes wired, nav items added" },
      qa: { status: "not-started", owner: "Shahed", notes: "Test via Lovable QA module" },
      dataSeeding: { status: "done", owner: "Shahed", notes: "supabase/seed/08-ai-agents.sql — 3 providers, 6 models, 5 agents, chat history, usage logs" },
      signOff: { status: "not-started", owner: "Jairaj" },
    },
    docs: [
      { title: "AI Features Overview", path: "docs/06-ai-features/README.md", description: "AI capabilities, models, RAG pipeline, agent architecture" },
      { title: "AI Agents Implementation", path: "docs/original/new/AI_AGENTS_IMPLEMENTATION_GUIDE.md", description: "Detailed agent implementation patterns and tools" },
      { title: "RAG Framework Guide", path: "docs/original/new/AI_AGENTS_RAG_FRAMEWORK_GUIDE.md", description: "Retrieval-augmented generation framework design" },
    ],
    database: { tables: 5, status: "done", notes: "ai_agents, ai_agent_runs, ai_models, ai_providers, ai_usage_logs" },
    types: { status: "done" },
    routes: { status: "done", notes: "Admin + user-facing routes wired with feature flag gating" },
    navigation: { status: "done", notes: "Admin AI & Automation section + user sidebar (AI Agents, AI Chat, Personal Knowledge)" },
    pages: [
      { name: "AIModelManagement — admin provider/model config", status: "done" },
      { name: "AIUsageAnalytics — admin usage dashboard + cost tracking", status: "done" },
      { name: "MCPServers — MCP server management", status: "done" },
      { name: "AIAgents — agent CRUD + execution", status: "qa-ready" },
      { name: "AIChat — conversational AI interface", status: "qa-ready" },
      { name: "PersonalKnowledge — user knowledge management", status: "qa-ready" },
    ],
    hooks: [
      { name: "useAIAgents — CRUD, toggle, run agent, execution history", status: "done" },
      { name: "useAIChatAssistant — chat with ai_chat_history persistence, session load, clear/remove", status: "done" },
      { name: "useModelSync — sync models from providers", status: "done" },
      { name: "useAgentPersonalizations — per-agent knowledge config + prompt overrides", status: "done" },
    ],
    components: [
      { name: "AIChatInterface — reusable chat UI", status: "done" },
      { name: "SemanticSearch — vector search component", status: "done" },
      { name: "AgentPersonalizationModal — agent customization", status: "done" },
    ],
    edgeFunctions: [
      { name: "run-ai-agent — agent execution runtime", status: "done" },
      { name: "agent-conversation-chat — conversational AI with context", status: "done" },
      { name: "auto-embed — embedding pipeline (shared with Knowledge)", status: "done" },
      { name: "semantic-search — vector similarity search (shared with Knowledge)", status: "done" },
      { name: "gemini-rag-query — RAG with vector search + AI answer generation", status: "done" },
    ],
    qaChecklist: [
      { description: "Navigate /admin/ai-models and see provider list", tested: false },
      { description: "Enable/disable an AI model", tested: false },
      { description: "Navigate /admin/ai-usage and see analytics dashboard", tested: false },
      { description: "Navigate /admin/mcp-servers and manage servers", tested: false },
      { description: "Create an AI agent with system prompt", tested: false },
      { description: "Run an agent and verify execution history", tested: false },
      { description: "Open AI chat and send a message", tested: false },
    ],
    nextSteps: [
      "Deploy edge functions to Supabase production (need API keys in secrets)",
      "Agent memory/conversation persistence tables",
      "Gemini RAG integration",
    ],
  },
];

// ─── Utility helpers for the status page ─────────────────────────────────────

export function getStatusColor(status: ItemStatus): string {
  switch (status) {
    case "done": return "#22c55e";
    case "qa-ready": return "#3b82f6";
    case "in-progress": return "#f59e0b";
    case "planned": return "#8b5cf6";
    case "blocked": return "#ef4444";
    case "not-started": return "#6b7280";
  }
}

export function getStatusLabel(status: ItemStatus): string {
  switch (status) {
    case "done": return "Done";
    case "qa-ready": return "QA Ready";
    case "in-progress": return "In Progress";
    case "planned": return "Planned";
    case "blocked": return "Blocked";
    case "not-started": return "Not Started";
  }
}

export function getModuleProgress(module: ModuleStatus): number {
  const items = [...module.pages, ...module.hooks, ...module.components, ...module.edgeFunctions];
  if (items.length === 0) return 100;
  const doneCount = items.filter((i) => i.status === "done" || i.status === "qa-ready").length;
  return Math.round((doneCount / items.length) * 100);
}

export function getQAProgress(module: ModuleStatus): { tested: number; total: number } {
  return {
    tested: module.qaChecklist.filter((q) => q.tested).length,
    total: module.qaChecklist.length,
  };
}

export function getPipelineColor(status: PipelineStatus): string {
  switch (status) {
    case "done": return "#22c55e";
    case "in-progress": return "#f59e0b";
    case "blocked": return "#ef4444";
    case "not-started": return "#6b7280";
  }
}

export function getPipelineLabel(status: PipelineStatus): string {
  switch (status) {
    case "done": return "Done";
    case "in-progress": return "In Progress";
    case "blocked": return "Blocked";
    case "not-started": return "Not Started";
  }
}

export function getPipelineProgress(module: ModuleStatus): number {
  const phases = [module.pipeline.development, module.pipeline.qa, module.pipeline.dataSeeding, module.pipeline.signOff];
  const doneCount = phases.filter((p) => p.status === "done").length;
  return Math.round((doneCount / 4) * 100);
}

export function getTeamModules(memberId: string): ModuleStatus[] {
  const member = TEAM.find((t) => t.id === memberId);
  if (!member) return [];
  return implementationStatus.filter((m) => member.modules.includes(m.id));
}
