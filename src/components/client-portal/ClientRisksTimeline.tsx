import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface Risk {
  id: string;
  title: string;
  description: string | null;
  priority?: string;
  status: string;
  identified_at?: string;
  mitigation_plan?: string | null;
}

interface ClientRisksTimelineProps {
  risks: Risk[];
}

export function ClientRisksTimeline({ risks }: ClientRisksTimelineProps) {
  if (risks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No risks reported.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {risks.map((risk) => (
        <div
          key={risk.id}
          className="flex gap-3 p-3 rounded-lg border bg-card border-amber-500/20"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{risk.title}</p>
            {risk.description && (
              <p className="text-sm text-muted-foreground mt-1">{risk.description}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              {risk.priority && (
                <span className="text-xs px-2 py-0.5 rounded bg-muted capitalize">
                  {risk.priority}
                </span>
              )}
              {risk.status && (
                <span className="text-xs px-2 py-0.5 rounded bg-muted capitalize">
                  {risk.status}
                </span>
              )}
              {risk.identified_at && (
                <span className="text-xs text-muted-foreground">
                  {format(new Date(risk.identified_at), "MMM d, yyyy")}
                </span>
              )}
            </div>
            {risk.mitigation_plan && (
              <p className="text-sm text-muted-foreground mt-2 italic">
                Mitigation: {risk.mitigation_plan}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
