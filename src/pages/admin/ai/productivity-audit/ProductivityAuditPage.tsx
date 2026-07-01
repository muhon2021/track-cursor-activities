import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw, AlertTriangle, FileText, Info, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  useCsaReportsList,
  useCsaTeamSummary,
  useGenerateCsaInsights,
} from "@/hooks/useCsaReports";
import { invalidateKeys } from "@/lib/cache";
import { useQueryClient } from "@tanstack/react-query";
import { CsaTeamStatsPanel } from "./CsaTeamStatsPanel";
import { CsaDeveloperSetupPanel } from "./CsaDeveloperSetupPanel";
import { CsaDateRangeFilter } from "./CsaDateRangeFilter";
import { formatCsaPeriodLabel, getDefaultCsaDateRange } from "@/lib/csaDateRange";

export default function ProductivityAuditPage() {
  const [dateRange, setDateRange] = useState(getDefaultCsaDateRange);
  const [search, setSearch] = useState("");

  const { data: teamSummary, isLoading: teamLoading } = useCsaTeamSummary(dateRange);
  const { data: reportsData, isLoading: reportsLoading, refetch: refetchReports } =
    useCsaReportsList(dateRange);
  const generateInsights = useGenerateCsaInsights();
  const queryClient = useQueryClient();

  const reports = reportsData?.reports ?? [];

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter((r) => {
      const name = (r.user_display_name || "").toLowerCase();
      const email = (r.user_email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [reports, search]);

  const handleRefreshData = async () => {
    invalidateKeys.csa(queryClient);
    toast.success("Dashboard data refreshed");
  };

  const handleGenerate = async () => {
    try {
      const result = await generateInsights.mutateAsync({ period: dateRange });
      refetchReports();
      if (result.generated > 0) {
        toast.success(`Regenerated ${result.generated} user report(s)`);
      } else {
        toast.warning(
          result.message ??
            "No sessions with prompts in the selected range. Users need hook data before reports can be generated.",
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to regenerate reports");
    }
  };

  const periodLabel = formatCsaPeriodLabel(dateRange);

  return (
    <div className="container py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Productivity Audit</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Team-wide Cursor developer insights. Developers view their own report under Profile → Cursor Insights.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleRefreshData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh data
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generateInsights.isPending}
            variant="outline"
            size="sm"
          >
            {generateInsights.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Regenerate all audits
          </Button>
        </div>
      </div>

      <Tabs defaultValue="reports">
        <TabsList>
          <TabsTrigger value="reports">Team reports</TabsTrigger>
          <TabsTrigger value="setup">Developer setup</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-6 mt-4">
          <CsaDateRangeFilter value={dateRange} onChange={setDateRange} />

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Showing Cursor activity for <span className="font-medium">{periodLabel}</span>. Session
              and prompt counts match the selected range (max 30 days). Regenerate audits after
              changing the range or when new hook data arrives.
            </AlertDescription>
          </Alert>

          <CsaTeamStatsPanel summary={teamSummary} isLoading={teamLoading} />

          {teamSummary?.top_friction_themes && teamSummary.top_friction_themes.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <span className="font-medium">Top team friction: </span>
                {teamSummary.top_friction_themes.map((t) => t.theme).join(" · ")}
              </AlertDescription>
            </Alert>
          )}

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {reportsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredReports.length === 0 ? (
            <Alert>
              <AlertDescription>
                {reports.length === 0
                  ? "No users with Cursor activity in this date range. Ask developers to set up hooks, then regenerate."
                  : "No users match your search."}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Sessions</TableHead>
                    <TableHead>Prompts</TableHead>
                    <TableHead>Generated</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((r) => {
                    const auditParams = new URLSearchParams({
                      period_start: dateRange.period_start,
                      period_end: dateRange.period_end,
                    });
                    const hasReport = !!r.generated_at && r.insights_json?.audit;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          {r.user_display_name || "—"}
                        </TableCell>
                        <TableCell>{r.user_email}</TableCell>
                        <TableCell>{r.stats_json?.total_sessions ?? 0}</TableCell>
                        <TableCell>{r.stats_json?.total_prompts ?? 0}</TableCell>
                        <TableCell>
                          {r.generated_at
                            ? format(new Date(r.generated_at), "MMM d, yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link
                              to={`/admin/ai/productivity-audit/${r.user_id}?${auditParams.toString()}`}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              {hasReport ? "Open audit" : "View / generate"}
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="setup" className="mt-4">
          <CsaDeveloperSetupPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
