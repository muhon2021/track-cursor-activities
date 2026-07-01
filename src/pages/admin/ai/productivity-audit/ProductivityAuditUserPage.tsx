import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useCsaUserDetail, useGenerateCsaInsights } from "@/hooks/useCsaReports";
import { CsaAuditReportView } from "./CsaAuditReportView";
import { CsaDateRangeFilter } from "./CsaDateRangeFilter";
import { getAuditFromReport } from "@/lib/csaAuditReportHtml";
import { clampCsaDateRange, formatCsaPeriodLabel, getDefaultCsaDateRange } from "@/lib/csaDateRange";

function periodFromSearchParams(params: URLSearchParams) {
  const start = params.get("period_start");
  const end = params.get("period_end");
  if (start && end) return clampCsaDateRange(start, end).range;
  return getDefaultCsaDateRange();
}

export default function ProductivityAuditUserPage() {
  const { userId } = useParams<{ userId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dateRange, setDateRange] = useState(() => periodFromSearchParams(searchParams));

  const { data, isLoading, refetch } = useCsaUserDetail(userId ?? null, dateRange);
  const generateInsights = useGenerateCsaInsights();

  const report = data?.report ?? null;
  const sessions = data?.sessions ?? [];
  const audit = report ? getAuditFromReport(report) : null;
  const periodLabel = formatCsaPeriodLabel(dateRange);

  const handleDateRangeChange = (range: typeof dateRange) => {
    setDateRange(range);
    setSearchParams({
      period_start: range.period_start,
      period_end: range.period_end,
    });
  };

  const handleRegenerate = async () => {
    if (!userId) return;
    try {
      const result = await generateInsights.mutateAsync({ userId, period: dateRange });
      await refetch();
      if (result.generated > 0) {
        toast.success("Audit report regenerated");
      } else {
        toast.warning(
          result.message ??
            "No sessions with prompts in the selected range. Capture usage via hooks first.",
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to regenerate");
    }
  };

  const title = useMemo(
    () => report?.user_display_name || report?.user_email || "Productivity Audit",
    [report],
  );

  return (
    <div className="container py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">
            <Link to="/admin/ai/productivity-audit" className="hover:underline">
              AI Productivity Audit
            </Link>
            <span className="mx-2">/</span>
            <span>{title}</span>
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Personal AI-assisted development audit for {periodLabel}. Summaries only — no raw chat.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/ai/productivity-audit">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to team
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={generateInsights.isPending || !userId}
          >
            {generateInsights.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Regenerate audit
          </Button>
        </div>
      </div>

      <CsaDateRangeFilter value={dateRange} onChange={handleDateRangeChange} />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !report ? (
        <Alert>
          <AlertDescription className="space-y-3">
            <p>
              {sessions.length > 0
                ? `${sessions.length} session(s) captured for ${periodLabel} but no audit report yet. Regenerate to build one.`
                : `No report for ${periodLabel}. Capture sessions via hooks, then regenerate.`}
            </p>
            <Button size="sm" onClick={handleRegenerate} disabled={generateInsights.isPending}>
              {generateInsights.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Regenerate audit
            </Button>
          </AlertDescription>
        </Alert>
      ) : !audit ? (
        <Alert>
          <AlertDescription className="space-y-3">
            <p>This report uses the legacy format. Click Regenerate audit to build the full productivity audit.</p>
            <Button size="sm" onClick={handleRegenerate} disabled={generateInsights.isPending}>
              {generateInsights.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Regenerate audit
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <CsaAuditReportView report={report} audit={audit} />
      )}
    </div>
  );
}
