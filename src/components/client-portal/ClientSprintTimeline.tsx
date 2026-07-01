import { CheckCircle2, Circle } from "lucide-react";
import { format } from "date-fns";

interface Task {
  id: string;
  task_name: string;
  status: string;
  due_date: string | null;
  assignee_name: string | null;
  completed_at: string | null;
}

interface Sprint {
  name: string;
  tasks: Task[];
  total: number;
  completed: number;
}

interface ClientSprintTimelineProps {
  sprints: Sprint[];
}

export function ClientSprintTimeline({ sprints }: ClientSprintTimelineProps) {
  if (sprints.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No sprints or tasks to display.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sprints.map((sprint) => (
        <div key={sprint.name} className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold">{sprint.name}</h4>
            <span className="text-sm text-muted-foreground">
              {sprint.completed}/{sprint.total} completed
            </span>
          </div>
          <div className="space-y-2">
            {sprint.tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 py-2 border-b border-muted/50 last:border-0"
              >
                {task.status === "completed" ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{task.task_name}</p>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    {task.due_date && (
                      <span>{format(new Date(task.due_date), "MMM d")}</span>
                    )}
                    {task.assignee_name && (
                      <span>• {task.assignee_name}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
