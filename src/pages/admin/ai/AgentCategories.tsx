/**
 * AI Agent Categories Management
 *
 * Admin interface for managing AI agent categories with CRUD operations.
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FolderOpen,
  Plus,
  RefreshCw,
  Edit,
  Trash2,
  Bot,
  LayoutGrid,
  List,
  CheckCircle2,
  XCircle,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  BarChart,
  Target,
  Package,
  CheckSquare,
  Folder,
} from "lucide-react";
import {
  useAIAgentCategoriesWithCounts,
  useCreateAIAgentCategory,
  useUpdateAIAgentCategory,
  useDeleteAIAgentCategory,
  useToggleAIAgentCategoryStatus,
  type AIAgentCategoryWithCounts,
  type CreateAIAgentCategoryInput,
} from "@/hooks/useAIAgentCategories";
import { toast } from "sonner";
import { format } from "date-fns";

const ICON_OPTIONS = [
  { value: "folder", label: "Folder", icon: Folder },
  { value: "bot", label: "Bot", icon: Bot },
  { value: "check-square", label: "Check Square", icon: CheckSquare },
  { value: "package", label: "Package", icon: Package },
  { value: "trending-up", label: "Trending Up", icon: TrendingUp },
  { value: "credit-card", label: "Credit Card", icon: CreditCard },
  { value: "alert-triangle", label: "Alert Triangle", icon: AlertTriangle },
  { value: "bar-chart", label: "Bar Chart", icon: BarChart },
  { value: "target", label: "Target", icon: Target },
];

function getIconComponent(iconName: string | null) {
  const iconOption = ICON_OPTIONS.find((opt) => opt.value === (iconName ?? "folder"));
  return iconOption?.icon ?? Folder;
}

export default function AgentCategories() {
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AIAgentCategoryWithCounts | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AIAgentCategoryWithCounts | null>(null);
  const [newCategory, setNewCategory] = useState<CreateAIAgentCategoryInput>({
    name: "",
    slug: "",
    description: "",
    icon: "folder",
    is_active: true,
    display_order: 0,
  });

  const { data: categories = [], isLoading, refetch } = useAIAgentCategoriesWithCounts();
  const createCategory = useCreateAIAgentCategory();
  const updateCategory = useUpdateAIAgentCategory();
  const deleteCategory = useDeleteAIAgentCategory();
  const toggleStatus = useToggleAIAgentCategoryStatus();

  const handleNameChange = (value: string, isEdit = false) => {
    if (isEdit && editingCategory) {
      setEditingCategory({ ...editingCategory, name: value });
    } else {
      const generatedSlug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
      setNewCategory({ ...newCategory, name: value, slug: generatedSlug });
    }
  };

  const handleCreateCategory = () => {
    if (!newCategory.name || !newCategory.slug) {
      toast.error("Please provide a category name");
      return;
    }
    createCategory.mutate(newCategory, {
      onSuccess: () => {
        toast.success("Category created successfully");
        setIsAddDialogOpen(false);
        setNewCategory({
          name: "",
          slug: "",
          description: "",
          icon: "folder",
          is_active: true,
          display_order: 0,
        });
      },
      onError: (error: Error) => {
        toast.error(`Failed to create category: ${error.message}`);
      },
    });
  };

  const handleUpdateCategory = () => {
    if (!editingCategory) return;
    updateCategory.mutate(
      {
        id: editingCategory.id,
        updates: {
          name: editingCategory.name,
          description: editingCategory.description ?? undefined,
          icon: editingCategory.icon ?? undefined,
          is_active: editingCategory.is_active ?? undefined,
          display_order: editingCategory.display_order ?? undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Category updated successfully");
          setEditingCategory(null);
        },
        onError: (error: Error) => {
          toast.error(`Failed to update category: ${error.message}`);
        },
      }
    );
  };

  const handleDeleteClick = (category: AIAgentCategoryWithCounts) => {
    if (category.agent_count > 0) {
      toast.error(
        "Cannot delete category with agents. Move or delete agents first."
      );
      return;
    }
    setDeleteTarget(category);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteCategory.mutate(
      { id: deleteTarget.id, slug: deleteTarget.slug },
      {
        onSuccess: () => {
          toast.success("Category deleted successfully");
          setDeleteTarget(null);
        },
        onError: (error: Error) => {
          toast.error(`Failed to delete category: ${error.message}`);
        },
      }
    );
  };

  const handleToggleStatus = (id: string, isActive: boolean) => {
    toggleStatus.mutate(
      { id, isActive },
      {
        onSuccess: () => {
          toast.success(`Category ${isActive ? "deactivated" : "activated"} successfully`);
        },
        onError: (error: Error) => {
          toast.error(`Failed to update status: ${error.message}`);
        },
      }
    );
  };

  const totalAgents = categories.reduce((sum, c) => sum + c.agent_count, 0);
  const activeAgents = categories.reduce((sum, c) => sum + c.active_agent_count, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agent Categories</h1>
          <p className="text-muted-foreground">Organize your AI agents into categories</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <FolderOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{categories.length}</p>
                <p className="text-sm text-muted-foreground">Total Categories</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-success/10 p-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {categories.filter((c) => c.is_active).length}
                </p>
                <p className="text-sm text-muted-foreground">Active Categories</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-info/10 p-2">
                <Bot className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalAgents}</p>
                <p className="text-sm text-muted-foreground">Total Agents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-500/10 p-2">
                <CheckCircle2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeAgents}</p>
                <p className="text-sm text-muted-foreground">Active Agents</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "cards" | "table")}>
          <TabsList>
            <TabsTrigger value="cards">
              <LayoutGrid className="mr-2 h-4 w-4" />
              Cards
            </TabsTrigger>
            <TabsTrigger value="table">
              <List className="mr-2 h-4 w-4" />
              Table
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {viewMode === "cards" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              Loading categories...
            </div>
          ) : categories.length === 0 ? (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              No categories found. Create your first category to get started.
            </div>
          ) : (
            categories.map((category) => {
              const IconComponent = getIconComponent(category.icon);
              return (
                <Card key={category.id} className="transition-shadow hover:shadow-lg">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <IconComponent className="h-5 w-5" />
                          {category.name}
                        </CardTitle>
                        <CardDescription className="mt-2">
                          {category.description || "No description"}
                        </CardDescription>
                      </div>
                      {category.is_active ? (
                        <Badge variant="default" className="bg-success">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-2xl font-bold">{category.agent_count}</p>
                          <p className="text-xs text-muted-foreground">Total Agents</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-2xl font-bold">{category.active_agent_count}</p>
                          <p className="text-xs text-muted-foreground">Active Agents</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Slug</p>
                        <p className="font-mono text-sm">{category.slug}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Last Updated</p>
                        <p className="text-sm">{format(new Date(category.updated_at ?? ""), "PPp")}</p>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setEditingCategory(category)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleStatus(category.id, category.is_active ?? false)}
                        >
                          {category.is_active ? (
                            <XCircle className="h-4 w-4" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteClick(category)}
                          disabled={category.agent_count > 0}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Categories</CardTitle>
            <CardDescription>{categories.length} categories total</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Icon</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Agents</TableHead>
                  <TableHead>Active Agents</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center">
                      Loading categories...
                    </TableCell>
                  </TableRow>
                ) : categories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No categories found
                    </TableCell>
                  </TableRow>
                ) : (
                  categories.map((category) => {
                    const IconComponent = getIconComponent(category.icon);
                    return (
                      <TableRow key={category.id}>
                        <TableCell>
                          <IconComponent className="h-4 w-4" />
                        </TableCell>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell className="font-mono text-sm">{category.slug}</TableCell>
                        <TableCell>{category.agent_count}</TableCell>
                        <TableCell>{category.active_agent_count}</TableCell>
                        <TableCell>{category.display_order}</TableCell>
                        <TableCell>
                          {category.is_active ? (
                            <Badge variant="default" className="bg-success">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingCategory(category)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleToggleStatus(category.id, category.is_active ?? false)
                              }
                            >
                              {category.is_active ? (
                                <XCircle className="h-4 w-4" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteClick(category)}
                              disabled={category.agent_count > 0}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Category</DialogTitle>
            <DialogDescription>
              Add a new category to organize your AI agents
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Category Name *</Label>
              <Input
                id="cat-name"
                placeholder="e.g., Financial Analysis"
                value={newCategory.name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-slug">Slug *</Label>
              <Input
                id="cat-slug"
                placeholder="e.g., financial_analysis"
                value={newCategory.slug}
                onChange={(e) => setNewCategory({ ...newCategory, slug: e.target.value })}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Used to identify the category in code
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea
                id="cat-desc"
                placeholder="Brief description of this category"
                value={newCategory.description ?? ""}
                onChange={(e) =>
                  setNewCategory({ ...newCategory, description: e.target.value })
                }
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select
                  value={newCategory.icon ?? "folder"}
                  onValueChange={(v) => setNewCategory({ ...newCategory, icon: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {opt.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-order">Display Order</Label>
                <Input
                  id="cat-order"
                  type="number"
                  value={newCategory.display_order ?? 0}
                  onChange={(e) =>
                    setNewCategory({
                      ...newCategory,
                      display_order: parseInt(e.target.value, 10) || 0,
                    })
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="active">Active</Label>
              <Switch
                id="active"
                checked={newCategory.is_active ?? true}
                onCheckedChange={(checked) =>
                  setNewCategory({ ...newCategory, is_active: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCategory} disabled={createCategory.isPending}>
              {createCategory.isPending ? "Creating..." : "Create Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>Update the category details</DialogDescription>
          </DialogHeader>
          {editingCategory && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Category Name *</Label>
                <Input
                  id="edit-name"
                  value={editingCategory.name}
                  onChange={(e) => handleNameChange(e.target.value, true)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-slug">Slug</Label>
                <Input
                  id="edit-slug"
                  value={editingCategory.slug}
                  disabled
                  className="font-mono opacity-50"
                />
                <p className="text-xs text-muted-foreground">
                  Slug cannot be changed after creation
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea
                  id="edit-desc"
                  value={editingCategory.description ?? ""}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <Select
                    value={editingCategory.icon ?? "folder"}
                    onValueChange={(v) =>
                      setEditingCategory({ ...editingCategory, icon: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        return (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {opt.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-order">Display Order</Label>
                  <Input
                    id="edit-order"
                    type="number"
                    value={editingCategory.display_order ?? 0}
                    onChange={(e) =>
                      setEditingCategory({
                        ...editingCategory,
                        display_order: parseInt(e.target.value, 10) || 0,
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-active">Active</Label>
                <Switch
                  id="edit-active"
                  checked={editingCategory.is_active ?? true}
                  onCheckedChange={(checked) =>
                    setEditingCategory({ ...editingCategory, is_active: checked })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCategory(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateCategory} disabled={updateCategory.isPending}>
              {updateCategory.isPending ? "Updating..." : "Update Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the category &quot;{deleteTarget?.name}&quot;. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
