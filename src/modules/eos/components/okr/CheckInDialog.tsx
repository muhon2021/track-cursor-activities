/**
 * Check-In Dialog
 *
 * Dialog for recording a check-in: update message (required), optional progress change.
 * Matches design: OKR context card, Update textarea, Progress Change optional, Post Check-in.
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCheckIn } from "../../hooks/useOKRs";
import { Send } from "lucide-react";
import type { OKRKeyResult } from "../../types";

interface CheckInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyResult: OKRKeyResult;
  okrId: string;
  /** OKR title for context card when opened from detail view */
  okrTitle?: string;
}

export function CheckInDialog({
  open,
  onOpenChange,
  keyResult,
  okrId,
  okrTitle,
}: CheckInDialogProps) {
  const [update, setUpdate] = useState("");
  const [progressChange, setProgressChange] = useState("");
  const checkIn = useCheckIn();

  const currentProgressLabel =
    keyResult.unit === "percent" || keyResult.unit === "percentage"
      ? `${keyResult.current_value}%`
      : `${keyResult.current_value} ${keyResult.unit || ""}`.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const notes = update.trim();
    if (!notes) return;

    let newValue = keyResult.current_value;
    if (progressChange.trim() !== "") {
      const delta = parseFloat(progressChange.replace(/^\+/, ""));
      if (!isNaN(delta)) {
        newValue = keyResult.current_value + delta;
        const isPercent =
          keyResult.unit === "percent" || keyResult.unit === "percentage";
        if (isPercent) {
          newValue = Math.max(0, Math.min(100, Math.round(newValue * 100) / 100));
        } else {
          newValue = Math.round(newValue * 100) / 100;
        }
      }
    }

    await checkIn.mutateAsync({
      okr_id: okrId,
      key_result_id: keyResult.id,
      previous_value: keyResult.current_value,
      new_value: newValue,
      confidence: "medium",
      notes,
    });

    setUpdate("");
    setProgressChange("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Add Check-in</DialogTitle>
          <p className="text-sm text-muted-foreground font-normal">
            Share progress, blockers, or insights about this OKR
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="font-medium text-sm">
              {okrTitle || keyResult.title}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Current progress: {currentProgressLabel}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="update">
              Update <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="update"
              placeholder="What's the status? Any blockers? What's next?"
              value={update}
              onChange={(e) => setUpdate(e.target.value)}
              rows={4}
              className="resize-none"
              required
            />
            <p className="text-xs text-muted-foreground">
              Share your progress, challenges, or learnings
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="progressChange">Progress Change (Optional)</Label>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                id="progressChange"
                type="text"
                inputMode="numeric"
                placeholder="e.g., +10 or -5"
                value={progressChange}
                onChange={(e) => setProgressChange(e.target.value)}
                className="w-24 shrink-0"
              />
              <span className="text-sm text-muted-foreground">
                % change since last update
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Positive for progress, negative if behind
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={checkIn.isPending}>
              {checkIn.isPending ? (
                "Posting..."
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Post Check-in
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
