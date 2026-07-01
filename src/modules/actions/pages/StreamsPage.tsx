import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Loader2,
  Plus,
  ArrowLeft,
  Pencil,
  Shield,
  Layers,
  Eye,
  CircleCheck,
  CircleOff,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useTaskCategories,
  useCreateTaskCategory,
  useUpdateTaskCategory,
  useToggleTaskCategory,
} from "../hooks/useTaskCategories";
import {
  useTaskCategoryAccess,
  useAddTaskCategoryAccess,
  useRemoveTaskCategoryAccess,
} from "../hooks/useTaskCategoryAccess";
import { useStreamTaskCounts } from "../hooks/useStreamTaskCounts";
import type { TaskCategory } from "../types/tasks";

const PAGE_SIZE = 5;

interface StreamFormState {
  name: string;
  description: string;
  color: string;
  icon: string;
  parent_id: string;
}

const DEFAULT_FORM: StreamFormState = {
  name: "",
  description: "",
  color: "#8b5cf6",
  icon: "layers",
  parent_id: "none",
};

const iconMap: Record<string, typeof Layers> = {
  layers: Layers,
};

const STREAM_COLORS: Array<{ label: string; value: string }> = [
  { label: "Purple", value: "#8b5cf6" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Green", value: "#22c55e" },
  { label: "Orange", value: "#f97316" },
  { label: "Cyan", value: "#06b6d4" },
  { label: "Pink", value: "#ec4899" },
  { label: "Yellow", value: "#eab308" },
  { label: "Gray", value: "#6b7280" },
];

export default function StreamsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  const { data: categories, isLoading } = useTaskCategories({
    includeInactive: isAdmin,
  });
  const { data: accessRules } = useTaskCategoryAccess();
  const { data: streamTaskCounts } = useStreamTaskCounts();
  const createStream = useCreateTaskCategory();
  const updateStream = useUpdateTaskCategory();
  const toggleStream = useToggleTaskCategory();
  const addAccess = useAddTaskCategoryAccess();
  const removeAccess = useRemoveTaskCategoryAccess();

  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<TaskCategory | null>(null);
  const [manageAccessFor, setManageAccessFor] = useState<TaskCategory | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<StreamFormState>(DEFAULT_FORM);
  const [selectedRole, setSelectedRole] = useState("none");
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<"full" | "read_only">("full");

  const { data: roles } = useQuery({
    queryKey: ["roles", "task-stream-access"],
    queryFn: async () => {
      const { data, error } = await supabase.from("roles").select("id, name").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const byParent = useMemo(() => {
    const map = new Map<string | null, TaskCategory[]>();
    (categories || []).forEach((category) => {
      const key = category.parent_id ?? null;
      const list = map.get(key) || [];
      list.push(category);
      map.set(key, list);
    });
    return map;
  }, [categories]);

  const rootStreams = byParent.get(null) || [];
  const totalPages = Math.max(1, Math.ceil(rootStreams.length / PAGE_SIZE));
  const pageStreams = rootStreams.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeCount = (categories || []).filter((stream) => stream.is_active !== false).length;
  const inactiveCount = (categories || []).filter((stream) => stream.is_active === false).length;
  const totalAccessRules = accessRules?.length || 0;

  const openCreate = () => {
    setForm(DEFAULT_FORM);
    setEditing(null);
    setShowCreate(true);
  };

  const openEdit = (stream: TaskCategory) => {
    setEditing(stream);
    setForm({
      name: stream.name,
      description: stream.description || "",
      color: stream.color || "#8b5cf6",
      icon: stream.icon || "layers",
      parent_id: stream.parent_id || "none",
    });
    setShowCreate(true);
  };

  const submitForm = async () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      color: form.color,
      icon: form.icon,
      parent_id: form.parent_id === "none" ? undefined : form.parent_id,
    };
    if (editing) {
      await updateStream.mutateAsync({
        id: editing.id,
        data: {
          ...payload,
          parent_id: payload.parent_id ?? null,
        },
      });
    } else {
      await createStream.mutateAsync(payload);
    }
    setShowCreate(false);
  };

  const streamUrl = (stream: TaskCategory) => {
    if (isAdmin) return `/admin/tasks/streams/${stream.id}`;
    return `/tasks/stream/${stream.slug || stream.id}`;
  };

  return (
    <div className="space-y-6">
      {!isAdmin && (
        <Button variant="outline" onClick={() => navigate("/tasks")} className="rounded-lg">
          <ArrowLeft className="mr-2 h-4 w-4" />
          My Tasks
        </Button>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Task Streams</h1>
          <p className="text-muted-foreground">
            {isAdmin
              ? "Manage task categories, visibility, and role-based access rules."
              : "Organize tasks into focused workspaces."}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Stream
        </Button>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Active streams</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-4xl font-semibold leading-none">{activeCount}</span>
              <CircleCheck className="h-6 w-6 text-emerald-500" />
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Inactive streams</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-4xl font-semibold leading-none">{inactiveCount}</span>
              <CircleOff className="h-6 w-6 text-amber-500" />
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Access rules</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-4xl font-semibold leading-none">{totalAccessRules}</span>
              <ShieldCheck className="h-6 w-6 text-blue-500" />
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : pageStreams.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          No streams yet. Add one to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {pageStreams.map((stream) => {
            const children = byParent.get(stream.id) || [];
            const rules = (accessRules || []).filter((rule) => rule.category_id === stream.id);
            const taskCount = streamTaskCounts?.[stream.id] || 0;
            const fullAccessRules = rules.filter((rule) => rule.access_level === "full");
            const readOnlyRules = rules.filter((rule) => rule.access_level === "read_only");
            const StreamIcon = iconMap[stream.icon || "layers"] || Layers;

            return (
              <Card key={stream.id} className="rounded-xl">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl"
                          style={{ backgroundColor: `${stream.color || "#8b5cf6"}1f` }}
                        >
                          <StreamIcon
                            className="h-5 w-5"
                            style={{ color: stream.color || "#8b5cf6" }}
                          />
                        </div>
                        <CardTitle className="text-xl">{stream.name}</CardTitle>
                        <Badge variant="outline" className="text-[11px] lowercase">
                          {stream.slug || "no-slug"}
                        </Badge>
                        {isAdmin && (
                          <Badge
                            variant={stream.is_active === false ? "secondary" : "default"}
                            className="rounded-md"
                          >
                            {stream.is_active === false ? "Inactive" : "Active"}
                          </Badge>
                        )}
                      </div>
                      {stream.description && (
                        <p className="text-sm text-muted-foreground">{stream.description}</p>
                      )}
                      {children.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {children.map((child) => (
                            <Badge key={child.id} variant="outline">
                              {child.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{taskCount}</Badge>
                      {isAdmin && (
                        <>
                          <div className="flex items-center gap-2 rounded-md px-2 py-1">
                            <Switch
                              checked={stream.is_active !== false}
                              onCheckedChange={(checked) =>
                                toggleStream.mutate({
                                  id: stream.id,
                                  is_active: checked,
                                })
                              }
                            />
                            <span className="text-sm">Active</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setManageAccessFor(stream)}
                            className="rounded-lg"
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            Manage access
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEdit(stream)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                        </>
                      )}
                      {!isAdmin && (
                        <Button variant="outline" size="sm" onClick={() => navigate(streamUrl(stream))}>
                          Open
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {isAdmin && (
                  <CardContent className="grid gap-3 pt-0 md:grid-cols-2">
                    <div className="rounded-lg border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CircleCheck className="h-4 w-4 text-emerald-500" />
                          <p className="font-medium">Full access</p>
                        </div>
                        <Badge variant="outline">{fullAccessRules.length}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Can update and manage tasks</p>
                      <p className="mt-2 text-xs italic text-muted-foreground">
                        {fullAccessRules.length > 0
                          ? fullAccessRules.map((rule) => rule.role_name || rule.role).join(", ")
                          : "No full-access rules configured."}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium">Read-only</p>
                        </div>
                        <Badge variant="outline">{readOnlyRules.length}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Can view tasks in this stream</p>
                      <p className="mt-2 text-xs italic text-muted-foreground">
                        {readOnlyRules.length > 0
                          ? readOnlyRules.map((rule) => rule.role_name || rule.role).join(", ")
                          : "No read-only rules configured."}
                      </p>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {rootStreams.length > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Previous
          </Button>
          <Badge variant="outline">
            Page {page} / {totalPages}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          >
            Next
          </Button>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Stream" : "Create Stream"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Stream name"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Optional description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Color</Label>
                <Select
                  value={form.color}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, color: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select color" />
                  </SelectTrigger>
                  <SelectContent>
                    {STREAM_COLORS.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-block h-4 w-4 rounded-md"
                            style={{ backgroundColor: color.value }}
                          />
                          {color.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Icon</Label>
                <Input
                  value={form.icon}
                  onChange={(event) => setForm((prev) => ({ ...prev, icon: event.target.value }))}
                  placeholder="layers"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Parent stream</Label>
              <Select
                value={form.parent_id}
                onValueChange={(value) => setForm((prev) => ({ ...prev, parent_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(categories || [])
                    .filter((category) => category.id !== editing?.id)
                    .map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                onClick={submitForm}
                disabled={createStream.isPending || updateStream.isPending || !form.name.trim()}
              >
                {(createStream.isPending || updateStream.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!manageAccessFor} onOpenChange={(open) => !open && setManageAccessFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage access {manageAccessFor ? `- ${manageAccessFor.name}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select role</SelectItem>
                  {(roles || []).map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedAccessLevel}
                onValueChange={(value: "full" | "read_only") => setSelectedAccessLevel(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full</SelectItem>
                  <SelectItem value="read_only">Read only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button
                disabled={!manageAccessFor || selectedRole === "none" || addAccess.isPending}
                onClick={async () => {
                  const role = (roles || []).find((entry) => entry.id === selectedRole);
                  if (!manageAccessFor || !role) return;
                  await addAccess.mutateAsync({
                    category_id: manageAccessFor.id,
                    role_id: role.id,
                    role: role.name,
                    access_level: selectedAccessLevel,
                  });
                  setSelectedRole("none");
                  setSelectedAccessLevel("full");
                }}
              >
                Add rule
              </Button>
            </div>
            <div className="space-y-2">
              {((accessRules || []).filter(
                (rule) => rule.category_id === manageAccessFor?.id
              )).map((rule) => (
                <div key={rule.id} className="flex items-center justify-between rounded-md border p-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <span>{rule.role_name || rule.role}</span>
                    <Badge variant="outline">{rule.access_level}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAccess.mutate(rule.id)}
                    disabled={removeAccess.isPending}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
