/**
 * Previous Agenda Viewer
 *
 * Displays the agenda from the most recent previous meeting in a recurring series.
 * Useful for reviewing what was discussed in the last occurrence.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock, Loader2 } from "lucide-react";
import type { MeetingAgendaItem } from "../../types";

interface PreviousAgendaViewerProps {
  seriesId: string;
  currentMeetingId: string;
}

interface PreviousMeeting {
  id: string;
  title: string;
  scheduled_at: string | null;
}

export function PreviousAgendaViewer({
  seriesId,
  currentMeetingId,
}: PreviousAgendaViewerProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["previous-agenda", seriesId, currentMeetingId],
    queryFn: async () => {
      // Find the most recent previous meeting in this series
      const { data: meetings, error: meetingsError } = await supabase
        .from("meetings")
        .select("id, title, scheduled_at")
        .eq("series_id", seriesId)
        .neq("id", currentMeetingId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (meetingsError) throw meetingsError;
      if (!meetings || meetings.length === 0) return null;

      const previousMeeting = meetings[0] as PreviousMeeting;

      // Fetch agenda items for that meeting
      const { data: agendaItems, error: agendaError } = await supabase
        .from("meeting_agenda_items")
        .select("*")
        .eq("meeting_id", previousMeeting.id)
        .order("sort_order");

      if (agendaError) throw agendaError;

      return {
        meeting: previousMeeting,
        agendaItems: (agendaItems || []) as unknown as MeetingAgendaItem[],
      };
    },
    enabled: !!seriesId && !!currentMeetingId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Previous Agenda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Previous Agenda</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No previous meeting found
          </p>
        </CardContent>
      </Card>
    );
  }

  const { meeting, agendaItems } = data;
  const meetingDate = meeting.scheduled_at;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Previous Agenda</CardTitle>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Previous Meeting: {meeting.title}</span>
          {meetingDate && (
            <Badge variant="outline" className="text-xs">
              {new Date(meetingDate).toLocaleDateString()}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {agendaItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No agenda items in the previous meeting.
          </p>
        ) : (
          <div className="space-y-2">
            {agendaItems.map((item) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 rounded-md border px-3 py-2 ${
                  item.is_completed ? "opacity-60" : ""
                }`}
              >
                <div className="mt-0.5">
                  {item.is_completed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      item.is_completed ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                  )}
                </div>
                {item.duration_minutes && (
                  <Badge variant="outline" className="text-xs shrink-0 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {item.duration_minutes}m
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
