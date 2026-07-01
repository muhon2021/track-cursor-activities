/**
 * Project Detail Page – full structure per replication guide
 * URL-driven tabs: overview, tasks, issues, integrations, client_portal,
 * checklist, risks, concerns, files, finance. Aliases: client-portal, docs→files, financials→finance.
 */

import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ArrowLeft, Loader2, Pencil, Trash2, Download } from "lucide-react";
import { useProject, useDeleteProject } from "@/modules/projects/hooks/useProjects";
import { useProjectMembers, useProjectMilestones, useProjectComments, useProjectRisks, useAddProjectComment, useAddMilestone, useUpdateMilestone } from "@/modules/projects/hooks/useProjectDetail";
import { useProjectTasks } from "@/modules/projects/hooks/useProjectTasks";
import { useProjectIntegrations } from "@/modules/projects/hooks/useProjectIntegrations";
import { useEnabledProjectModules } from "@/hooks/useProjectModuleSettings";
import { useProjectMeetings } from "@/modules/meetings/hooks/useCrossModuleMeetings";
import { MeetingTranscriptsCard } from "@/modules/projects/components/MeetingTranscriptsCard";
import { useClients } from "@/hooks/useClients";
import { OverviewTab } from "@/modules/projects/components/OverviewTab";
import { TasksTab } from "@/modules/projects/components/TasksTab";
import { IntegrationsTab } from "@/modules/projects/components/IntegrationsTab";
import { BillingTab } from "@/modules/projects/components/BillingTab";
import { ClientAccessManagement } from "@/modules/projects/components/ClientAccessManagement";
import { ProjectSummaryCard } from "@/components/projects/ProjectSummaryCard";
import { ProjectOverviewCard } from "@/components/projects/ProjectOverviewCard";
import { QuickCommentsSection } from "@/components/projects/QuickCommentsSection";
import type { ProjectTab } from "@/modules/projects/types";

const TAB_ALIASES: Record<string, ProjectTab> = {
  overview: "overview",
  tasks: "tasks",
  issues: "issues",
  integrations: "integrations",
  "client-portal": "client_portal",
  client_portal: "client_portal",
  checklist: "checklist",
  risks: "risks",
  concerns: "concerns",
  docs: "files",
  files: "files",
  financials: "finance",
  finance: "finance",
  billing: "billing",
  milestones: "milestones",
  members: "members",
  meetings: "meetings",
};

const VALID_TABS = new Set<string>(Object.keys(TAB_ALIASES));

const TAB_ORDER: ProjectTab[] = [
  "overview",
  "tasks",
  "issues",
  "integrations",
  "client_portal",
  "checklist",
  "risks",
  "concerns",
  "files",
  "finance",
  "billing",
  "milestones",
  "members",
  "meetings",
];

function normalizeTab(param: string | undefined): ProjectTab {
  if (!param) return "overview";
  const normalized = param.toLowerCase().replace(/_/g, "_");
  const alias = TAB_ALIASES[param] ?? TAB_ALIASES[normalized];
  return alias ?? "overview";
}

export default function ProjectDetail() {
  const { slug, tab: tabParam } = useParams<{ slug: string; tab?: string }>();
  const navigate = useNavigate();
  const activeTab: ProjectTab = useMemo(
    () => (tabParam && VALID_TABS.has(tabParam) ? (TAB_ALIASES[tabParam] ?? "overview") : "overview"),
    [tabParam]
  );

  const { data: project, isLoading } = useProject(slug);
  const { data: ownerProfile } = useQuery({
    queryKey: ["profile", project?.owner_id],
    queryFn: async () => {
      if (!project?.owner_id) return null;
      const { data, error } = await supabase.from("profiles").select("full_name, email").eq("id", project.owner_id).single();
      if (error) return null;
      return data as { full_name: string; email: string };
    },
    enabled: !!project?.owner_id,
  });
  const owner = ownerProfile ? { full_name: ownerProfile.full_name ?? "", email: ownerProfile.email ?? "" } : null;

  const { data: enabledModules = {} } = useEnabledProjectModules();
  const { data: members = [] } = useProjectMembers(project?.id || "");
  const { data: milestones = [] } = useProjectMilestones(project?.id || "");
  const { data: comments = [] } = useProjectComments(project?.id || "");
  const { data: risks = [] } = useProjectRisks(project?.id || "");
  const { data: tasks = [], isLoading: tasksLoading } = useProjectTasks(project?.id || "");
  const { data: integrations = [], isLoading: integrationsLoading } = useProjectIntegrations(project?.id || "");
  const { data: linkedMeetings = [] } = useProjectMeetings(project?.id);
  const { data: clients = [] } = useClients();
  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);

  const addComment = useAddProjectComment();
  const deleteProject = useDeleteProject();
  const addMilestone = useAddMilestone();
  const updateMilestone = useUpdateMilestone();

  const visibleTabs = useMemo(() => {
    const order = TAB_ORDER.filter((tab) => enabledModules[tab] !== false);
    if (order.length === 0) return ["overview", "tasks", "issues", "billing", "integrations", "client_portal", "milestones", "members", "meetings"];
    return order;
  }, [enabledModules]);

  useEffect(() => {
    if (tabParam && !VALID_TABS.has(tabParam)) {
      const normalized = normalizeTab(tabParam);
      navigate(`/projects/${slug}/${normalized}`, { replace: true });
      return;
    }
    if (tabParam && visibleTabs.length > 0 && !visibleTabs.includes(activeTab)) {
      navigate(`/projects/${slug}`, { replace: true });
    }
  }, [tabParam, slug, navigate, visibleTabs, activeTab]);

  const [newComment, setNewComment] = useState("");
  const [newMilestone, setNewMilestone] = useState("");

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">Project not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/projects")}>
          Back to Projects
        </Button>
      </div>
    );
  }

  const clientName = project.client_id && clientById[project.client_id] ? clientById[project.client_id].name : null;
  const ownerName = owner?.full_name ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            {project.status && (
              <Badge
                style={{ backgroundColor: `${project.status.color}20`, color: project.status.color }}
                variant="outline"
              >
                {project.status.name}
              </Badge>
            )}
            {owner && <span className="text-sm text-muted-foreground">Owner: {owner.full_name}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${slug}/edit`)}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete project?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete "{project.name}" and associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteProject.mutate(project.id, { onSuccess: () => navigate("/projects") })}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          {project.description && <p className="text-sm text-muted-foreground">{project.description}</p>}
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          const next = v as ProjectTab;
          if (next === "overview") navigate(`/projects/${slug}`);
          else navigate(`/projects/${slug}/${next}`);
        }}
      >
        <TabsList className="flex flex-wrap gap-1">
          {visibleTabs.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {tab === "overview" && "Overview"}
              {tab === "tasks" && `Tasks (${tasks.length})`}
              {tab === "milestones" && `Milestones (${milestones.length})`}
              {tab === "members" && `Members (${members.length})`}
              {tab === "issues" && `Issues (${risks.length})`}
              {tab === "billing" && "Billing"}
              {tab === "finance" && "Finance"}
              {tab === "integrations" && "Integrations"}
              {tab === "meetings" && `Meetings (${linkedMeetings.length})`}
              {tab === "client_portal" && "Client Portal"}
              {tab === "checklist" && "Checklist"}
              {tab === "risks" && "Risks"}
              {tab === "concerns" && "Concerns"}
              {tab === "files" && "Files"}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <ProjectSummaryCard project={project} clientName={clientName} ownerName={ownerName} />
              <ProjectOverviewCard project={project} />
            </div>
            <QuickCommentsSection
              projectId={project.id}
              comments={comments}
              onAddComment={(content) => addComment.mutate({ projectId: project.id, content })}
            />
          </div>
        </TabsContent>

        {visibleTabs.includes("tasks") && (
          <TabsContent value="tasks" className="mt-4">
            <TasksTab projectId={project.id} projectSlug={project.slug} tasks={tasks} isLoading={tasksLoading} />
          </TabsContent>
        )}

        {visibleTabs.includes("integrations") && (
          <TabsContent value="integrations" className="mt-4">
            <IntegrationsTab
              projectId={project.id}
              projectName={project.name}
              integrations={integrations}
              isLoading={integrationsLoading}
            />
          </TabsContent>
        )}

        {visibleTabs.includes("billing") && (
          <TabsContent value="billing" className="mt-4">
            <BillingTab projectId={project.id} projectSlug={project.slug} />
          </TabsContent>
        )}
        {visibleTabs.includes("finance") && (
          <TabsContent value="finance" className="mt-4">
            <BillingTab projectId={project.id} projectSlug={project.slug} />
          </TabsContent>
        )}

        {visibleTabs.includes("meetings") && (
          <TabsContent value="meetings" className="mt-4 space-y-6">
            <MeetingTranscriptsCard projectId={project.id} />
            {linkedMeetings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No meetings linked to this project yet.</p>
            ) : (
              <div className="space-y-2">
                {linkedMeetings.map((item) =>
                  item.meeting ? (
                    <Card
                      key={item.id}
                      className="cursor-pointer hover:border-primary/40"
                      onClick={() => navigate(`/meetings/${item.meeting!.id}`)}
                    >
                      <CardContent className="flex items-center gap-3 py-3 px-4">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.meeting.title}</p>
                          {item.meeting.scheduled_at && (
                            <p className="text-xs text-muted-foreground">
                              {new Date(item.meeting.scheduled_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                        {item.meeting.status && <Badge variant="outline">{item.meeting.status}</Badge>}
                      </CardContent>
                    </Card>
                  ) : null
                )}
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="milestones" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <input
              placeholder="New milestone..."
              value={newMilestone}
              onChange={(e) => setNewMilestone(e.target.value)}
              className="flex h-9 w-full max-w-sm rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
            />
            <Button
              size="sm"
              disabled={!newMilestone.trim()}
              onClick={() => {
                addMilestone.mutate({ projectId: project.id, title: newMilestone.trim() });
                setNewMilestone("");
              }}
            >
              Add
            </Button>
          </div>
          {milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No milestones yet.</p>
          ) : (
            <div className="space-y-2">
              {milestones.map((m) => (
                <Card key={m.id}>
                  <CardContent className="flex items-center gap-3 py-3 px-4">
                    <button
                      onClick={() =>
                        updateMilestone.mutate({
                          id: m.id,
                          projectId: project.id,
                          data: {
                            status: m.status === "completed" ? "pending" : "completed",
                            completed_at: m.status === "completed" ? null : new Date().toISOString(),
                          },
                        })
                      }
                    >
                      <span className={`h-5 w-5 ${m.status === "completed" ? "text-green-500" : "text-muted-foreground"}`}>✓</span>
                    </button>
                    <div className="flex-1">
                      <p className={`font-medium text-sm ${m.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                        {m.title}
                      </p>
                      {m.due_date && (
                        <p className="text-xs text-muted-foreground">{new Date(m.due_date).toLocaleDateString()}</p>
                      )}
                    </div>
                    <Badge variant="outline">{m.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No members yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map((m) => (
                <Card key={m.id}>
                  <CardContent className="flex items-center gap-3 py-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center" />
                    <div>
                      <p className="font-medium text-sm">{m.user?.full_name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="issues" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Risks and issues. Run AI analysis for blind spots.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/projects/${slug}/issues/ai/analyze`)}
            >
              AI issues analysis
            </Button>
          </div>
          {risks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No risks identified yet.</p>
          ) : (
            <div className="space-y-2">
              {risks.map((r) => (
                <Card key={r.id}>
                  <CardContent className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{r.title}</p>
                      {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                    </div>
                    <Badge variant="outline">{r.severity}</Badge>
                    <Badge variant="secondary">{r.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {visibleTabs.includes("client_portal") && (
          <TabsContent value="client_portal" className="mt-4">
            <ClientAccessManagement projectId={project.id} projectName={project.name} projectSlug={project.slug} />
          </TabsContent>
        )}

        {visibleTabs.includes("risks") && (
          <TabsContent value="risks" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Project risks.</p>
              <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${slug}/issues/ai/analyze`)}>AI analysis</Button>
            </div>
            {risks.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No risks yet.</p>
            ) : (
              <div className="space-y-2">
                {risks.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{r.title}</p>
                        {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                      </div>
                      <Badge variant="outline">{r.severity}</Badge>
                      <Badge variant="secondary">{r.status}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="checklist" className="mt-4">
          <p className="text-sm text-muted-foreground py-8 text-center">Checklist panel can be wired here.</p>
        </TabsContent>
        <TabsContent value="concerns" className="mt-4">
          <p className="text-sm text-muted-foreground py-8 text-center">Concerns panel can be wired here.</p>
        </TabsContent>
        <TabsContent value="files" className="mt-4">
          <p className="text-sm text-muted-foreground py-8 text-center">Drive and meetings files can be wired here.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
