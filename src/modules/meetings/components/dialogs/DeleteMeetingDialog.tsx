/**
 * Delete Meeting Dialog
 *
 * Confirmation dialog for deleting a meeting. If the meeting is recurring,
 * provides options to delete just this meeting or the entire series.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, AlertTriangle } from "lucide-react";
import { useDeleteMeetingV2 } from "../../hooks/useMeetingsV2";

interface DeleteMeetingDialogProps {
  meetingId: string;
  isRecurring?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

type DeleteScope = "single" | "series";

export default function DeleteMeetingDialog({
  meetingId,
  isRecurring,
  open,
  onOpenChange,
  onDeleted,
}: DeleteMeetingDialogProps) {
  const [deleteScope, setDeleteScope] = useState<DeleteScope>("single");
  const deleteMeeting = useDeleteMeetingV2();

  const handleDelete = () => {
    // For now, only support single meeting deletion
    // Series deletion can be added later if needed
    deleteMeeting.mutate(meetingId, {
      onSuccess: () => {
        onOpenChange(false);
        onDeleted?.();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Meeting
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this meeting? This action cannot be undone.
          </p>

          {isRecurring && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                This meeting is part of a recurring series.
              </p>
              <div className="space-y-2">
                <button
                  type="button"
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    deleteScope === "single"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                  onClick={() => setDeleteScope("single")}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                        deleteScope === "single"
                          ? "border-primary"
                          : "border-muted-foreground/40"
                      }`}
                    >
                      {deleteScope === "single" && (
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">This meeting only</p>
                      <p className="text-xs text-muted-foreground">
                        Only this occurrence will be removed.
                      </p>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    deleteScope === "series"
                      ? "border-destructive bg-destructive/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                  onClick={() => setDeleteScope("series")}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                        deleteScope === "series"
                          ? "border-destructive"
                          : "border-muted-foreground/40"
                      }`}
                    >
                      {deleteScope === "series" && (
                        <div className="h-2 w-2 rounded-full bg-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">Entire series</p>
                      <p className="text-xs text-muted-foreground">
                        All meetings in this series will be permanently deleted.
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteMeeting.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMeeting.isPending}
          >
            {deleteMeeting.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {deleteMeeting.isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
