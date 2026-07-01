import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Trash2,
  RefreshCw,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Download,
  Filter,
} from "lucide-react";
import { formatBytes, formatDateTime } from "@/lib/utils";

interface KnowledgeFile {
  id: string;
  category_id: string | null;
  source_id: string | null;
  title: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  storage_path: string | null;
  processing_status: string;
  chunk_count: number | null;
  processing_error: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

export default function KnowledgeFiles() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch files
  const { data: files = [], isLoading } = useQuery({
    queryKey: ["admin", "knowledge-files", searchQuery, statusFilter, sourceFilter],
    queryFn: async () => {
      let query = supabase
        .from("knowledge_files")
        .select(`
          *,
          knowledge_categories(name, slug),
          knowledge_sources(name)
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      if (searchQuery) {
        query = query.or(
          `title.ilike.%${searchQuery}%,file_name.ilike.%${searchQuery}%`
        );
      }

      if (statusFilter !== "all") {
        query = query.eq("processing_status", statusFilter);
      }

      if (sourceFilter !== "all") {
        query = query.eq("source_id", sourceFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as KnowledgeFile[];
    },
  });

  // Fetch sources for filter
  const { data: sources = [] } = useQuery({
    queryKey: ["admin", "knowledge-sources-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_sources")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  // Delete file mutation
  const deleteFile = useMutation({
    mutationFn: async (fileId: string) => {
      // Delete from storage if storage_path exists
      const file = files.find((f) => f.id === fileId);
      if (file?.storage_path) {
        await supabase.storage.from("knowledge").remove([file.storage_path]);
      }

      // Delete database record
      const { error } = await supabase
        .from("knowledge_files")
        .delete()
        .eq("id", fileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "knowledge-files"] });
      toast({ title: "Success", description: "File deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Bulk delete mutation
  const bulkDelete = useMutation({
    mutationFn: async (fileIds: string[]) => {
      const filesToDelete = files.filter((f) => fileIds.includes(f.id));

      // Delete from storage
      const storagePaths = filesToDelete
        .filter((f) => f.storage_path)
        .map((f) => f.storage_path!);
      if (storagePaths.length > 0) {
        await supabase.storage.from("knowledge").remove(storagePaths);
      }

      // Delete database records
      const { error } = await supabase
        .from("knowledge_files")
        .delete()
        .in("id", fileIds);
      if (error) throw error;
    },
    onSuccess: (_, fileIds) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "knowledge-files"] });
      setSelectedFiles(new Set());
      toast({
        title: "Success",
        description: `${fileIds.length} files deleted successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reprocess file mutation
  const reprocessFile = useMutation({
    mutationFn: async (fileId: string) => {
      const { data, error } = await supabase.functions.invoke(
        "user-knowledge-process",
        {
          body: { file_id: fileId },
        }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "knowledge-files"] });
      toast({ title: "Success", description: "File reprocessing started" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Bulk reprocess mutation
  const bulkReprocess = useMutation({
    mutationFn: async (fileIds: string[]) => {
      const results = await Promise.allSettled(
        fileIds.map((fileId) =>
          supabase.functions.invoke("user-knowledge-process", {
            body: { file_id: fileId },
          })
        )
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      return { succeeded, failed, total: fileIds.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "knowledge-files"] });
      setSelectedFiles(new Set());
      toast({
        title: "Bulk Reprocess Complete",
        description: `${data.succeeded} files queued, ${data.failed} failed`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Export to CSV function
  const exportToCSV = () => {
    const selectedData = selectedFiles.size > 0
      ? files.filter((f) => selectedFiles.has(f.id))
      : files;

    const csvData = selectedData.map((file) => ({
      ID: file.id,
      Title: file.title,
      FileName: file.file_name,
      Category: file.knowledge_categories?.name || "-",
      Source: file.knowledge_sources?.name || "-",
      Status: file.processing_status,
      Chunks: file.chunk_count || 0,
      Size: formatBytes(file.file_size || 0),
      Created: formatDateTime(file.created_at),
      Error: file.processing_error || "-",
    }));

    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(","),
      ...csvData.map((row) =>
        headers.map((header) => `"${row[header as keyof typeof row]}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `knowledge-files-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: `Exported ${csvData.length} files to CSV`,
    });
  };

  const toggleFileSelection = (fileId: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedFiles(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map((f) => f.id)));
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { variant: "default" | "destructive" | "outline" | "secondary"; icon: any }
    > = {
      pending: { variant: "outline", icon: Loader2 },
      processing: { variant: "secondary", icon: Loader2 },
      completed: { variant: "default", icon: CheckCircle2 },
      failed: { variant: "destructive", icon: AlertCircle },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className={`h-3 w-3 ${status === "processing" ? "animate-spin" : ""}`} />
        {status}
      </Badge>
    );
  };

  // Stats
  const stats = {
    total: files.length,
    pending: files.filter((f) => f.processing_status === "pending").length,
    processing: files.filter((f) => f.processing_status === "processing").length,
    completed: files.filter((f) => f.processing_status === "completed").length,
    failed: files.filter((f) => f.processing_status === "failed").length,
    totalSize: files.reduce((sum, f) => sum + (f.file_size || 0), 0),
    totalChunks: files.reduce((sum, f) => sum + (f.chunk_count || 0), 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Files</h1>
          <p className="text-muted-foreground">
            Manage and monitor all knowledge files across sources
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV {selectedFiles.size > 0 && `(${selectedFiles.size})`}
          </Button>
          {selectedFiles.size > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => bulkReprocess.mutate(Array.from(selectedFiles))}
                disabled={bulkReprocess.isPending}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reprocess {selectedFiles.size}
              </Button>
              <Button
                variant="destructive"
                onClick={() => bulkDelete.mutate(Array.from(selectedFiles))}
                disabled={bulkDelete.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete {selectedFiles.size}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Loader2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.processing}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.failed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Size</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(stats.totalSize)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {sources.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    {source.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Files Table */}
      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
          <CardDescription>
            All knowledge files with processing status and metadata
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No files found matching your filters
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedFiles.size === files.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Chunks</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedFiles.has(file.id)}
                        onCheckedChange={() => toggleFileSelection(file.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="space-y-1">
                        <div>{file.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {file.file_name}
                        </div>
                        {file.processing_error && (
                          <div className="text-xs text-destructive">
                            {file.processing_error}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {file.knowledge_categories ? (
                        <Badge variant="outline">
                          {file.knowledge_categories.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {file.knowledge_sources ? (
                        <span className="text-sm">
                          {file.knowledge_sources.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(file.processing_status)}</TableCell>
                    <TableCell>{file.chunk_count || 0}</TableCell>
                    <TableCell>{formatBytes(file.file_size || 0)}</TableCell>
                    <TableCell>{formatDateTime(file.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {file.processing_status === "failed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reprocessFile.mutate(file.id)}
                            disabled={reprocessFile.isPending}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteFile.mutate(file.id)}
                          disabled={deleteFile.isPending}
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
    </div>
  );
}
