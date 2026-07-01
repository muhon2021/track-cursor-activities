export const CSA_DEFAULT_RANGE_DAYS = 7;
export const CSA_MAX_RANGE_DAYS = 30;

export interface CsaPeriodBounds {
  period_start: string;
  period_end: string;
  startIso: string;
  endIso: string;
  period_type: "weekly" | "custom";
}

function parseDateOnly(value: string | undefined): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(`${value.trim()}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDateOnlyStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function endOfDayUtc(d: Date): Date {
  return new Date(`${toDateOnlyStr(d)}T23:59:59.999Z`);
}

export function resolveCsaPeriod(body: {
  period_start?: string;
  period_end?: string;
}): CsaPeriodBounds | { error: string } {
  const today = new Date();
  const todayStr = toDateOnlyStr(today);

  let end = parseDateOnly(body.period_end) ?? today;
  let start = parseDateOnly(body.period_start);

  if (!start) {
    start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (CSA_DEFAULT_RANGE_DAYS - 1));
  }

  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  const spanDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (spanDays > CSA_MAX_RANGE_DAYS) {
    return { error: `Date range cannot exceed ${CSA_MAX_RANGE_DAYS} days` };
  }

  const endCap = parseDateOnly(todayStr)!;
  if (end > endCap) end = endCap;
  if (start > end) start = end;

  const period_start = toDateOnlyStr(start);
  const period_end = toDateOnlyStr(end);

  return {
    period_start,
    period_end,
    startIso: `${period_start}T00:00:00.000Z`,
    endIso: endOfDayUtc(end).toISOString(),
    period_type: "weekly" as const,
  };
}
