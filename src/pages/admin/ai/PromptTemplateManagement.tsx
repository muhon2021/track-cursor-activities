/**
 * Prompt Template Management – Admin AI Hub.
 * Route: /admin/ai/prompt-templates
 * Create and manage reusable AI prompt templates with placeholders (e.g. {{variable}}).
 */
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  FileText,
  LayoutDashboard,
  Mail,
  Plus,
  Pencil,
  Copy,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  usePromptTemplates,
  usePromptTemplateStats,
  useCreatePromptTemplate,
  useUpdatePromptTemplate,
  useDeletePromptTemplate,
  useDuplicatePromptTemplate,
  type PromptTemplate,
  type PromptTemplateFormData,
} from "@/hooks/usePromptTemplates";

const CATEGORY_OPTIONS = [
  "General Purpose",
  "Email Generation",
  "Follow-up",
  "Meeting Summary",
  "Deal Coaching",
];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function PromptTemplateManagement() {
  const { data: templates = [], isLoading } = usePromptTemplates();
  const stats = usePromptTemplateStats(templates);
  const createTemplate = useCreatePromptTemplate();
  const updateTemplate = useUpdatePromptTemplate();
  const deleteTemplate = useDeletePromptTemplate();
  const duplicateTemplate = useDuplicatePromptTemplate();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<PromptTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PromptTemplate | null>(null);
  const [formData, setFormData] = useState<PromptTemplateFormData>({
    name: "",
    slug: "",
    description: "",
    category: "General Purpose",
    template_content: "",
    is_active: true,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      description: "",
      category: "General Purpose",
      template_content: "",
      is_active: true,
    });
    setEditTemplate(null);
  };

  const handleCreateOpen = () => {
    resetForm();
    setCreateOpen(true);
  };

  const handleEditOpen = (t: PromptTemplate) => {
    setEditTemplate(t);
    setFormData({
      name: t.name,
      slug: t.slug,
      description: t.description ?? "",
      category: t.category,
      template_content: t.template_content,
      is_active: t.is_active,
    });
  };

  const handleCreateSubmit = () => {
    if (!formData.name.trim() || !formData.template_content.trim()) return;
    createTemplate.mutate(
      {
        ...formData,
        slug: formData.slug.trim() || formData.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      },
      {
        onSuccess: () => {
          setCreateOpen(false);
          resetForm();
        },
      }
    );
  };

  const handleUpdateSubmit = () => {
    if (!editTemplate || !formData.name.trim() || !formData.template_content.trim()) return;
    updateTemplate.mutate(
      {
        id: editTemplate.id,
        data: {
          ...formData,
          slug: formData.slug.trim() || formData.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        },
      },
      {
        onSuccess: () => {
          setEditTemplate(null);
          resetForm();
        },
      }
    );
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteTemplate.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const slugFromName = useMemo(() => {
    return formData.name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }, [formData.name]);

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/dashboard">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/admin">Admin</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/admin/ai/agents">Ai</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Prompt Templates</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header: title, subtitle, Back to Dashboard, Create Template */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Prompt Template Management</h1>
          <p className="mt-1 text-muted-foreground">
            Create and manage reusable AI prompt templates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
          <Button onClick={handleCreateOpen} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Template
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Templates</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{isLoading ? "—" : stats.total}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Templates</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-success dark:text-green-400">
              {isLoading ? "—" : stats.active}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Usage</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{isLoading ? "—" : stats.totalUsage}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Categories</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{isLoading ? "—" : stats.categories}</span>
          </CardContent>
        </Card>
      </div>

      {/* Template list */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <p className="mt-2 font-medium">No templates yet</p>
              <p className="text-sm text-muted-foreground">
                Create a reusable prompt template to get started.
              </p>
              <Button onClick={handleCreateOpen} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          templates.map((template) => (
            <Card key={template.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-muted p-2">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription className="mt-0.5">
                        {template.description || "No description."}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={template.is_active ? "default" : "secondary"} className="shrink-0">
                    {template.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                  <span>
                    <strong className="text-foreground">Category:</strong> {template.category}
                  </span>
                  <span>
                    <strong className="text-foreground">Usage Count:</strong> {template.usage_count} times
                  </span>
                  <span>
                    <strong className="text-foreground">Created:</strong> {formatDate(template.created_at)}
                  </span>
                  <span>
                    <strong className="text-foreground">Template Size:</strong> {template.template_content.length} chars
                  </span>
                </div>
                <div>
                  <p className="mb-1.5 text-sm font-medium text-muted-foreground">Template Preview</p>
                  <pre className="rounded-md border bg-muted/50 p-3 text-sm overflow-x-auto whitespace-pre-wrap">
                    {template.template_content}
                  </pre>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditOpen(template)}
                    className="flex items-center gap-2"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => duplicateTemplate.mutate(template)}
                    className="flex items-center gap-2"
                    disabled={duplicateTemplate.isPending}
                  >
                    <Copy className="h-4 w-4" />
                    Duplicate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(template)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Template Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
            <DialogDescription>
              Design a reusable prompt template for AI agents.
            </DialogDescription>
          </DialogHeader>
          <TemplateForm
            formData={formData}
            setFormData={setFormData}
            slugSuggest={slugFromName}
            categoryOptions={CATEGORY_OPTIONS}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSubmit}
              disabled={!formData.name.trim() || !formData.template_content.trim() || createTemplate.isPending}
            >
              {createTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={!!editTemplate} onOpenChange={(open) => !open && (setEditTemplate(null), resetForm())}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Update this reusable prompt template.
            </DialogDescription>
          </DialogHeader>
          <TemplateForm
            formData={formData}
            setFormData={setFormData}
            slugSuggest={slugFromName}
            categoryOptions={CATEGORY_OPTIONS}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditTemplate(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateSubmit}
              disabled={!formData.name.trim() || !formData.template_content.trim() || updateTemplate.isPending}
            >
              {updateTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteTarget?.name}&quot;. This action cannot be undone.
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

function TemplateForm({
  formData,
  setFormData,
  slugSuggest,
  categoryOptions,
}: {
  formData: PromptTemplateFormData;
  setFormData: React.Dispatch<React.SetStateAction<PromptTemplateFormData>>;
  slugSuggest: string;
  categoryOptions: string[];
}) {
  return (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="template-name">Template Name (required)</Label>
          <Input
            id="template-name"
            placeholder="e.g., B2B Email Expert"
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="template-slug">Slug</Label>
          <Input
            id="template-slug"
            placeholder="e.g., b2b-email-expert"
            value={formData.slug}
            onChange={(e) => setFormData((p) => ({ ...p, slug: e.target.value }))}
          />
          {slugSuggest && !formData.slug && (
            <p className="text-xs text-muted-foreground">Suggested: {slugSuggest}</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="template-description">Description</Label>
        <Textarea
          id="template-description"
          placeholder="Describe what this template does..."
          value={formData.description}
          onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
          rows={2}
          className="resize-y"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="template-category">Category</Label>
        <Select
          value={formData.category}
          onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}
        >
          <SelectTrigger id="template-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="template-content">Template Content (required)</Label>
        <Textarea
          id="template-content"
          placeholder="Enter your prompt template here..."
          value={formData.template_content}
          onChange={(e) => setFormData((p) => ({ ...p, template_content: e.target.value }))}
          rows={6}
          className="resize-y font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Use placeholders like {"{{recipient_name}}"} or {"{{topic}}"} for variable substitution.
        </p>
      </div>
    </div>
  );
}
