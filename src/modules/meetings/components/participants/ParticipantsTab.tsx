/**
 * Participants Tab Component
 *
 * Displays meeting participants with RSVP status and attendance tracking.
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  UserCheck,
  UserX,
  UserMinus,
  Loader2,
} from "lucide-react";
import {
  useMeetingParticipants,
  useAddParticipant,
  useRemoveParticipant,
  useUpdateParticipantAttendance,
} from "../../hooks/useMeetingParticipants";
import type { MeetingParticipant, RSVPStatus } from "../../types";

interface ParticipantsTabProps {
  meetingId: string;
}

const rsvpConfig: Record<RSVPStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-gray-100 text-gray-800" },
  accepted: { label: "Accepted", className: "bg-green-100 text-green-800" },
  declined: { label: "Declined", className: "bg-red-100 text-red-800" },
  tentative: { label: "Tentative", className: "bg-yellow-100 text-yellow-800" },
};

const roleLabels: Record<string, string> = {
  organizer: "Organizer",
  presenter: "Presenter",
  attendee: "Attendee",
  optional: "Optional",
};

export function ParticipantsTab({ meetingId }: ParticipantsTabProps) {
  const { data: participants = [], isLoading } = useMeetingParticipants(meetingId);
  const addParticipant = useAddParticipant();
  const removeParticipant = useRemoveParticipant();
  const updateAttendance = useUpdateParticipantAttendance();

  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");

  const attended = participants.filter((p) => p.attended).length;
  const accepted = participants.filter((p) => p.rsvp_status === "accepted").length;

  const handleAdd = () => {
    if (!newEmail.trim() && !newName.trim()) return;
    addParticipant.mutate(
      {
        meetingId,
        email: newEmail.trim() || undefined,
        name: newName.trim() || undefined,
      },
      {
        onSuccess: () => {
          setNewEmail("");
          setNewName("");
          setShowAdd(false);
        },
      }
    );
  };

  const handleRemove = (id: string) => {
    removeParticipant.mutate({ id, meetingId });
  };

  const handleToggleAttendance = (p: MeetingParticipant) => {
    updateAttendance.mutate({
      id: p.id,
      meetingId,
      attended: !p.attended,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getInitials = (p: MeetingParticipant) => {
    const name = p.user?.full_name || p.name || p.email || "?";
    return name
      .split(" ")
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Participants</h3>
          <Badge variant="outline">{participants.length} invited</Badge>
          <Badge variant="secondary">{accepted} accepted</Badge>
          <Badge variant="secondary">{attended} attended</Badge>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Add participant form */}
      {showAdd && (
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <Input
                className="flex-1"
                placeholder="Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Input
                className="flex-1"
                placeholder="Email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={(!newEmail.trim() && !newName.trim()) || addParticipant.isPending}
              >
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Participant list */}
      {participants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <p>No participants added.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {participants.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center gap-3 py-3 px-4">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs">{getInitials(p)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {p.user?.full_name || p.name || p.email || "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.user?.email || p.email || ""}
                    {p.role !== "attendee" && ` \u2022 ${roleLabels[p.role]}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={rsvpConfig[p.rsvp_status]?.className || ""}>
                    {rsvpConfig[p.rsvp_status]?.label || p.rsvp_status}
                  </Badge>
                  {p.attended ? (
                    <Badge className="bg-green-100 text-green-800">
                      <UserCheck className="h-3 w-3 mr-1" />
                      Present
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      <UserX className="h-3 w-3 mr-1" />
                      Absent
                    </Badge>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleToggleAttendance(p)}>
                        {p.attended ? "Mark Absent" : "Mark Present"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleRemove(p.id)}
                      >
                        <UserMinus className="h-4 w-4 mr-2" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
