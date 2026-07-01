import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import {
  useKnowledgeEntry,
  useCreateKnowledgeEntry,
  useUpdateKnowledgeEntry,
  useKnowledgeCategories,
} from "../hooks/useKnowledge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Save,
  ArrowLeft,
  X,
  Eye,
  Code,
  Sparkles,
  Clock,
  FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function KnowledgeForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const { data: entry, isLoading: loadingEntry } = useKnowledgeEntry(id || "");
  const { data: categories } = useKnowledgeCategories();
  const createEntry = useCreateKnowledgeEntry();
  const updateEntry = useUpdateKnowledgeEntry();

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    summary: "",
    category: "",
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState("");
  const [viewMode, setViewMode] = useState<"edit" | "preview" | "split">("split");
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Load entry data
  useEffect(() => {
    if (entry && isEditing) {
      setFormData({
        title: entry.title,
        content: entry.content,
        summary: entry.summary || "",
        category: entry.category_id || "",
        tags: entry.tags || [],
      });
    }
  }, [entry, isEditing]);

  // Auto-save to localStorage (draft)
  useEffect(() => {
    if (!isEditing && formData.title) {
      const draftKey = "knowledge-draft";
      const draft = {
        ...formData,
        lastSaved: new Date().toISOString(),
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
      setLastSaved(new Date());
    }
  }, [formData, isEditing]);

  // Load draft on mount (only for new entries)
  useEffect(() => {
    if (!isEditing) {
      const draftKey = "knowledge-draft";
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          if (draft.title || draft.content) {
            const shouldLoad = window.confirm(
              "Found a saved draft. Would you like to load it?"
            );
            if (shouldLoad) {
              setFormData({
                title: draft.title || "",
                content: draft.content || "",
                summary: draft.summary || "",
                category: draft.category || "",
                tags: draft.tags || [],
              });
              setLastSaved(new Date(draft.lastSaved));
            } else {
              localStorage.removeItem(draftKey);
            }
          }
        } catch (error) {
          console.error("Failed to load draft:", error);
        }
      }
    }
  }, [isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error("Please fill in required fields");
      return;
    }

    try {
      if (isEditing) {
        await updateEntry.mutateAsync({
          id: id!,
          data: formData,
        });
      } else {
        await createEntry.mutateAsync(formData);
        // Clear draft on successful creation
        localStorage.removeItem("knowledge-draft");
      }
      navigate("/knowledge");
    } catch (error: any) {
      console.error("Submit error:", error);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()],
      });
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag) => tag !== tagToRemove),
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleGenerateSummary = async () => {
    if (!formData.content.trim()) {
      toast.error("Please add some content first");
      return;
    }

    setGeneratingSummary(true);
    try {
      // Get a default AI model for text generation
      const { data: models } = await supabase
        .from("ai_models")
        .select("*")
        .eq("enabled", true)
        .eq("is_default", true)
        .maybeSingle();

      if (!models) {
        toast.error("No default AI model configured");
        return;
      }

      // Call AI chat to generate summary
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          model_id: models.id,
          messages: [
            {
              role: "user",
              content: `Generate a concise 2-3 sentence summary of the following knowledge base article. Focus on the key points and main takeaways:\n\n${formData.content}`,
            },
          ],
        },
      });

      if (error) throw error;

      const summary = data?.response?.trim() || "";
      setFormData({ ...formData, summary });
      toast.success("Summary generated!");
    } catch (error: any) {
      console.error("Summary generation error:", error);
      toast.error("Failed to generate summary");
    } finally {
      setGeneratingSummary(false);
    }
  };

  const insertMarkdownSyntax = (syntax: string, placeholder = "") => {
    const textarea = document.getElementById("content") as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = formData.content.substring(start, end) || placeholder;
    const beforeText = formData.content.substring(0, start);
    const afterText = formData.content.substring(end);

    let newText = "";
    let cursorOffset = 0;

    switch (syntax) {
      case "bold":
        newText = `${beforeText}**${selectedText}**${afterText}`;
        cursorOffset = start + 2;
        break;
      case "italic":
        newText = `${beforeText}_${selectedText}_${afterText}`;
        cursorOffset = start + 1;
        break;
      case "link":
        newText = `${beforeText}[${selectedText}](url)${afterText}`;
        cursorOffset = start + selectedText.length + 3;
        break;
      case "code":
        newText = `${beforeText}\`${selectedText}\`${afterText}`;
        cursorOffset = start + 1;
        break;
      case "codeblock":
        newText = `${beforeText}\n\`\`\`\n${selectedText}\n\`\`\`\n${afterText}`;
        cursorOffset = start + 4;
        break;
      case "h1":
        newText = `${beforeText}# ${selectedText}${afterText}`;
        cursorOffset = start + 2;
        break;
      case "h2":
        newText = `${beforeText}## ${selectedText}${afterText}`;
        cursorOffset = start + 3;
        break;
      case "h3":
        newText = `${beforeText}### ${selectedText}${afterText}`;
        cursorOffset = start + 4;
        break;
      case "ul":
        newText = `${beforeText}- ${selectedText}${afterText}`;
        cursorOffset = start + 2;
        break;
      case "ol":
        newText = `${beforeText}1. ${selectedText}${afterText}`;
        cursorOffset = start + 3;
        break;
      default:
        return;
    }

    setFormData({ ...formData, content: newText });

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorOffset, cursorOffset);
    }, 0);
  };

  if (isEditing && loadingEntry) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditing ? "Edit Knowledge Entry" : "Add Knowledge Entry"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing
              ? "Update your knowledge entry"
              : "Create a new knowledge entry with markdown support"}
          </p>
        </div>
        <div className="flex gap-2">
          {lastSaved && !isEditing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Draft saved {lastSaved.toLocaleTimeString()}</span>
            </div>
          )}
          <Button variant="outline" onClick={() => navigate("/knowledge")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title & Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Entry Details</CardTitle>
            <CardDescription>Basic information about your entry</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Enter entry title"
                required
                disabled={createEntry.isPending || updateEntry.isPending}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value === "none" ? "" : value })
                }
                disabled={createEntry.isPending || updateEntry.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Category</SelectItem>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Summary */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="summary">Summary</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateSummary}
                  disabled={
                    generatingSummary ||
                    !formData.content.trim() ||
                    createEntry.isPending ||
                    updateEntry.isPending
                  }
                >
                  {generatingSummary ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-3 w-3" />
                  )}
                  Generate with AI
                </Button>
              </div>
              <Textarea
                id="summary"
                value={formData.summary}
                onChange={(e) =>
                  setFormData({ ...formData, summary: e.target.value })
                }
                placeholder="Brief summary of the entry (optional)"
                rows={3}
                disabled={createEntry.isPending || updateEntry.isPending}
              />
              <p className="text-xs text-muted-foreground">
                A concise summary helps users quickly understand the content
              </p>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <div className="flex gap-2">
                <Input
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Add tags (press Enter)"
                  disabled={createEntry.isPending || updateEntry.isPending}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddTag}
                  disabled={
                    !tagInput.trim() ||
                    createEntry.isPending ||
                    updateEntry.isPending
                  }
                >
                  Add
                </Button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-destructive"
                        disabled={
                          createEntry.isPending || updateEntry.isPending
                        }
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

        {/* Content Editor */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  Content <span className="text-destructive">*</span>
                </CardTitle>
                <CardDescription>
                  Write your content using Markdown formatting
                </CardDescription>
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant={viewMode === "edit" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("edit")}
                >
                  <Code className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "preview" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("preview")}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "split" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("split")}
                >
                  Split
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Markdown Toolbar */}
            <div className="mb-4 flex flex-wrap gap-1 rounded-lg border bg-muted/50 p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdownSyntax("h1", "Heading 1")}
                title="Heading 1"
              >
                H1
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdownSyntax("h2", "Heading 2")}
                title="Heading 2"
              >
                H2
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdownSyntax("h3", "Heading 3")}
                title="Heading 3"
              >
                H3
              </Button>
              <div className="w-px bg-border" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdownSyntax("bold", "bold text")}
                title="Bold"
                className="font-bold"
              >
                B
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdownSyntax("italic", "italic text")}
                title="Italic"
                className="italic"
              >
                I
              </Button>
              <div className="w-px bg-border" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdownSyntax("code", "code")}
                title="Inline Code"
              >
                <Code className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdownSyntax("codeblock", "code block")}
                title="Code Block"
              >
                <FileDown className="h-4 w-4" />
              </Button>
              <div className="w-px bg-border" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdownSyntax("ul", "list item")}
                title="Bullet List"
              >
                UL
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdownSyntax("ol", "list item")}
                title="Numbered List"
              >
                OL
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdownSyntax("link", "link text")}
                title="Link"
              >
                Link
              </Button>
            </div>

            {/* Editor/Preview */}
            <div
              className={`grid gap-4 ${
                viewMode === "split" ? "lg:grid-cols-2" : ""
              }`}
            >
              {/* Editor */}
              {(viewMode === "edit" || viewMode === "split") && (
                <div className="space-y-2">
                  {viewMode === "split" && (
                    <Label className="text-xs text-muted-foreground">
                      Markdown Editor
                    </Label>
                  )}
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) =>
                      setFormData({ ...formData, content: e.target.value })
                    }
                    placeholder="# Getting Started

Write your content here using Markdown...

## Features
- Lists
- **Bold** and _italic_ text
- `Code blocks`
- And more!"
                    rows={20}
                    required
                    disabled={createEntry.isPending || updateEntry.isPending}
                    className="font-mono text-sm"
                  />
                </div>
              )}

              {/* Preview */}
              {(viewMode === "preview" || viewMode === "split") && (
                <div className="space-y-2">
                  {viewMode === "split" && (
                    <Label className="text-xs text-muted-foreground">
                      Live Preview
                    </Label>
                  )}
                  <div className="rounded-lg border bg-background p-6 min-h-[500px]">
                    {formData.content ? (
                      <article className="prose prose-slate dark:prose-invert max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeHighlight, rehypeRaw]}
                        >
                          {formData.content}
                        </ReactMarkdown>
                      </article>
                    ) : (
                      <p className="text-muted-foreground text-center py-12">
                        Start typing to see the preview...
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={createEntry.isPending || updateEntry.isPending}
          >
            {(createEntry.isPending || updateEntry.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <Save className="mr-2 h-4 w-4" />
            {isEditing ? "Update Entry" : "Create Entry"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/knowledge")}
            disabled={createEntry.isPending || updateEntry.isPending}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
