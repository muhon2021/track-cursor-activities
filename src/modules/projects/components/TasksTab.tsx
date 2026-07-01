import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Calendar, User } from "lucide-react";
import type { ProjectTask } from "@/modules/projects/hooks/useProjectTasks";

interface TasksTabProps {
  projectId: string;
  projectSlug: string;
  tasks?: ProjectTask[];
  isLoading?: boolean;
}

const statusConfig: Record<ProjectTask["status"], { label: string; variant: "default" | "secondary" | "outline" }> = {
  todo: { label: "To do", variant: "outline" },
  in_progress: { label: "In progress", variant: "secondary" },
  done: { label: "Done", variant: "default" },
};

const priorityConfig: Record<string, { label: string; className: string }> = {
  high: { label: "High", className: "text-red-600 border-red-300 bg-red-50" },
  medium: { label: "Med", className: "text-amber-600 border-amber-300 bg-amber-50" },
  low: { label: "Low", className: "text-green-600 border-green-300 bg-green-50" },
};

export function TasksTab({ projectId, projectSlug, tasks = [], isLoading }: TasksTabProps) {
  const navigate = useNavigate();
  const hasTasks = tasks.length > 0;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Tasks</CardTitle>
          {hasTasks && (
            <CardDescription>
              {doneCount} of {tasks.length} completed
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading tasks…</p>
          )}
          {!isLoading && hasTasks && (
            <ul className="space-y-2">
              {tasks.map((t) => {
                const sc = statusConfig[t.status];
                const pc = priorityConfig[t.priority] || priorityConfig.medium;
                return (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/60 transition-colors"
                    onClick={() =>
                      navigate(`/tasks/${t.id}`, {
                        state: { fromProject: { slug: projectSlug } },
                      })
                    }
                  >
                    <div className="flex-1 min-w-0">
                      <span className={t.status === "done" ? "text-muted-foreground line-through" : ""}>
                        {t.title}
                      </span>
                      {t.assigned_to && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          {t.assigned_to}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      <Badge variant="outline" className={pc.className}>
                        {pc.label}
                      </Badge>
                      {t.due_date && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(t.due_date).toLocaleDateString()}
                        </span>
                      )}
                      <Badge variant={sc.variant}>{sc.label}</Badge>
                      {t.source && t.source !== "internal" && (
                        <Badge variant="secondary" className="text-xs">
                          {t.source}
                        </Badge>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {!isLoading && !hasTasks && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mb-3" />
              <p className="text-sm font-medium">No tasks yet</p>
              <p className="text-xs">
                Tasks can be added manually or synced from ClickUp, ActiveCollab, or Jira
                for <span className="font-mono">{projectSlug}</span>.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
