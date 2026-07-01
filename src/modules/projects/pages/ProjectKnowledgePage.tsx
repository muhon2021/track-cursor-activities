/**
 * Project Knowledge Page
 *
 * Shows documents linked to the project from unified_documents
 * (owner_type = 'project', owner_id = project.id). Includes file type
 * badges, processing status, and chunk count for embedded docs.
 */

import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, FileText, Search, BookOpen, Loader2, File } from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "../hooks/useProjects";

interface ProjectDocument {
  id: string;
  title: string;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  processing_status: string | null;
  chunk_count: number | null;
  created_at: string | null;
}

function useProjectDocuments(projectId: string) {
  return useQuery({
    queryKey: ["project-knowledge", projectId],
    queryFn: async (): Promise<ProjectDocument[]> => {
      const { data, error } = await supabase
        .from("unified_documents")
        .select("id, title, file_name, file_type, file_size, processing_status, chunk_count, created_at")
        .eq("owner_type", "project")
        .eq("owner_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ProjectDocument[];
    },
    enabled: !!projectId,
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  completed: { label: "Embedded", variant: "default" },
  processing: { label: "Processing", variant: "secondary" },
  pending: { label: "Pending", variant: "outline" },
  error: { label: "Error", variant: "destructive" },
  failed: { label: "Failed", variant: "destructive" },
  skipped: { label: "Skipped", variant: "outline" },
};

export default function ProjectKnowledgePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: project } = useProject(slug || "");
  const { data: documents = [], isLoading } = useProjectDocuments(project?.id || "");

  const filtered = useMemo(() => {
    if (!search) return documents;
    const q = search.toLowerCase();
    return documents.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.file_name || "").toLowerCase().includes(q)
    );
  }, [documents, search]);

  const embeddedCount = documents.filter((d) => d.processing_status === "completed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${slug}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Project Knowledge</h1>
          {project && (
            <p className="text-sm text-muted-foreground">
              Documents and knowledge for <span className="font-medium">{project.name}</span>
            </p>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <FileText className="h-4 w-4" />
              Total Documents
            </div>
            <p className="text-2xl font-bold mt-1">{documents.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <BookOpen className="h-4 w-4" />
              Embedded
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">{embeddedCount}</p>
            <p className="text-xs text-muted-foreground">available for semantic search</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <File className="h-4 w-4" />
              Total Chunks
            </div>
            <p className="text-2xl font-bold mt-1">
              {documents.reduce((s, d) => s + (d.chunk_count || 0), 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Document Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents</CardTitle>
          <CardDescription>
            {filtered.length} of {documents.length} documents shown
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BookOpen className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">
                {documents.length === 0 ? "No documents yet" : "No matching documents"}
              </p>
              <p className="text-sm">
                {documents.length === 0
                  ? "Upload documents via the Knowledge module to link them to this project."
                  : "Try adjusting your search."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Chunks</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((doc) => {
                  const sc = statusConfig[doc.processing_status || "pending"] || statusConfig.pending;
                  return (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{doc.title}</p>
                          {doc.file_name && doc.file_name !== doc.title && (
                            <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {doc.file_type || "unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatFileSize(doc.file_size)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={sc.variant}>{sc.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {doc.chunk_count || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
