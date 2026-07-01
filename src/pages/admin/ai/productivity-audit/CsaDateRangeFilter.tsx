import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CSA_DEFAULT_RANGE_DAYS,
  CSA_MAX_RANGE_DAYS,
  clampCsaDateRange,
  csaPeriodDays,
  formatCsaPeriodLabel,
  type CsaDateRange,
} from "@/lib/csaDateRange";

interface CsaDateRangeFilterProps {
  value: CsaDateRange;
  onChange: (range: CsaDateRange) => void;
}

export function CsaDateRangeFilter({ value, onChange }: CsaDateRangeFilterProps) {
  const days = csaPeriodDays(value);

  const applyRange = (start: string, end: string) => {
    const { range, adjusted } = clampCsaDateRange(start, end);
    onChange(range);
    return adjusted;
  };

  const setPresetDays = (numDays: number) => {
    const end = format(new Date(), "yyyy-MM-dd");
    const start = format(
      new Date(Date.now() - (numDays - 1) * 86_400_000),
      "yyyy-MM-dd",
    );
    applyRange(start, end);
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Date range</span>
        <span className="text-xs text-muted-foreground">
          {formatCsaPeriodLabel(value)} ({days} day{days === 1 ? "" : "s"})
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={days === CSA_DEFAULT_RANGE_DAYS ? "default" : "outline"}
          size="sm"
          onClick={() => setPresetDays(CSA_DEFAULT_RANGE_DAYS)}
        >
          Last {CSA_DEFAULT_RANGE_DAYS} days
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setPresetDays(14)}>
          Last 14 days
        </Button>
        <Button
          type="button"
          variant={days === CSA_MAX_RANGE_DAYS ? "default" : "outline"}
          size="sm"
          onClick={() => setPresetDays(CSA_MAX_RANGE_DAYS)}
        >
          Last {CSA_MAX_RANGE_DAYS} days
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="csa-period-start" className="text-xs">
            From
          </Label>
          <Input
            id="csa-period-start"
            type="date"
            className="w-[160px]"
            value={value.period_start}
            max={value.period_end}
            onChange={(e) => applyRange(e.target.value, value.period_end)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="csa-period-end" className="text-xs">
            To
          </Label>
          <Input
            id="csa-period-end"
            type="date"
            className="w-[160px]"
            value={value.period_end}
            min={value.period_start}
            max={format(new Date(), "yyyy-MM-dd")}
            onChange={(e) => applyRange(value.period_start, e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground pb-2">
          Max {CSA_MAX_RANGE_DAYS} days. Default is last {CSA_DEFAULT_RANGE_DAYS} days.
        </p>
      </div>
    </div>
  );
}

export function csaRangeFromReport(report: { period_start: string; period_end: string }): CsaDateRange {
  return clampCsaDateRange(report.period_start, report.period_end).range;
}
