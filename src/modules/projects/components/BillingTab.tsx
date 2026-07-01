import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Calendar, FileText } from "lucide-react";

interface BillingTabProps {
  projectId: string;
  projectSlug: string;
}

interface ProjectBillingRow {
  billing_type: string | null;
  rate: number | null;
  total_budget: number | null;
  invoiced_amount: number | null;
  currency: string | null;
  payment_terms: string | null;
}

interface ProjectInvoiceRow {
  id: string;
  invoice_number: string;
  amount: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  created_at: string | null;
}

interface BillingData {
  billing: ProjectBillingRow | null;
  invoices: ProjectInvoiceRow[];
}

export function BillingTab({ projectId, projectSlug }: BillingTabProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["project-billing-ui", projectId],
    queryFn: async (): Promise<BillingData> => {
      const [billingRes, invoicesRes] = await Promise.all([
        supabase
          .from("project_billing")
          .select(
            "billing_type, rate, total_budget, invoiced_amount, currency, payment_terms",
          )
          .eq("project_id", projectId)
          .maybeSingle(),
        supabase
          .from("project_invoices")
          .select(
            "id, invoice_number, amount, status, due_date, paid_at, created_at",
          )
          .eq("project_id", projectId)
          .order("due_date", { ascending: true }),
      ]);

      if (billingRes.error) {
        // If there is simply no row yet, treat as null billing; otherwise bubble up
        if (billingRes.error.code !== "PGRST116") {
          throw billingRes.error;
        }
      }

      if (invoicesRes.error) {
        throw invoicesRes.error;
      }

      return {
        billing: (billingRes.data as ProjectBillingRow | null) ?? null,
        invoices: (invoicesRes.data as ProjectInvoiceRow[]) ?? [],
      };
    },
    enabled: !!projectId,
  });

  const billing = data?.billing ?? null;
  const invoices = data?.invoices ?? [];

  const totalBudget = billing?.total_budget ?? 0;
  const invoicedAmount = billing?.invoiced_amount ?? 0;
  const remaining = Math.max(totalBudget - invoicedAmount, 0);
  const currency = billing?.currency || "USD";
  const pct = totalBudget > 0 ? Math.round((invoicedAmount / totalBudget) * 100) : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billing overview</CardTitle>
          <CardDescription>
            Read-only view of billing for <span className="font-mono">{projectSlug}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading billing data…</p>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3" />
              <span>Unable to load billing data: {error.message}</span>
            </div>
          )}

          {!isLoading && !error && !billing && invoices.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FileText className="mb-3 h-10 w-10" />
              <p className="text-sm font-medium">No billing set up for this project yet</p>
              <p className="mt-1 max-w-md text-center text-xs">
                You can seed demo billing data via <code>05-projects.sql</code> or insert a
                row into <code>project_billing</code> and <code>project_invoices</code> for this
                project to populate this view.
              </p>
            </div>
          )}

          {billing && (
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Billing type</p>
                <p className="text-sm font-medium capitalize">
                  {billing.billing_type || "Not set"}
                </p>
                {billing.rate && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Rate: {currency} {billing.rate.toLocaleString()}
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Budget vs invoiced</p>
                <p className="text-sm font-medium">
                  {currency} {invoicedAmount.toLocaleString()}{" "}
                  <span className="text-xs text-muted-foreground">
                    of {currency} {totalBudget.toLocaleString()}
                  </span>
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Progress value={pct} className="h-2" />
                  <span className="text-xs text-muted-foreground">{pct}%</span>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Remaining budget</p>
                <p className="text-sm font-medium">
                  {currency} {remaining.toLocaleString()}
                </p>
                {billing.payment_terms && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Terms: {billing.payment_terms}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoices</CardTitle>
          {invoices.length > 0 && (
            <CardDescription>
              {invoices.length} invoice{invoices.length === 1 ? "" : "s"} for this project
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading invoices…</p>
          )}
          {!isLoading && invoices.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">
              No invoices found for this project yet.
            </p>
          )}
          {!isLoading && invoices.length > 0 && (
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{inv.invoice_number}</span>
                    <span className="text-xs text-muted-foreground">
                      Created{" "}
                      {inv.created_at
                        ? new Date(inv.created_at).toLocaleDateString()
                        : "unknown"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {currency} {inv.amount.toLocaleString()}
                    </span>
                    {inv.due_date && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Due {new Date(inv.due_date).toLocaleDateString()}
                      </span>
                    )}
                    <Badge variant="outline" className="capitalize">
                      {inv.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
