import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCsaUserDetail, useGenerateCsaInsights } from "@/hooks/useCsaReports";
import { CsaAuditReportView } from "@/pages/admin/ai/productivity-audit/CsaAuditReportView";
import { CsaDeveloperSetupPanel } from "@/pages/admin/ai/productivity-audit/CsaDeveloperSetupPanel";
import { CsaDateRangeFilter } from "@/pages/admin/ai/productivity-audit/CsaDateRangeFilter";
import { getAuditFromReport } from "@/lib/csaAuditReportHtml";
import { formatCsaPeriodLabel, getDefaultCsaDateRange } from "@/lib/csaDateRange";

export default function CursorInsightsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(getDefaultCsaDateRange);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data, isLoading, refetch } = useCsaUserDetail(userId, dateRange);
  const generateInsights = useGenerateCsaInsights();

  const report = data?.report ?? null;
  const sessions = data?.sessions ?? [];
  const audit = report ? getAuditFromReport(report) : null;
  const periodLabel = formatCsaPeriodLabel(dateRange);

  const handleRegenerate = async () => {
    try {
      const result = await generateInsights.mutateAsync({ period: dateRange });
      await refetch();
      if (result.generated > 0) {
        toast.success("Your audit report was regenerated");
      } else {
        toast.warning(
          result.message ??
            "No Cursor sessions found in the selected range. Use Cursor with hooks installed, then try again.",
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to regenerate");
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">
            <Link to="/profile" className="hover:underline">
              My Profile
            </Link>
            <span className="mx-2">/</span>
            <span>Cursor Insights</span>
          </p>
          <h1 className="text-2xl font-bold tracking-tight">My Cursor Insights</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your personal AI-assisted development audit for {periodLabel}. Summaries only — no raw chat.
          </p>
        </div>
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
          Regenerate my audit
        </Button>
      </div>

      <Tabs defaultValue="audit">
        <TabsList>
          <TabsTrigger value="audit">My audit</TabsTrigger>
          <TabsTrigger value="setup">Cursor setup</TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-6 mt-4">
          <CsaDateRangeFilter value={dateRange} onChange={setDateRange} />

          {isLoading || !userId ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !report ? (
            <Alert>
              <AlertDescription className="space-y-3">
                <p>
                  {sessions.length > 0
                    ? `We found ${sessions.length} session(s) for ${periodLabel} but no audit report yet. Click regenerate to build one.`
                    : `No audit for ${periodLabel}. Complete Cursor setup (token + hooks), use Cursor for a few prompts, then regenerate.`}
                </p>
                <Button size="sm" onClick={handleRegenerate} disabled={generateInsights.isPending}>
                  {generateInsights.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Regenerate my audit
                </Button>
              </AlertDescription>
            </Alert>
          ) : !audit ? (
            <Alert>
              <AlertDescription className="space-y-3">
                <p>Your report uses an older format. Regenerate to build the full productivity audit.</p>
                <Button size="sm" onClick={handleRegenerate} disabled={generateInsights.isPending}>
                  Regenerate my audit
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <CsaAuditReportView report={report} audit={audit} />
          )}
        </TabsContent>

        <TabsContent value="setup" className="mt-4">
          <CsaDeveloperSetupPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
