import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Loader2,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Circle,
} from "lucide-react";
import {
  useProjectStatuses,
  useCreateProjectStatus,
  useUpdateProjectStatus,
  useDeleteProjectStatus,
  useReorderProjectStatuses,
  type ProjectStatus,
} from "@/hooks/useProjectStatuses";

const DEFAULT_COLORS = [
  "#8b5cf6", // violet - Planning
  "#3b82f6", // blue - In Progress
  "#f59e0b", // amber - On Hold
  "#22c55e", // green - Completed
  "#6b7280", // gray - Archived
  "#ef4444", // red
  "#ec4899", // pink
  "#14b8a6", // teal
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface StatusFormData {
  name: string;
  color: string;
  is_active: boolean;
  is_default: boolean;
}

const emptyForm: StatusFormData = {
  name: "",
  color: DEFAULT_COLORS[0],
  is_active: true,
  is_default: false,
};

export default function ProjectStatusSettings() {
  const { data: statuses = [], isLoading } = useProjectStatuses();
  const createMutation = useCreateProjectStatus();
  const updateMutation = useUpdateProjectStatus();
  const deleteMutation = useDeleteProjectStatus();
  const reorderMutation = useReorderProjectStatuses();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StatusFormData>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<ProjectStatus | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(status: ProjectStatus) {
    setEditingId(status.id);
    setForm({
      name: status.name,
      color: status.color || DEFAULT_COLORS[0],
      is_active: status.is_active ?? true,
      is_default: status.is_default ?? false,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;

    if (editingId) {
      await updateMutation.mutateAsync({
        id: editingId,
        name: form.name.trim(),
        slug: slugify(form.name),
        color: form.color,
        is_active: form.is_active,
        is_default: form.is_default,
      });
    } else {
      const maxSort = statuses.reduce(
        (max, s) => Math.max(max, s.sort_order ?? 0),
        -1,
      );
      await createMutation.mutateAsync({
        name: form.name.trim(),
        slug: slugify(form.name),
        color: form.color,
        sort_order: maxSort + 1,
      });
    }
    setDialogOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  async function moveStatus(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= statuses.length) return;
    const ids = statuses.map((s) => s.id);
    [ids[index], ids[newIndex]] = [ids[newIndex], ids[index]];
    await reorderMutation.mutateAsync(ids);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Project Statuses</CardTitle>
            <CardDescription>
              Configure the statuses available for projects. Drag to reorder the pipeline flow.
            </CardDescription>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Status
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : statuses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Circle className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">No statuses configured</p>
              <p className="text-sm">Add your first project status to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statuses.map((status, index) => (
                  <TableRow key={status.id}>
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell>
                      <div
                        className="h-6 w-6 rounded-full border"
                        style={{ backgroundColor: status.color || "#6b7280" }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{status.name}</TableCell>
                    <TableCell>
                      <code className="text-xs text-muted-foreground">{status.slug}</code>
                    </TableCell>
                    <TableCell>
                      {status.is_active ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {status.is_default && (
                        <Badge>Default</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={index === 0 || reorderMutation.isPending}
                          onClick={() => moveStatus(index, -1)}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={index === statuses.length - 1 || reorderMutation.isPending}
                          onClick={() => moveStatus(index, 1)}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(status)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteTarget(status)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Status" : "Add Status"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update this project status."
                : "Create a new project status for your pipeline."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="status-name">Name</Label>
              <Input
                id="status-name"
                placeholder="e.g. In Progress"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              {form.name && (
                <p className="text-xs text-muted-foreground">
                  Slug: <code>{slugify(form.name)}</code>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      form.color === c ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                  />
                ))}
                <Input
                  type="color"
                  className="h-8 w-8 p-0 border-0 cursor-pointer"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="status-active">Active</Label>
              <Switch
                id="status-active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, is_active: checked }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="status-default">Default</Label>
                <p className="text-xs text-muted-foreground">
                  Auto-assigned to new projects
                </p>
              </div>
              <Switch
                id="status-default"
                checked={form.is_default}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, is_default: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Save Changes" : "Create Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This status will be permanently removed. Projects currently using this status
              will need to be reassigned. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
