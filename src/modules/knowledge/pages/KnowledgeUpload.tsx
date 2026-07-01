import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Upload, ArrowLeft, FileText, CheckCircle, AlertCircle, X } from "lucide-react";
import { toast } from "sonner";
import { useKnowledgeCategories } from "../hooks/useKnowledge";

interface UploadedFile {
  file: File;
  status: "pending" | "uploading" | "processing" | "completed" | "error";
  progress: number;
  error?: string;
  path?: string;
}

export default function KnowledgeUpload() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: categories } = useKnowledgeCategories();

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    // Filter for allowed file types
    const allowedTypes = [
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/markdown",
    ];

    const validFiles = selectedFiles.filter((file) => {
      if (!allowedTypes.includes(file.type) && !file.name.endsWith(".md")) {
        toast.error(`${file.name}: Unsupported file type`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: File size exceeds 10MB`);
        return false;
      }
      return true;
    });

    setFiles(
      validFiles.map((file) => ({
        file,
        status: "pending",
        progress: 0,
      }))
    );
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

  const uploadFile = async (uploadedFile: UploadedFile, index: number): Promise<string | null> => {
    if (!user) return null;

    try {
      // Update status to uploading
      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, status: "uploading", progress: 30 } : f))
      );

      // Upload to Supabase Storage
      const fileName = `${user.id}/${Date.now()}-${uploadedFile.file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("user-knowledge")
        .upload(fileName, uploadedFile.file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Update progress
      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, progress: 60, path: uploadData.path } : f))
      );

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("user-knowledge")
        .getPublicUrl(uploadData.path);

      return urlData.publicUrl;
    } catch (error: any) {
      console.error("Upload error:", error);
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "error", error: error.message } : f
        )
      );
      return null;
    }
  };

  const processFileWithEdgeFunction = async (
    fileUrl: string,
    fileName: string,
    index: number
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      // Update status to processing
      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, status: "processing", progress: 80 } : f))
      );

      // Call user-knowledge-upload edge function
      const { data, error } = await supabase.functions.invoke("user-knowledge-upload", {
        body: {
          file_url: fileUrl,
          file_name: fileName,
          user_id: user.id,
          title: formData.title || fileName,
          description: formData.description || null,
          category_id: formData.category || null,
          tags: formData.tags.length > 0 ? formData.tags : null,
        },
      });

      if (error) throw error;

      // Update to completed
      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, status: "completed", progress: 100 } : f))
      );

      return true;
    } catch (error: any) {
      console.error("Processing error:", error);
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? { ...f, status: "error", error: error.message || "Failed to process file" }
            : f
        )
      );
      return false;
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    if (!user) {
      toast.error("You must be logged in to upload files");
      return;
    }

    setUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const uploadedFile = files[i];

        // Upload file to storage
        const fileUrl = await uploadFile(uploadedFile, i);

        if (fileUrl) {
          // Process file with edge function
          await processFileWithEdgeFunction(fileUrl, uploadedFile.file.name, i);
        }
      }

      const successCount = files.filter((f) => f.status === "completed").length;
      const errorCount = files.filter((f) => f.status === "error").length;

      if (successCount > 0) {
        toast.success(`Successfully uploaded ${successCount} file(s)`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to upload ${errorCount} file(s)`);
      }

      if (errorCount === 0) {
        setTimeout(() => navigate("/knowledge"), 1500);
      }
    } catch (error: any) {
      console.error("Upload process error:", error);
      toast.error("Upload process failed");
    } finally {
      setUploading(false);
    }
  };

  const getStatusIcon = (status: UploadedFile["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case "uploading":
      case "processing":
        return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
      default:
        return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Upload Knowledge Files</h1>
          <p className="text-muted-foreground">
            Upload documents to automatically extract and index knowledge
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/knowledge")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Upload Form */}
      <Card>
        <CardHeader>
          <CardTitle>File Upload</CardTitle>
          <CardDescription>
            Supported formats: PDF, TXT, DOC, DOCX, MD (Max 10MB per file)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Input */}
          <div className="space-y-2">
            <Label htmlFor="file">Select Files</Label>
            <Input
              id="file"
              type="file"
              multiple
              onChange={handleFileChange}
              disabled={uploading}
              accept=".pdf,.txt,.doc,.docx,.md"
            />
          </div>

          {/* Metadata */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title (Optional)</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Custom title for uploaded files"
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use filename as title
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Add a description for these files"
                rows={3}
                disabled={uploading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category (Optional)</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value === "none" ? "" : value })}
                disabled={uploading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
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

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Add tags (press Enter)"
                  disabled={uploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddTag}
                  disabled={!tagInput.trim() || uploading}
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
                        disabled={uploading}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-3">
              <Label>Selected Files ({files.length})</Label>
              <div className="space-y-2">
                {files.map((uploadedFile, index) => (
                  <div key={index} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {getStatusIcon(uploadedFile.status)}
                        <div className="flex-1">
                          <p className="text-sm font-medium">{uploadedFile.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(uploadedFile.file.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          uploadedFile.status === "completed"
                            ? "default"
                            : uploadedFile.status === "error"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {uploadedFile.status}
                      </Badge>
                    </div>
                    {uploadedFile.status !== "pending" && uploadedFile.status !== "completed" && (
                      <Progress value={uploadedFile.progress} className="h-1" />
                    )}
                    {uploadedFile.error && (
                      <p className="text-xs text-destructive">{uploadedFile.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Button */}
          <div className="flex gap-2 pt-4">
            <Button onClick={handleUpload} disabled={files.length === 0 || uploading}>
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Files
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/knowledge")}
              disabled={uploading}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
