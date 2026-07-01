/**
 * Agenda Item Takeaways
 *
 * Displays takeaways linked to a specific agenda item and provides
 * an inline form for adding new takeaways scoped to that item.
 */

import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  ArrowRight,
  StickyNote,
  Lightbulb,
  Loader2,
} from "lucide-react";
import { useMeetingTakeaways } from "../../hooks/useMeetingTakeaways";
import InlineTakeawayForm from "../takeaways/InlineTakeawayForm";
import type { TakeawayType } from "../../types";

interface AgendaItemTakeawaysProps {
  meetingId: string;
  agendaItemId: string;
}

const typeIcons: Record<TakeawayType, React.ReactNode> = {
  decision: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,
  action_item: <ArrowRight className="h-3.5 w-3.5 text-blue-600" />,
  note: <StickyNote className="h-3.5 w-3.5 text-gray-600" />,
  follow_up: <Lightbulb className="h-3.5 w-3.5 text-yellow-600" />,
};

const typeLabels: Record<TakeawayType, string> = {
  decision: "Decision",
  action_item: "Action Item",
  note: "Note",
  follow_up: "Follow Up",
};

const typeBadgeClasses: Record<TakeawayType, string> = {
  decision: "bg-green-100 text-green-800",
  action_item: "bg-blue-100 text-blue-800",
  note: "bg-gray-100 text-gray-800",
  follow_up: "bg-yellow-100 text-yellow-800",
};

export default function AgendaItemTakeaways({
  meetingId,
  agendaItemId,
}: AgendaItemTakeawaysProps) {
  const { data: allTakeaways = [], isLoading } = useMeetingTakeaways(meetingId);

  const takeaways = allTakeaways.filter(
    (t) => t.agenda_item_id === agendaItemId
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {takeaways.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          No takeaways for this agenda item.
        </p>
      ) : (
        <div className="space-y-2">
          {takeaways.map((takeaway) => (
            <div
              key={takeaway.id}
              className={`flex items-start gap-2 py-1.5 ${
                takeaway.is_completed ? "opacity-60" : ""
              }`}
            >
              <span className="mt-0.5 shrink-0">
                {typeIcons[takeaway.takeaway_type]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge
                    className={`${typeBadgeClasses[takeaway.takeaway_type]} text-xs`}
                  >
                    {typeLabels[takeaway.takeaway_type]}
                  </Badge>
                  {takeaway.is_completed && (
                    <Badge variant="outline" className="text-xs">
                      Completed
                    </Badge>
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
          ))}
        </div>
      )}

      <InlineTakeawayForm meetingId={meetingId} agendaItemId={agendaItemId} />
    </div>
  );
}
