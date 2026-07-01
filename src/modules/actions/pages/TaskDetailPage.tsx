/**
 * Task Detail Page
 *
 * Shows full task details with subtasks, comments, metadata sidebar,
 * and inline status/priority editing.
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Calendar,
  Loader2,
  Trash2,
  Pencil,
  GitBranch,
  User,
  Clock,
  Reply,
  Paperclip,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTaskBySlug, useUpdateTask, useDeleteTask } from "../hooks/useTasksV2";
import { useTaskCategories } from "../hooks/useTaskCategories";
import { useTaskAttachments } from "../hooks/useTaskAttachments";
import { SubTasksList } from "../components/SubTasksList";
import { CommentThread } from "../components/comments/CommentThread";
import { CreateTaskDialog } from "../components/CreateTaskDialog";
import type { TaskStatus, TaskPriority } from "../types/tasks";
import { sanitizeRichText } from "@/lib/sanitize";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

const statusColors: Record<string, string> = {
  todo: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export default function TaskDetailPage() {
  const { idOrSlug } = useParams<{ idOrSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [showDelete, setShowDelete] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: task, isLoading } = useTaskBySlug(idOrSlug);
  const { data: attachments } = useTaskAttachments(task?.id);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { data: categories } = useTaskCategories();

  // Prefer slug in URL: if we loaded by UUID and task has slug, redirect to /tasks/:slug
  useEffect(() => {
    if (!task || !idOrSlug || !isUuid(idOrSlug) || !task.slug) return;
    if (idOrSlug !== task.slug) {
      navigate(`/tasks/${task.slug}`, { replace: true });
    }
  }, [task, idOrSlug, navigate]);

  const fromState = location.state as { fromProject?: { slug?: string } } | null;
  const projectSlug = fromState?.fromProject?.slug;

  const backHref = projectSlug
    ? `/projects/${projectSlug}/tasks`
    : task?.stream?.slug
      ? `/tasks/stream/${task.stream.slug}`
      : "/tasks";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-lg text-muted-foreground">Task not found</p>
        <Button variant="outline" onClick={() => navigate("/tasks")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Tasks
        </Button>
      </div>
    );
  }

  const canAssignBack =
    user?.id &&
    task.assigned_to === user.id &&
    task.created_by !== user.id &&
    task.created_by != null;

  const handleAssignBack = () => {
    if (!task.created_by) return;
    updateTask.mutate({
      id: task.id,
      data: { assigned_to: task.created_by },
    });
  };

  const jiraMeta = task.metadata as Record<string, unknown> | null;
  const isJiraTask = jiraMeta?.source === "jira" && typeof jiraMeta?.external_id === "string";
  const jiraUrl =
    isJiraTask && typeof jiraMeta?.jira_url === "string" ? (jiraMeta.jira_url as string) : null;
  const jiraStatusName =
    isJiraTask && typeof jiraMeta?.jira_status_name === "string"
      ? (jiraMeta.jira_status_name as string)
      : null;

  const clickupMeta =
    (task.metadata as any)?.clickup as
      | {
          timeEstimateMs?: number | null;
          timeSpentMs?: number | null;
          tags?: string[];
          sprintPoints?: number | null;
        }
      | undefined;
  interface ExternalAttachment {
    id?: string | number | null;
    title?: string | null;
    name?: string | null;
    mimetype?: string | null;
    mime_type?: string | null;
    url?: string | null;
    download_url?: string | null;
  }
  const clickupExternalId = (task.metadata as any)?.external_id as string | undefined;
  const isClickupTask = (task.metadata as any)?.source === "clickup" && !!clickupExternalId;
  const integrationSource = (task.metadata as any)?.source as string | undefined;
  const providerLabel =
    integrationSource === "clickup"
      ? "ClickUp"
      : integrationSource === "activecollab"
        ? "ActiveCollab"
        : integrationSource === "jira"
          ? "Jira"
          : "External";
  const integrationAttachmentsRaw = (task.metadata as any)?.attachments as ExternalAttachment[] | undefined;
  const integrationAttachments = Array.isArray(integrationAttachmentsRaw) ? integrationAttachmentsRaw : [];

  const handleStatusChange = (status: TaskStatus) => {
    updateTask.mutate(
      { id: task.id, data: { status } },
      {
        onSuccess: async () => {
          if (isClickupTask) {
            try {
              await supabase.functions.invoke("update-clickup-task", {
                body: {
                  external_id: clickupExternalId,
                  status,
                },
              });
            } catch {
              // best-effort sync
            }
          }
        },
      },
    );
  };

  const handlePriorityChange = (priority: TaskPriority) => {
    updateTask.mutate({ id: task.id, data: { priority } });
  };

  const handleDeleteConfirm = () => {
    deleteTask.mutate(task.id, {
      onSuccess: () => navigate("/tasks"),
    });
  };

  const handleOpenAttachment = async (attachmentId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Please sign in to open attachments.");
        return;
      }
      const { data, error } = await supabase.functions.invoke("task-attachment-url", {
        body: { attachment_id: attachmentId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      const url = data?.url;
      if (!url || typeof url !== "string") {
        toast.error("Could not open file");
        return;
      }
      window.open(url, "_blank");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to open file";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(backHref)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{task.title}</h1>
            {task.stream && (
              <span
                className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 mt-1"
                style={{ backgroundColor: task.stream.color + "20", color: task.stream.color }}
              >
                <GitBranch className="h-3 w-3" />
                {task.stream.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canAssignBack && (
            <Button variant="outline" size="sm" onClick={handleAssignBack}>
              <Reply className="mr-2 h-4 w-4" />
              Assign back to sender
            </Button>
          )}
          <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="destructive" size="icon" onClick={() => setShowDelete(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Task Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Task Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status & Priority inline selects */}
              <div className="flex items-center gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Status</p>
                  <Select value={task.status} onValueChange={(v) => handleStatusChange(v as TaskStatus)}>
                    <SelectTrigger className="h-8 w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Priority</p>
                  <Select value={task.priority} onValueChange={(v) => handlePriorityChange(v as TaskPriority)}>
                    <SelectTrigger className="h-8 w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              {task.description && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Description</p>
                    {/<\/?[a-z][^>]*>/i.test(task.description) ? (
                      <div
                        className="text-sm prose prose-sm max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeRichText(task.description),
                        }}
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{task.description}</p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Attachments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!attachments || attachments.length === 0) && integrationAttachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attachments yet.</p>
              ) : (
                <div className="space-y-3">
                  {attachments && attachments.length > 0 && (
                    <ul className="space-y-2">
                      {attachments.map((att) => (
                        <li key={att.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate font-medium" title={att.file_name}>
                            {att.file_name}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0 h-8"
                            onClick={() => handleOpenAttachment(att.id)}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Open
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {integrationAttachments.length > 0 && (
                    <ul className="space-y-2">
                      {integrationAttachments.map((att, idx) => {
                        const link = att.download_url ?? att.url ?? null;
                        const fileName = att.title ?? att.name ?? `Attachment ${idx + 1}`;
                        return (
                          <li key={`${att.id ?? `external-${idx}`}`} className="flex items-center justify-between gap-2 text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0">
                                {providerLabel}
                              </Badge>
                              <span className="truncate font-medium" title={fileName}>
                                {fileName}
                              </span>
                            </div>
                            {link ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="shrink-0 h-8"
                                onClick={() => window.open(link, "_blank")}
                              >
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Open
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">No link</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Subtasks */}
          <Card>
            <CardContent className="pt-6">
              <SubTasksList parentId={task.id} subtasks={task.subtasks || []} />
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardContent className="pt-6">
              <CommentThread taskId={task.id} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar (1/3) */}
        <div className="space-y-4">
          {/* Assignment */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Assignment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {task.assigned_user?.full_name || "Unassigned"}
                  </p>
                  {task.assigned_user?.email && (
                    <p className="text-xs text-muted-foreground">{task.assigned_user.email}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Due Date */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Due Date</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {task.due_date
                  ? format(new Date(task.due_date), "MMM d, yyyy 'at' h:mm a")
                  : "No due date"}
              </div>
            </CardContent>
          </Card>

          {/* Category */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Category</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={task.category_id || "none"}
                onValueChange={(v) => updateTask.mutate({ id: task.id, data: { category_id: v === "none" ? undefined : v } })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="No category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {(categories || []).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Related Items */}
          {(task.clients || task.meetings) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Related Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {task.clients && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Client: </span>
                    <Link to={`/clients/${task.client_id}`} className="text-primary hover:underline">
                      {task.clients.name}
                    </Link>
                  </div>
                )}
                {task.meetings && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Meeting: </span>
                    <Link to={`/meetings/${task.meeting_id}`} className="text-primary hover:underline">
                      {task.meetings.title}
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Created {format(new Date(task.created_at), "MMM d, yyyy")}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Updated {format(new Date(task.updated_at), "MMM d, yyyy")}
              </div>
              {task.completed_at && (
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  Completed {format(new Date(task.completed_at), "MMM d, yyyy")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ClickUp-specific fields */}
          {(task.metadata as any)?.source === "clickup" && clickupMeta && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">ClickUp</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                {clickupMeta.timeEstimateMs != null && (
                  <div>
                    <span className="font-medium text-foreground">Time estimate: </span>
                    <span>{Math.round(clickupMeta.timeEstimateMs / 60000)} min</span>
                  </div>
                )}
                {clickupMeta.timeSpentMs != null && (
                  <div>
                    <span className="font-medium text-foreground">Time tracked: </span>
                    <span>{Math.round(clickupMeta.timeSpentMs / 60000)} min</span>
                  </div>
                )}
                {clickupMeta.sprintPoints != null && (
                  <div>
                    <span className="font-medium text-foreground">Sprint points: </span>
                    <span>{clickupMeta.sprintPoints}</span>
                  </div>
                )}
                {clickupMeta.tags && clickupMeta.tags.length > 0 && (
                  <div>
                    <span className="font-medium text-foreground">Tags: </span>
                    <span>{clickupMeta.tags.join(", ")}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {isJiraTask && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Jira</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                {jiraStatusName && (
                  <div>
                    <span className="font-medium text-foreground">Jira status: </span>
                    <span>{jiraStatusName}</span>
                  </div>
                )}
                {task.work_type && (
                  <div>
                    <span className="font-medium text-foreground">Issue type: </span>
                    <span>{task.work_type}</span>
                  </div>
                )}
                {jiraUrl && (
                  <Button variant="outline" size="sm" className="h-8 mt-1" asChild>
                    <a href={jiraUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Open in Jira
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Task Dialog */}
      <CreateTaskDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        task={task}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{task.title}" and all its subtasks and comments.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
