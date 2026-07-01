/**
 * MetricTrendChart
 *
 * Renders a recharts LineChart that visualises EOS scorecard metric values
 * over time.  Metrics are grouped by their `week_of` date (falling back to
 * the ISO-week of `created_at` when `week_of` is absent) and pivoted so that
 * each unique metric name becomes its own line.
 *
 * When a consistent `target_value` exists across all supplied metrics the
 * chart also draws a dashed reference line at that value.
 */

import { useMemo } from "react";
import { format, startOfWeek } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import type { EOSScorecardMetric } from "../../types";

/** Colour palette used to distinguish individual metric lines. */
const COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
  "#8b5cf6",
];

interface MetricTrendChartProps {
  /** The scorecard metrics to visualise. */
  metrics: EOSScorecardMetric[];
  /** Optional chart height in pixels.  Defaults to 300. */
  height?: number;
  /** Optional card title. Defaults to "Metric Trends". */
  title?: string;
}

/**
 * Resolves the week key for a single metric.
 *
 * If the metric carries a `week_of` value it is formatted directly.
 * Otherwise the ISO-week start of `created_at` is used as the fallback.
 */
function resolveWeekKey(metric: EOSScorecardMetric): string {
  if (metric.week_of) {
    return format(new Date(metric.week_of), "MMM d");
  }
  const weekStart = startOfWeek(new Date(metric.created_at), {
    weekStartsOn: 1,
  });
  return format(weekStart, "MMM d");
}

/**
 * Resolves the raw sortable date for a metric so data-points can be
 * chronologically ordered before the human-readable label is applied.
 */
function resolveWeekDate(metric: EOSScorecardMetric): Date {
  if (metric.week_of) {
    return new Date(metric.week_of);
  }
  return startOfWeek(new Date(metric.created_at), { weekStartsOn: 1 });
}

/**
 * Builds the chart configuration object that the shadcn `ChartContainer`
 * requires.  Each unique metric name gets a colour from the palette.
 */
function buildChartConfig(metricNames: string[]): ChartConfig {
  const config: ChartConfig = {};
  metricNames.forEach((name, i) => {
    config[name] = { label: name, color: COLORS[i % COLORS.length] };
  });
  return config;
}

/**
 * Derives a single, consistent target value from the metric set.
 *
 * Returns the target only when every metric that carries a `target_value`
 * shares the same number -- otherwise the reference line is omitted.
 */
function deriveConsistentTarget(
  metrics: EOSScorecardMetric[],
): number | null {
  const targets = metrics
    .map((m) => m.target_value)
    .filter((v): v is number => v !== null);

  if (targets.length === 0) return null;

  const first = targets[0];
  return targets.every((t) => t === first) ? first : null;
}

/**
 * MetricTrendChart -- EOS scorecard metric trend line chart.
 *
 * Groups metrics by week and renders a multi-line recharts `LineChart` wrapped
 * in the shadcn `ChartContainer`.  Displays an empty-state card when there is
 * insufficient data to plot.
 */
export default function MetricTrendChart({
  metrics,
  height = 300,
  title = "Metric Trends",
}: MetricTrendChartProps) {
  /** Unique metric names used as individual line series. */
  const metricNames = useMemo(
    () => [...new Set(metrics.map((m) => m.name))],
    [metrics],
  );

  /** Dynamic chart config derived from metric names. */
  const chartConfig = useMemo(
    () => buildChartConfig(metricNames),
    [metricNames],
  );

  /**
   * Pivoted chart data.
   *
   * Each entry represents a single week and contains a key per metric name
   * holding that metric's `current_value` for the week.
   *
   * Example:
   * ```
   * [{ week: "Jan 6", _sortDate: Date, Revenue: 150000, Customers: 45 }, ...]
   * ```
   */
  const chartData = useMemo(() => {
    if (metrics.length === 0) return [];

    // Accumulate values keyed by week label.
    const weekMap = new Map<
      string,
      { _sortDate: Date; week: string; [metric: string]: unknown }
    >();

    for (const metric of metrics) {
      const weekLabel = resolveWeekKey(metric);
      const weekDate = resolveWeekDate(metric);

      if (!weekMap.has(weekLabel)) {
        weekMap.set(weekLabel, { _sortDate: weekDate, week: weekLabel });
      }

      const entry = weekMap.get(weekLabel)!;
      entry[metric.name] = metric.current_value;

      // Keep the earliest date for proper sorting.
      if (weekDate < (entry._sortDate as Date)) {
        entry._sortDate = weekDate;
      }
    }

    // Sort chronologically and strip the helper field.
    return Array.from(weekMap.values())
      .sort(
        (a, b) =>
          (a._sortDate as Date).getTime() - (b._sortDate as Date).getTime(),
      )
      .map(({ _sortDate, ...rest }) => rest);
  }, [metrics]);

  /** A consistent target line, shown only when all metrics share the same target. */
  const consistentTarget = useMemo(
    () => deriveConsistentTarget(metrics),
    [metrics],
  );

  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------
  if (metrics.length === 0 || chartData.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-sm">Not enough data to show trends</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // -----------------------------------------------------------------------
  // Chart
  // -----------------------------------------------------------------------
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="w-full"
          style={{ height }}
        >
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />

            {consistentTarget !== null && (
              <ReferenceLine
                y={consistentTarget}
                stroke="#94a3b8"
                strokeDasharray="6 4"
                label={{
                  value: `Target: ${consistentTarget}`,
                  position: "insideTopRight",
                  fontSize: 11,
                  fill: "#94a3b8",
                }}
              />
            )}

            {metricNames.map((name) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={`var(--color-${name})`}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
