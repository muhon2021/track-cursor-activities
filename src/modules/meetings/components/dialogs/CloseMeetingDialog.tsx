/**
 * Close Meeting Dialog
 *
 * Confirmation dialog for closing/completing a meeting with optional closing notes.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useUpdateMeetingV2 } from "../../hooks/useMeetingsV2";

interface CloseMeetingDialogProps {
  meetingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CloseMeetingDialog({
  meetingId,
  open,
  onOpenChange,
}: CloseMeetingDialogProps) {
  const [closingNotes, setClosingNotes] = useState("");
  const updateMeeting = useUpdateMeetingV2();

  const handleClose = () => {
    updateMeeting.mutate(
      {
        id: meetingId,
        data: {
          status: "completed",
          notes: closingNotes.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setClosingNotes("");
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close Meeting</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to close this meeting? This will mark it as completed.
          </p>
          <div>
            <label className="text-sm font-medium mb-1 block">
              Closing Notes (optional)
            </label>
            <Textarea
              placeholder="Add any final notes or summary..."
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateMeeting.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleClose}
            disabled={updateMeeting.isPending}
          >
            {updateMeeting.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {updateMeeting.isPending ? "Closing..." : "Close Meeting"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
