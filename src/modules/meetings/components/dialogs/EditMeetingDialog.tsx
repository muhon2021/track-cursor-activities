/**
 * Edit Meeting Dialog
 *
 * Dialog form for editing an existing meeting's details including title,
 * description, schedule, duration, location, type, timezone, and notes.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2 } from "lucide-react";
import { useUpdateMeetingV2 } from "../../hooks/useMeetingsV2";
import DateTimePicker from "../common/DateTimePicker";
import type { MeetingV2, MeetingType } from "../../types/meetings";

interface EditMeetingDialogProps {
  meeting: MeetingV2;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditMeetingDialog({
  meeting,
  open,
  onOpenChange,
}: EditMeetingDialogProps) {

  const [title, setTitle] = useState(meeting.title);
  const [description, setDescription] = useState(meeting.description || "");
  const [scheduledAt, setScheduledAt] = useState(
    meeting.scheduled_at
      ? new Date(meeting.scheduled_at).toISOString().slice(0, 16)
      : ""
  );
  const [durationMinutes, setDurationMinutes] = useState(
    meeting.duration_minutes?.toString() || ""
  );
  const [location, setLocation] = useState(meeting.location || "");
  const [meetingType, setMeetingType] = useState<MeetingType>((meeting.meeting_type || 'internal') as MeetingType);
  const [timezone, setTimezone] = useState(meeting.timezone || "UTC");
  const [notes, setNotes] = useState(meeting.notes || "");

  useEffect(() => {
    if (open) {
      setTitle(meeting.title);
      setDescription(meeting.description || "");
      setScheduledAt(
        meeting.scheduled_at
          ? new Date(meeting.scheduled_at).toISOString().slice(0, 16)
          : ""
      );
      setDurationMinutes(meeting.duration_minutes?.toString() || "60");
      setLocation(meeting.location || "");
      setMeetingType((meeting.meeting_type || 'internal') as MeetingType);
      setTimezone(meeting.timezone || "UTC");
      setNotes(meeting.notes || "");
    }
  }, [open, meeting]);

  const updateMeeting = useUpdateMeetingV2();

  const handleSave = () => {
    if (!title.trim()) return;
    updateMeeting.mutate({
      id: meeting.id,
      data: {
        title: title.trim(),
        description: description.trim() || undefined,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : meeting.scheduled_at,
        duration_minutes: durationMinutes ? parseInt(durationMinutes) : 60,
        location: location.trim() || undefined,
        meeting_type: meetingType,
        timezone: timezone.trim() || "UTC",
        notes: notes.trim() || undefined,
      },
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Meeting</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Title</label>
            <Input
              placeholder="Meeting title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <Textarea
              placeholder="Meeting description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Scheduled At</label>
              <DateTimePicker
                value={scheduledAt}
                onChange={setScheduledAt}
                timezone={timezone}
                disabled={updateMeeting.isPending}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Duration (minutes)</label>
              <Input
                type="number"
                placeholder="60"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                min={1}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Location</label>
            <Input
              placeholder="Room name or URL"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Meeting Type</label>
            <Select value={meetingType} onValueChange={(v) => setMeetingType(v as MeetingType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="l10">L10</SelectItem>
                <SelectItem value="one_on_one">One-on-One</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Timezone</label>
            <Input
              placeholder="e.g. America/New_York"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Notes</label>
            <Textarea
              placeholder="Additional notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={updateMeeting.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || updateMeeting.isPending}
          >
            {updateMeeting.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {updateMeeting.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
