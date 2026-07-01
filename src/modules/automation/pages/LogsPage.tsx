import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAutomationExecutions } from "../hooks/useAutomationExecutions";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  failed: "destructive",
  running: "secondary",
  pending: "outline",
  paused: "secondary",
  cancelled: "outline",
};

export default function LogsPage() {
  const { data: executions = [], isLoading } = useAutomationExecutions();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Execution Logs</h1>
          <p className="text-muted-foreground">Workflow run history and status</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/automation/workflows">Workflows</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Retries</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executions.map((ex) => {
                const duration =
                  ex.started_at && ex.completed_at
                    ? `${Math.round((new Date(ex.completed_at).getTime() - new Date(ex.started_at).getTime()) / 1000)}s`
                    : "—";
                return (
                  <TableRow key={ex.id}>
                    <TableCell>{ex.automation_workflows?.name ?? ex.workflow_id.slice(0, 8)}</TableCell>
                    <TableCell>{ex.automation_workflows?.trigger_type ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[ex.status] ?? "outline"}>{ex.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ex.started_at ? new Date(ex.started_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>{duration}</TableCell>
                    <TableCell>{ex.retry_count ?? 0}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
