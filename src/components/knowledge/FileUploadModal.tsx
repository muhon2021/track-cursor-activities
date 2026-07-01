import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";

interface FileUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFilesSelected: (files: FileList) => void;
  title?: string;
  description?: string;
  acceptedTypes?: string;
  multiple?: boolean;
  maxFiles?: number;
}

export function FileUploadModal({
  open,
  onOpenChange,
  onFilesSelected,
  title = "Upload Files",
  description = "Upload PDFs, Word documents, text files, and more",
  acceptedTypes = ".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx",
  multiple = true,
  maxFiles = 10,
}: FileUploadModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const limitedFiles = multiple
      ? fileArray.slice(0, maxFiles)
      : fileArray.slice(0, 1);

    setSelectedFiles((prev) => {
      const newFiles = [...prev, ...limitedFiles];
      return newFiles.slice(0, maxFiles);
    });
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) return;

    const dataTransfer = new DataTransfer();
    selectedFiles.forEach((file) => dataTransfer.items.add(file));

    onFilesSelected(dataTransfer.files);
    setSelectedFiles([]);
    onOpenChange(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop Zone */}
          <div
            className={`relative rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple={multiple}
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
              accept={acceptedTypes}
            />
            <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
            <div className="mt-4 text-sm">
              <button
                type="button"
                className="font-semibold text-primary hover:text-primary/80"
                onClick={() => fileInputRef.current?.click()}
              >
                Click to upload
              </button>
              {" "}or drag and drop
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {acceptedTypes
                .split(",")
                .map((ext) => ext.trim().toUpperCase())
                .join(", ")}{" "}
              (max {maxFiles} files)
            </p>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">
                Selected Files ({selectedFiles.length})
              </h4>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-md bg-secondary p-2"
                  >
                    <div className="flex-1 truncate">
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0}
            >
              Upload {selectedFiles.length > 0 && `(${selectedFiles.length})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
