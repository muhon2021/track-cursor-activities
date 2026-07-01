/**
 * Key Result Progress Chart
 *
 * Displays a line chart of key result check-in values over time,
 * with reference lines for start and target values.
 */

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import type { OKRKeyResult } from "../../types";

interface CheckIn {
  new_value: number;
  created_at: string;
}

interface KeyResultProgressChartProps {
  keyResult: OKRKeyResult;
  checkIns?: CheckIn[];
  embedded?: boolean;
}

const chartConfig = {
  value: {
    label: "Value",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export function KeyResultProgressChart({
  keyResult,
  checkIns = [],
  embedded = false,
}: KeyResultProgressChartProps) {
  const progressPercent =
    keyResult.target_value !== keyResult.start_value
      ? Math.round(
          ((keyResult.current_value - keyResult.start_value) /
            (keyResult.target_value - keyResult.start_value)) *
            100
        )
      : 0;

  const chartData = useMemo(() => {
    const sorted = [...checkIns].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return sorted.map((checkIn) => ({
      date: new Date(checkIn.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      value: checkIn.new_value,
    }));
  }, [checkIns]);

  if (embedded) {
    return (
      <div className="w-full">
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground border rounded-md">
            No check-in data yet
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ReferenceLine
                y={keyResult.target_value}
                stroke="hsl(var(--chart-2))"
                strokeDasharray="8 4"
                label={{
                  value: `Target: ${keyResult.target_value}${keyResult.unit}`,
                  position: "insideTopRight",
                  fontSize: 11,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />
              <ReferenceLine
                y={keyResult.start_value}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="2 4"
                label={{
                  value: `Start: ${keyResult.start_value}${keyResult.unit}`,
                  position: "insideBottomRight",
                  fontSize: 11,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-value)"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ChartContainer>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{keyResult.title}</CardTitle>
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            {keyResult.current_value}
            {keyResult.unit} / {keyResult.target_value}
            {keyResult.unit}{" "}
            <span className="text-xs">
              ({Math.max(0, Math.min(100, progressPercent))}%)
            </span>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
            No check-in data yet
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ReferenceLine
                y={keyResult.target_value}
                stroke="hsl(var(--chart-2))"
                strokeDasharray="8 4"
                label={{
                  value: `Target: ${keyResult.target_value}${keyResult.unit}`,
                  position: "insideTopRight",
                  fontSize: 11,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />
              <ReferenceLine
                y={keyResult.start_value}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="2 4"
                label={{
                  value: `Start: ${keyResult.start_value}${keyResult.unit}`,
                  position: "insideBottomRight",
                  fontSize: 11,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-value)"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
