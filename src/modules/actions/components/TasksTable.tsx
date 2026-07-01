import { Link } from "react-router-dom";
import { format, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, MessageSquare, GitBranch } from "lucide-react";
import type { Task, TaskStatus } from "../types/tasks";

const statusColors: Record<string, string> = {
  todo: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};

interface TasksTableProps {
  tasks: Task[];
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  /** If provided, task title links use this href (e.g. slug-based /tasks/:slug) */
  taskHref?: (task: Task) => string;
}

export function TasksTable({ tasks, onStatusChange, onDelete, taskHref }: TasksTableProps) {
  const hrefFor = (task: Task) => taskHref?.(task) ?? `/tasks/${task.id}`;
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No tasks found</p>
        <p className="text-sm">Create a task to get started.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40%]">Title</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Assigned To</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => {
          const isOverdue =
            task.due_date &&
            isPast(new Date(task.due_date)) &&
            task.status !== "completed" &&
            task.status !== "cancelled";
          const isDueToday = task.due_date && isToday(new Date(task.due_date));

          return (
            <TableRow
              key={task.id}
              className={cn(isOverdue && "bg-red-50/50")}
            >
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Link
                    to={hrefFor(task)}
                    className="font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {task.title}
                  </Link>
                  <div className="flex items-center gap-2">
                    {task.stream && (
                      <span
                        className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5"
                        style={{ backgroundColor: task.stream.color + "20", color: task.stream.color }}
                      >
                        <GitBranch className="h-3 w-3" />
                        {task.stream.name}
                      </span>
                    )}
                    {task.comment_count && task.comment_count > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        {task.comment_count}
                      </span>
                    )}
                    {task.subtasks && task.subtasks.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {task.subtasks.filter((s) => s.status === "completed").length}/
                        {task.subtasks.length} subtasks
                      </span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Select
                  value={task.status}
                  onValueChange={(val) => onStatusChange(task.id, val as TaskStatus)}
                >
                  <SelectTrigger className="h-8 w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        <Badge variant="secondary" className={cn("text-xs", statusColors[value])}>
                          {label}
                        </Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={cn("text-xs", priorityColors[task.priority])}>
                  {task.priority}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {task.assigned_user?.full_name || task.assigned_user?.email || "Unassigned"}
                </span>
              </TableCell>
              <TableCell>
                {task.due_date ? (
                  <span
                    className={cn(
                      "text-sm",
                      isOverdue && "text-red-600 font-medium",
                      isDueToday && !isOverdue && "text-amber-600 font-medium"
                    )}
                  >
                    {format(new Date(task.due_date), "MMM d, yyyy")}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-red-600"
                  onClick={() => onDelete(task.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
