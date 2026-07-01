import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, AlertCircle } from "lucide-react";
import { useEOSDashboard } from "@/modules/eos/hooks/useEOSDashboard";
import { Skeleton } from "@/components/ui/skeleton";

export function EOSMeetingsSummaryCard() {
  const { data, isLoading } = useEOSDashboard();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">L10 Meetings</CardTitle>
        <Calendar className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex gap-6">
        <div>
          <p className="text-2xl font-bold text-primary">{data?.meetings.upcoming ?? 0}</p>
          <p className="text-xs text-muted-foreground">Upcoming</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-destructive">{data?.meetings.missed ?? 0}</p>
          <p className="text-xs text-muted-foreground">Missed</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function EOSIDSSummaryCard() {
  const { data, isLoading } = useEOSDashboard();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-20" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">IDS Issues</CardTitle>
        <AlertCircle className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex gap-6">
        <div>
          <p className="text-2xl font-bold">{data?.idsSummary.open ?? 0}</p>
          <p className="text-xs text-muted-foreground">Open</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {data?.idsSummary.resolved ?? 0}
          </p>
          <p className="text-xs text-muted-foreground">Resolved</p>
        </div>
      </CardContent>
    </Card>
  );
}
