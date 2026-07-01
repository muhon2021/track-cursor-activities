import { Ticket } from "lucide-react";
import { cn } from "@/lib/utils";

/** Issue-type hint for Jira-synced tasks (icon only; label via title). */
export function JiraWorkTypeIcon({
  workType,
  className,
}: {
  workType?: string | null;
  className?: string;
}) {
  return (
    <span title={workType || "Jira issue"}>
      <Ticket
        className={cn("h-4 w-4 shrink-0 text-muted-foreground", className)}
        aria-hidden
      />
    </span>
  );
}
