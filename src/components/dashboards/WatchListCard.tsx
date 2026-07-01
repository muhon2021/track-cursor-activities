import { AlertTriangle, Clock, ExternalLink, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useProjectRisks, type ProjectRisk } from "@/hooks/useProjectRisks";

const FLAG_LABELS: Record<string, string> = {
  deadline_approaching: "Deadline near",
  blocked: "Blocked",
  over_budget: "Over budget",
  no_activity: "No recent activity",
  feedback_pending: "Feedback pending",
};

function RiskBadge({ flag }: { flag: string }) {
  const label = FLAG_LABELS[flag] ?? flag;
  const isHigh = flag === "blocked" || flag === "over_budget";
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs",
        isHigh
          ? "border-destructive/50 text-destructive"
          : "border-yellow-500/50 text-yellow-600 dark:text-yellow-400"
      )}
    >
      {label}
    </Badge>
  );
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const now = new Date();
  const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  return `${diff}d left`;
}

function RiskItem({ project }: { project: ProjectRisk }) {
  const flags = project.risk_flags
    ? project.risk_flags.split(", ").filter(Boolean)
    : [];
  const dueLabel = formatRelativeDate(project.end_date ?? project.expected_completion_date);
  const isOverdue = project.end_date
    ? new Date(project.end_date) < new Date()
    : false;

  return (
    <li className="group flex items-start justify-between gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="min-w-0 flex-1">
        <Link
          to={`/projects/${project.slug}`}
          className="flex items-center gap-1.5 text-sm font-medium hover:underline"
        >
          <AlertTriangle
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              isOverdue ? "text-destructive" : "text-yellow-500"
            )}
          />
          <span className="truncate">{project.name}</span>
        </Link>
        {project.client_name && (
          <p className="mt-0.5 text-xs text-muted-foreground">{project.client_name}</p>
        )}
        {flags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {flags.map((f) => (
              <RiskBadge key={f} flag={f} />
            ))}
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={cn(
            "text-xs font-medium tabular-nums",
            isOverdue ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {dueLabel}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </li>
  );
}

export function WatchListCard() {
  const { data: risks, isLoading } = useProjectRisks(5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            Watch List
          </CardTitle>
          <Link
            to="/projects?filter=at_risk"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : !risks || risks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-medium text-foreground">All clear</p>
            <p className="text-xs text-muted-foreground">No at-risk projects right now.</p>
          </div>
        ) : (
          <ul>
            {risks.map((project) => (
              <RiskItem key={project.id} project={project} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
