/**
 * Related Tasks Tab
 *
 * Displays action items, follow-ups, and takeaways linked to tasks for a meeting.
 * Groups items into "Action Items" and "Linked Tasks" sections.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, ListTodo } from "lucide-react";
import type { MeetingTakeaway, TakeawayType } from "../types";

interface RelatedTasksTabProps {
  meetingId: string;
}

const typeBadgeConfig: Record<TakeawayType, { label: string; className: string }> = {
  action_item: { label: "Action Item", className: "bg-blue-100 text-blue-800" },
  follow_up: { label: "Follow Up", className: "bg-orange-100 text-orange-800" },
  decision: { label: "Decision", className: "bg-purple-100 text-purple-800" },
  note: { label: "Note", className: "bg-gray-100 text-gray-800" },
};

export function RelatedTasksTab({ meetingId }: RelatedTasksTabProps) {
  const { data: takeaways = [], isLoading } = useQuery({
    queryKey: ["meeting-related-tasks", meetingId],
    queryFn: async (): Promise<MeetingTakeaway[]> => {
      const { data, error } = await supabase
        .from("meeting_takeaways")
        .select("*")
        .eq("meeting_id", meetingId);

      if (error) throw error;
      return (data || []) as unknown as MeetingTakeaway[];
    },
    enabled: !!meetingId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Action items: takeaways with type action_item or follow_up
  const actionItems = takeaways.filter(
    (t) => t.takeaway_type === "action_item" || t.takeaway_type === "follow_up"
  );

  // Linked tasks: any takeaway that has been converted to a task
  const linkedTasks = takeaways.filter((t) => t.task_id != null);

  const hasContent = actionItems.length > 0 || linkedTasks.length > 0;

  if (!hasContent) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <ListTodo className="h-8 w-8 mb-2" />
          <p>No action items or tasks linked to this meeting</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Items section */}
      {actionItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Action Items</h3>
            <Badge variant="outline">{actionItems.length}</Badge>
          </div>
          <div className="space-y-2">
            {actionItems.map((item) => {
              const config = typeBadgeConfig[item.takeaway_type];
              return (
                <Card
                  key={item.id}
                  className={item.is_completed ? "opacity-60" : ""}
                >
                  <CardContent className="flex items-start gap-3 py-3 px-4">
                    <Checkbox
                      className="mt-0.5"
                      checked={item.is_completed}
                      disabled
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <Badge className={`${config.className} text-xs`}>
                          {config.label}
                        </Badge>
                        {item.is_completed && (
                          <Badge className="bg-green-100 text-green-800 text-xs flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Completed
                          </Badge>
                        )}
                      </div>
                      <p
                        className={`text-sm ${
                          item.is_completed
                            ? "line-through text-muted-foreground"
                            : ""
                        }`}
                      >
                        {item.content}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {item.assignee && (
                          <span>Assigned to: {item.assignee.full_name}</span>
                        )}
                        {item.due_date && (
                          <span>
                            Due: {new Date(item.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Linked Tasks section */}
      {linkedTasks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Linked Tasks</h3>
            <Badge variant="outline">{linkedTasks.length}</Badge>
          </div>
          <div className="space-y-2">
            {linkedTasks.map((item) => {
              const config = typeBadgeConfig[item.takeaway_type];
              return (
                <Card
                  key={item.id}
                  className={item.is_completed ? "opacity-60" : ""}
                >
                  <CardContent className="flex items-start gap-3 py-3 px-4">
                    <Checkbox
                      className="mt-0.5"
                      checked={item.is_completed}
                      disabled
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <Badge className={`${config.className} text-xs`}>
                          {config.label}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          Converted to Task
                        </Badge>
                        {item.is_completed && (
                          <Badge className="bg-green-100 text-green-800 text-xs flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Completed
                          </Badge>
                        )}
                      </div>
                      <p
                        className={`text-sm ${
                          item.is_completed
                            ? "line-through text-muted-foreground"
                            : ""
                        }`}
                      >
                        {item.content}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {item.assignee && (
                          <span>Assigned to: {item.assignee.full_name}</span>
                        )}
                        {item.due_date && (
                          <span>
                            Due: {new Date(item.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
