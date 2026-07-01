/**
 * OKR Detail Dialog
 *
 * Full OKR detail in a large modal: header (title, badges, Add Check-in),
 * 6 tabs (Overview, Performance, Progress, Entries, Updates, AI).
 * Matches View Details flow spec.
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2,
  MessageSquarePlus,
  Calendar,
  User,
  Sparkles,
  BarChart2,
  History,
  ChevronRight,
  TrendingUp,
  MessageCircle,
} from "lucide-react";
import { useOKRDetail, useOKRCheckIns } from "../hooks/useOKRs";
import { useKeyResultsHistory } from "@/hooks/useKeyResultHistory";
import {
  calculateOKRProgress,
  calculateKeyResultProgressFromKR,
  formatDateLong,
  formatDateTime,
} from "@/utils/okrHelpers";
import { CheckInDialog } from "../components/okr/CheckInDialog";
import { KeyResultProgressChart } from "../components/okr/KeyResultProgressChart";
import { OKRS_KEY } from "../hooks/useOKRs";
import { supabase } from "@/integrations/supabase/client";
import type { OKRKeyResult } from "../types";
import type { KeyResultHistoryRow } from "@/types/okr";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  active: "bg-blue-100 text-blue-800",
  on_track: "bg-green-100 text-green-800",
  at_risk: "bg-yellow-100 text-yellow-800",
  behind: "bg-red-100 text-red-800",
  completed: "bg-emerald-100 text-emerald-800",
  closed: "bg-gray-100 text-gray-600",
};

function daysRemaining(endDate: string | null | undefined): number | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

function healthScoreAndLabel(
  keyResults: OKRKeyResult[]
): { score: number; label: string; className: string } {
  if (!keyResults.length) return { score: 0, label: "No KRs", className: "bg-gray-100 text-gray-700" };
  const onTrack = keyResults.filter((kr) => {
    if (kr.status === "on_track" || kr.status === "completed") return true;
    return calculateKeyResultProgressFromKR(kr) >= 66;
  }).length;
  const score = Math.round((onTrack / keyResults.length) * 100);
  if (score >= 66) return { score, label: "healthy", className: "bg-blue-100 text-blue-800" };
  if (score >= 33) return { score, label: "at risk", className: "bg-amber-100 text-amber-800" };
  return { score, label: "unhealthy", className: "bg-red-100 text-red-800" };
}

interface OKRDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  okrId: string;
  onUpdate?: () => void;
}

export function OKRDetailDialog({
  open,
  onOpenChange,
  okrId,
  onUpdate,
}: OKRDetailDialogProps) {
  const { data: okr, isLoading } = useOKRDetail(okrId);
  const { data: checkIns = [] } = useOKRCheckIns(open ? okrId : undefined);
  const krIds = useMemo(
    () => (okr?.key_results || []).map((kr) => kr.id),
    [okr?.key_results]
  );
  const { data: historyByKr = {} } = useKeyResultsHistory(krIds);

  const recordedByIds = useMemo(() => {
    const set = new Set<string>();
    Object.values(historyByKr).flat().forEach((e: KeyResultHistoryRow) => {
      if (e.updated_by) set.add(e.updated_by);
    });
    return Array.from(set);
  }, [historyByKr]);

  const { data: recordedByProfiles = {} } = useQuery({
    queryKey: ["profiles", "recorded-by", recordedByIds],
    queryFn: async (): Promise<Record<string, { full_name: string | null }>> => {
      if (!recordedByIds.length) return {};
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", recordedByIds);
      const map: Record<string, { full_name: string | null }> = {};
      (data || []).forEach(
        (p: { id: string; full_name: string | null }) => {
          map[p.id] = { full_name: p.full_name };
        }
      );
      return map;
    },
    enabled: recordedByIds.length > 0,
  });

  const [activeTab, setActiveTab] = useState("overview");
  const [addCheckInKr, setAddCheckInKr] = useState<OKRKeyResult | null>(null);

  const progress = useMemo(
    () =>
      okr?.key_results?.length
        ? calculateOKRProgress(okr.key_results)
        : Number(okr?.progress ?? 0),
    [okr]
  );

  const health = useMemo(
    () => healthScoreAndLabel(okr?.key_results || []),
    [okr?.key_results]
  );

  const checkInsByKr = useMemo(() => {
    const map: Record<string, Array<{ new_value: number; created_at: string }>> = {};
    for (const c of checkIns) {
      const krId = c.key_result_id || "none";
      if (!map[krId]) map[krId] = [];
      map[krId].push({
        new_value: c.new_value ?? 0,
        created_at: c.created_at,
      });
    }
    return map;
  }, [checkIns]);

  const daysLeft = okr?.end_date ? daysRemaining(okr.end_date) : null;

  if (isLoading || !okr) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Loading OKR</DialogTitle>
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0"
        aria-describedby={undefined}
      >
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl font-semibold leading-tight pr-8">
                {okr.title}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="secondary" className={statusColors[okr.status] || ""}>
                  {okr.status.replace("_", " ")}
                </Badge>
                {okr.okr_type && (
                  <Badge variant="secondary" className="capitalize">
                    {okr.okr_type}
                  </Badge>
                )}
                <Badge variant="secondary" className="bg-rose-100 text-rose-800">
                  {okr.quarter}
                </Badge>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                okr.key_results?.length
                  ? setAddCheckInKr(okr.key_results[0])
                  : undefined
              }
              disabled={!okr.key_results?.length}
              className="shrink-0"
            >
              <MessageSquarePlus className="h-4 w-4 mr-2" />
              Add Check-in
            </Button>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full justify-start rounded-none border-b h-auto p-0 bg-transparent shrink-0">
            <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
              Overview
            </TabsTrigger>
            <TabsTrigger value="performance" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
              Performance
            </TabsTrigger>
            <TabsTrigger value="progress" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none flex items-center gap-1.5">
              <BarChart2 className="h-3.5 w-3.5" />
              Progress
            </TabsTrigger>
            <TabsTrigger value="entries" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" />
              Entries
            </TabsTrigger>
            <TabsTrigger value="updates" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
              Updates
            </TabsTrigger>
            <TabsTrigger value="ai" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              AI
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <TabsContent value="overview" className="mt-0 space-y-4">
              {okr.description && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Description</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">{okr.description}</p>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    <p className="text-2xl font-bold">{Math.round(progress)}%</p>
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      Average of {okr.key_results?.length || 0} key result
                      {(okr.key_results?.length || 0) !== 1 ? "s" : ""}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Health Score</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    <p className="text-2xl font-bold">{health.score}%</p>
                    <Badge variant="secondary" className={health.className}>
                      {health.label}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      {okr.key_results?.filter((k) => k.status === "on_track" || k.status === "completed").length} of{" "}
                      {okr.key_results?.length || 0} KRs on track
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Details</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <dl className="space-y-3 text-sm">
                    {okr.owner && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-16 shrink-0">Owner</span>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                          {(okr.owner.full_name || okr.owner.email || "?").charAt(0).toUpperCase()}
                        </span>
                        <span>{okr.owner.full_name || okr.owner.email || "—"}</span>
                      </div>
                    )}
                    {okr.end_date && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-16 shrink-0">Due date</span>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formatDateLong(okr.end_date)}</span>
                      </div>
                    )}
                    {daysLeft !== null && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-16 shrink-0">Remaining</span>
                        <span className={daysLeft < 0 ? "text-destructive font-medium" : ""}>
                          {daysLeft < 0 ? "Overdue" : `${daysLeft} days`}
                        </span>
                      </div>
                    )}
                    {okr.pod && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-16 shrink-0">Team</span>
                        <span>{okr.pod.name}</span>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance" className="mt-0 space-y-4">
              {(() => {
                const onTrackCount = (okr.key_results ?? []).filter(
                  (kr) => calculateKeyResultProgressFromKR(kr) >= 66
                ).length;
                const atRiskCount = (okr.key_results ?? []).length - onTrackCount;
                return (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-1">Overall: {Math.round(progress)}%</p>
                      <Progress value={progress} className="h-2" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-md bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        {onTrackCount} On Track
                      </span>
                      <span className="inline-flex items-center rounded-md bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                        {atRiskCount} At Risk
                      </span>
                    </div>
                    {okr.key_results && okr.key_results.length > 0 ? (
                      <div className="space-y-1">
                        {okr.key_results.map((kr) => {
                          const krProgress = calculateKeyResultProgressFromKR(kr);
                          const isOnTrack = krProgress >= 66;
                          const krOwner = kr.owner;
                          const displayCurrent =
                            kr.unit === "percent"
                              ? `${kr.current_value}%`
                              : String(kr.current_value);
                          const displayTarget =
                            kr.unit === "percent"
                              ? `${kr.target_value}%`
                              : String(kr.target_value);
                          const trendPercent =
                            kr.start_value !== kr.target_value
                              ? Math.round(
                                  ((kr.current_value - kr.start_value) /
                                    (kr.target_value - kr.start_value)) *
                                    100
                                )
                              : 0;
                          return (
                            <div
                              key={kr.id}
                              className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer"
                              onClick={() => setAddCheckInKr(kr)}
                            >
                              <span
                                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                  isOnTrack ? "bg-green-500" : "bg-amber-500"
                                }`}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{kr.title}</p>
                                <div className="flex items-center gap-2 mt-0.5 text-muted-foreground text-xs">
                                  {krOwner && (
                                    <>
                                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                                        {(krOwner.full_name || krOwner.email || "?").charAt(0).toUpperCase()}
                                      </span>
                                      <span className="truncate">{krOwner.full_name || krOwner.email}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <div className="w-20">
                                  <Progress value={Math.min(100, Math.max(0, krProgress))} className="h-2" />
                                </div>
                                <span className="text-sm font-medium w-8">{Math.round(krProgress)}%</span>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {displayCurrent} / {displayTarget}
                                </span>
                                <span className={`text-xs font-medium whitespace-nowrap ${isOnTrack ? "text-green-600" : "text-amber-600"}`}>
                                  <TrendingUp className="h-3 w-3 inline mr-0.5" />
                                  +{trendPercent}%
                                </span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        No key results defined
                      </p>
                    )}
                  </div>
                );
              })()}
            </TabsContent>

            <TabsContent value="progress" className="mt-0 space-y-4">
              {okr.key_results && okr.key_results.length > 0 ? (
                okr.key_results.map((kr) => {
                  const history = historyByKr[kr.id] || [];
                  const chartData = history.map((h) => ({
                    new_value: h.new_value,
                    created_at: h.updated_at || String(h.new_value),
                  }));
                  const krProgress = calculateKeyResultProgressFromKR(kr);
                  const trendPercent =
                    kr.start_value !== kr.target_value
                      ? Math.round(
                          ((kr.current_value - kr.start_value) /
                            (kr.target_value - kr.start_value)) *
                            100
                        )
                      : 0;
                  const isOnTrack = krProgress >= 66;
                  const sortedChart = chartData.length >= 2
                    ? [...chartData].sort(
                        (a, b) =>
                          new Date(a.created_at).getTime() -
                          new Date(b.created_at).getTime()
                      )
                    : [];
                  const ratePerDay =
                    sortedChart.length >= 2
                      ? (sortedChart[sortedChart.length - 1].new_value -
                          sortedChart[0].new_value) /
                        (Math.max(
                          1,
                          (new Date(sortedChart[sortedChart.length - 1].created_at).getTime() -
                            new Date(sortedChart[0].created_at).getTime()) /
                            (24 * 60 * 60 * 1000)
                        ))
                      : null;
                  const projectedCompletion =
                    ratePerDay != null &&
                    ratePerDay > 0 &&
                    kr.current_value < kr.target_value
                      ? (() => {
                          const daysToTarget =
                            (kr.target_value - kr.current_value) / ratePerDay;
                          const d = new Date();
                          d.setDate(d.getDate() + Math.ceil(daysToTarget));
                          return formatDateLong(d.toISOString());
                        })()
                      : null;
                  const vsSchedule =
                    okr.end_date && projectedCompletion
                      ? (() => {
                          const end = new Date(okr.end_date);
                          const proj = new Date(projectedCompletion);
                          const diffDays = Math.ceil(
                            (proj.getTime() - end.getTime()) / (24 * 60 * 60 * 1000)
                          );
                          if (diffDays <= 0)
                            return { text: `${Math.abs(diffDays)}d ahead`, ahead: true };
                          return { text: `${diffDays}d behind`, ahead: false };
                        })()
                      : null;
                  return (
                    <Card key={kr.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <CardTitle className="text-base">{kr.title}</CardTitle>
                            <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />
                          </div>
                          <Badge
                            className={
                              isOnTrack
                                ? "bg-green-100 text-green-800"
                                : "bg-amber-100 text-amber-800"
                            }
                          >
                            {isOnTrack ? "On Track" : "At Risk"} +{trendPercent}%
                          </Badge>
                        </div>
                        {kr.description && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {kr.description}
                          </p>
                        )}
                      </CardHeader>
                      <CardContent className="pt-0">
                        <KeyResultProgressChart
                          keyResult={kr}
                          embedded
                          checkIns={
                            chartData.length >= 2
                              ? chartData
                              : checkInsByKr[kr.id] || []
                          }
                        />
                        <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                          {ratePerDay != null && (
                            <span>
                              Rate of Change:{" "}
                              {ratePerDay >= 0 ? "+" : ""}
                              {ratePerDay.toFixed(2)}/day
                            </span>
                          )}
                          {projectedCompletion && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              Projected Completion: {projectedCompletion}
                            </span>
                          )}
                          {vsSchedule && (
                            <span
                              className={
                                vsSchedule.ahead
                                  ? "text-green-600 font-medium"
                                  : ""
                              }
                            >
                              vs Schedule: {vsSchedule.text}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No key results to show progress for
                </p>
              )}
            </TabsContent>

            <TabsContent value="entries" className="mt-0 space-y-4">
              {okr.key_results && okr.key_results.length > 0 ? (
                <div className="space-y-2">
                  {okr.key_results.map((kr) => {
                    const entries = (historyByKr[kr.id] || []).slice().reverse();
                    const krOwner = kr.owner;
                    return (
                      <Collapsible key={kr.id} defaultOpen className="group">
                        <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left hover:bg-muted/50">
                          <BarChart2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm flex-1">{kr.title}</span>
                          <span className="text-xs text-muted-foreground">
                            Responsible: {krOwner?.full_name || krOwner?.email || "—"}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="pt-2 pl-6 space-y-2">
                            {entries.length > 0 ? (
                              entries.map((e) => (
                                <div
                                  key={e.id}
                                  className="rounded-md border bg-card p-3 text-sm"
                                >
                                  <p className="text-muted-foreground text-xs">
                                    {formatDateTime(e.updated_at)}
                                  </p>
                                  <p className="font-medium mt-0.5">
                                    Value: {e.previous_value ?? "—"} → {e.new_value}
                                    {kr.unit === "percent" ? "%" : ""}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Recorded by{" "}
                                    {recordedByProfiles[e.updated_by]?.full_name || "Someone"}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-muted-foreground py-2">
                                No value history yet
                              </p>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No key results
                </p>
              )}
            </TabsContent>

            <TabsContent value="updates" className="mt-0 space-y-4">
              {checkIns.length > 0 ? (
                <div className="space-y-3">
                  {checkIns.map((c) => (
                    <Card key={c.id}>
                      <CardContent className="py-3">
                        <div className="flex items-start gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                            {(c.user?.full_name || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">
                              {c.user?.full_name || "Someone"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateLong(c.created_at)}
                            </p>
                            <p className="text-sm mt-1">
                              Updated value: {c.previous_value ?? "—"} → {c.new_value}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageCircle className="h-16 w-16 text-muted-foreground/60 mx-auto mb-4 stroke-[1.5]" />
                  <p className="text-sm text-muted-foreground mb-4">
                    No check-ins yet
                  </p>
                  <Button
                    size="sm"
                    onClick={() =>
                      okr.key_results?.length
                        ? setAddCheckInKr(okr.key_results[0])
                        : undefined
                    }
                    disabled={!okr.key_results?.length}
                  >
                    <MessageSquarePlus className="h-4 w-4 mr-2" />
                    Add First Check-in
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="ai" className="mt-0">
              <Card>
                <CardContent className="py-8 text-center">
                  <Sparkles className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Get AI-powered insights about this OKR
                  </p>
                  <Button>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate AI Insights
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Coming soon
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>

      {addCheckInKr && (
        <CheckInDialog
          open={!!addCheckInKr}
          onOpenChange={(open) => !open && setAddCheckInKr(null)}
          keyResult={addCheckInKr}
          okrId={okr.id}
          okrTitle={okr.title}
        />
      )}
    </Dialog>
  );
}
