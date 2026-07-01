/**
 * Create Task Dialog
 *
 * Matches reference: "Create New Task" title, subtitle, Title *, Description with toolbar,
 * Attachments, Task Stream (No Stream (Personal)), Status * (New), Priority * (Medium),
 * Due Date, Assignee (Unassigned). Cancel / Create Task.
 * Description toolbar: Bold, Italic, Strikethrough, Lists, Link (working via contentEditable + execCommand).
 */
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Bold, Italic, Strikethrough, List, ListOrdered, Link2, Table, Upload, User, CalendarIcon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCreateTask } from "../hooks/useTasksV2";
import { useUpdateTask } from "../hooks/useTasksV2";
import { useTaskStreams } from "../hooks/useTaskStreams";
import { useTaskCategories } from "../hooks/useTaskCategories";
import type { Task, TaskStatus, TaskPriority } from "../types/tasks";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { invalidateKeys } from "@/lib/cache";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.string().default("todo"),
  priority: z.string().default("medium"),
  due_date: z.string().optional(),
  stream_id: z.string().optional(),
  category_id: z.string().optional(),
  assigned_to: z.string().optional(),
  attachment_url: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStreamId?: string;
  parentId?: string;
  /** When provided, dialog acts as Edit Task: prefills form and calls update on submit. */
  task?: Task | null;
}

export function CreateTaskDialog({ open, onOpenChange, defaultStreamId, parentId, task: editTask }: CreateTaskDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const isEdit = !!editTask;
  const { data: streams } = useTaskStreams();
  const { data: categories } = useTaskCategories();
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const descriptionEditorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profiles } = useQuery({
    queryKey: ["profiles", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: "todo",
      priority: "medium",
      stream_id: defaultStreamId || "",
      assigned_to: "",
    },
  });

  useEffect(() => {
    if (!open) setPendingFiles([]);
  }, [open]);

  useEffect(() => {
    if (open && defaultStreamId) setValue("stream_id", defaultStreamId);
  }, [open, defaultStreamId, setValue]);

  // Prefill form when opening in edit mode
  useEffect(() => {
    if (!open || !editTask) return;
    setValue("title", editTask.title);
    setValue("description", editTask.description ?? "");
    setValue("status", editTask.status);
    setValue("priority", editTask.priority);
    setValue("stream_id", editTask.stream_id ?? "");
    setValue("category_id", editTask.category_id ?? "");
    setValue("assigned_to", editTask.assigned_to ?? "");
    setDueDate(editTask.due_date ? new Date(editTask.due_date) : undefined);
  }, [open, editTask, setValue]);

  // Sync description editor with form when dialog opens or form resets
  const descriptionValue = watch("description");
  useEffect(() => {
    if (!open || !descriptionEditorRef.current) return;
    const next = descriptionValue ?? "";
    if (descriptionEditorRef.current.innerHTML !== next) {
      descriptionEditorRef.current.innerHTML = next;
    }
  }, [open, descriptionValue]);

  const handleFormat = (command: string, value?: string) => {
    descriptionEditorRef.current?.focus();
    document.execCommand(command, false, value ?? undefined);
    if (descriptionEditorRef.current) {
      setValue("description", descriptionEditorRef.current.innerHTML, { shouldDirty: true });
    }
  };

  const handleInsertLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) handleFormat("createLink", url);
  };

  const BUCKET = "user-knowledge";
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/gif", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"];

  const uploadFileToTask = async (taskId: string, file: File): Promise<void> => {
    if (!user?.id) throw new Error("Not authenticated");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${user.id}/task-attachments/${taskId}/${crypto.randomUUID()}_${safeName}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, { upsert: false });
    if (uploadError) throw uploadError;
    const { error: insertError } = await supabase.from("task_attachments").insert({
      task_id: taskId,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type || null,
      storage_path: storagePath,
      uploaded_by: user.id,
    });
    if (insertError) throw insertError;
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    const valid = files.filter((f) => {
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name} exceeds 10MB`);
        return false;
      }
      if (ALLOWED_TYPES.length && !ALLOWED_TYPES.includes(f.type) && !f.name.match(/\.(pdf|doc|docx|txt|md|jpg|jpeg|png|gif)$/i)) {
        toast.error(`${f.name}: unsupported file type`);
        return false;
      }
      return true;
    });
    if (valid.length === 0) return;
    if (isEdit && editTask) {
      setUploading(true);
      try {
        for (const file of valid) {
          await uploadFileToTask(editTask.id, file);
        }
        invalidateKeys.taskDetail(queryClient, editTask.id);
        toast.success(valid.length === 1 ? "File uploaded" : `${valid.length} files uploaded`);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
      return;
    }
    setPendingFiles((prev) => [...prev, ...valid]);
    toast.success(valid.length === 1 ? "File added; it will be uploaded when you create the task." : `${valid.length} files added.`);
  };

  const assignedTo = watch("assigned_to");

  const onSubmit = async (data: FormValues) => {
    if (isEdit && editTask) {
      await updateTask.mutateAsync({
        id: editTask.id,
        data: {
          title: data.title,
          description: data.description,
          status: (data.status || "todo") as TaskStatus,
          priority: (data.priority || "medium") as TaskPriority,
          due_date: dueDate ? dueDate.toISOString() : undefined,
          stream_id: data.stream_id || undefined,
          category_id: data.category_id || undefined,
          assigned_to: data.assigned_to || undefined,
        },
      });
      onOpenChange(false);
      return;
    }
    const task = await createTask.mutateAsync({
      title: data.title,
      description: data.description,
      status: (data.status || "todo") as TaskStatus,
      priority: (data.priority || "medium") as TaskPriority,
      due_date: dueDate ? dueDate.toISOString() : undefined,
      stream_id: data.stream_id || undefined,
      category_id: data.category_id || undefined,
      assigned_to: data.assigned_to || undefined,
      parent_id: parentId,
    });
    if (pendingFiles.length > 0 && task?.id) {
      setUploading(true);
      try {
        for (const file of pendingFiles) await uploadFileToTask(task.id, file);
        toast.success("Task and attachments created");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Task created but some attachments failed to upload");
      } finally {
        setUploading(false);
        setPendingFiles([]);
      }
    }
    reset();
    setDueDate(undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Task" : parentId ? "Add Subtask" : "Create New Task"}</DialogTitle>
          {!parentId && (
            <DialogDescription>
              {isEdit ? "Update task details, due date, and assignment." : "Create a new task and assign it to a team member."}
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title * */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Enter task title."
              {...register("title")}
              autoFocus
              className="rounded-md"
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Description with working toolbar */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <div className="rounded-md border bg-background">
              <div className="flex items-center gap-0.5 border-b p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Bold"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleFormat("bold");
                  }}
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Italic"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleFormat("italic");
                  }}
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Strikethrough"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleFormat("strikeThrough");
                  }}
                >
                  <Strikethrough className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Bullet list"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleFormat("insertUnorderedList");
                  }}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Numbered list"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleFormat("insertOrderedList");
                  }}
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Insert link"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleInsertLink();
                  }}
                >
                  <Link2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Insert table"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleFormat("insertTable");
                  }}
                >
                  <Table className="h-4 w-4" />
                </Button>
              </div>
              <div
                ref={descriptionEditorRef}
                contentEditable
                role="textbox"
                aria-label="Description"
                data-placeholder="Add details..."
                className="min-h-[100px] max-h-[200px] overflow-y-auto px-3 py-2 text-sm focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
                onInput={() => {
                  if (descriptionEditorRef.current) {
                    setValue("description", descriptionEditorRef.current.innerHTML, { shouldDirty: true });
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const text = e.clipboardData.getData("text/plain");
                  document.execCommand("insertText", false, text);
                }}
              />
            </div>
          </div>

          {/* Proposal URL / NDA URL / File Attachments */}
          <div className="space-y-2">
            <Label>Proposal URL / NDA URL / File Attachments</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Paste URL or upload PDF..."
                className="rounded-md flex-1"
                {...register("attachment_url")}
              />
              <Button type="button" variant="outline" size="icon" title="Paste URL">
                <Link2 className="h-4 w-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.md,.jpg,.jpeg,.png,.gif,application/pdf,image/*,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Upload file"
                onClick={handleUploadClick}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </Button>
            </div>
            {pendingFiles.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {pendingFiles.length} file(s) will be attached when you create the task.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Upload files or paste a URL to add attachments.
            </p>
          </div>

          {/* Task Stream */}
          {!parentId && (
            <div className="space-y-2">
              <Label>Task Stream</Label>
              <Select
                value={watch("stream_id") || "none"}
                onValueChange={(v) => setValue("stream_id", v === "none" ? "" : v)}
              >
                <SelectTrigger className="rounded-md">
                  <SelectValue placeholder="No Stream (Personal)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Stream (Personal)</SelectItem>
                  {(streams || []).map((stream) => (
                    <SelectItem key={stream.id} value={stream.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: stream.color }}
                        />
                        {stream.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={watch("category_id") || "none"}
              onValueChange={(v) => setValue("category_id", v === "none" ? "" : v)}
            >
              <SelectTrigger className="rounded-md">
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
          </div>

          {/* Status * & Priority * */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status *</Label>
              <Select
                value={watch("status") || "todo"}
                onValueChange={(v) => setValue("status", v)}
              >
                <SelectTrigger className="rounded-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">New</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Done</SelectItem>
                  <SelectItem value="cancelled">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority *</Label>
              <Select
                value={watch("priority") || "medium"}
                onValueChange={(v) => setValue("priority", v)}
              >
                <SelectTrigger className="rounded-md">
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

          {/* Due Date & Assignee */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal rounded-md",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "dd-MM-yyyy") : "dd-mm-yyyy"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={(d) => {
                      setDueDate(d);
                      setDueDateOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Assignee</Label>
              <Select
                value={assignedTo || "unassigned"}
                onValueChange={(v) => setValue("assigned_to", v === "unassigned" ? "" : v)}
              >
                <SelectTrigger className="rounded-md">
                  <SelectValue>
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {assignedTo && profiles?.find((p) => p.id === assignedTo)
                        ? profiles.find((p) => p.id === assignedTo)?.full_name || profiles.find((p) => p.id === assignedTo)?.email
                        : "Unassigned"}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Unassigned
                    </span>
                  </SelectItem>
                  {(profiles || []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {p.full_name || p.email}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTask.isPending || updateTask.isPending}>
              {(createTask.isPending || updateTask.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save" : parentId ? "Add Subtask" : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
