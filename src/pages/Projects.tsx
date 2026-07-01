/**
 * Projects List Page – full structure per replication guide
 * KPI card, ProjectsToolbar, Backup row, Status tabs, List/Grid, Pagination
 * State persisted in localStorage key projects_filters_v1
 */

import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FolderKanban, Loader2, Star, Pencil, TrendingUp, CheckCircle2, Activity } from "lucide-react";
import { useProjects, useProjectStatuses, useManagers } from "@/modules/projects/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { useSyncProjects, useSyncTasks } from "@/hooks/useIntegrationSync";
import { generateProjectsCSV } from "@/lib/export-utils";
import {
  ProjectsToolbar,
  type ProjectsToolbarFilters,
} from "@/components/projects/ProjectsToolbar";
import { ProjectsPagination } from "@/components/projects/ProjectsPagination";
import { ProjectsBackupStatus } from "@/components/projects/ProjectsBackupStatus";
import { ProjectsRestoreBackupDialog } from "@/components/projects/ProjectsRestoreBackupDialog";
import { ProjectBudgetUtilizationCell } from "@/components/projects/ProjectBudgetUtilizationCell";
import { ProjectNameCell } from "@/components/projects/ProjectNameCell";
import type { Project } from "@/modules/projects/types";
import { isSameMonth, isSameYear, differenceInDays } from "date-fns";
import { AgentTeamBanner } from "@/components/ai/AgentTeamBanner";
import { AIAgentPresenceIndicator } from "@/components/ai/AIAgentPresenceIndicator";

const STORAGE_KEY = "projects_filters_v1";
/** Red badge count on Project Queue tab (match reference UI; replace with API when available) */
const PROJECT_QUEUE_ALERT_BADGE = 6;
/** Exactly these 5 tabs; API statuses are mapped to them (e.g. "In Progress" -> Active). */
const FIXED_STATUS_TABS = [
  { id: "project-queue", label: "Project Queue", slugMatches: ["queue", "project-queue", "project_queue"] },
  { id: "planning", label: "Planning", slugMatches: ["planning"] },
  { id: "active", label: "Active", slugMatches: ["active", "in-progress", "in_progress"] },
  { id: "on-hold", label: "On Hold", slugMatches: ["on-hold", "on_hold"] },
  { id: "completed", label: "Completed", slugMatches: ["completed"] },
] as const;

function getTabIdForStatus(status: { slug?: string; name?: string } | null | undefined): string | null {
  if (!status) return null;
  const norm = (s: string) => s.toLowerCase().replace(/_/g, "-");
  const slug = norm((status.slug ?? "") || (status.name ?? ""));
  const name = norm((status.name ?? "") || (status.slug ?? ""));
  for (const tab of FIXED_STATUS_TABS) {
    if (tab.slugMatches.some((key) => slug.includes(key) || name.includes(key))) return tab.id;
  }
  return null;
}

const DEFAULT_FILTERS: ProjectsToolbarFilters = {
  searchQuery: "",
  selectedManager: "",
  selectedClient: "",
  selectedTeam: "",
  selectedCategory: "",
  dateFrom: "",
  dateTo: "",
  showArchived: false,
  showOverBudgetOnly: false,
  sortBy: "updated_at",
  sortAsc: false,
};

function loadStored(): Partial<ProjectsToolbarFilters> & { viewMode?: "list" | "grid"; activeTab?: string; currentPage?: number; pageSize?: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      ...(parsed.viewMode && { viewMode: parsed.viewMode as "list" | "grid" }),
      ...(parsed.activeTab && { activeTab: String(parsed.activeTab) }),
      ...(parsed.currentPage != null && { currentPage: Number(parsed.currentPage) }),
      ...(parsed.pageSize != null && { pageSize: Number(parsed.pageSize) }),
      searchQuery: typeof parsed.searchQuery === "string" ? parsed.searchQuery : "",
      selectedManager: typeof parsed.selectedManager === "string" ? parsed.selectedManager : "",
      selectedClient: typeof parsed.selectedClient === "string" ? parsed.selectedClient : "",
      selectedTeam: typeof parsed.selectedTeam === "string" ? parsed.selectedTeam : "",
      selectedCategory: typeof parsed.selectedCategory === "string" ? parsed.selectedCategory : "",
      dateFrom: typeof parsed.dateFrom === "string" ? parsed.dateFrom : "",
      dateTo: typeof parsed.dateTo === "string" ? parsed.dateTo : "",
      showArchived: Boolean(parsed.showArchived),
      showOverBudgetOnly: Boolean(parsed.showOverBudgetOnly),
      sortBy: ["name", "start_date", "end_date", "updated_at", "over_budget_gap"].includes(String(parsed.sortBy))
        ? (parsed.sortBy as ProjectsToolbarFilters["sortBy"])
        : "updated_at",
      sortAsc: Boolean(parsed.sortAsc),
    };
  } catch {
    return {};
  }
}

function saveStored(state: Record<string, unknown>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export default function Projects() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const syncJiraProjects = useSyncProjects("jira");
  const syncJiraTasks = useSyncTasks("jira");

  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [filters, setFilters] = useState<ProjectsToolbarFilters>(() => ({
    ...DEFAULT_FILTERS,
    ...loadStored(),
  }));

  useEffect(() => {
    const stored = loadStored();
    if (stored.viewMode) setViewMode(stored.viewMode);
    if (stored.activeTab) setActiveTab(stored.activeTab);
    if (stored.currentPage != null) setCurrentPage(stored.currentPage);
    if (stored.pageSize != null) setPageSize(stored.pageSize);
  }, []);

  useEffect(() => {
    saveStored({
      viewMode,
      activeTab,
      currentPage,
      pageSize,
      ...filters,
    });
  }, [viewMode, activeTab, currentPage, pageSize, filters]);

  const filterParams = useMemo(
    () => ({
      search: filters.searchQuery || undefined,
      owner_id: filters.selectedManager || undefined,
      client_id: filters.selectedClient || undefined,
      date_from: filters.dateFrom || undefined,
      date_to: filters.dateTo || undefined,
      is_archived: filters.showArchived,
      show_over_budget_only: filters.showOverBudgetOnly,
      sort_by: filters.sortBy,
      sort_asc: filters.sortAsc,
    }),
    [filters]
  );

  const { data: statuses = [] } = useProjectStatuses();
  const { data: allProjects = [], isLoading } = useProjects(filterParams);
  const statusById = useMemo(() => Object.fromEntries(statuses.map((s) => [s.id, s])), [statuses]);

  const projects = useMemo(() => {
    if (activeTab === "all") return allProjects;
    const tabIds = FIXED_STATUS_TABS.map((t) => t.id);
    if (tabIds.includes(activeTab as (typeof tabIds)[number])) {
      return allProjects.filter((p) => getTabIdForStatus(statusById[p.status_id ?? ""]) === activeTab);
    }
    return allProjects.filter((p) => p.status_id === activeTab);
  }, [allProjects, activeTab, statusById]);
  const { data: clients = [] } = useClients();
  const { data: managers = [] } = useManagers();

  const ownerIds = useMemo(() => [...new Set(projects.map((p) => p.owner_id).filter(Boolean))] as string[], [projects]);
  const { data: ownerProfiles = [] } = useQuery({
    queryKey: ["profiles", ownerIds],
    queryFn: async () => {
      if (ownerIds.length === 0) return [];
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").in("id", ownerIds);
      if (error) throw error;
      return (data || []) as { id: string; full_name: string | null; email: string | null }[];
    },
    enabled: ownerIds.length > 0,
  });

  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);
  const ownerById = useMemo(() => Object.fromEntries(ownerProfiles.map((p) => [p.id, p])), [ownerProfiles]);

  const syncFromJira = useMutation({
    mutationFn: async () => {
      await syncJiraProjects.mutateAsync();
      await syncJiraTasks.mutateAsync(undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: Error) => {
      toast({ title: "Jira sync failed", description: e.message, variant: "destructive" });
    },
  });

  const backupAll = useMutation({
    mutationFn: async () => {
      if (!projects.length) return;
      const rows = projects.map((p) => ({
        project_id: p.id,
        backup_type: "manual",
        status: "completed",
        snapshot: p as unknown as Json,
        notes: "Manual backup from Projects list",
      }));
      const { error } = await supabase.from("project_backups").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-backups-summary"] });
      toast({ title: "Backups created", description: "Manual backups recorded for projects on this page." });
    },
    onError: (e: Error) => toast({ title: "Backup failed", description: e.message, variant: "destructive" }),
  });

  const handleExport = () => {
    const withNames = projects.map((p) => ({
      ...p,
      status_name: p.status_id ? statusById[p.status_id]?.name : undefined,
      client_name: p.client_id ? clientById[p.client_id]?.name : undefined,
      owner_name: p.owner_id ? ownerById[p.owner_id]?.full_name : undefined,
    }));
    generateProjectsCSV(withNames);
  };

  const now = new Date();
  const activeCount = allProjects.filter((p) => p.status_id && statusById[p.status_id]).length;
  const completedThisMonth = allProjects.filter(
    (p) => p.end_date && isSameMonth(new Date(p.end_date), now) && isSameYear(new Date(p.end_date), now)
  ).length;
  const completedThisYear = allProjects.filter(
    (p) => p.end_date && isSameYear(new Date(p.end_date), now)
  ).length;
  const totalForCompletion = allProjects.filter((p) => p.end_date).length;
  const completionRateMonth = totalForCompletion > 0 ? Math.round((completedThisMonth / totalForCompletion) * 100) : 0;
  const completionRateYear = totalForCompletion > 0 ? Math.round((completedThisYear / totalForCompletion) * 100) : 0;
  const activeThisMonth = allProjects.filter(
    (p) => p.updated_at && differenceInDays(now, new Date(p.updated_at)) <= 30
  ).length;
  const activeThisWeek = allProjects.filter(
    (p) => p.updated_at && differenceInDays(now, new Date(p.updated_at)) <= 7
  ).length;

  const displayStatuses = useMemo(() => {
    return FIXED_STATUS_TABS.map((tab) => ({
      id: tab.id,
      name: tab.label,
      slug: tab.id,
      count: allProjects.filter((p) => getTabIdForStatus(statusById[p.status_id ?? ""]) === tab.id).length,
    }));
  }, [allProjects, statusById]);

  const totalCount = projects.length;
  const paginatedProjects = useMemo(
    () => projects.slice(currentPage * pageSize, currentPage * pageSize + pageSize),
    [projects, currentPage, pageSize]
  );

  return (
    <div className="space-y-4">
      <AgentTeamBanner team="projects" />
      <div className="flex flex-wrap gap-2">
        <AIAgentPresenceIndicator agentName="Project Analyst" agentSlug="project-analyst" gradientFrom="150 70% 40%" gradientTo="170 75% 50%" />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground">Manage your projects</p>
        </div>
      </div>

      {/* First part: 4 KPI cards – Total, Active, Completion Rate, Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <FolderKanban className="h-4 w-4" />
              Total Projects
            </div>
            <p className="text-2xl font-bold mt-1 text-primary">{allProjects.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Active Projects
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-500">{activeCount}</p>
            <Badge variant="secondary" className="mt-1.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs font-normal">
              In Progress
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingUp className="h-4 w-4" />
              Completion Rate
            </div>
            <div className="mt-1 space-y-0.5">
              <p className="text-sm">This Month <span className="font-semibold text-primary">{completionRateMonth}%</span></p>
              <p className="text-sm">This Year <span className="font-semibold text-primary">{completionRateYear}%</span></p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Activity className="h-4 w-4" />
              Recent Activity
            </div>
            <div className="mt-1 space-y-0.5">
              <p className="text-sm">Active This Month <span className="font-semibold text-primary">{activeThisMonth}</span></p>
              <p className="text-sm">Active This Week <span className="font-semibold text-primary">{activeThisWeek}</span></p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control panel: Row 1 filters, Row 2 view+actions, Row 3 backup */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <ProjectsToolbar
          filters={filters}
          onFiltersChange={(f) => setFilters((prev) => ({ ...prev, ...f }))}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onExport={handleExport}
          onSync={() => queryClient.invalidateQueries({ queryKey: ["projects"] })}
          onSyncFromJira={() => syncFromJira.mutate()}
          syncFromJiraPending={syncFromJira.isPending}
          totalCount={allProjects.length}
          activeTab={activeTab}
          onAllClick={() => setActiveTab("all")}
          managers={managers}
          clients={clients}
          teams={[]}
          categories={[]}
        />
        <ProjectsBackupStatus
          onBackup={() => backupAll.mutate()}
          backupPending={backupAll.isPending}
          restoreSlot={<ProjectsRestoreBackupDialog />}
        />
      </div>

      {/* Status tabs only: Project Queue, Planning, Active, On Hold, Completed (no All tab) */}
      <div className="flex gap-0 border-b overflow-x-auto bg-muted/30">
        {displayStatuses.map((s) => {
          const isProjectQueue = s.slug?.toLowerCase().includes("queue") ?? s.name?.toLowerCase().includes("queue");
          const queueAlertCount = isProjectQueue ? PROJECT_QUEUE_ALERT_BADGE : 0;
          return (
            <button
              key={s.id}
              type="button"
              className={`
                relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap
                border-b-2 -mb-px transition-colors
                ${activeTab === s.id
                  ? "bg-background text-foreground border-primary border-b-background rounded-t-md shadow-sm"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }
              `}
              onClick={() => setActiveTab(s.id)}
            >
              {s.name} ({s.count})
              {queueAlertCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {queueAlertCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : paginatedProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FolderKanban className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg font-medium">No {activeTab === "all" ? "" : (FIXED_STATUS_TABS.find((t) => t.id === activeTab)?.label ?? statusById[activeTab]?.name ?? activeTab)} projects found</p>
        </div>
      ) : viewMode === "list" ? (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Project Name</TableHead>
                  <TableHead className="w-[140px]">Client</TableHead>
                  <TableHead className="w-[100px]">Team</TableHead>
                  <TableHead className="w-[100px]">Start Date</TableHead>
                  <TableHead className="w-[100px]">End Date</TableHead>
                  <TableHead className="w-[120px]">Budget Utilization</TableHead>
                  <TableHead className="w-[140px]">Project Manager</TableHead>
                  <TableHead className="w-[80px]">Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProjects.map((project) => {
                  const isNewProject = project.created_at && differenceInDays(now, new Date(project.created_at)) <= 7;
                  return (
                  <TableRow
                    key={project.id}
                    className={`cursor-pointer ${isNewProject ? "border-l-4 border-l-primary" : ""}`}
                    onClick={() => navigate(`/projects/${project.slug}`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Star className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <ProjectNameCell
                        projectId={project.id}
                        name={project.name}
                        description={project.description}
                        budget={project.budget}
                        currency={project.currency}
                        statusId={project.status_id}
                        statusName={project.status_id ? statusById[project.status_id]?.name : null}
                        statusColor={project.status_id ? statusById[project.status_id]?.color : undefined}
                        isNew={isNewProject}
                      />
                    </TableCell>
                    <TableCell className="text-sm">
                      {project.client_id && clientById[project.client_id]
                        ? clientById[project.client_id].name
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm">—</TableCell>
                    <TableCell className="text-sm">
                      {project.start_date
                        ? new Date(project.start_date).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {project.end_date ? new Date(project.end_date).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <ProjectBudgetUtilizationCell
                        projectId={project.id}
                        budget={project.budget}
                        currency={project.currency}
                      />
                    </TableCell>
                    <TableCell className="text-sm">
                      {project.owner_id && ownerById[project.owner_id]?.full_name
                        ? ownerById[project.owner_id].full_name
                        : "—"}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/projects/${project.slug}/edit`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
          <ProjectsPagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setCurrentPage}
            onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(0); }}
          />
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedProjects.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => navigate(`/projects/${project.slug}`)}
              >
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    {project.status_id && statusById[project.status_id] && (
                      <Badge
                        variant="outline"
                        style={{
                          backgroundColor: `${statusById[project.status_id].color}20`,
                          color: statusById[project.status_id].color,
                          borderColor: statusById[project.status_id].color,
                        }}
                      >
                        {statusById[project.status_id].name}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.slug}/edit`); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="font-medium line-clamp-2">{project.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {project.client_id && clientById[project.client_id]
                      ? clientById[project.client_id].name
                      : "No client"}
                  </p>
                  <ProjectBudgetUtilizationCell projectId={project.id} budget={project.budget} currency={project.currency} />
                  <p className="text-xs text-muted-foreground">
                    PM: {project.owner_id && ownerById[project.owner_id]?.full_name ? ownerById[project.owner_id].full_name : "—"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <ProjectsPagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setCurrentPage}
            onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(0); }}
          />
        </>
      )}
    </div>
  );
}
