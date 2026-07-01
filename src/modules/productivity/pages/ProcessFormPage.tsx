/**
 * Process Form Page - Create and edit process documents
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Loader2, Save, Tag, Trash2, X } from "lucide-react";
import {
  useProcessCategories,
  useProcessDocument,
  useCreateProcessDocument,
  useUpdateProcessDocument,
  useDeleteProcessDocument,
} from "../hooks/useProcesses";

export default function ProcessFormPage() {
  const { category, slug } = useParams<{ category?: string; slug?: string }>();
  const navigate = useNavigate();
  const isEdit = !!slug;

  const { data: categories = [] } = useProcessCategories();
  const { data: existingDoc, isLoading: loadingDoc } = useProcessDocument(
    category || "",
    slug || ""
  );
  const createDoc = useCreateProcessDocument();
  const updateDoc = useUpdateProcessDocument();
  const deleteDoc = useDeleteProcessDocument();

  const [form, setForm] = useState({
    title: "",
    content: "",
    category_id: "",
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState("");

  // Populate form when editing
  useEffect(() => {
    if (isEdit && existingDoc) {
      setForm({
        title: existingDoc.title,
        content: existingDoc.content || "",
        category_id: existingDoc.category_id,
        tags: existingDoc.tags || [],
      });
    }
  }, [isEdit, existingDoc]);

  // Pre-select category from URL param
  useEffect(() => {
    if (!isEdit && category && categories.length > 0) {
      const cat = categories.find((c) => c.slug === category);
      if (cat) setForm((f) => ({ ...f, category_id: cat.id }));
    }
  }, [isEdit, category, categories]);

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !form.tags.includes(tag)) {
      setForm((f) => ({ ...f, tags: [...f.tags, tag] }));
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));
  };

  const handleSubmit = () => {
    if (!form.title.trim() || !form.category_id) return;

    if (isEdit && existingDoc) {
      updateDoc.mutate(
        {
          id: existingDoc.id,
          data: {
            title: form.title,
            content: form.content || undefined,
            tags: form.tags,
            category_id: form.category_id,
          },
        },
        {
          onSuccess: () =>
            navigate(`/process/${category}/${slug}`),
        }
      );
    } else {
      createDoc.mutate(
        {
          category_id: form.category_id,
          title: form.title,
          content: form.content || undefined,
          tags: form.tags.length > 0 ? form.tags : undefined,
        },
        {
          onSuccess: () => {
            const cat = categories.find((c) => c.id === form.category_id);
            navigate(cat ? `/process/${cat.slug}` : "/process");
          },
        }
      );
    }
  };

  const handleDelete = () => {
    if (!existingDoc) return;
    deleteDoc.mutate(existingDoc.id, {
      onSuccess: () => navigate(category ? `/process/${category}` : "/process"),
    });
  };

  const backPath = isEdit
    ? `/process/${category}/${slug}`
    : category
      ? `/process/${category}`
      : "/process";

  if (isEdit && loadingDoc) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isEdit && !existingDoc && !loadingDoc) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">Document not found</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate("/process")}
        >
          Back to Processes
        </Button>
      </div>
    );
  }

  const isPending = createDoc.isPending || updateDoc.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(backPath)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {isEdit ? "Edit Document" : "New Process Document"}
          </h1>
          <p className="text-muted-foreground">
            {isEdit
              ? "Update this process document"
              : "Create a new standard operating procedure"}
          </p>
        </div>
        {isEdit && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete document?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete "{existingDoc?.title}". This
                  action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDelete}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Document Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Category *</Label>
            <Select
              value={form.category_id}
              onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Title *</Label>
            <Input
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="e.g., Employee Onboarding Process"
            />
          </div>

          <div>
            <Label>Content</Label>
            <Textarea
              value={form.content}
              onChange={(e) =>
                setForm((f) => ({ ...f, content: e.target.value }))
              }
              placeholder="Write the process documentation..."
              rows={16}
              className="font-mono text-sm"
            />
          </div>

          <div>
            <Label>Tags</Label>
            <div className="flex items-center gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add a tag and press Enter"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTag}
                disabled={!tagInput.trim()}
              >
                <Tag className="h-4 w-4" />
              </Button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {form.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs gap-1">
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-0.5 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(backPath)}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!form.title.trim() || !form.category_id || isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          {isPending
            ? "Saving..."
            : isEdit
              ? "Update Document"
              : "Create Document"}
        </Button>
      </div>
    </div>
  );
}
