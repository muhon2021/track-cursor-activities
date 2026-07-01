import { Calendar, Video, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys, cacheConfig } from "@/lib/cache";
import { useAuth } from "@/contexts/AuthContext";

interface Meeting {
  id: string;
  title: string;
  scheduled_at: string | null;
  status: string | null;
  join_url: string | null;
  meeting_type: string | null;
}

function useMeetingsThisWeek(userId: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.meetingsThisWeek(userId),
    queryFn: async (): Promise<Meeting[]> => {
      const weekStart = new Date();
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const { data, error } = await supabase
        .from("meetings")
        .select("id, title, scheduled_at, status, join_url, meeting_type")
        .gte("scheduled_at", weekStart.toISOString())
        .lt("scheduled_at", weekEnd.toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(8);

      if (error) throw error;
      return data ?? [];
    },
    staleTime: cacheConfig.staleTime.short,
    enabled: !!userId,
  });
}

export function MeetingsThisWeekCard() {
  const { user } = useAuth();
  const { data: meetings, isLoading } = useMeetingsThisWeek(user?.id ?? "");

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Meetings This Week
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/meetings/schedule" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : !meetings || meetings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No meetings scheduled this week.</p>
        ) : (
          <ul className="space-y-2">
            {meetings.map((meeting) => (
              <li key={meeting.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    to={`/meetings/${meeting.id}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {meeting.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">{formatTime(meeting.scheduled_at)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {meeting.status && (
                    <Badge variant="outline" className="text-xs">
                      {meeting.status}
                    </Badge>
                  )}
                  {meeting.join_url && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                      <a href={meeting.join_url} target="_blank" rel="noopener noreferrer" title="Join meeting">
                        <Video className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
