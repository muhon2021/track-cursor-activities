import { Link } from "react-router-dom";
import { FolderKanban, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TeamCapacityCard } from "@/components/dashboards/TeamCapacityCard";
import { MeetingsThisWeekCard } from "@/components/dashboards/MeetingsThisWeekCard";
import { QuickActionsCard } from "@/components/dashboards/QuickActionsCard";
import { AITeamsDashboardCard } from "@/components/dashboards/AITeamsDashboardCard";
import { DashboardPreferencesSheet } from "@/components/dashboards/DashboardPreferencesSheet";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/hooks/useProjects";
import { useIsWidgetEnabled } from "@/hooks/useDashboardWidgets";
import type { Project } from "@/modules/projects/types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function statusColor(slug: string | undefined): string {
  switch (slug) {
    case "in_progress": return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    case "on_track":    return "bg-green-500/15 text-green-700 dark:text-green-400";
    case "at_risk":
    case "blocked":     return "bg-destructive/15 text-destructive";
    case "completed":   return "bg-muted text-muted-foreground";
    default:            return "bg-muted text-muted-foreground";
  }
}

function ProjectsTable({ projects, isLoading }: { projects: Project[] | undefined; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        No active projects assigned to you.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto -mx-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-6 pb-2 font-medium text-muted-foreground">Project</th>
            <th className="px-4 pb-2 font-medium text-muted-foreground hidden sm:table-cell">Status</th>
            <th className="px-4 pb-2 font-medium text-muted-foreground hidden md:table-cell">Due</th>
            <th className="px-4 pb-2 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {projects.map((project: any) => {
            const statusSlug = project.project_statuses?.slug ?? project.status?.slug;
            const statusName = project.project_statuses?.name ?? project.status?.name ?? "—";
            return (
              <tr key={project.id} className="group border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-6 py-3">
                  <Link
                    to={`/projects/${project.slug}`}
                    className="font-medium hover:underline block"
                  >
                    {project.name}
                  </Link>
                  {project.clients?.name && (
                    <p className="text-xs text-muted-foreground">{project.clients.name}</p>
                  )}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${statusColor(statusSlug)}`}>
                    {statusName}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell tabular-nums">
                  {formatDate(project.end_date)}
                </td>
                <td className="px-4 py-3">
                  <Link to={`/projects/${project.slug}`}>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function PMDashboard() {
  const { profile, user } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  const showCapacity = useIsWidgetEnabled("team_capacity", "pm");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: myProjects, isLoading: projectsLoading } = (useProjects as any)({
    owner_id: user?.id,
    is_archived: false,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Good {getTimeOfDay()}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground">Your projects and team overview.</p>
        </div>
        <DashboardPreferencesSheet />
      </div>

      {/* Row 1: Quick actions */}
      <QuickActionsCard />

      {/* AI Team showcase */}
      <AITeamsDashboardCard agencyRole="pm" />

      {/* Row 2: Projects table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              My Projects
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/projects" className="text-xs text-muted-foreground hover:text-foreground">
                View all
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ProjectsTable projects={myProjects} isLoading={projectsLoading} />
        </CardContent>
      </Card>

      {/* Row 2: Team capacity + Meetings */}
      <div className="grid gap-6 lg:grid-cols-2">
        {showCapacity && <TeamCapacityCard />}
        <MeetingsThisWeekCard />
      </div>
    </div>
  );
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
