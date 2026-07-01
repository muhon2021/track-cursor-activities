/**
 * Add Participant Dialog
 *
 * Dialog form for adding a new participant to a meeting with name, email, and role fields.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAddParticipant } from "../../hooks/useMeetingParticipants";
import type { ParticipantRole } from "../../types";

interface AddParticipantDialogProps {
  meetingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddParticipantDialog({
  meetingId,
  open,
  onOpenChange,
}: AddParticipantDialogProps) {
  const addParticipant = useAddParticipant();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ParticipantRole>("attendee");

  const resetFields = () => {
    setName("");
    setEmail("");
    setRole("attendee");
  };

  const handleAdd = () => {
    if (!name.trim() && !email.trim()) return;

    addParticipant.mutate(
      {
        meetingId,
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        role,
      },
      {
        onSuccess: () => {
          resetFields();
          onOpenChange(false);
        },
      }
    );
  };

  const handleCancel = () => {
    resetFields();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Participant</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Name</label>
            <Input
              placeholder="Participant name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Email</label>
            <Input
              type="email"
              placeholder="participant@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Role</label>
            <Select value={role} onValueChange={(v) => setRole(v as ParticipantRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="organizer">Organizer</SelectItem>
                <SelectItem value="presenter">Presenter</SelectItem>
                <SelectItem value="attendee">Attendee</SelectItem>
                <SelectItem value="optional">Optional</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={(!name.trim() && !email.trim()) || addParticipant.isPending}
          >
            {addParticipant.isPending ? "Adding..." : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
