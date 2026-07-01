import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Project } from "@/modules/projects/types";

interface ProjectOverviewCardProps {
  project: Project;
}

/**
 * Overview card for project detail – mirrors module OverviewTab content.
 */
export function ProjectOverviewCard({ project }: ProjectOverviewCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Project Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {project.description && <p>{project.description}</p>}
        <div className="grid sm:grid-cols-3 gap-2">
          {project.start_date && (
            <div>
              <p className="text-xs uppercase tracking-wide">Start date</p>
              <p>{new Date(project.start_date).toLocaleDateString()}</p>
            </div>
          )}
          {project.end_date && (
            <div>
              <p className="text-xs uppercase tracking-wide">End date</p>
              <p>{new Date(project.end_date).toLocaleDateString()}</p>
            </div>
          )}
          {project.budget != null && (
            <div>
              <p className="text-xs uppercase tracking-wide">Budget</p>
              <p>{project.currency} {project.budget.toLocaleString()}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
