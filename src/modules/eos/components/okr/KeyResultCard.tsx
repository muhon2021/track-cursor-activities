/**
 * Key Result Card
 *
 * Full card layout for a single key result: title, metric description,
 * assignee, start/current/target, progress bar, status badge, update frequency.
 * Pencil icon on Current allows editing the current value (check-in).
 */

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown, User, Pencil } from "lucide-react";
import { UPDATE_FREQUENCIES } from "@/types/okr";
import type { OKRKeyResult } from "../../types";
import { calculateKeyResultProgress } from "@/utils/okrHelpers";
import { useCheckIn } from "../../hooks/useOKRs";

const statusConfig: Record<string, { label: string; className: string }> = {
  not_started: { label: "Not started", className: "bg-gray-100 text-gray-800" },
  on_track: { label: "On track", className: "bg-green-100 text-green-800" },
  at_risk: { label: "At risk", className: "bg-amber-100 text-amber-800" },
  behind: { label: "Off track", className: "bg-red-100 text-red-800" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-800" },
};

const frequencyLabel = (freq: string | null | undefined): string => {
  if (!freq) return "Weekly";
  const key = freq as keyof typeof UPDATE_FREQUENCIES;
  return UPDATE_FREQUENCIES[key] ?? freq;
};

interface KeyResultCardProps {
  keyResult: OKRKeyResult;
  okrId: string;
}

export function KeyResultCard({ keyResult, okrId }: KeyResultCardProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [editValue, setEditValue] = useState(String(keyResult.current_value ?? 0));

  const checkIn = useCheckIn();

  const progress = calculateKeyResultProgress(
    Number(keyResult.start_value ?? 0),
    Number(keyResult.current_value ?? 0),
    Number(keyResult.target_value ?? 0)
  );
  const config = statusConfig[keyResult.status] ?? statusConfig.not_started;

  const handleSaveCurrent = () => {
    const newVal = Number(editValue);
    if (Number.isNaN(newVal)) return;
    const previous = Number(keyResult.current_value ?? 0);
    if (newVal === previous) {
      setPopoverOpen(false);
      return;
    }
    checkIn.mutate(
      {
        okr_id: okrId,
        key_result_id: keyResult.id,
        previous_value: previous,
        new_value: newVal,
      },
      {
        onSuccess: () => {
          setPopoverOpen(false);
        },
      }
    );
  };

  const currentDisplay = keyResult.current_value;
  const unitSuffix = keyResult.unit ? ` ${keyResult.unit}` : "";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            <h4 className="text-sm font-semibold leading-tight">
              {keyResult.title}
            </h4>
          </div>
        </div>
        {keyResult.description && (
          <p className="pl-6 text-sm text-muted-foreground">
            {keyResult.description}
          </p>
        )}
        {keyResult.owner && (
          <div className="flex items-center gap-1.5 pl-6 text-sm text-muted-foreground">
            <User className="h-4 w-4 shrink-0" />
            <span>{keyResult.owner.full_name}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Start</p>
            <p className="text-sm font-medium">
              {keyResult.start_value != null ? keyResult.start_value : "—"}
              {unitSuffix}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Current</p>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium">
                {currentDisplay != null ? currentDisplay : "—"}
                {unitSuffix}
              </p>
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setEditValue(String(keyResult.current_value ?? 0))}
                  >
                    <Pencil className="h-3 w-3" />
                    <span className="sr-only">Edit current value</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56" align="start">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Update current value</p>
                    <Input
                      type="number"
                      step="any"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveCurrent()}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPopoverOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveCurrent}
                        disabled={checkIn.isPending}
                      >
                        {checkIn.isPending ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Target</p>
            <p className="text-sm font-medium">
              {keyResult.target_value != null ? keyResult.target_value : "—"}
              {unitSuffix}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Progress</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{Math.round(progress)}%</span>
              <Badge variant="secondary" className={config.className}>
                {config.label}
              </Badge>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Progress value={Math.max(0, Math.min(100, progress))} className="h-2" />
        </div>
        <p className="text-xs text-muted-foreground">
          Update frequency: {frequencyLabel(keyResult.update_frequency).toLowerCase()}
        </p>
      </CardContent>
    </Card>
  );
}
