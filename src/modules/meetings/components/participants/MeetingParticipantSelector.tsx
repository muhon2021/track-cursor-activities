/**
 * Meeting Participant Selector
 *
 * Inline participant list with add/remove capabilities and compact display.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, X, Loader2 } from "lucide-react";
import {
  useMeetingParticipants,
  useRemoveParticipant,
} from "../../hooks/useMeetingParticipants";
import { AddParticipantDialog } from "./AddParticipantDialog";
import type { MeetingParticipant } from "../../types";

interface MeetingParticipantSelectorProps {
  meetingId: string;
  editable?: boolean;
}

const roleColors: Record<string, string> = {
  organizer: "bg-purple-100 text-purple-800",
  presenter: "bg-blue-100 text-blue-800",
  attendee: "bg-gray-100 text-gray-800",
  optional: "bg-yellow-100 text-yellow-800",
};

function getInitials(participant: MeetingParticipant): string {
  const name =
    participant.user?.full_name || participant.name || participant.email || "?";
  return name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getDisplayName(participant: MeetingParticipant): string {
  return (
    participant.user?.full_name ||
    participant.name ||
    participant.email ||
    "Unknown"
  );
}

function getDisplayEmail(participant: MeetingParticipant): string {
  return participant.user?.email || participant.email || "";
}

export function MeetingParticipantSelector({
  meetingId,
  editable = false,
}: MeetingParticipantSelectorProps) {
  const { data: participants = [], isLoading } = useMeetingParticipants(meetingId);
  const removeParticipant = useRemoveParticipant();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleRemove = (id: string) => {
    removeParticipant.mutate({ id, meetingId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary line */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {participants.length} participant{participants.length !== 1 ? "s" : ""}
        </span>
        {editable && (
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Participant
          </Button>
        )}
      </div>

      {/* Compact participant list */}
      {participants.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No participants added yet.
        </p>
      ) : (
        <div className="space-y-1.5">
          {participants.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-md border px-3 py-2"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">
                  {getInitials(p)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate leading-tight">
                  {getDisplayName(p)}
                </p>
                {getDisplayEmail(p) && (
                  <p className="text-xs text-muted-foreground truncate">
                    {getDisplayEmail(p)}
                  </p>
                )}
              </div>
              <Badge className={`text-xs shrink-0 ${roleColors[p.role] || ""}`}>
                {p.role}
              </Badge>
              {editable && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => handleRemove(p.id)}
                  disabled={removeParticipant.isPending}
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add participant dialog */}
      <AddParticipantDialog
        meetingId={meetingId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
