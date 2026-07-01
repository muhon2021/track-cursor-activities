/**
 * Scorecard Page
 *
 * Displays scorecard metrics in a table with status tracking.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { useScorecards, useScorecardMetrics } from "../hooks/useScorecard";
import { ScorecardMetricsTable } from "../components/scorecard/ScorecardMetricsTable";
import MetricTrendChart from "../components/scorecard/MetricTrendChart";

export default function ScorecardPage() {
  const { data: scorecards, isLoading: scorecardsLoading } = useScorecards();
  const [selectedId, setSelectedId] = useState<string | undefined>();

  // Select first scorecard by default
  const activeScorecardId = selectedId || scorecards?.[0]?.id;
  const { data: metrics, isLoading: metricsLoading } = useScorecardMetrics(activeScorecardId);

  const isLoading = scorecardsLoading || metricsLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scorecard</h1>
          <p className="text-muted-foreground">
            Track key metrics and performance indicators
          </p>
        </div>
      </div>

      {scorecards && scorecards.length > 1 && (
        <Select
          value={activeScorecardId}
          onValueChange={setSelectedId}
        >
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Select scorecard" />
          </SelectTrigger>
          <SelectContent>
            {scorecards.map((sc) => (
              <SelectItem key={sc.id} value={sc.id}>
                {sc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : scorecards && scorecards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">No scorecards yet</p>
          <p className="text-sm">Scorecards can be configured in the admin panel.</p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-card">
            <ScorecardMetricsTable metrics={metrics || []} />
          </div>
          <MetricTrendChart metrics={metrics || []} />
        </>
      )}
    </div>
  );
}
