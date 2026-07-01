import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { useUpdateTask, useDeleteTask } from "../hooks/useTasksV2";
import type { Task } from "../types/tasks";

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

interface SubTasksListProps {
  parentId: string;
  subtasks: Task[];
}

export function SubTasksList({ parentId, subtasks }: SubTasksListProps) {
  const [showCreate, setShowCreate] = useState(false);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const completed = subtasks.filter((t) => t.status === "completed").length;
  const total = subtasks.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const toggleSubtask = (subtask: Task) => {
    const newStatus = subtask.status === "completed" ? "todo" : "completed";
    updateTask.mutate({ id: subtask.id, data: { status: newStatus } });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-medium">Subtasks</h4>
          {total > 0 && (
            <span className="text-xs text-muted-foreground">
              {completed}/{total} completed
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCreate(true)}
          className="h-7 text-xs"
        >
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="h-1.5 w-full rounded-full bg-muted">
          <div
            className="h-1.5 rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Subtask list */}
      <div className="space-y-1">
        {subtasks.map((subtask) => (
          <div
            key={subtask.id}
            className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50 group"
          >
            <Checkbox
              checked={subtask.status === "completed"}
              onCheckedChange={() => toggleSubtask(subtask)}
            />
            <span
              className={cn(
                "flex-1 text-sm",
                subtask.status === "completed" && "line-through text-muted-foreground"
              )}
            >
              {subtask.title}
            </span>
            <Badge
              variant="secondary"
              className={cn("text-[10px] h-5", priorityColors[subtask.priority])}
            >
              {subtask.priority}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-600"
              onClick={() => deleteTask.mutate(subtask.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      {total === 0 && (
        <p className="text-sm text-muted-foreground py-2">No subtasks yet.</p>
      )}

      <CreateTaskDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        parentId={parentId}
      />
    </div>
  );
}
