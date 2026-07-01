import { CheckCircle2, Circle, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Milestone {
  id: string;
  name: string;
  description: string | null;
  target_date: string | null;
  completion_date: string | null;
  status: string;
  progress_percentage?: number;
  pm_notes?: string | null;
  amount?: number | null;
  payment_status?: string | null;
}

interface ClientMilestoneTimelineProps {
  milestones: Milestone[];
}

export function ClientMilestoneTimeline({ milestones }: ClientMilestoneTimelineProps) {
  if (milestones.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No milestones defined yet.
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return <CheckCircle2 className="h-6 w-6 text-green-500" />;
      case "in_progress":
      case "in progress":
        return <Clock className="h-6 w-6 text-blue-500 animate-pulse" />;
      case "overdue":
      case "delayed":
        return <AlertCircle className="h-6 w-6 text-destructive" />;
      default:
        return <Circle className="h-6 w-6 text-muted-foreground" />;
    }
  };

  return (
    <div className="relative">
      <div className="md:hidden space-y-4">
        {milestones.map((milestone, index) => (
          <div key={milestone.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center bg-background border-2 ${
                  milestone.status === "completed"
                    ? "border-green-500"
                    : milestone.status === "in_progress" || milestone.status === "in progress"
                      ? "border-blue-500"
                      : milestone.status === "overdue" || milestone.status === "delayed"
                        ? "border-destructive"
                        : "border-muted"
                }`}
              >
                {getStatusIcon(milestone.status)}
              </div>
              {index < milestones.length - 1 && (
                <div
                  className={`w-0.5 flex-1 mt-2 min-h-[24px] ${
                    milestone.status === "completed" ? "bg-green-500" : "bg-muted"
                  }`}
                />
              )}
            </div>
            <div className="flex-1 pb-4">
              <p className="font-medium">{milestone.name}</p>
              {milestone.target_date && (
                <p className="text-sm text-muted-foreground">
                  {format(new Date(milestone.target_date), "MMM d, yyyy")}
                </p>
              )}
              {milestone.description && (
                <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>
              )}
              {milestone.pm_notes && (
                <p className="text-sm italic mt-1">&quot;{milestone.pm_notes}&quot;</p>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="hidden md:block space-y-3">
        {milestones.map((milestone) => (
          <Tooltip key={milestone.id}>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                <div className="shrink-0">{getStatusIcon(milestone.status)}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{milestone.name}</p>
                  {milestone.target_date && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(milestone.target_date), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <div className="space-y-1">
                <p className="font-medium">{milestone.name}</p>
                {milestone.description && (
                  <p className="text-sm text-muted-foreground">{milestone.description}</p>
                )}
                {milestone.target_date && (
                  <p className="text-xs">
                    Target: {format(new Date(milestone.target_date), "MMM d, yyyy")}
                  </p>
                )}
                {milestone.pm_notes && (
                  <p className="text-xs italic">&quot;{milestone.pm_notes}&quot;</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
