import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crosshair } from "lucide-react";
import { useEOSDashboard } from "@/modules/eos/hooks/useEOSDashboard";
import { ROCK_STATUS_LABELS, type RockStatus } from "@/modules/eos/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<RockStatus, string> = {
  on_track: "text-green-600 dark:text-green-400",
  at_risk: "text-amber-600 dark:text-amber-400",
  off_track: "text-red-600 dark:text-red-400",
  completed: "text-blue-600 dark:text-blue-400",
};

export function RocksSummaryCard() {
  const { data, isLoading } = useEOSDashboard();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const summary = data?.rocksSummary ?? {
    on_track: 0,
    at_risk: 0,
    off_track: 0,
    completed: 0,
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">Rocks Summary</CardTitle>
        <Crosshair className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(ROCK_STATUS_LABELS) as RockStatus[]).map((status) => (
            <div key={status} className="rounded-lg border p-3 text-center">
              <p className={cn("text-2xl font-bold", STATUS_COLORS[status])}>
                {summary[status]}
              </p>
              <p className="text-xs text-muted-foreground">{ROCK_STATUS_LABELS[status]}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
