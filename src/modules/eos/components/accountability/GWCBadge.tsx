/**
 * GWC Badge Component
 *
 * Displays a compact GWC (Get it, Want it, Capacity) assessment indicator.
 */

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { GWCAssessment } from "../../types";

interface GWCBadgeProps {
  assessment: GWCAssessment;
}

export function GWCBadge({ assessment }: GWCBadgeProps) {
  const score = [assessment.gets_it, assessment.wants_it, assessment.has_capacity].filter(
    Boolean
  ).length;

  const colorMap: Record<number, string> = {
    0: "bg-red-100 text-red-800 border-red-200",
    1: "bg-orange-100 text-orange-800 border-orange-200",
    2: "bg-yellow-100 text-yellow-800 border-yellow-200",
    3: "bg-green-100 text-green-800 border-green-200",
  };

  return (
    <Tooltip>
      <TooltipTrigger>
        <div
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium border ${colorMap[score]}`}
        >
          <span className={assessment.gets_it ? "opacity-100" : "opacity-30"}>G</span>
          <span className={assessment.wants_it ? "opacity-100" : "opacity-30"}>W</span>
          <span className={assessment.has_capacity ? "opacity-100" : "opacity-30"}>C</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-1.5">
            <span>{assessment.gets_it ? "Y" : "N"}</span>
            <span>Gets It</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>{assessment.wants_it ? "Y" : "N"}</span>
            <span>Wants It</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>{assessment.has_capacity ? "Y" : "N"}</span>
            <span>Has Capacity</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
