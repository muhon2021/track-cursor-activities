/**
 * Add Takeaway Dialog
 *
 * Dialog form for adding a new takeaway (decision, action item, note, follow-up)
 * to a meeting or specific agenda item.
 */

import { useState } from "react";
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
import { useAddTakeaway } from "../../hooks/useMeetingTakeaways";
import type { TakeawayType, TakeawayPriority } from "../../types";

interface AddTakeawayDialogProps {
  meetingId: string;
  agendaItemId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddTakeawayDialog({
  meetingId,
  agendaItemId,
  open,
  onOpenChange,
}: AddTakeawayDialogProps) {
  const addTakeaway = useAddTakeaway();

  const [content, setContent] = useState("");
  const [takeawayType, setTakeawayType] = useState<TakeawayType>("note");
  const [priority, setPriority] = useState<TakeawayPriority>("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");

  const showAssignmentFields =
    takeawayType === "action_item" || takeawayType === "follow_up";

  const resetForm = () => {
    setContent("");
    setTakeawayType("note");
    setPriority("medium");
    setAssignedTo("");
    setDueDate("");
  };

  const handleAdd = () => {
    if (!content.trim()) return;

    addTakeaway.mutate(
      {
        meetingId,
        data: {
          content: content.trim(),
          takeaway_type: takeawayType,
          agenda_item_id: agendaItemId,
          assigned_to: showAssignmentFields && assignedTo.trim() ? assignedTo.trim() : undefined,
          due_date: showAssignmentFields && dueDate ? dueDate : undefined,
        },
      },
      {
        onSuccess: () => {
          resetForm();
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Takeaway</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Content</label>
            <Textarea
              placeholder="Describe the takeaway..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Type</label>
              <Select
                value={takeawayType}
                onValueChange={(v) => setTakeawayType(v as TakeawayType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="decision">Decision</SelectItem>
                  <SelectItem value="action_item">Action Item</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="follow_up">Follow Up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Priority</label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TakeawayPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {showAssignmentFields && (
            <>
              <div>
                <label className="text-sm font-medium mb-1 block">Assigned To</label>
                <Input
                  placeholder="User ID or email"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Due Date</label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!content.trim() || addTakeaway.isPending}
          >
            {addTakeaway.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {addTakeaway.isPending ? "Adding..." : "Add Takeaway"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
