import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckSquare, FolderKanban, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MeetingsThisWeekCard } from "@/components/dashboards/MeetingsThisWeekCard";
import { AIDigestCard } from "@/components/dashboards/AIDigestCard";
import { QuickActionsCard } from "@/components/dashboards/QuickActionsCard";
import { AITeamsDashboardCard } from "@/components/dashboards/AITeamsDashboardCard";
import { DashboardPreferencesSheet } from "@/components/dashboards/DashboardPreferencesSheet";
import { useAuth } from "@/contexts/AuthContext";
import { useMyTasks, useMyProjects } from "@/hooks/usePMDashboard";
import { useDashboardPreferences } from "@/hooks/useDashboardPreferences";
import { useIsWidgetEnabled } from "@/hooks/useDashboardWidgets";
import { useUpdateTask } from "@/hooks/useTasks";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/cache";
import { cn } from "@/lib/utils";

const ACTIVE_STATUSES = ["todo", "in_progress", "paused"] as const;
const ALL_STATUSES = ["todo", "in_progress", "paused", "completed", "cancelled"] as const;
type TaskStatus = (typeof ALL_STATUSES)[number];

const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  paused: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  completed: "bg-green-500/15 text-green-700 dark:text-green-400",
  cancelled: "bg-red-500/15 text-red-700 dark:text-red-400",
};

function formatDue(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "due today";
  if (diff === 1) return "due tomorrow";
  if (diff <= 7) return `due in ${diff}d`;
  return null;
}

function MyTasksKanban({ hideCompleted }: { hideCompleted: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: tasks, isLoading } = useMyTasks({ hideCompleted });
  const updateTask = useUpdateTask();

  const visibleStatuses: readonly TaskStatus[] = hideCompleted ? ACTIVE_STATUSES : ALL_STATUSES;
  const filters = { hideCompleted };

  const byStatus = visibleStatuses.reduce<Record<string, typeof tasks>>(
    (acc, s) => ({ ...acc, [s]: [] }),
    {}
  );

  if (tasks) {
    for (const task of tasks) {
      if (task.status in byStatus) {
        const s = task.status as TaskStatus;
        byStatus[s] = [...(byStatus[s] ?? []), task];
      }
    }
  }

  const handleStatusChange = (taskId: string, newStatus: string) => {
    const myTasksKey = queryKeys.dashboard.myTasks(user?.id ?? "", filters);
    updateTask.mutate(
      { id: taskId, data: { status: newStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: myTasksKey });
        },
        onError: () => {
          queryClient.invalidateQueries({ queryKey: myTasksKey });
        },
      } as any
    );
  };

  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, taskId: string, fromStatus: string) => {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.setData("fromStatus", fromStatus);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleColumnDragOver = (e: React.DragEvent, statusKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(statusKey);
  };

  const handleColumnDragLeave = (e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    setDragOverColumn(null);
  };

  const handleColumnDrop = (e: React.DragEvent, toStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData("taskId");
    const fromStatus = e.dataTransfer.getData("fromStatus");
    if (!taskId || toStatus === fromStatus) return;
    handleStatusChange(taskId, toStatus);
  };

  const colCount = visibleStatuses.length;

  if (isLoading) {
    return (
      <div className={`grid gap-4 sm:grid-cols-${colCount}`}>
        {visibleStatuses.map((s) => (
          <div key={s} className="space-y-2">
            <Skeleton className="h-5 w-24" />
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  const totalTasks = Object.values(byStatus).reduce((a, v) => a + (v?.length ?? 0), 0);

  if (totalTasks === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No tasks assigned to you. 🎉
      </p>
    );
  }

  return (
    <div className={`grid gap-4 sm:grid-cols-${colCount}`}>
      {visibleStatuses.map((statusKey) => {
        const statusTasks = byStatus[statusKey] ?? [];
        return (
          <div key={statusKey} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {STATUS_LABELS[statusKey]}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">{statusTasks.length}</span>
            </div>
            <div
              className={cn(
                "space-y-1.5 min-h-[2rem] rounded-md transition-colors",
                dragOverColumn === statusKey && "bg-muted/60 ring-1 ring-primary/30"
              )}
              onDragOver={(e) => handleColumnDragOver(e, statusKey)}
              onDragLeave={handleColumnDragLeave}
              onDrop={(e) => handleColumnDrop(e, statusKey)}
            >
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {statusTasks.map((task: any) => {
                const dueLabel = formatDue(task.due_date);
                const isOverdue = dueLabel?.includes("overdue");
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id, statusKey)}
                    className="group cursor-grab active:cursor-grabbing rounded-lg border border-border/50 bg-card p-2.5 text-left text-sm hover:border-border hover:shadow-sm transition-all"
                  >
                    <Link to={`/tasks/${task.id}`} className="block font-medium hover:underline">
                      {task.title}
                    </Link>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      {task.clients?.name && (
                        <span className="text-xs text-muted-foreground truncate">{task.clients.name}</span>
                      )}
                      {dueLabel && (
                        <span
                          className={cn(
                            "text-xs shrink-0",
                            isOverdue ? "text-destructive font-medium" : "text-muted-foreground"
                          )}
                        >
                          {dueLabel}
                        </span>
                      )}
                    </div>
                    {/* Quick status: advance to next, or move to Cancelled/Completed */}
                    {statusKey !== "completed" && statusKey !== "cancelled" && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <button
                          onClick={() => {
                            const nextStatus =
                              statusKey === "todo"
                                ? "in_progress"
                                : statusKey === "in_progress"
                                  ? "paused"
                                  : "completed";
                            handleStatusChange(task.id, nextStatus);
                          }}
                          className="text-xs text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Move to{" "}
                          {statusKey === "todo"
                            ? "In Progress"
                            : statusKey === "in_progress"
                              ? "Paused"
                              : "Completed"}{" "}
                          →
                        </button>
                        <button
                          onClick={() => handleStatusChange(task.id, "cancelled")}
                          className="text-xs text-muted-foreground hover:text-destructive hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {statusKey === "completed" && (
                      <button
                        onClick={() => handleStatusChange(task.id, "cancelled")}
                        className="mt-1.5 text-xs text-muted-foreground hover:text-destructive hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Move to Cancelled →
                      </button>
                    )}
                    {statusKey === "cancelled" && (
                      <button
                        onClick={() => handleStatusChange(task.id, "completed")}
                        className="mt-1.5 text-xs text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Move to Completed →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MyProjectsList() {
  const { data: projects, isLoading } = useMyProjects();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">You haven't been added to any active projects yet.</p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {projects.slice(0, 6).map((project: any) => {
        const statusSlug = project.project_statuses?.slug ?? project.status?.slug;
        const statusName = project.project_statuses?.name ?? project.status?.name;
        return (
          <li key={project.id} className="group flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Link
                to={`/projects/${project.slug}`}
                className="block truncate text-sm font-medium hover:underline"
              >
                {project.name}
              </Link>
              <p className="text-xs text-muted-foreground capitalize">{project.myRole}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {statusName && (
                <Badge variant="outline" className="text-xs">
                  {statusName}
                </Badge>
              )}
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function ICDashboard() {
  const { profile } = useAuth();
  const { preferences } = useDashboardPreferences();
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  const showAiDigest = useIsWidgetEnabled("ai_digest", "ic");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Good {getTimeOfDay()}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground">Here's your work for today.</p>
        </div>
        <DashboardPreferencesSheet />
      </div>

      {/* Row 1: Quick Actions */}
      <QuickActionsCard />

      {/* AI Team showcase */}
      <AITeamsDashboardCard agencyRole="ic" />

      {/* Row 2: My Work kanban (full width) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
              My Work
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/tasks" className="text-xs text-muted-foreground hover:text-foreground">
                View all tasks
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <MyTasksKanban hideCompleted={preferences.hide_completed_tasks} />
        </CardContent>
      </Card>

      {/* Row 2: AI Digest (if admin-enabled and user-enabled) */}
      {showAiDigest && preferences.ai_digest_enabled && <AIDigestCard />}

      {/* Row 3: My Projects + Meetings */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                My Projects
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/projects" className="text-xs text-muted-foreground hover:text-foreground">
                  View all
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <MyProjectsList />
          </CardContent>
        </Card>

        <MeetingsThisWeekCard />
      </div>
    </div>
  );
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
