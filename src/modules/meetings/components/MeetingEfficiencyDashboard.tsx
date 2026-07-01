/**
 * Meeting Efficiency Dashboard
 *
 * Self-contained dashboard component that visualises meeting efficiency metrics.
 * Fetches its own data via the `useMeetingEfficiency` hook and renders:
 *  - Time-range selector (30 / 60 / 90 days)
 *  - Hero efficiency score card
 *  - 2x2 stat cards grid (total meetings, avg duration, agenda rate, takeaway rate)
 *  - Monthly efficiency trend bar chart (recharts + ChartContainer)
 *  - Meeting quality breakdown card with progress bars
 *
 * @module meetings/components
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, ListChecks, ClipboardList, Loader2, TrendingUp } from "lucide-react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useMeetingEfficiency } from "../hooks/useMeetingEfficiency";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIME_RANGES = [
  { label: "30 days", value: 30 },
  { label: "60 days", value: 60 },
  { label: "90 days", value: 90 },
] as const;

const chartConfig: ChartConfig = {
  avgEfficiency: {
    label: "Avg Efficiency",
    color: "hsl(var(--primary))",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a Tailwind text-color class based on the efficiency score.
 *  - green >= 70
 *  - amber  40-69
 *  - red   < 40
 */
function getScoreColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

/** Same logic but returns a bg colour class for the Progress bar wrapper. */
function getScoreBarClass(score: number): string {
  if (score >= 70) return "[&>div]:bg-green-500";
  if (score >= 40) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-red-500";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MeetingEfficiencyDashboard() {
  const [days, setDays] = useState<number>(90);
  const { data, isLoading } = useMeetingEfficiency(days);

  // ---------- Loading state ----------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If no data yet (hook returned undefined before first load)
  if (!data) {
    return null;
  }

  // ---------- Render ----------

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Meeting Efficiency</h2>
        <div className="flex items-center gap-1 rounded-lg border p-1">
          {TIME_RANGES.map((range) => (
            <Button
              key={range.value}
              size="sm"
              variant={days === range.value ? "default" : "ghost"}
              className="h-7 px-3 text-xs"
              onClick={() => setDays(range.value)}
            >
              {range.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Hero Efficiency Score */}
      <Card>
        <CardContent className="pt-6 pb-5 flex flex-col items-center gap-3">
          <span className="text-sm text-muted-foreground font-medium">
            Overall Efficiency Score
          </span>
          <span className={`text-5xl font-bold ${getScoreColor(data.avgEfficiencyScore)}`}>
            {data.avgEfficiencyScore}
          </span>
          <div className="w-full max-w-xs">
            <Progress
              value={data.avgEfficiencyScore}
              className={`h-3 ${getScoreBarClass(data.avgEfficiencyScore)}`}
            />
          </div>
          <Badge
            variant="outline"
            className={`${getScoreColor(data.avgEfficiencyScore)} border-current`}
          >
            {data.avgEfficiencyScore >= 70
              ? "Excellent"
              : data.avgEfficiencyScore >= 40
                ? "Needs Improvement"
                : "Critical"}
          </Badge>
        </CardContent>
      </Card>

      {/* 2x2 Stat Cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total Meetings */}
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Total Meetings</span>
            </div>
            <p className="text-2xl font-bold mt-1">{data.totalMeetings}</p>
          </CardContent>
        </Card>

        {/* Avg Duration */}
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-500" />
              <span className="text-sm text-muted-foreground">Avg Duration</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {data.avgDuration}
              <span className="text-sm font-normal text-muted-foreground ml-1">min</span>
            </p>
          </CardContent>
        </Card>

        {/* Agenda Rate */}
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Agenda Rate</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {data.agendaRate}
              <span className="text-sm font-normal text-muted-foreground ml-0.5">%</span>
            </p>
          </CardContent>
        </Card>

        {/* Takeaway Rate */}
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Takeaway Rate</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {data.takeawayRate}
              <span className="text-sm font-normal text-muted-foreground ml-0.5">%</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend Chart */}
      {data.byMonth.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Monthly Efficiency Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={data.byMonth} accessibilityLayer>
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  className="text-xs"
                />
                <YAxis
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  className="text-xs"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="avgEfficiency"
                  fill="var(--color-avgEfficiency)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Meeting Quality Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meeting Quality Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* With Agenda */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span>With Agenda</span>
              <span className="text-muted-foreground">
                {data.withAgenda} / {data.totalMeetings}
              </span>
            </div>
            <Progress
              value={data.totalMeetings > 0 ? (data.withAgenda / data.totalMeetings) * 100 : 0}
              className="h-2"
            />
          </div>

          <Separator />

          {/* With Takeaways */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span>With Takeaways</span>
              <span className="text-muted-foreground">
                {data.withTakeaways} / {data.totalMeetings}
              </span>
            </div>
            <Progress
              value={data.totalMeetings > 0 ? (data.withTakeaways / data.totalMeetings) * 100 : 0}
              className="h-2"
            />
          </div>

          <Separator />

          {/* Avg Participants */}
          <div className="flex items-center justify-between text-sm">
            <span>Avg Participants</span>
            <span className="font-medium">{data.avgParticipants}</span>
          </div>

          <Separator />

          {/* Avg Takeaways/Meeting */}
          <div className="flex items-center justify-between text-sm">
            <span>Avg Takeaways/Meeting</span>
            <span className="font-medium">{data.avgTakeaways}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
