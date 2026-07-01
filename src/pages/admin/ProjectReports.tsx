import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, FolderKanban, Milestone, ShieldAlert, DollarSign } from "lucide-react";
import { useProjectReports } from "@/hooks/useProjectReports";


function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    "Planning": "bg-violet-100 text-violet-800 border-violet-200",
    "In Progress": "bg-info/10 text-info border-info/30",
    "On Hold": "bg-warning/10 text-warning border-warning/30",
    "Completed": "bg-success/10 text-success border-success/30",
    "Archived": "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={colorMap[status] || ""}>
      {status}
    </Badge>
  );
}

export default function ProjectReports() {
  const { data: rows = [], isLoading } = useProjectReports();

  const totals = rows.reduce(
    (acc, r) => ({
      projects: acc.projects + 1,
      milestones: acc.milestones + r.milestones_total,
      milestonesDone: acc.milestonesDone + r.milestones_done,
      risksOpen: acc.risksOpen + r.risks_open,
      budgetTotal: acc.budgetTotal + r.budget_total,
      invoiced: acc.invoiced + r.invoiced_total,
    }),
    { projects: 0, milestones: 0, milestonesDone: 0, risksOpen: 0, budgetTotal: 0, invoiced: 0 },
  );

  const overallBudgetPct = totals.budgetTotal > 0
    ? Math.round((totals.invoiced / totals.budgetTotal) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.projects}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Milestones</CardTitle>
            <Milestone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totals.milestonesDone} / {totals.milestones}
            </div>
            <p className="text-xs text-muted-foreground">
              {totals.milestones > 0
                ? `${Math.round((totals.milestonesDone / totals.milestones) * 100)}% completed`
                : "No milestones"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Risks</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.risksOpen}</div>
            <p className="text-xs text-muted-foreground">across all projects</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget Utilization</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallBudgetPct}%</div>
            <Progress value={overallBudgetPct} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Project Table */}
      <Card>
        <CardHeader>
          <CardTitle>Project Reports</CardTitle>
          <CardDescription>
            Per-project metrics aggregated from milestones, risks, and billing data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FolderKanban className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">No active projects</p>
              <p className="text-sm">Create projects to see reports here</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Milestones</TableHead>
                  <TableHead className="text-right">Progress</TableHead>
                  <TableHead className="text-right">Risks</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const msPct = r.milestones_total > 0
                    ? Math.round((r.milestones_done / r.milestones_total) * 100)
                    : 0;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{r.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground font-mono">
                            {r.slug}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {r.milestones_done} / {r.milestones_total}
                      </TableCell>
                      <TableCell className="text-right w-32">
                        <div className="flex items-center gap-2 justify-end">
                          <Progress value={msPct} className="h-2 w-16" />
                          <span className="text-xs text-muted-foreground w-8">{msPct}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.risks_open > 0 ? (
                          <Badge variant="destructive" className="font-mono">
                            {r.risks_open}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{r.budget_spent_pct}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
