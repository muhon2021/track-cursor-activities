/**
 * Takeaways Column
 *
 * Displays takeaways grouped by type (decision, action_item, note, follow_up)
 * within a card. Includes an inline form for adding new takeaways.
 * Used as part of the AgendaTakeawaysPanel split view.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  ArrowRight,
  StickyNote,
  Lightbulb,
} from "lucide-react";
import InlineTakeawayForm from "../takeaways/InlineTakeawayForm";
import type { MeetingTakeaway, TakeawayType } from "../../types";

interface TakeawaysColumnProps {
  meetingId: string;
  takeaways: MeetingTakeaway[];
  agendaItemId?: string;
}

const typeConfig: Record<
  TakeawayType,
  { icon: React.ReactNode; label: string; className: string }
> = {
  decision: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    label: "Decisions",
    className: "bg-green-100 text-green-800",
  },
  action_item: {
    icon: <ArrowRight className="h-3.5 w-3.5" />,
    label: "Action Items",
    className: "bg-blue-100 text-blue-800",
  },
  note: {
    icon: <StickyNote className="h-3.5 w-3.5" />,
    label: "Notes",
    className: "bg-gray-100 text-gray-800",
  },
  follow_up: {
    icon: <Lightbulb className="h-3.5 w-3.5" />,
    label: "Follow Ups",
    className: "bg-yellow-100 text-yellow-800",
  },
};

const typeOrder: TakeawayType[] = ["decision", "action_item", "note", "follow_up"];

export default function TakeawaysColumn({
  meetingId,
  takeaways,
  agendaItemId,
}: TakeawaysColumnProps) {
  const grouped = typeOrder
    .map((type) => ({
      type,
      config: typeConfig[type],
      items: takeaways.filter((t) => t.takeaway_type === type),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          Takeaways
          <Badge variant="outline">{takeaways.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {takeaways.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No takeaways yet
          </p>
        )}

        {grouped.map((group) => (
          <div key={group.type}>
            <div className="flex items-center gap-2 mb-2">
              <Badge className={`${group.config.className} flex items-center gap-1`}>
                {group.config.icon}
                {group.config.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                ({group.items.length})
              </span>
            </div>
            <div className="space-y-1 pl-2">
              {group.items.map((takeaway) => (
                <div
                  key={takeaway.id}
                  className={`text-sm py-1 ${
                    takeaway.is_completed
                      ? "line-through text-muted-foreground"
                      : ""
                  }`}
                >
                  {takeaway.content}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="pt-2 border-t">
          <InlineTakeawayForm
            meetingId={meetingId}
            agendaItemId={agendaItemId}
          />
        </div>
      </CardContent>
    </Card>
  );
}
