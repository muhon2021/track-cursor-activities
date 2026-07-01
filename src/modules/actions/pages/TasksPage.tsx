/**
 * Tasks Page
 *
 * Main "My Tasks" page matching reference: subtitle, search, tabs with icons,
 * empty states per tab, This Week calendar view with week navigation.
 */
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, startOfWeek, endOfWeek, addWeeks, addDays, isToday, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Loader2, Plus, LayoutGrid, Search, Settings, CheckSquare, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useTasksV2, useTaskStats, useUpdateTask, useDeleteTask } from "../hooks/useTasksV2";
import { useTaskViewPreference, type TaskDefaultView } from "../hooks/useTaskViewPreference";
import { useTaskStreams } from "../hooks/useTaskStreams";
import { useTaskCategories } from "../hooks/useTaskCategories";
import { TasksTable } from "../components/TasksTable";
import { TaskViewTabs } from "../components/TaskViewTabs";
import { TaskFiltersBar } from "../components/TaskFiltersBar";
import { CreateTaskDialog } from "../components/CreateTaskDialog";
import type { TaskView, TaskFilters, TaskStatus } from "../types/tasks";
import type { Task } from "../types/tasks";
import { cn } from "@/lib/utils";
import { useSyncTasks } from "@/hooks/useIntegrationSync";
import { usePMIntegrationDisplay } from "@/hooks/usePMIntegrationDisplay";
import { usePMSync } from "@/hooks/usePMSync";
import { isPMSyncProvider } from "@/lib/integration-preferences";
import type { IntegrationTaskTab } from "../components/TaskViewTabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plug } from "lucide-react";

const INTEGRATION_TAB_CONFIG: Record<
  string,
  { label: string; statsKey: IntegrationTaskTab["statsKey"] }
> = {
  jira: { label: "Jira", statsKey: "jiraCount" },
  clickup: { label: "ClickUp", statsKey: "clickupCount" },
  activecollab: { label: "ActiveCollab", statsKey: "activecollabCount" },
  workamajig: { label: "Workamajig", statsKey: "workamajigCount" },
};

const TAB_VIEW_MAP: Record<TaskDefaultView, TaskView | "streams"> = {
  today: "today",
  this_week: "this_week",
  overdue: "overdue",
  delegated: "delegated",
  all: "allMine",
  streams: "streams",
};

const EMPTY_MESSAGES: Record<TaskView | "streams", { title: string; description: string }> = {
  today: {
    title: "No tasks due today",
    description: "You don't have any tasks due today. Great job staying on top of things!",
  },
  this_week: {
    title: "No tasks this week",
    description: "You don't have any tasks due this week.",
  },
  overdue: {
    title: "No overdue tasks",
    description: "You're all caught up. No overdue tasks.",
  },
  delegated: {
    title: "No delegated tasks",
    description: "You haven't delegated any tasks to others.",
  },
  all: {
    title: "No tasks",
    description: "No tasks found.",
  },
  my_tasks: {
    title: "No tasks assigned",
    description: "You don't have any tasks assigned to you.",
  },
  allMine: {
    title: "No tasks yet",
    description: "Create a task to get started.",
  },
  streams: {
    title: "No streams",
    description: "Create a stream to organize your tasks.",
  },
  jira: {
    title: "No Jira tasks yet",
    description:
      "Sync issues from Jira after configuring the integration (Admin → Integrations → Jira) and setting JIRA_HOST, JIRA_EMAIL, and JIRA_API_TOKEN in Edge secrets.",
  },
  clickup: {
    title: "No ClickUp tasks yet",
    description:
      "Connect ClickUp in Admin → Integrations, sync your workspace, and ensure Tasks is enabled under display pages.",
  },
  activecollab: {
    title: "No ActiveCollab tasks yet",
    description:
      "Connect ActiveCollab in Admin → Integrations or Settings, then sync projects and tasks.",
  },
  workamajig: {
    title: "No Workamajig tasks yet",
    description: "Sync from Admin → Integrations after configuring Workamajig credentials.",
  },
};

export default function TasksPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { showOnTasks, primarySlug } = usePMIntegrationDisplay();
  const pmSync = usePMSync(primarySlug ?? "");
  const { defaultView, setDefaultView } = useTaskViewPreference();
  const initialViewParam = searchParams.get("view");
  const [view, setView] = useState<TaskView | "streams">(() => {
    if (
      initialViewParam &&
      (initialViewParam === "streams" ||
        Object.keys(EMPTY_MESSAGES).includes(initialViewParam))
    ) {
      return initialViewParam as TaskView | "streams";
    }
    return TAB_VIEW_MAP[defaultView] ?? "allMine";
  });
  const [filters, setFilters] = useState<TaskFilters>({});
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    setView(TAB_VIEW_MAP[defaultView] ?? "allMine");
  }, [defaultView]);

  useEffect(() => {
    const viewParam = searchParams.get("view");
    if (
      viewParam &&
      viewParam !== "streams" &&
      Object.keys(EMPTY_MESSAGES).includes(viewParam)
    ) {
      setView(viewParam as TaskView);
    }
  }, [searchParams]);

  const integrationTabs = useMemo((): IntegrationTaskTab[] => {
    if (!showOnTasks) return [];
    const slugs = primarySlug ? [primarySlug] : Object.keys(INTEGRATION_TAB_CONFIG);
    return slugs
      .filter((slug) => INTEGRATION_TAB_CONFIG[slug])
      .map((slug) => ({
        value: slug as TaskView,
        label: INTEGRATION_TAB_CONFIG[slug].label,
        statsKey: INTEGRATION_TAB_CONFIG[slug].statsKey,
      }));
  }, [showOnTasks, primarySlug]);

  const showWeekView = view === "this_week";
  const now = new Date();
  const weekStart = startOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 0 });
  const weekEnd = endOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 0 });

  const mergedFilters = {
    ...filters,
    view: view === "streams" ? undefined : view,
    search,
    ...(showWeekView
      ? {
          dueDateFrom: weekStart.toISOString(),
          dueDateTo: weekEnd.toISOString(),
        }
      : {}),
  };
  const { data: tasks, isLoading } = useTasksV2(
    view === "streams" ? undefined : mergedFilters
  );
  const { data: stats } = useTaskStats();
  const { data: streams } = useTaskStreams();
  const { data: categories } = useTaskCategories();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const syncJiraTasks = useSyncTasks("jira");

  const handleViewChange = (v: TaskView | "streams") => {
    setView(v);
    if (v !== "streams") {
      const pref = (Object.keys(TAB_VIEW_MAP) as TaskDefaultView[]).find(
        (k) => TAB_VIEW_MAP[k] === v
      );
      if (pref) setDefaultView(pref);
      if (
        v === "jira" ||
        v === "clickup" ||
        v === "activecollab" ||
        v === "workamajig"
      ) {
        setSearchParams({ view: v }, { replace: true });
      } else {
        searchParams.delete("view");
        setSearchParams(searchParams, { replace: true });
      }
    }
  };

  const defaultViewLabel = (v: TaskDefaultView) =>
    v === "streams" ? "Streams" : v === "all" ? "All Tasks" : v === "this_week" ? "This Week" : v.charAt(0).toUpperCase() + v.slice(1).replace("_", " ");

  const handleSetDefaultView = (v: TaskDefaultView) => {
    setDefaultView(v);
    toast.success("Default view saved", {
      description: `"${defaultViewLabel(v)}" is now your default view.`,
    });
  };

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    updateTask.mutate({ id: taskId, data: { status } });
  };

  const handleDelete = (taskId: string) => {
    deleteTask.mutate(taskId);
  };

  const showStreamsGrid = view === "streams";
  const taskList = tasks || [];
  const isEmpty = !isLoading && taskList.length === 0 && !showStreamsGrid;

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const tasksByDay = (): Record<string, Task[]> => {
    const byDay: Record<string, Task[]> = {};
    weekDays.forEach((d) => {
      const key = format(d, "yyyy-MM-dd");
      byDay[key] = taskList.filter(
        (t) =>
          t.due_date &&
          isSameDay(new Date(t.due_date), d) &&
          new Date(t.due_date).getTime() >= weekStart.getTime() &&
          new Date(t.due_date).getTime() <= weekEnd.getTime()
      );
    });
    return byDay;
  };
  const byDay = showWeekView ? tasksByDay() : {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">My Tasks</h1>
          <p className="text-muted-foreground">
            Stay on top of tasks assigned to you and explore streams by team focus.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" title="Default view">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Default View</DropdownMenuLabel>
              {(["today", "this_week", "overdue", "delegated", "all", "streams"] as TaskDefaultView[]).map(
                (v) => {
                  const isSelected = defaultView === v;
                  return (
                    <DropdownMenuItem
                      key={v}
                      onClick={() => handleSetDefaultView(v)}
                      className={cn(
                        "flex items-center gap-3 cursor-pointer",
                        isSelected && "bg-primary/10 text-primary focus:bg-primary/10 focus:text-primary"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                          isSelected
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/40 bg-transparent"
                        )}
                      >
                        {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                      </span>
                      <span>
                        {v === "streams"
                          ? "Streams"
                          : v === "all"
                            ? "All Tasks"
                            : v === "this_week"
                              ? "This Week"
                              : v.charAt(0).toUpperCase() + v.slice(1).replace("_", " ")}
                      </span>
                    </DropdownMenuItem>
                  );
                }
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={() => navigate("/streams")}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            Browse Streams
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (showOnTasks && primarySlug && isPMSyncProvider(primarySlug)) {
                pmSync.mutate(primarySlug);
              } else {
                syncJiraTasks.mutate(undefined);
              }
            }}
            disabled={pmSync.isPending || syncJiraTasks.isPending}
            title={
              showOnTasks && primarySlug
                ? `Sync tasks from ${INTEGRATION_TAB_CONFIG[primarySlug]?.label ?? primarySlug}`
                : "Requires JIRA_* secrets on sync-tasks-jira"
            }
          >
            {(pmSync.isPending || syncJiraTasks.isPending) ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {showOnTasks && primarySlug
              ? `Sync ${INTEGRATION_TAB_CONFIG[primarySlug]?.label ?? primarySlug}`
              : "Sync Jira"}
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      {showOnTasks && primarySlug && (
        <Alert>
          <Plug className="h-4 w-4" />
          <AlertDescription>
            Synced tasks from{" "}
            <strong>{INTEGRATION_TAB_CONFIG[primarySlug]?.label ?? primarySlug}</strong>{" "}
            appear in the integration tab below. Sync from here or from Admin → Integrations.
          </AlertDescription>
        </Alert>
      )}

      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search tasks by title..."
          className="pl-9 w-full rounded-lg"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <TaskViewTabs
        currentView={view}
        onViewChange={handleViewChange}
        stats={stats}
        integrationTabs={integrationTabs}
      />

      {showStreamsGrid ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {streams?.map((stream) => (
            <Card
              key={stream.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/tasks/stream/${stream.slug || stream.id}`)}
            >
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: stream.color }}
                  />
                  <span className="font-medium">{stream.name}</span>
                </div>
                {stream.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {stream.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {stream.task_count ?? 0} tasks · {stream.member_count ?? 0} members
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : showWeekView ? (
        <>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWeekOffset((o) => o - 1)}
              >
                &larr; Previous
              </Button>
              <span className="text-sm font-medium min-w-[200px] text-center">
                {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWeekOffset((o) => o + 1)}
              >
                Next &rarr;
              </Button>
            </div>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          </div>
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="grid grid-cols-7 border-b bg-muted/40">
              {dayLabels.map((label, i) => (
                <div
                  key={label}
                  className="p-2 text-center text-xs font-medium text-muted-foreground border-r last:border-r-0"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 min-h-[120px]">
              {weekDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayTasks = byDay[key] || [];
                const isTodayCell = isToday(day);
                return (
                  <div
                    key={key}
                    className={cn(
                      "border-r last:border-r-0 p-2 min-h-[100px]",
                      isTodayCell && "bg-primary/5"
                    )}
                  >
                    <div
                      className={cn(
                        "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium",
                        isTodayCell
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {format(day, "d")}
                    </div>
                    <div className="mt-1 space-y-1">
                      {dayTasks.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No tasks</p>
                      ) : (
                        dayTasks.slice(0, 3).map((task) => (
                          <a
                            key={task.id}
                            href={`/tasks/${task.slug || task.id}`}
                            className="block text-xs truncate rounded px-1 py-0.5 bg-muted hover:bg-muted/80"
                            onClick={(e) => {
                              e.preventDefault();
                              navigate(`/tasks/${task.slug || task.id}`);
                            }}
                          >
                            {task.title}
                          </a>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <>
          <TaskFiltersBar filters={filters} onFiltersChange={setFilters} streams={streams} categories={categories} />

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isEmpty ? (
            <Card className="rounded-lg border bg-card">
              <CardContent className="flex flex-col items-center justify-center py-16 px-6">
                <div className="rounded-lg bg-muted p-4 mb-4">
                  <CheckSquare className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-center">
                  {EMPTY_MESSAGES[view].title}
                </h3>
                <p className="text-sm text-muted-foreground text-center mt-1 max-w-sm">
                  {EMPTY_MESSAGES[view].description}
                </p>
                <Button className="mt-6" onClick={() => setShowCreate(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Task
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border bg-card">
              <TasksTable
                tasks={taskList}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                taskHref={(task) => `/tasks/${task.slug || task.id}`}
              />
            </div>
          )}
        </>
      )}

      <CreateTaskDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
