import { useState } from 'react';
import { Plus, Edit2, Trash2, FolderTree, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  useCategoryTree,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useEmbeddingStats,
} from '@/modules/knowledge/hooks/useKnowledgeAdmin';
import type { Database } from '@/integrations/supabase/types';

type KnowledgeCategory = Database['public']['Tables']['knowledge_categories']['Row'];
type CategoryWithStats = KnowledgeCategory & {
  stats?: {
    entry_count: number;
    published_count: number;
    draft_count: number;
    total_views: number;
  };
  children?: CategoryWithStats[];
};

// Common category icons
const CATEGORY_ICONS = [
  { value: 'FolderTree', label: 'Folder' },
  { value: 'Book', label: 'Book' },
  { value: 'FileText', label: 'Document' },
  { value: 'Code', label: 'Code' },
  { value: 'Database', label: 'Database' },
  { value: 'Settings', label: 'Settings' },
  { value: 'Users', label: 'Users' },
  { value: 'Zap', label: 'Integration' },
  { value: 'Shield', label: 'Security' },
  { value: 'HelpCircle', label: 'Help' },
];

// Color palette for categories
const CATEGORY_COLORS = [
  { value: 'blue', class: 'bg-info' },
  { value: 'green', class: 'bg-success' },
  { value: 'yellow', class: 'bg-warning' },
  { value: 'red', class: 'bg-destructive' },
  { value: 'purple', class: 'bg-purple-500' },
  { value: 'pink', class: 'bg-pink-500' },
  { value: 'indigo', class: 'bg-indigo-500' },
  { value: 'orange', class: 'bg-orange-500' },
  { value: 'teal', class: 'bg-teal-500' },
  { value: 'cyan', class: 'bg-cyan-500' },
];

interface CategoryFormData {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  parent_id: string | null;
}

export default function KnowledgeCategories() {
  const { data: categoryTree = [], flatData: categories = [], isLoading } = useCategoryTree();
  const { data: embeddingStats } = useEmbeddingStats();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryWithStats | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<CategoryWithStats | null>(null);

  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    slug: '',
    description: '',
    icon: 'FolderTree',
    color: 'blue',
    parent_id: null,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      icon: 'FolderTree',
      color: 'blue',
      parent_id: null,
    });
    setEditingCategory(null);
  };

  const handleOpenDialog = (category?: CategoryWithStats) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        slug: category.slug,
        description: category.description || '',
        icon: category.icon || 'FolderTree',
        color: category.color || 'blue',
        parent_id: category.parent_id,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setTimeout(resetForm, 200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingCategory) {
      await updateCategory.mutateAsync({
        id: editingCategory.id,
        updates: formData,
      });
    } else {
      await createCategory.mutateAsync(formData);
    }

    handleCloseDialog();
  };

  const handleDelete = async () => {
    if (deletingCategory) {
      await deleteCategory.mutateAsync(deletingCategory.id);
      setIsDeleteDialogOpen(false);
      setDeletingCategory(null);
    }
  };

  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    setFormData((prev) => ({ ...prev, name, slug }));
  };

  const renderCategoryTree = (items: CategoryWithStats[], level = 0) => {
    return items.map((category) => (
      <div key={category.id} className="space-y-2">
        <Card className={`p-4 ${level > 0 ? 'ml-8' : ''}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div
                className={`w-10 h-10 rounded-lg ${
                  CATEGORY_COLORS.find((c) => c.value === category.color)
                    ?.class || 'bg-muted/500'
                } flex items-center justify-center text-primary-foreground`}
              >
                <FolderTree className="w-5 h-5" />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{category.name}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {category.slug}
                  </Badge>
                </div>
                {category.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {category.description}
                  </p>
                )}
              </div>

              {category.stats && (
                <div className="flex gap-6 text-sm">
                  <div className="text-center">
                    <div className="font-semibold">
                      {category.stats.entry_count}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Entries
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold">
                      {category.stats.total_views}
                    </div>
                    <div className="text-muted-foreground text-xs">Views</div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleOpenDialog(category)}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setDeletingCategory(category);
                  setIsDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {category.children && category.children.length > 0 && (
          <div>{renderCategoryTree(category.children, level + 1)}</div>
        )}
      </div>
    ));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading categories...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Knowledge Categories</h1>
          <p className="text-muted-foreground mt-1">
            Organize your knowledge base with categories and subcategories
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          New Category
        </Button>
      </div>

      {/* Stats Cards */}
      {embeddingStats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm font-medium">Total Entries</div>
            </div>
            <div className="text-2xl font-bold mt-2">
              {embeddingStats.total}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm font-medium text-muted-foreground">
              Completed
            </div>
            <div className="text-2xl font-bold mt-2 text-success">
              {embeddingStats.completed}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm font-medium text-muted-foreground">
              Pending
            </div>
            <div className="text-2xl font-bold mt-2 text-warning">
              {embeddingStats.pending}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm font-medium text-muted-foreground">
              Processing
            </div>
            <div className="text-2xl font-bold mt-2 text-info">
              {embeddingStats.processing}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm font-medium text-muted-foreground">
              Failed
            </div>
            <div className="text-2xl font-bold mt-2 text-destructive">
              {embeddingStats.failed}
            </div>
          </Card>
        </div>
      )}

      {/* Category Tree */}
      <div className="space-y-4">
        {categoryTree.length === 0 ? (
          <Card className="p-12 text-center">
            <FolderTree className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No categories yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first category to organize your knowledge base
            </p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Create Category
            </Button>
          </Card>
        ) : (
          renderCategoryTree(categoryTree)
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </DialogTitle>
              <DialogDescription>
                {editingCategory
                  ? 'Update the category details below'
                  : 'Add a new category to organize your knowledge base'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Technical Documentation"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, slug: e.target.value }))
                  }
                  placeholder="technical-documentation"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  URL-friendly identifier (auto-generated from name)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Brief description of this category..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="icon">Icon</Label>
                  <Select
                    value={formData.icon}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, icon: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_ICONS.map((icon) => (
                        <SelectItem key={icon.value} value={icon.value}>
                          {icon.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <Select
                    value={formData.color}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, color: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_COLORS.map((color) => (
                        <SelectItem key={color.value} value={color.value}>
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-4 h-4 rounded ${color.class}`}
                            />
                            {color.value}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="parent">Parent Category (Optional)</Label>
                <Select
                  value={formData.parent_id || 'none'}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      parent_id: value === 'none' ? null : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None (Top Level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Top Level)</SelectItem>
                    {categories
                      .filter((c) => c.id !== editingCategory?.id)
                      .map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createCategory.isPending || updateCategory.isPending}
              >
                {editingCategory ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the category "
              {deletingCategory?.name}". This action cannot be undone.
              {deletingCategory?.stats &&
                deletingCategory.stats.entry_count > 0 && (
                  <span className="block mt-2 font-semibold text-destructive">
                    Warning: This category has{' '}
                    {deletingCategory.stats.entry_count} entries. Please
                    reassign them first.
                  </span>
                )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
