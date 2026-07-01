/**
 * Key Results By Owner (Performance view)
 *
 * Matches reference: Search owners, Individual Health summary line,
 * grid of color-coded owner cards (name, %, X KRs), and legend.
 * Health by avg progress: On track ≥70%, Medium 40–69%, High risk <40%.
 */

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { calculateKeyResultProgressFromKR } from "@/utils/okrHelpers";
import type { OKRKeyResult } from "../../types";

const HEALTH = {
  ON_TRACK: { bg: "bg-green-600", text: "text-white", label: "On Track (≥70%)" },
  MEDIUM: { bg: "bg-amber-500", text: "text-white", label: "Medium Risk (40-69%)" },
  HIGH: { bg: "bg-red-600", text: "text-white", label: "High Risk (<40%)" },
} as const;

function getHealthBand(progressPercent: number): keyof typeof HEALTH {
  if (progressPercent >= 70) return "ON_TRACK";
  if (progressPercent >= 40) return "MEDIUM";
  return "HIGH";
}

interface OwnerGroup {
  id: string;
  name: string;
  keyResults: OKRKeyResult[];
  avgProgress: number;
  band: keyof typeof HEALTH;
}

interface KeyResultsByOwnerProps {
  keyResults: OKRKeyResult[];
}

export function KeyResultsByOwner({ keyResults }: KeyResultsByOwnerProps) {
  const [search, setSearch] = useState("");

  const { groups, summary } = useMemo(() => {
    const map = new Map<string, { name: string; keyResults: OKRKeyResult[] }>();

    for (const kr of keyResults) {
      const id = kr.owner_id ?? "unassigned";
      const name = kr.owner?.full_name ?? "Unassigned";
      const existing = map.get(id);
      if (existing) {
        existing.keyResults.push(kr);
      } else {
        map.set(id, { name, keyResults: [kr] });
      }
    }

    const groupsList: OwnerGroup[] = [];
    let totalProgress = 0;
    let totalKrs = 0;
    let onTrack = 0;
    let mediumRisk = 0;
    let highRisk = 0;

    for (const [id, { name, keyResults: krs }] of map) {
      const progressSum = krs.reduce((s, kr) => s + calculateKeyResultProgressFromKR(kr), 0);
      const avgProgress = krs.length ? progressSum / krs.length : 0;
      const band = getHealthBand(avgProgress);
      groupsList.push({
        id,
        name,
        keyResults: krs,
        avgProgress,
        band,
      });
      totalProgress += progressSum;
      totalKrs += krs.length;
      if (band === "ON_TRACK") onTrack += 1;
      else if (band === "MEDIUM") mediumRisk += 1;
      else highRisk += 1;
    }

    const avgProgress = totalKrs ? totalProgress / totalKrs : 0;
    return {
      groups: groupsList.sort((a, b) => a.name.localeCompare(b.name)),
      summary: {
        avgProgress: Math.round(avgProgress),
        onTrack,
        mediumRisk,
        highRisk,
      },
    };
  }, [keyResults]);

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.trim().toLowerCase();
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, search]);

  if (keyResults.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <p>No key results to display</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Input
        type="search"
        placeholder="Search owners..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
        aria-label="Search owners"
      />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium">
          Individual Health: {summary.avgProgress}% avg progress
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden />
          {summary.onTrack} on track
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
          {summary.mediumRisk} medium risk
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
          {summary.highRisk} high risk
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {filtered.map((group) => {
          const style = HEALTH[group.band];
          const progressLabel = `${Math.round(group.avgProgress)}%`;
          const krLabel = group.keyResults.length === 1 ? "1 KR" : `${group.keyResults.length} KRs`;
          return (
            <Card
              key={group.id}
              className={`${style.bg} ${style.text} border-0`}
            >
              <CardContent className="p-4">
                <p
                  className="font-medium text-sm truncate"
                  title={group.name}
                >
                  {group.name}
                </p>
                <p className="text-2xl font-bold mt-2">{progressLabel}</p>
                <p className="text-xs opacity-90 mt-0.5">{krLabel}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-2 border-t text-sm text-muted-foreground">
        <span className="font-medium">Legend:</span>
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
      </div>
    </div>
  );
}
