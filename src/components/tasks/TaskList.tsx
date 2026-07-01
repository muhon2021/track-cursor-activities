/**
 * TaskList – used in ProjectDetail (per PROJECTS-EXACT-FILE-LIST).
 * Placeholder; wire to project tasks or useTasks when needed.
 */
interface TaskListProps {
  projectId?: string;
  tasks?: unknown[];
  isLoading?: boolean;
}

export function TaskList({ tasks = [], isLoading }: TaskListProps) {
  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Loading tasks…</p>;
  if (!tasks.length) return <p className="text-sm text-muted-foreground py-4">No tasks.</p>;
  return <p className="text-sm text-muted-foreground py-4">TaskList ({tasks.length} tasks) – wire to full implementation</p>;
}
