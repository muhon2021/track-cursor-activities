/**
 * Series History Tab
 *
 * Displays a timeline of all meetings in a recurring series with status and navigation.
 */

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, Loader2 } from "lucide-react";

interface SeriesHistoryTabProps {
  seriesId: string;
}

interface SeriesMeeting {
  id: string;
  title: string;
  scheduled_at: string | null;
  status: string | null;
  duration_minutes: number | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-800" },
  completed: { label: "Completed", className: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-800" },
  in_progress: { label: "In Progress", className: "bg-yellow-100 text-yellow-800" },
  no_show: { label: "No Show", className: "bg-gray-100 text-gray-800" },
};

export function SeriesHistoryTab({ seriesId }: SeriesHistoryTabProps) {
  const navigate = useNavigate();

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["series-history", seriesId],
    queryFn: async (): Promise<SeriesMeeting[]> => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id, title, scheduled_at, status, duration_minutes, created_at")
        .eq("series_id", seriesId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as SeriesMeeting[];
    },
    enabled: !!seriesId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getMeetingDate = (meeting: SeriesMeeting): string | null => {
    return meeting.scheduled_at || meeting.created_at;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">Series History</h3>
        <Badge variant="outline">{meetings.length} meetings</Badge>
      </div>

      {/* Meeting list */}
      {meetings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <p>No meetings in this series yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {meetings.map((meeting) => {
            const date = getMeetingDate(meeting);
            const config = statusConfig[meeting.status || ""] || {
              label: meeting.status || "Unknown",
              className: "bg-gray-100 text-gray-800",
            };

            return (
              <Card
                key={meeting.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => navigate(`/meetings/${meeting.id}`)}
              >
                <CardContent className="flex items-center gap-3 py-3 px-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{meeting.title}</p>
                    {date && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Calendar className="h-3 w-3" />
                        {new Date(date).toLocaleDateString(undefined, {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {meeting.duration_minutes && (
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {meeting.duration_minutes}m
                      </Badge>
                    )}
                    <Badge className={config.className}>{config.label}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
