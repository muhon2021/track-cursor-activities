/**
 * Rocks Kanban board grouped by rock_status.
 */

import { OKRCard } from "./OKRCard";
import type { OKR, RockStatus } from "../../types";
import { ROCK_STATUS_LABELS } from "../../types";
import { cn } from "@/lib/utils";

const COLUMNS: RockStatus[] = ["on_track", "at_risk", "off_track", "completed"];

const COLUMN_BG: Record<RockStatus, string> = {
  on_track: "border-green-200 dark:border-green-900",
  at_risk: "border-amber-200 dark:border-amber-900",
  off_track: "border-red-200 dark:border-red-900",
  completed: "border-blue-200 dark:border-blue-900",
};

interface RocksBoardViewProps {
  okrs: OKR[];
  onSelect?: (okr: OKR) => void;
  onStatusChange?: (okrId: string, status: RockStatus) => void;
}

export function RocksBoardView({ okrs, onSelect }: RocksBoardViewProps) {
  const grouped = COLUMNS.reduce(
    (acc, col) => {
      acc[col] = okrs.filter(
        (o) => (o.rock_status || "on_track") === col
      );
      return acc;
    },
    {} as Record<RockStatus, OKR[]>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {COLUMNS.map((col) => (
        <div
          key={col}
          className={cn("rounded-lg border-2 bg-muted/30 p-3 min-h-[200px]", COLUMN_BG[col])}
        >
          <h3 className="font-medium text-sm mb-3 flex items-center justify-between">
            {ROCK_STATUS_LABELS[col]}
            <span className="text-muted-foreground text-xs">{grouped[col].length}</span>
          </h3>
          <div className="space-y-2">
            {grouped[col].length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No rocks</p>
            ) : (
              grouped[col].map((okr) => (
                <div key={okr.id} onClick={() => onSelect?.(okr)} className="cursor-pointer">
                  <OKRCard okr={okr} />
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
