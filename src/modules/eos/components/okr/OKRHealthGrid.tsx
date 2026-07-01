/**
 * OKR Health Grid
 *
 * Matches reference: Team Health summary line, Company Health (Yearly + Quarterly cards),
 * Team Health by POD grid with color-coded cards, and legend.
 * Health by progress: On track ≥70%, Medium 40–69%, High risk <40%, No OKRs = grey.
 */

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { calculateOKRProgress } from "@/utils/okrHelpers";
import type { OKR, EOSPod } from "../../types";

const HEALTH = {
  ON_TRACK: { min: 70, max: 100, bg: "bg-green-600", text: "text-white", label: "On Track (≥70%)" },
  MEDIUM: { min: 40, max: 69, bg: "bg-amber-500", text: "text-white", label: "Medium Risk (40-69%)" },
  HIGH: { min: 0, max: 39, bg: "bg-red-600", text: "text-white", label: "High Risk (<40%)" },
  NONE: { bg: "bg-muted", text: "text-muted-foreground", label: "No OKRs" },
} as const;

function getHealthBand(progressPercent: number): keyof typeof HEALTH {
  if (progressPercent >= 70) return "ON_TRACK";
  if (progressPercent >= 40) return "MEDIUM";
  return "HIGH";
}

interface OKRHealthGridProps {
  okrs: OKR[];
  pods?: EOSPod[];
  onSelectPod?: (podId: string | null) => void;
  onSelectCompany?: () => void;
}

export function OKRHealthGrid({
  okrs,
  pods = [],
  onSelectPod,
  onSelectCompany,
}: OKRHealthGridProps) {
  const {
    teamSummary,
    companyYearly,
    companyQuarterly,
    podStats,
  } = useMemo(() => {
    const teamOkrs = okrs.filter((o) => (o.okr_type || "personal") === "team" && o.pod_id);
    const companyOkrs = okrs.filter((o) => (o.okr_type || "personal") === "company");

    const getProgress = (o: OKR) =>
      o.key_results?.length
        ? calculateOKRProgress(o.key_results)
        : Number(o.progress ?? 0);

    const yearlyOkrs = companyOkrs.filter((o) => !o.quarter?.trim().startsWith("Q"));
    const quarterlyOkrs = companyOkrs.filter((o) => o.quarter?.trim().startsWith("Q"));

    const avg = (list: OKR[]) =>
      list.length ? list.reduce((s, o) => s + getProgress(o), 0) / list.length : 0;

    const teamProgressSum = teamOkrs.reduce((s, o) => s + getProgress(o), 0);
    const teamAvgProgress = teamOkrs.length ? teamProgressSum / teamOkrs.length : 0;

    const byPod = new Map<
      string,
      { progressSum: number; count: number }
    >();
    for (const o of teamOkrs) {
      const pid = o.pod_id!;
      const p = getProgress(o);
      const cur = byPod.get(pid);
      if (cur) {
        cur.progressSum += p;
        cur.count += 1;
      } else {
        byPod.set(pid, { progressSum: p, count: 1 });
      }
    }

    let onTrack = 0;
    let mediumRisk = 0;
    let highRisk = 0;
    let noOkrs = 0;
    for (const pod of pods) {
      const stat = byPod.get(pod.id);
      if (!stat || stat.count === 0) {
        noOkrs += 1;
        continue;
      }
      const avgP = stat.progressSum / stat.count;
      if (avgP >= 70) onTrack += 1;
      else if (avgP >= 40) mediumRisk += 1;
      else highRisk += 1;
    }

    const podStatsList = pods.map((pod) => {
      const stat = byPod.get(pod.id);
      const count = stat?.count ?? 0;
      const avgProgress = count ? (stat!.progressSum / count) : 0;
      const band = count === 0 ? "NONE" : getHealthBand(avgProgress);
      return { pod, count, avgProgress, band };
    });

    return {
      teamSummary: {
        avgProgress: Math.round(teamAvgProgress),
        onTrack,
        mediumRisk,
        highRisk,
        noOkrs,
      },
      companyYearly: {
        okrs: yearlyOkrs,
        avgProgress: avg(yearlyOkrs),
        count: yearlyOkrs.length,
      },
      companyQuarterly: {
        okrs: quarterlyOkrs,
        avgProgress: avg(quarterlyOkrs),
        count: quarterlyOkrs.length,
      },
      podStats: podStatsList,
    };
  }, [okrs, pods]);

  const companyCards = [
    {
      title: "Yearly OKRs",
      ...companyYearly,
      progressLabel: companyYearly.count ? `${Math.round(companyYearly.avgProgress)}%` : "—",
      band: companyYearly.count ? getHealthBand(companyYearly.avgProgress) : "NONE",
    },
    {
      title: "Quarterly OKRs",
      ...companyQuarterly,
      progressLabel: companyQuarterly.count ? `${Math.round(companyQuarterly.avgProgress)}%` : "—",
      band: companyQuarterly.count ? getHealthBand(companyQuarterly.avgProgress) : "NONE",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Team Health summary line */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium">
          Team Health: {teamSummary.avgProgress}% avg progress
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden />
          {teamSummary.onTrack} on track
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
          {teamSummary.mediumRisk} medium risk
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
          {teamSummary.highRisk} high risk
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-muted-foreground" aria-hidden />
          {teamSummary.noOkrs} no OKRs
        </span>
      </div>

      {/* Company Health */}
      <div>
        <h2 className="text-lg font-semibold mb-3 text-center">Company Health</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {companyCards.map((card) => {
            const style = HEALTH[card.band];
            const isClickable = card.count > 0 && onSelectCompany;
            return (
              <Card
                key={card.title}
                className={`${style.bg} ${style.text} border-0 ${
                  isClickable
                    ? "cursor-pointer hover:opacity-90 transition-opacity"
                    : ""
                }`}
                onClick={isClickable ? onSelectCompany : undefined}
              >
                <CardContent className="p-5">
                  <p className="text-sm font-medium opacity-90">{card.title}</p>
                  <p className="text-3xl font-bold mt-1">{card.progressLabel}</p>
                  <p className="text-sm opacity-90 mt-0.5">{card.count} OKRs</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Team Health by POD */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Team Health by POD</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {podStats.map(({ pod, count, avgProgress, band }) => {
            const style = HEALTH[band];
            const progressLabel = count ? `${Math.round(avgProgress)}%` : "—";
            const isClickable = count > 0 && onSelectPod;
            return (
              <Card
                key={pod.id}
                className={`${style.bg} ${style.text} border-0 ${
                  isClickable
                    ? "cursor-pointer hover:opacity-90 transition-opacity"
                    : ""
                }`}
                onClick={isClickable ? () => onSelectPod(pod.id) : undefined}
              >
                <CardContent className="p-4">
                  <p className="font-medium text-sm truncate" title={pod.name}>
                    {pod.name}
                  </p>
                  <p className="text-2xl font-bold mt-1">{progressLabel}</p>
                  <p className="text-xs opacity-90 mt-0.5">{count} OKRs</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 pt-2 border-t text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 rounded bg-red-600 shrink-0" aria-hidden />
          {HEALTH.HIGH.label}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 rounded bg-amber-500 shrink-0" aria-hidden />
          {HEALTH.MEDIUM.label}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 rounded bg-green-600 shrink-0" aria-hidden />
          {HEALTH.ON_TRACK.label}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 rounded bg-muted shrink-0" aria-hidden />
          {HEALTH.NONE.label}
        </span>
      </div>
    </div>
  );
}
