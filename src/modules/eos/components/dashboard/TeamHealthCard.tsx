import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeartPulse } from "lucide-react";
import { useEOSDashboard } from "@/modules/eos/hooks/useEOSDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function TeamHealthCard() {
  const { data, isLoading } = useEOSDashboard();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-16 rounded-full mx-auto" />
        </CardContent>
      </Card>
    );
  }

  const score = data?.teamHealthScore ?? 0;
  const color =
    score >= 80 ? "text-green-600 dark:text-green-400" :
    score >= 60 ? "text-amber-600 dark:text-amber-400" :
    "text-red-600 dark:text-red-400";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">Team Health</CardTitle>
        <HeartPulse className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex flex-col items-center py-4">
        <div className={cn("text-4xl font-bold", color)}>{score}</div>
        <p className="text-sm text-muted-foreground mt-1">Composite health score</p>
        <div className="mt-4 grid grid-cols-3 gap-4 w-full text-center text-xs">
          <div>
            <p className="font-medium">{data?.idsSummary.open ?? 0}</p>
            <p className="text-muted-foreground">Open Issues</p>
          </div>
          <div>
            <p className="font-medium">{data?.meetings.upcoming ?? 0}</p>
            <p className="text-muted-foreground">Upcoming L10</p>
          </div>
          <div>
            <p className="font-medium">{data?.scorecardSummary.healthy ?? 0}</p>
            <p className="text-muted-foreground">Healthy KPIs</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
