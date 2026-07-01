/**
 * Deals Overview Tab - Matches Business Opportunities reference
 * KPIs, Active Pipeline by stage, Closed Deals Summary, Revenue Projection, Stage Conversion Funnel
 */

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";
import {
  DollarSign,
  Target,
  Clock,
  TrendingUp,
  Briefcase,
  ArrowUpRight,
  FileText,
  Lightbulb,
  Trophy,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { useDealPipelineStats, useDealRevenueProjection, useDealOverviewExtra } from "../hooks/useDeals";
import type { DealStage } from "../types";

const ACTIVE_STAGES: DealStage[] = ["lead", "discovery", "qualified", "estimation", "proposal"];
const STAGE_LABELS: Record<DealStage, string> = {
  lead: "Lead",
  discovery: "Discovery",
  qualified: "Qualified",
  estimation: "Estimation",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};
const STAGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  lead: Briefcase,
  discovery: ArrowUpRight,
  qualified: CheckCircle,
  estimation: Lightbulb,
  proposal: FileText,
};
const STAGE_COLORS: Record<DealStage, string> = {
  lead: "bg-violet-100 text-violet-600",
  discovery: "bg-violet-100 text-violet-600",
  qualified: "bg-blue-100 text-blue-600",
  estimation: "bg-gray-100 text-gray-600",
  proposal: "bg-blue-100 text-blue-600",
  won: "bg-green-100 text-green-600",
  lost: "bg-red-100 text-red-600",
};

function formatShortCurrency(val: number) {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(2)}K`;
  return `$${val}`;
}

export default function DealsOverview() {
  const [revenueYear, setRevenueYear] = useState(new Date().getFullYear());

  const { data: stats, isLoading: statsLoading } = useDealPipelineStats();
  const { data: revenueData = [], isLoading: revenueLoading } = useDealRevenueProjection(revenueYear);
  const { data: extra } = useDealOverviewExtra();

  const activeCount = useMemo(
    () => ACTIVE_STAGES.reduce((sum, s) => sum + (stats?.by_stage?.[s]?.count ?? 0), 0),
    [stats]
  );
  const activeValue = useMemo(
    () => ACTIVE_STAGES.reduce((sum, s) => sum + (stats?.by_stage?.[s]?.value ?? 0), 0),
    [stats]
  );
  const wonCount = stats?.by_stage?.won?.count ?? 0;
  const lostCount = stats?.by_stage?.lost?.count ?? 0;
  const wonValue = stats?.by_stage?.won?.value ?? 0;
  const lostValue = stats?.by_stage?.lost?.value ?? 0;
  const closedTotal = wonCount + lostCount;
  const winRate = closedTotal > 0 ? ((wonCount / closedTotal) * 100).toFixed(2) : "0";
  const avgDaysToClose = extra?.avg_days_to_close ?? 0;
  const projectedMRR = activeValue > 0 ? activeValue / 12 : 0;

  const funnelData = useMemo(
    () =>
      ACTIVE_STAGES.map((stage) => ({
        name: STAGE_LABELS[stage],
        stage,
        count: stats?.by_stage?.[stage]?.count ?? 0,
      })),
    [stats]
  );

  const chartConfigRevenue: ChartConfig = useMemo(
    () => ({
      projected: { label: "Projected Revenue", color: "hsl(var(--chart-1))" },
    }),
    []
  );
  const chartConfigFunnel: ChartConfig = useMemo(
    () => ({
      count: { label: "Deal Count", color: "#3b82f6" },
    }),
    []
  );

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 4 KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Pipeline</p>
                <p className="text-2xl font-bold mt-1">{formatShortCurrency(activeValue)}</p>
                <p className="text-xs text-muted-foreground mt-1">{activeCount} opportunities</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold mt-1">{winRate}%</p>
                {closedTotal > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {wonCount} won / {lostCount} lost
                  </p>
                )}
              </div>
              <div className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center">
                <Target className="h-5 w-5 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Deal Velocity</p>
                <p className="text-2xl font-bold mt-1">{avgDaysToClose} days</p>
                <p className="text-xs text-muted-foreground mt-1">Time to close</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Monthly Recurring Revenue</p>
                <p className="text-2xl font-bold mt-1">{formatShortCurrency(projectedMRR)}</p>
                <p className="text-xs text-muted-foreground mt-1">Projected MRR</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Pipeline by stage - 5 cards */}
      <div>
        <h3 className="text-base font-semibold mb-3">Active Pipeline</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {ACTIVE_STAGES.map((stage) => {
            const Icon = STAGE_ICONS[stage];
            const count = stats?.by_stage?.[stage]?.count ?? 0;
            const value = stats?.by_stage?.[stage]?.value ?? 0;
            const colorClass = STAGE_COLORS[stage];
            return (
              <Card key={stage}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{STAGE_LABELS[stage]}</p>
                      <p className="text-xl font-bold mt-1">{count}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatShortCurrency(value)} potential</p>
                    </div>
                    {Icon && (
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Closed Deals Summary - 3 cards */}
      <div>
        <h3 className="text-base font-semibold mb-3">Closed Deals Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Won</p>
                  <p className="text-2xl font-bold mt-1">{wonCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatShortCurrency(wonValue)} total</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Accepted</p>
                  <p className="text-2xl font-bold mt-1">{wonCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatShortCurrency(wonValue)} total</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Lost</p>
                  <p className="text-2xl font-bold mt-1">{lostCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatShortCurrency(lostValue)} total</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Revenue Projection */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base">Revenue Projection</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">Probability-weighted revenue forecast by close date</p>
            </div>
            <Select value={String(revenueYear)} onValueChange={(v) => setRevenueYear(Number(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={String(new Date().getFullYear())}>This Year</SelectItem>
                <SelectItem value={String(new Date().getFullYear() - 1)}>Last Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {revenueLoading ? (
            <div className="h-[280px] flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ChartContainer config={chartConfigRevenue} className="h-[280px] w-full">
              <BarChart data={revenueData} margin={{ left: 12, right: 12 }}>
                <defs>
                  <linearGradient id="revenueBarGradient" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#000000" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `$${v >= 1000 ? v / 1000 + "K" : v}`} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => [formatShortCurrency(Number(v)), "Projected Revenue"]} />} />
                <Bar dataKey="projected" radius={[4, 4, 0, 0]} name="Projected Revenue" fill="url(#revenueBarGradient)" />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Stage Conversion Funnel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Stage Conversion Funnel</CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">Conversion rates between pipeline stages</p>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfigFunnel} className="h-[280px] w-full">
            <LineChart data={funnelData} margin={{ left: 12, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.name}
                    formatter={(v) => ["Deal Count : " + v, "Deal Count"]}
                  />
                }
              />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 5, fill: "#3b82f6" }} name="Deal Count" />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
