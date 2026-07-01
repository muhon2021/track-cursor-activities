/**
 * Close OKR Dialog
 *
 * Dialog for closing or completing an OKR with optional notes.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2, XCircle } from "lucide-react";
import type { OKR } from "../../types";

interface CloseOKRDialogProps {
  okr: OKR;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: (data: { status: "completed" | "closed"; notes?: string }) => void;
  isClosing?: boolean;
}

export function CloseOKRDialog({
  okr,
  open,
  onOpenChange,
  onClose,
  isClosing,
}: CloseOKRDialogProps) {
  const [status, setStatus] = useState<"completed" | "closed">("completed");
  const [notes, setNotes] = useState("");

  const handleConfirm = () => {
    onClose({
      status,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close OKR</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">{okr.title}</p>
            <div className="flex items-center gap-2">
              <Progress value={okr.progress} className="h-2 flex-1" />
              <span className="text-sm text-muted-foreground">
                {Math.round(okr.progress)}%
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Outcome</Label>
            <RadioGroup
              value={status}
              onValueChange={(v) => setStatus(v as "completed" | "closed")}
              className="grid gap-3"
            >
              <label
                htmlFor="close-completed"
                className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors [&:has([data-state=checked])]:border-green-500 [&:has([data-state=checked])]:bg-green-50"
              >
                <RadioGroupItem value="completed" id="close-completed" />
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Completed</p>
                  <p className="text-xs text-muted-foreground">
                    Objective was achieved successfully
                  </p>
                </div>
              </label>

              <label
                htmlFor="close-closed"
                className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors [&:has([data-state=checked])]:border-gray-400 [&:has([data-state=checked])]:bg-gray-50"
              >
                <RadioGroupItem value="closed" id="close-closed" />
                <XCircle className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">Closed / Cancelled</p>
                  <p className="text-xs text-muted-foreground">
                    Objective was cancelled or is no longer relevant
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="close-notes">Notes (optional)</Label>
            <Textarea
              id="close-notes"
              placeholder="Add any closing remarks or lessons learned..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isClosing}>
            {isClosing ? "Closing..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
