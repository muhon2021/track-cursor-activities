/**
 * Stream Tasks Page
 *
 * Shows tasks filtered to a specific stream (by slug or id in URL).
 */
import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, ArrowLeft, Users } from "lucide-react";
import { useTasksV2, useUpdateTask, useDeleteTask } from "../hooks/useTasksV2";
import { useTaskStreamBySlug } from "../hooks/useTaskStreams";
import { TasksTable } from "../components/TasksTable";
import { TaskFiltersBar } from "../components/TaskFiltersBar";
import { CreateTaskDialog } from "../components/CreateTaskDialog";
import { StreamPeopleModal } from "../components/StreamPeopleModal";
import type { TaskFilters, TaskStatus } from "../types/tasks";

export default function StreamTasksPage() {
  const { slug, streamId } = useParams<{ slug?: string; streamId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const slugOrId = streamId || slug;
  const [filters, setFilters] = useState<TaskFilters>({});
  const [showCreate, setShowCreate] = useState(false);
  const [showPeople, setShowPeople] = useState(false);

  const { data: stream, isLoading: streamLoading } = useTaskStreamBySlug(slugOrId);
  const currentStreamId = stream?.id;
  const { data: tasks, isLoading: tasksLoading } = useTasksV2({
    ...filters,
    stream_id: currentStreamId,
  });
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const isLoading = streamLoading || tasksLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(isAdmin ? "/admin/tasks/streams" : "/streams")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              {stream && (
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: stream.color }}
                />
              )}
              <h1 className="text-2xl font-bold">{stream?.name || "Stream"}</h1>
            </div>
            {stream?.description && (
              <p className="text-muted-foreground">{stream.description}</p>
            )}
          </div>
          {stream && (
            <Button variant="outline" size="sm" onClick={() => setShowPeople(true)}>
              <Users className="mr-2 h-4 w-4" />
              People
            </Button>
          )}
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>

      <TaskFiltersBar filters={filters} onFiltersChange={setFilters} />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <TasksTable
            tasks={tasks || []}
            onStatusChange={(id, status) => updateTask.mutate({ id, data: { status } })}
            onDelete={(id) => deleteTask.mutate(id)}
            taskHref={(task) => `/tasks/${task.slug || task.id}`}
          />
        </div>
      )}

      <CreateTaskDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        defaultStreamId={currentStreamId}
      />
      {stream && (
        <StreamPeopleModal
          open={showPeople}
          onOpenChange={setShowPeople}
          streamId={stream.id}
        />
      )}
    </div>
  );
}
