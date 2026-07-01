/**
 * GWC Assessment Dialog
 *
 * Dialog for assessing whether a person in a role Gets It, Wants It,
 * and Has the Capacity for the position. Includes toggle switches,
 * descriptive text, and an optional notes field.
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Brain, Heart, Gauge } from "lucide-react";
import type { GWCAssessment } from "../../types";

interface GWCAssessmentDialogProps {
  responsibilityId: string;
  roleTitle: string;
  currentAssessment?: GWCAssessment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    responsibility_id: string;
    gets_it: boolean;
    wants_it: boolean;
    has_capacity: boolean;
    notes?: string;
  }) => void;
  isSaving?: boolean;
}

export function GWCAssessmentDialog({
  responsibilityId,
  roleTitle,
  currentAssessment,
  open,
  onOpenChange,
  onSave,
  isSaving = false,
}: GWCAssessmentDialogProps) {
  const [getsIt, setGetsIt] = useState(false);
  const [wantsIt, setWantsIt] = useState(false);
  const [hasCapacity, setHasCapacity] = useState(false);
  const [notes, setNotes] = useState("");

  // Pre-fill from existing assessment when dialog opens
  useEffect(() => {
    if (open && currentAssessment) {
      setGetsIt(currentAssessment.gets_it);
      setWantsIt(currentAssessment.wants_it);
      setHasCapacity(currentAssessment.has_capacity);
      setNotes(currentAssessment.notes ?? "");
    } else if (open) {
      setGetsIt(false);
      setWantsIt(false);
      setHasCapacity(false);
      setNotes("");
    }
  }, [open, currentAssessment]);

  const handleSave = () => {
    onSave({
      responsibility_id: responsibilityId,
      gets_it: getsIt,
      wants_it: wantsIt,
      has_capacity: hasCapacity,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>GWC Assessment</DialogTitle>
          <p className="text-sm text-muted-foreground">{roleTitle}</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Gets It */}
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
              <Brain className="h-4.5 w-4.5 text-purple-600" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="gwc-gets-it" className="text-sm font-medium">
                  Gets It
                </Label>
                <Switch
                  id="gwc-gets-it"
                  checked={getsIt}
                  onCheckedChange={setGetsIt}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Truly understands the role, the company, and the people around them.
              </p>
            </div>
          </div>

          <Separator />

          {/* Wants It */}
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-rose-100 flex items-center justify-center shrink-0 mt-0.5">
              <Heart className="h-4.5 w-4.5 text-rose-600" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="gwc-wants-it" className="text-sm font-medium">
                  Wants It
                </Label>
                <Switch
                  id="gwc-wants-it"
                  checked={wantsIt}
                  onCheckedChange={setWantsIt}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Genuinely wants the position with all its responsibilities and challenges.
              </p>
            </div>
          </div>

          <Separator />

          {/* Has Capacity */}
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
              <Gauge className="h-4.5 w-4.5 text-amber-600" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="gwc-capacity" className="text-sm font-medium">
                  Has Capacity
                </Label>
                <Switch
                  id="gwc-capacity"
                  checked={hasCapacity}
                  onCheckedChange={setHasCapacity}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Has the time, knowledge, and ability to perform the role effectively.
              </p>
            </div>
          </div>

          <Separator />

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="gwc-notes">Notes</Label>
            <Textarea
              id="gwc-notes"
              placeholder="Optional assessment notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Assessment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
