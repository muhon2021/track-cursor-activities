import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, DollarSign, Users, FileText } from "lucide-react";
import type { Project } from "@/modules/projects/types";

interface ProjectSummaryCardProps {
  project: Project;
  clientName?: string | null;
  ownerName?: string | null;
}

export function ProjectSummaryCard({ project, clientName, ownerName }: ProjectSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {project.description && (
          <p className="text-muted-foreground line-clamp-3">{project.description}</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {project.start_date && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>Start: {new Date(project.start_date).toLocaleDateString()}</span>
            </div>
          )}
          {project.end_date && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>End: {new Date(project.end_date).toLocaleDateString()}</span>
            </div>
          )}
          {project.budget != null && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-4 w-4 shrink-0" />
              <span>{project.currency} {project.budget.toLocaleString()}</span>
            </div>
          )}
          {(clientName || ownerName) && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4 shrink-0" />
              <span>{[clientName, ownerName].filter(Boolean).join(" · ") || "—"}</span>
            </div>
          )}
        </div>
        {project.status && (
          <Badge
            variant="outline"
            style={{
              backgroundColor: `${project.status.color}20`,
              color: project.status.color,
              borderColor: project.status.color,
            }}
          >
            {project.status.name}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
