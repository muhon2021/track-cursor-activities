/**
 * Edit Meeting Series Confirm Dialog
 *
 * Confirmation dialog that asks the user whether to apply changes to
 * just this meeting, all meetings in the series, or this and future meetings.
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

interface EditMeetingSeriesConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (scope: "this" | "all" | "future") => void;
}

type EditScope = "this" | "all" | "future";

const scopeOptions: { value: EditScope; label: string; description: string }[] = [
  {
    value: "this",
    label: "This meeting only",
    description: "Changes will only apply to this single occurrence.",
  },
  {
    value: "all",
    label: "All meetings in series",
    description: "Changes will apply to every meeting in this recurring series.",
  },
  {
    value: "future",
    label: "This and future meetings",
    description: "Changes will apply to this meeting and all future occurrences.",
  },
];

export default function EditMeetingSeriesConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
}: EditMeetingSeriesConfirmDialogProps) {
  const [selectedScope, setSelectedScope] = useState<EditScope>("this");

  const handleConfirm = () => {
    onConfirm(selectedScope);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Recurring Meeting</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            This meeting is part of a recurring series. How would you like to apply your changes?
          </p>
          <div className="space-y-2">
            {scopeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  selectedScope === option.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
                onClick={() => setSelectedScope(option.value)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                      selectedScope === option.value
                        ? "border-primary"
                        : "border-muted-foreground/40"
                    }`}
                  >
                    {selectedScope === option.value && (
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
