/**
 * Key Result Progress Component
 *
 * Shows a key result with its progress bar and values.
 */

import { Progress } from "@/components/ui/progress";
import type { OKRKeyResult } from "../../types";

const statusColors: Record<string, string> = {
  not_started: "text-gray-500",
  on_track: "text-green-600",
  at_risk: "text-yellow-600",
  behind: "text-red-600",
  completed: "text-emerald-600",
};

interface KeyResultProgressProps {
  keyResult: OKRKeyResult;
  compact?: boolean;
}

export function KeyResultProgress({ keyResult, compact }: KeyResultProgressProps) {
  const progress = keyResult.target_value > 0
    ? Math.min(100, ((keyResult.current_value - keyResult.start_value) / (keyResult.target_value - keyResult.start_value)) * 100)
    : 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Progress value={Math.max(0, progress)} className="h-1.5 flex-1" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {keyResult.current_value}{keyResult.unit} / {keyResult.target_value}{keyResult.unit}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 p-3 rounded-lg border">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{keyResult.title}</p>
        <span className={`text-xs font-medium ${statusColors[keyResult.status]}`}>
          {keyResult.status.replace("_", " ")}
        </span>
      </div>
      <Progress value={Math.max(0, progress)} className="h-2" />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {keyResult.current_value}{keyResult.unit} of {keyResult.target_value}{keyResult.unit}
        </span>
        <span>{Math.round(Math.max(0, progress))}%</span>
      </div>
    </div>
  );
}
