import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Project } from "@/modules/projects/types";

/**
 * OverviewTab (skeleton)
 *
 * Lightweight overview panel for ProjectDetail, inspired by sj-control-main's OverviewTab.
 * Currently shows basic project metadata; you can extend it with AI analysis,
 * metrics, and editable fields later.
 */
interface OverviewTabProps {
  project: Project;
}

export function OverviewTab({ project }: OverviewTabProps) {
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
          {project.budget && (
            <div>
              <p className="text-xs uppercase tracking-wide">Budget</p>
              <p>
                {project.currency} {project.budget.toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
