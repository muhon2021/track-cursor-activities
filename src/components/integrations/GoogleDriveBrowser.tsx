/**
 * Google Drive File Browser Component
 * Displays files and folders from user's Google Drive
 */

import { useState } from "react";
import { useDriveFiles, type DriveFile } from "@/hooks/useUserIntegrations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Folder, 
  File, 
  ArrowLeft, 
  ExternalLink, 
  Loader2, 
  RefreshCw,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  FileSpreadsheet,
  Presentation,
  Download,
  Eye,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface GoogleDriveBrowserProps {
  className?: string;
}

export function GoogleDriveBrowser({ className }: GoogleDriveBrowserProps) {
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [folderStack, setFolderStack] = useState<Array<{ id: string; name: string }>>([]);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const { toast } = useToast();
  
  const { data, isLoading, error, refetch } = useDriveFiles(currentFolderId);

  const handleFolderClick = (folder: DriveFile) => {
    setFolderStack([...folderStack, { id: folder.id, name: folder.name }]);
    setCurrentFolderId(folder.id);
  };

  const handleBackClick = () => {
    const newStack = [...folderStack];
    newStack.pop();
    setFolderStack(newStack);
    setCurrentFolderId(newStack.length > 0 ? newStack[newStack.length - 1].id : undefined);
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return <ImageIcon className="h-5 w-5 text-blue-500" />;
    if (mimeType.startsWith("video/")) return <Video className="h-5 w-5 text-purple-500" />;
    if (mimeType.startsWith("audio/")) return <Music className="h-5 w-5 text-green-500" />;
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
    if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return <Presentation className="h-5 w-5 text-orange-500" />;
    if (mimeType.includes("pdf")) return <FileText className="h-5 w-5 text-red-500" />;
    if (mimeType.includes("zip") || mimeType.includes("archive")) return <Archive className="h-5 w-5 text-yellow-500" />;
    if (mimeType.startsWith("application/vnd.google-apps")) return <FileText className="h-5 w-5 text-blue-600" />;
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const formatFileSize = (size?: string) => {
    if (!size) return "Unknown size";
    const bytes = parseInt(size, 10);
    if (isNaN(bytes)) return size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const handleDownload = async (file: DriveFile) => {
    setDownloadingFileId(file.id);
    try {
      // Get session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      // Get Supabase URL from environment
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error("Supabase URL not configured");
      }

      // Call the backend endpoint to download the file
      const response = await fetch(
        `${supabaseUrl}/functions/v1/user-drive-download`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file_id: file.id,
            mime_type: file.mimeType,
            file_name: file.name,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Download failed: ${errorText}`);
      }

      // Get the blob and create a download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      // Determine filename with proper extension
      let filename = file.name;
      if (file.mimeType.startsWith("application/vnd.google-apps")) {
        const extensionMap: Record<string, string> = {
          "application/vnd.google-apps.document": ".docx",
          "application/vnd.google-apps.spreadsheet": ".xlsx",
          "application/vnd.google-apps.presentation": ".pptx",
          "application/vnd.google-apps.drawing": ".png",
        };
        const ext = extensionMap[file.mimeType] || ".pdf";
        if (!filename.endsWith(ext)) {
          filename = filename.replace(/\.[^/.]+$/, "") + ext;
        }
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download started",
        description: `Downloading ${file.name}...`,
      });
    } catch (err: any) {
      console.error("Download error:", err);
      toast({
        title: "Download failed",
        description: err.message || "Failed to download file",
        variant: "destructive",
      });
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handleView = (file: DriveFile) => {
    if (file.webViewLink) {
      window.open(file.webViewLink, "_blank");
    }
  };

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Google Drive Files</CardTitle>
          <CardDescription>Error loading files</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load Google Drive files"}
          </div>
          <Button onClick={() => refetch()} variant="outline" className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Google Drive Files
            </CardTitle>
            <CardDescription>
              {folderStack.length > 0 
                ? `Browsing: ${folderStack.map(f => f.name).join(" / ")}`
                : "Browse your Google Drive files and folders"}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {folderStack.length > 0 && (
              <Button onClick={handleBackClick} variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
            <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Folders */}
            {data.folders && data.folders.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Folders</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => handleFolderClick(folder)}
                      className="flex items-center gap-3 p-3 rounded-lg border-2 border-transparent hover:border-primary/50 hover:bg-muted/50 transition-all text-left group"
                    >
                      <Folder className="h-8 w-8 text-blue-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate group-hover:text-primary">
                          {folder.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Folder
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            {data.files && data.files.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                  Files {data.files.length > 0 && `(${data.files.length})`}
                </h3>
                <div className="space-y-2">
                  {data.files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex-shrink-0">
                        {getFileIcon(file.mimeType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{file.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </span>
                          {file.modifiedTime && (
                            <>
                              <span className="text-xs text-muted-foreground">•</span>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(file.modifiedTime), { addSuffix: true })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {file.mimeType && (
                          <Badge variant="secondary" className="text-xs">
                            {file.mimeType.split("/")[1]?.split(".")[0] || "file"}
                          </Badge>
                        )}
                        <div className="flex items-center gap-1">
                          {file.webViewLink && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(file)}
                              className="h-8 w-8 p-0"
                              title="View file"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(file)}
                            disabled={downloadingFileId === file.id}
                            className="h-8 w-8 p-0"
                            title="Download file"
                          >
                            {downloadingFileId === file.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {(!data.folders || data.folders.length === 0) && 
             (!data.files || data.files.length === 0) && (
              <div className="text-center py-12">
                <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">
                  {folderStack.length > 0 
                    ? "This folder is empty"
                    : "No files or folders found in your Google Drive"}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

