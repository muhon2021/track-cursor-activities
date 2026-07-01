/**
 * Project Performance Page – placeholder for performance view
 */
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { useProject } from "@/modules/projects/hooks/useProjects";

export default function Performance() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: project } = useProject(slug);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${slug}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Performance
          </h1>
          {project && (
            <p className="text-sm text-muted-foreground">
              Metrics and performance for <span className="font-medium">{project.name}</span>
            </p>
          )}
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance view</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Performance metrics and analytics can be wired here (e.g. completion rate, velocity, burndown).
        </CardContent>
      </Card>
    </div>
  );
}
