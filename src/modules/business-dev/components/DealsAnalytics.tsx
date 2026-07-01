/**
 * Deals Analytics Tab - KPIs, Stage Distribution, Monthly Trend,
 * Deal Velocity by Stage, Top 10 Clients by Value, Top 10 Owners by Win Rate
 * Matches reference screenshots for /deals?tab=analytics
 */

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, Legend } from "recharts";
import { useDealsAnalytics } from "../hooks/useDeals";
import { Loader2, BarChart3, DollarSign, Target, TrendingUp, Shield, AlertTriangle } from "lucide-react";
import type { DealStage } from "../types";

const STAGE_COLORS: Record<DealStage, string> = {
  lead: "#a78bfa",
  discovery: "#a78bfa",
  qualified: "#a78bfa",
  estimation: "#a78bfa",
  proposal: "#a78bfa",
  won: "#a78bfa",
  lost: "#a78bfa",
};

function formatCurrency(val: number) {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  return `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DealsAnalytics() {
  const { data: analytics, isLoading } = useDealsAnalytics();

  const stageChartConfig: ChartConfig = useMemo(
    () =>
      (["lead", "discovery", "qualified", "estimation", "proposal", "won", "lost"] as DealStage[]).reduce(
        (acc, stage) => {
          acc[stage] = { label: stage.charAt(0).toUpperCase() + stage.slice(1), color: STAGE_COLORS[stage] };
          return acc;
        },
        {} as ChartConfig
      ),
    []
  );

  const monthlyChartConfig: ChartConfig = useMemo(
    () => ({
      month: { label: "Month" },
      dealsCreated: { label: "Deals Created", color: "#18181b" },
      dealsWon: { label: "Deals Won", color: "#18181b" },
      totalValue: { label: "Total Value ($)", color: "#18181b" },
    }),
    []
  );

  const velocityChartConfig: ChartConfig = useMemo(
    () =>
      (["lead", "discovery", "qualified", "estimation", "proposal", "won", "lost"] as DealStage[]).reduce(
        (acc, stage) => {
          acc[stage] = { label: stage.charAt(0).toUpperCase() + stage.slice(1), color: "#71717a" };
          return acc;
        },
        {} as ChartConfig
      ),
    []
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-lg font-medium">No deals data yet</p>
        <p className="text-sm">Create deals to see analytics</p>
      </div>
    );
  }

  const { kpis, stageDistribution, monthlyTrend, velocityByStage, topClientsByValue, topOwnersByWinRate } = analytics;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">{formatCurrency(kpis.totalValue)}</p>
                <p className="text-xs text-muted-foreground">Across all deals</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Deals</p>
                <p className="text-2xl font-bold">{kpis.totalDeals.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">In pipeline</p>
              </div>
              <Target className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Deal Size</p>
                <p className="text-2xl font-bold">{formatCurrency(kpis.avgDealSize)}</p>
                <p className="text-xs text-muted-foreground">Per deal</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold">{kpis.winRate}%</p>
                <p className="text-xs text-muted-foreground">Conversion rate</p>
              </div>
              <Shield className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  Stagnant Deals
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </p>
                <p className="text-2xl font-bold">{kpis.stagnantCount}</p>
                <p className="text-xs text-muted-foreground">
                  ${kpis.stagnantValue.toLocaleString()} at risk (60+ days)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stage Distribution & Monthly Deal Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stage Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={stageChartConfig} className="h-[280px]">
              <BarChart data={stageDistribution} margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Count" fill="#a78bfa">
                  {stageDistribution.map((entry, i) => (
                    <Cell key={i} fill={STAGE_COLORS[entry.stage as DealStage] || "#a78bfa"} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Deal Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={monthlyChartConfig} className="h-[280px]">
              <BarChart data={monthlyTrend} margin={{ left: 12, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}K` : String(v))} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => (typeof v === "number" && v > 1000 ? formatCurrency(v) : v)} />} />
                <Legend />
                <Bar yAxisId="left" dataKey="dealsCreated" name="Deals Created" fill="#18181b" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="dealsWon" name="Deals Won" fill="#3f3f46" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="totalValue" name="Total Value ($)" fill="#18181b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Deal Velocity by Stage & Top 10 Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deal Velocity by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={velocityChartConfig} className="h-[280px]">
              <BarChart data={velocityByStage} margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => (value !== undefined ? `Avg Days : ${value}` : value)}
                    />
                  }
                />
                <Bar dataKey="avgDays" radius={[4, 4, 0, 0]} name="Avg Days" fill="#71717a">
                  {velocityByStage.map((entry, i) => (
                    <Cell key={i} fill={STAGE_COLORS[entry.stage as DealStage] || "#71717a"} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 Clients by Value</CardTitle>
          </CardHeader>
          <CardContent>
            {topClientsByValue.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No client data</p>
            ) : (
              <ChartContainer
                config={{ totalValue: { label: "Total Value ($)", color: "#18181b" }, wonValue: { label: "Won Value ($)", color: "#3f3f46" } }}
                className="h-[280px]"
              >
                <BarChart data={topClientsByValue} layout="vertical" margin={{ left: 8, right: 24 }} barCategoryGap="12%">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => (v >= 1000000 ? `${v / 1000000}M` : v >= 1000 ? `${v / 1000}K` : String(v))} />
                  <YAxis type="category" dataKey="clientName" tickLine={false} axisLine={false} fontSize={12} width={140} tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => (typeof v === "number" ? formatCurrency(v) : v)} />} />
                  <Legend />
                  <Bar dataKey="totalValue" name="Total Value ($)" fill="#18181b" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="wonValue" name="Won Value ($)" fill="#3f3f46" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top 10 Owners by Win Rate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 10 Owners by Win Rate</CardTitle>
        </CardHeader>
        <CardContent>
          {topOwnersByWinRate.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No owner data</p>
          ) : (
            <ul className="space-y-0">
              {topOwnersByWinRate.map((owner, index) => (
                <li
                  key={owner.ownerId}
                  className={`flex items-center justify-between py-3 px-3 rounded-md ${index === 0 ? "bg-muted/60" : ""}`}
                >
                  <span className="font-medium text-foreground">{owner.ownerName}</span>
                  <span className="text-sm text-muted-foreground">
                    {owner.winRate}% win rate {owner.won}/{owner.total} deals
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
