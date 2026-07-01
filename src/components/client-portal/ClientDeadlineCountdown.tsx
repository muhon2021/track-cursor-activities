import { Calendar, AlertTriangle } from "lucide-react";
import { differenceInDays, isPast, format } from "date-fns";

interface ClientDeadlineCountdownProps {
  endDate: string | null;
}

export function ClientDeadlineCountdown({ endDate }: ClientDeadlineCountdownProps) {
  if (!endDate) {
    return (
      <div className="p-4 rounded-lg border bg-card text-muted-foreground">
        <Calendar className="h-5 w-5 inline mr-2" />
        No end date set.
      </div>
    );
  }

  const date = new Date(endDate);
  const days = differenceInDays(date, new Date());
  const overdue = isPast(date);

  return (
    <div
      className={`p-4 rounded-lg border ${
        overdue ? "bg-destructive/10 border-destructive/30" : "bg-card"
      }`}
    >
      <div className="flex items-center gap-2">
        {overdue ? (
          <AlertTriangle className="h-5 w-5 text-destructive" />
        ) : (
          <Calendar className="h-5 w-5 text-muted-foreground" />
        )}
        <span className="text-sm font-medium">
          {overdue
            ? `Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""}`
            : days === 0
              ? "Due today"
              : `${days} day${days !== 1 ? "s" : ""} remaining`}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        End date: {format(date, "MMM d, yyyy")}
      </p>
    </div>
  );
}
