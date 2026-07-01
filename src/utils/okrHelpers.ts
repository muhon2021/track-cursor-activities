/**
 * OKR helper utilities.
 *
 * Lightweight utilities used across OKR pages/components.
 */

import type { UpdateFrequency } from "@/types/okr";

export type QuarterYear = { quarter: string; year: number };

export function getCurrentQuarter(): QuarterYear {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return { quarter: `Q${q}`, year: now.getFullYear() };
}

export function getCurrentQuarterString(): string {
  const { quarter, year } = getCurrentQuarter();
  return `${quarter} ${year}`;
}

export function getYearlyString(year: number): string {
  return `Yearly ${year}`;
}

export function calculateKeyResultProgress(
  start: number,
  current: number,
  target: number
): number {
  if (target === start) return current >= target ? 100 : 0;
  const raw = ((current - start) / (target - start)) * 100;
  return Number(Math.max(0, Math.min(100, raw)).toFixed(2));
}

export function calculateKeyResultProgressFromKR(keyResult: {
  start_value?: number | null;
  current_value?: number | null;
  target_value?: number | null;
}): number {
  const start = Number(keyResult.start_value ?? 0);
  const current = Number(keyResult.current_value ?? 0);
  const target = Number(keyResult.target_value ?? 0);
  return calculateKeyResultProgress(start, current, target);
}

export function calculateOKRProgress(keyResults: Array<{
  start_value?: number | null;
  current_value?: number | null;
  target_value?: number | null;
}>): number {
  if (!keyResults.length) return 0;
  const total = keyResults.reduce(
    (sum, kr) => sum + calculateKeyResultProgressFromKR(kr),
    0
  );
  return Number((total / keyResults.length).toFixed(2));
}

export interface OKRStatsResult {
  total: number;
  active: number;
  at_risk: number;
  completed: number;
  avg_progress: number;
}

export function calculateOKRStats(okrs: Array<{
  status: string;
  progress?: number | null;
  key_results?: Array<{
    start_value?: number | null;
    current_value?: number | null;
    target_value?: number | null;
  }>;
}>): OKRStatsResult {
  const total = okrs.length;
  const active = okrs.filter((o) => o.status === "active" || o.status === "on_track").length;
  const at_risk = okrs.filter((o) => o.status === "at_risk" || o.status === "behind").length;
  const completed = okrs.filter((o) => o.status === "completed" || o.status === "closed").length;
  const progressSum = okrs.reduce((sum, o) => {
    const p = o.key_results?.length
      ? calculateOKRProgress(o.key_results)
      : Number(o.progress ?? 0);
    return sum + p;
  }, 0);
  const avg_progress = total ? Number((progressSum / total).toFixed(1)) : 0;
  return { total, active, at_risk, completed, avg_progress };
}

export function getFrequencyMilliseconds(frequency: UpdateFrequency): number {
  switch (frequency) {
    case "daily":
      return 24 * 60 * 60 * 1000;
    case "biweekly":
      return 14 * 24 * 60 * 60 * 1000;
    case "monthly":
      return 30 * 24 * 60 * 60 * 1000;
    case "weekly":
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

export function isOverdue(lastUpdatedAt: string | null, frequency: UpdateFrequency): boolean {
  if (!lastUpdatedAt) return true;
  const updatedMs = new Date(lastUpdatedAt).getTime();
  if (Number.isNaN(updatedMs)) return true;
  return Date.now() - updatedMs > getFrequencyMilliseconds(frequency);
}

export function formatValue(value: number, unit?: string | null): string {
  if (unit === "percentage" || unit === "%") return `${value}%`;
  if (unit === "currency" || unit === "$") return `$${value}`;
  return `${value}${unit ? ` ${unit}` : ""}`;
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString();
}

/** Format date as "Jul 01, 2026" for OKR cards and similar. */
export function formatDateLong(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

/** Format date and time as "Feb 23, 2026 3:49 PM" for entries/updates. */
export function formatDateTime(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRelativeDate(date: string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return d.toLocaleDateString();
}
