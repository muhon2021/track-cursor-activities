/**
 * Project Detail Page - Tabbed view (URL-driven tabs)
 * Tabs are conditionally shown via useEnabledProjectModules().
 */

import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Calendar, Users, AlertTriangle, Loader2, Plus, CheckCircle2, Pencil, Trash2, Video, Brain } from "lucide-react";
import { useProject, useDeleteProject } from "../hooks/useProjects";
import { useProjectMembers } from "../hooks/useProjectDetail";
import { useProjectMilestones, useAddMilestone, useUpdateMilestone } from "../hooks/useProjectDetail";
import { useProjectComments, useAddProjectComment } from "../hooks/useProjectDetail";
import { useProjectRisks } from "../hooks/useProjectDetail";
import { useProjectTasks } from "../hooks/useProjectTasks";
import { useProjectIntegrations } from "../hooks/useProjectIntegrations";
import { useEnabledProjectModules } from "@/hooks/useProjectModuleSettings";
import { useProjectMeetings } from "@/modules/meetings/hooks/useCrossModuleMeetings";
import { ClientAccessManagement } from "@/modules/projects/components/ClientAccessManagement";
import { OverviewTab } from "@/modules/projects/components/OverviewTab";
import { TasksTab } from "@/modules/projects/components/TasksTab";
import { IntegrationsTab } from "@/modules/projects/components/IntegrationsTab";
import { BillingTab } from "@/modules/projects/components/BillingTab";
import type { ProjectTab } from "../types";

const TAB_URL_MAPPINGS: Record<string, ProjectTab> = {
  overview: "overview",
  milestones: "milestones",
  members: "members",
  issues: "issues",
  billing: "billing",
  client_portal: "client_portal",
  tasks: "tasks",
  integrations: "integrations",
  meetings: "meetings",
};
const VALID_TAB_KEYS = new Set(Object.keys(TAB_URL_MAPPINGS));
const TAB_ORDER: ProjectTab[] = [
  "overview",
  "tasks",
  "milestones",
  "members",
  "issues",
  "billing",
  "integrations",
  "meetings",
  "client_portal",
];

export default function ProjectDetailPage() {
  const { slug, tab: tabParam } = useParams<{ slug: string; tab?: string }>();
  const navigate = useNavigate();
  const activeTab: ProjectTab =
    tabParam && VALID_TAB_KEYS.has(tabParam) ? TAB_URL_MAPPINGS[tabParam] : "overview";

  const { data: project, isLoading } = useProject(slug!);
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
  const addComment = useAddProjectComment();
  const deleteProject = useDeleteProject();
  const addMilestone = useAddMilestone();
  const updateMilestone = useUpdateMilestone();

  const visibleTabs = useMemo(() => {
    return TAB_ORDER.filter((tab) => enabledModules[tab] !== false);
  }, [enabledModules]);

  useEffect(() => {
    if (tabParam && !VALID_TAB_KEYS.has(tabParam)) {
      navigate(`/projects/${slug}`, { replace: true });
      return;
    }
    // If current tab is disabled by module settings, redirect to overview
    if (tabParam && visibleTabs.length > 0 && !visibleTabs.includes(tabParam as ProjectTab)) {
      navigate(`/projects/${slug}`, { replace: true });
    }
  }, [tabParam, slug, navigate, visibleTabs]);

  const [newComment, setNewComment] = useState("");
  const [newMilestone, setNewMilestone] = useState("");

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">Project not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/projects")}>Back to Projects</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            {project.status && (
              <Badge style={{ backgroundColor: `${project.status.color}20`, color: project.status.color }} variant="outline">{project.status.name}</Badge>
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
                <Trash2 className="h-4 w-4 mr-1" />Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete project?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete "{project.name}" and all associated milestones, comments, and members.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteProject.mutate(project.id, { onSuccess: () => navigate("/projects") })}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          const next = v as ProjectTab;
          if (next === "overview") navigate(`/projects/${slug}`);
          else navigate(`/projects/${slug}/${next}`);
        }}
      >
        <TabsList>
          {visibleTabs.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {tab === "overview" && "Overview"}
              {tab === "tasks" && `Tasks (${tasks.length})`}
              {tab === "milestones" && `Milestones (${milestones.length})`}
              {tab === "members" && `Members (${members.length})`}
              {tab === "issues" && `Risks (${risks.length})`}
              {tab === "billing" && "Billing"}
              {tab === "integrations" && "Integrations"}
              {tab === "meetings" && `Meetings (${linkedMeetings.length})`}
              {tab === "client_portal" && "Client Portal"}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <OverviewTab project={project} />
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">Activity</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {comments.slice(-5).map((c) => (
                    <div key={c.id} className="text-sm border-l-2 pl-3 py-1">
                      <p className="font-medium text-xs">{c.user?.full_name}</p>
                      <p className="text-muted-foreground">{c.content}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Input placeholder="Add a comment..." value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newComment.trim()) { addComment.mutate({ projectId: project.id, content: newComment.trim() }); setNewComment(""); }}} />
                  <Button size="sm" disabled={!newComment.trim()} onClick={() => { addComment.mutate({ projectId: project.id, content: newComment.trim() }); setNewComment(""); }}>Post</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {visibleTabs.includes("tasks") && (
          <TabsContent value="tasks" className="mt-4">
            <TasksTab
              projectId={project.id}
              projectSlug={project.slug}
              tasks={tasks}
              isLoading={tasksLoading}
            />
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

        {visibleTabs.includes("meetings") && (
          <TabsContent value="meetings" className="mt-4">
            {linkedMeetings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No meetings linked to this project.</p>
            ) : (
              <div className="space-y-2">
                {linkedMeetings.map((item) =>
                  item.meeting ? (
                    <Card
                      key={item.id}
                      className="cursor-pointer hover:border-primary/40 transition-colors"
                      onClick={() => navigate(`/meetings/${item.meeting!.id}`)}
                    >
                      <CardContent className="flex items-center gap-3 py-3 px-4">
                        <Video className="h-5 w-5 text-primary" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.meeting.title}</p>
                          {item.meeting.scheduled_at && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(item.meeting.scheduled_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                        {item.meeting.duration_minutes && (
                          <span className="text-xs text-muted-foreground">{item.meeting.duration_minutes} min</span>
                        )}
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
            <Input placeholder="New milestone..." value={newMilestone} onChange={(e) => setNewMilestone(e.target.value)} className="max-w-sm" />
            <Button size="sm" disabled={!newMilestone.trim()} onClick={() => { addMilestone.mutate({ projectId: project.id, title: newMilestone.trim() }); setNewMilestone(""); }}><Plus className="h-4 w-4 mr-1" />Add</Button>
          </div>
          {milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No milestones yet.</p>
          ) : (
            <div className="space-y-2">
              {milestones.map((m) => (
                <Card key={m.id}>
                  <CardContent className="flex items-center gap-3 py-3 px-4">
                    <button onClick={() => updateMilestone.mutate({ id: m.id, projectId: project.id, data: { status: m.status === "completed" ? "pending" : "completed", completed_at: m.status === "completed" ? null : new Date().toISOString() } })}>
                      <CheckCircle2 className={`h-5 w-5 ${m.status === "completed" ? "text-green-500" : "text-muted-foreground"}`} />
                    </button>
                    <div className="flex-1">
                      <p className={`font-medium text-sm ${m.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{m.title}</p>
                      {m.due_date && <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(m.due_date).toLocaleDateString()}</p>}
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
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div>
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
            <p className="text-sm text-muted-foreground">
              Track project risks and optionally run an AI pass for potential blind spots.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="inline-flex items-center gap-2"
              onClick={() => navigate(`/projects/${slug}/issues/ai/analyze`)}
            >
              <Brain className="h-4 w-4" />
              AI issues analysis
            </Button>
          </div>
          {risks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No risks identified yet. Use the AI analysis flow to help surface potential issues.
            </p>
          ) : (
            <div className="space-y-2">
              {risks.map((r) => (
                <Card key={r.id}>
                  <CardContent className="flex items-center gap-3 px-4 py-3">
                    <AlertTriangle
                      className={`h-5 w-5 ${
                        r.severity === "critical"
                          ? "text-red-500"
                          : r.severity === "high"
                          ? "text-orange-500"
                          : "text-yellow-500"
                      }`}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{r.title}</p>
                      {r.description && (
                        <p className="text-xs text-muted-foreground">{r.description}</p>
                      )}
                    </div>
                    <Badge variant="outline">{r.severity}</Badge>
                    <Badge variant="secondary">{r.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="client_portal" className="mt-4">
          <ClientAccessManagement
            projectId={project.id}
            projectName={project.name}
            projectSlug={project.slug}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
