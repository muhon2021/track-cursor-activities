/**
 * General Takeaways Section
 *
 * Displays takeaways that are not linked to any agenda item
 * (agenda_item_id is null). Renders each takeaway with type badge,
 * content, assignee, and due date.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  ArrowRight,
  StickyNote,
  Lightbulb,
  Loader2,
} from "lucide-react";
import { useMeetingTakeaways } from "../../hooks/useMeetingTakeaways";
import type { TakeawayType } from "../../types";

interface GeneralTakeawaysSectionProps {
  meetingId: string;
}

const typeConfig: Record<
  TakeawayType,
  { icon: React.ReactNode; label: string; className: string }
> = {
  decision: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    label: "Decision",
    className: "bg-green-100 text-green-800",
  },
  action_item: {
    icon: <ArrowRight className="h-3.5 w-3.5" />,
    label: "Action Item",
    className: "bg-blue-100 text-blue-800",
  },
  note: {
    icon: <StickyNote className="h-3.5 w-3.5" />,
    label: "Note",
    className: "bg-gray-100 text-gray-800",
  },
  follow_up: {
    icon: <Lightbulb className="h-3.5 w-3.5" />,
    label: "Follow Up",
    className: "bg-yellow-100 text-yellow-800",
  },
};

export default function GeneralTakeawaysSection({
  meetingId,
}: GeneralTakeawaysSectionProps) {
  const { data: allTakeaways = [], isLoading } = useMeetingTakeaways(meetingId);

  const generalTakeaways = allTakeaways.filter(
    (t) => t.agenda_item_id === null
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">General Takeaways</CardTitle>
      </CardHeader>
      <CardContent>
        {generalTakeaways.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No general takeaways yet.
          </p>
        ) : (
          <div className="space-y-3">
            {generalTakeaways.map((takeaway) => {
              const config = typeConfig[takeaway.takeaway_type];
              return (
                <div
                  key={takeaway.id}
                  className={`flex items-start gap-3 py-2 ${
                    takeaway.is_completed ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        className={`${config.className} flex items-center gap-1`}
                      >
                        {config.icon}
                        {config.label}
                      </Badge>
                      {takeaway.assignee && (
                        <span className="text-xs text-muted-foreground">
                          {takeaway.assignee.full_name}
                        </span>
                      )}
                      {takeaway.due_date && (
                        <span className="text-xs text-muted-foreground">
                          Due: {new Date(takeaway.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-sm ${
                        takeaway.is_completed
                          ? "line-through text-muted-foreground"
                          : ""
                      }`}
                    >
                      {takeaway.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
