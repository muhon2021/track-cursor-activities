/**
 * Unassigned Takeaways
 *
 * Displays takeaways where assigned_to is null, helping surface items
 * that need to be assigned to a team member.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ArrowRight,
  StickyNote,
  Lightbulb,
  UserPlus,
  Loader2,
} from "lucide-react";
import { useMeetingTakeaways } from "../../hooks/useMeetingTakeaways";
import type { TakeawayType } from "../../types";

interface UnassignedTakeawaysProps {
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

export default function UnassignedTakeaways({
  meetingId,
}: UnassignedTakeawaysProps) {
  const { data: allTakeaways = [], isLoading } = useMeetingTakeaways(meetingId);

  const unassignedTakeaways = allTakeaways.filter(
    (t) => t.assigned_to === null
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
        <CardTitle className="flex items-center gap-2 text-base">
          Unassigned Takeaways
          <Badge variant="outline">{unassignedTakeaways.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {unassignedTakeaways.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            All takeaways have been assigned.
          </p>
        ) : (
          <div className="space-y-3">
            {unassignedTakeaways.map((takeaway) => {
              const config = typeConfig[takeaway.takeaway_type];
              return (
                <div
                  key={takeaway.id}
                  className="flex items-start gap-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        className={`${config.className} flex items-center gap-1`}
                      >
                        {config.icon}
                        {config.label}
                      </Badge>
                    </div>
                    <p className="text-sm">{takeaway.content}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-muted-foreground"
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Assign
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
