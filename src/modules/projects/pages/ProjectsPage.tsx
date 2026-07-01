/**
 * Projects Listing Page
 */

import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FolderKanban, Calendar, Loader2, Database, RefreshCw } from "lucide-react";
import { useProjects, useProjectStatuses } from "../hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { GlobalProjectsRestoreDialog } from "@/modules/projects/components/GlobalProjectsRestoreDialog";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { useSyncProjects, useSyncTasks } from "@/hooks/useIntegrationSync";
import { usePMIntegrationDisplay } from "@/hooks/usePMIntegrationDisplay";
import { usePMSync } from "@/hooks/usePMSync";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plug, RefreshCw as RefreshCwIcon } from "lucide-react";

const PROVIDER_LABELS: Record<string, string> = {
  clickup: "ClickUp",
  jira: "Jira",
  activecollab: "ActiveCollab",
  workamajig: "Workamajig",
};

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>(
    () => searchParams.get("source") ?? "all"
  );
  const { showOnProjects, primarySlug } = usePMIntegrationDisplay();
  const pmSync = usePMSync(primarySlug ?? "");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const syncJiraProjects = useSyncProjects("jira");
  const syncJiraTasks = useSyncTasks("jira");

  const { data: statuses = [] } = useProjectStatuses();
  const { data: projects = [], isLoading } = useProjects({
    search: search || undefined,
    status_id: statusFilter !== "all" ? statusFilter : undefined,
    external_provider: sourceFilter !== "all" ? sourceFilter : undefined,
  });

  useEffect(() => {
    const source = searchParams.get("source");
    if (source) setSourceFilter(source);
  }, [searchParams]);
  const { data: clients = [] } = useClients();

  const ownerIds = useMemo(() => [...new Set((projects || []).map((p) => p.owner_id).filter(Boolean))] as string[], [projects]);
  const { data: ownerProfiles = [] } = useQuery({
    queryKey: ["profiles", ownerIds],
    queryFn: async () => {
      if (ownerIds.length === 0) return [];
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").in("id", ownerIds);
      if (error) throw error;
      return (data || []) as { id: string; full_name: string | null; email: string | null }[];
    },
    enabled: ownerIds.length > 0,
  });

  const statusById = useMemo(
    () => Object.fromEntries(statuses.map((s) => [s.id, s])),
    [statuses],
  );
  const clientById = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c])),
    [clients],
  );
  const ownerById = useMemo(
    () => Object.fromEntries(ownerProfiles.map((p) => [p.id, p])),
    [ownerProfiles],
  );

  const syncFromJira = useMutation({
    mutationFn: async () => {
      await syncJiraProjects.mutateAsync();
      await syncJiraTasks.mutateAsync(undefined);
    },
    onError: (error: Error) => {
      toast({
        title: "Jira sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const backupAll = useMutation({
    mutationFn: async () => {
      if (!projects.length) return;
      const rows = projects.map((p) => ({
        project_id: p.id,
        backup_type: "manual",
        status: "completed",
        snapshot: p as unknown as Json,
        notes: "Manual backup created from Projects list (Backup all)",
      }));
      const { error } = await supabase.from("project_backups").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-backups-summary"] });
      toast({
        title: "Backups created",
        description: "Manual backups have been recorded for all projects on this page.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create backups",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground">Manage your projects</p>
        </div>
        <div className="flex items-center gap-2">
          {showOnProjects && primarySlug && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => pmSync.mutate(primarySlug)}
              disabled={pmSync.isPending}
            >
              {pmSync.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCwIcon className="mr-1 h-4 w-4" />
              )}
              Sync {PROVIDER_LABELS[primarySlug] ?? primarySlug}
            </Button>
          )}
          <GlobalProjectsRestoreDialog />
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncFromJira.mutate()}
            disabled={syncFromJira.isPending}
            title="Runs Jira project sync, then Jira task sync (requires JIRA_* Edge secrets)"
          >
            {syncFromJira.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-4 w-4" />
            )}
            Sync from Jira
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => backupAll.mutate()}
            disabled={backupAll.isPending || projects.length === 0}
          >
            {backupAll.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Database className="mr-1 h-4 w-4" />
            )}
            Backup all
          </Button>
          <Button onClick={() => navigate("/projects/new")}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {showOnProjects && primarySlug && (
        <Alert>
          <Plug className="h-4 w-4" />
          <AlertDescription>
            Synced projects from{" "}
            <strong>{PROVIDER_LABELS[primarySlug] ?? primarySlug}</strong> appear here.
            Use the sync button to pull the latest from your connected tool.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statuses.slice(0, 4).map((s) => (
          <Card key={s.id}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                <p className="text-sm text-muted-foreground">{s.name}</p>
              </div>
              <p className="text-2xl font-bold mt-1">
                {projects.filter((p) => p.status_id === s.id).length}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sourceFilter}
          onValueChange={(value) => {
            setSourceFilter(value);
            if (value === "all") {
              searchParams.delete("source");
              setSearchParams(searchParams, { replace: true });
            } else {
              setSearchParams({ ...Object.fromEntries(searchParams), source: value }, { replace: true });
            }
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="internal">Internal only</SelectItem>
            {showOnProjects && primarySlug && (
              <SelectItem value={primarySlug}>
                {PROVIDER_LABELS[primarySlug] ?? primarySlug}
              </SelectItem>
            )}
            <SelectItem value="clickup">ClickUp</SelectItem>
            <SelectItem value="jira">Jira</SelectItem>
            <SelectItem value="activecollab">ActiveCollab</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FolderKanban className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg font-medium">No projects found</p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead className="w-[100px]">Source</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[170px]">Client / Owner</TableHead>
                <TableHead className="w-[150px]">Dates</TableHead>
                <TableHead className="w-[160px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow
                  key={project.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/projects/${project.slug}`)}
                >
                  <TableCell>
                    <p className="font-medium">{project.name}</p>
                    {project.description && <p className="text-xs text-muted-foreground line-clamp-1">{project.description}</p>}
                  </TableCell>
                  <TableCell>
                    {project.external_provider ? (
                      <Badge variant="secondary" className="text-xs capitalize">
                        {PROVIDER_LABELS[project.external_provider] ?? project.external_provider}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Internal</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {project.status_id && statusById[project.status_id] ? (
                      <Badge
                        style={{
                          backgroundColor: `${statusById[project.status_id].color}20`,
                          color: statusById[project.status_id].color,
                          borderColor: statusById[project.status_id].color,
                        }}
                        variant="outline"
                      >
                        {statusById[project.status_id].name}
                      </Badge>
                    ) : (
                      <Badge variant="outline">No status</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <span className="font-medium">
                        {project.client_id && clientById[project.client_id]
                          ? clientById[project.client_id].name
                          : "No client"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Owner: {project.owner_id && ownerById[project.owner_id]?.full_name ? ownerById[project.owner_id].full_name : "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {project.start_date ? (
                      <span className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(project.start_date).toLocaleDateString()}</span>
                    ) : <span className="text-xs text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/projects/${project.slug}/edit`);
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
