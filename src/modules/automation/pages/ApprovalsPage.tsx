import { Link } from "react-router-dom";
import { Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAutomationApprovals, useRespondApproval } from "../hooks/useAutomationAnalytics";

export default function ApprovalsPage() {
  const { data: approvals = [], isLoading } = useAutomationApprovals();
  const respond = useRespondApproval();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pending Approvals</h1>
          <p className="text-muted-foreground">Review workflow approval requests</p>
        </div>
        <Button variant="outline" asChild><Link to="/automation/workflows">Workflows</Link></Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : approvals.length === 0 ? (
        <p className="text-muted-foreground">No pending approvals</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {approvals.map((a: Record<string, unknown>) => (
            <Card key={a.id as string}>
              <CardHeader>
                <CardTitle className="text-base">
                  Level {(a.level as number) ?? 1} — {(a.step_key as string) ?? "approval"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => respond.mutate({ approvalId: a.id as string, status: "approved" })}
                >
                  <Check className="mr-1 h-4 w-4" />Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => respond.mutate({ approvalId: a.id as string, status: "rejected" })}
                >
                  <X className="mr-1 h-4 w-4" />Reject
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
