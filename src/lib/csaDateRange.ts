import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";

export const CSA_DEFAULT_RANGE_DAYS = 7;
export const CSA_MAX_RANGE_DAYS = 30;

export interface CsaDateRange {
  period_start: string;
  period_end: string;
}

export function getDefaultCsaDateRange(): CsaDateRange {
  const end = new Date();
  const start = subDays(end, CSA_DEFAULT_RANGE_DAYS - 1);
  return {
    period_start: format(start, "yyyy-MM-dd"),
    period_end: format(end, "yyyy-MM-dd"),
  };
}

export function clampCsaDateRange(
  period_start: string,
  period_end: string,
): { range: CsaDateRange; adjusted: boolean } {
  let start = parseISO(period_start);
  let end = parseISO(period_end);
  let adjusted = false;

  if (Number.isNaN(start.getTime())) {
    start = parseISO(getDefaultCsaDateRange().period_start);
    adjusted = true;
  }
  if (Number.isNaN(end.getTime())) {
    end = new Date();
    adjusted = true;
  }

  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
    adjusted = true;
  }

  const span = differenceInCalendarDays(end, start) + 1;
  if (span > CSA_MAX_RANGE_DAYS) {
    start = subDays(end, CSA_MAX_RANGE_DAYS - 1);
    adjusted = true;
  }

  const today = new Date();
  if (end > today) {
    end = today;
    adjusted = true;
  }

  return {
    range: {
      period_start: format(start, "yyyy-MM-dd"),
      period_end: format(end, "yyyy-MM-dd"),
    },
    adjusted,
  };
}

export function formatCsaPeriodLabel(range: CsaDateRange): string {
  const start = format(parseISO(range.period_start), "MMM d, yyyy");
  const end = format(parseISO(range.period_end), "MMM d, yyyy");
  return `${start} – ${end}`;
}

export function csaPeriodDays(range: CsaDateRange): number {
  return differenceInCalendarDays(parseISO(range.period_end), parseISO(range.period_start)) + 1;
}
