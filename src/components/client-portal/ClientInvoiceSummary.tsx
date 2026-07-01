import { DollarSign } from "lucide-react";

interface ClientInvoiceSummaryProps {
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueCount: number;
}

export function ClientInvoiceSummary({
  totalAmount,
  paidAmount,
  pendingAmount,
  overdueCount,
}: ClientInvoiceSummaryProps) {
  if (totalAmount === 0 && paidAmount === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        No billing summary available.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="p-4 rounded-lg border bg-card">
        <div className="flex items-center gap-2 text-muted-foreground">
          <DollarSign className="h-4 w-4" />
          <span className="text-sm">Total</span>
        </div>
        <p className="text-xl font-semibold mt-1">
          ${totalAmount.toLocaleString()}
        </p>
      </div>
      <div className="p-4 rounded-lg border bg-card">
        <span className="text-sm text-muted-foreground">Paid</span>
        <p className="text-xl font-semibold mt-1 text-green-600">
          ${paidAmount.toLocaleString()}
        </p>
      </div>
      <div className="p-4 rounded-lg border bg-card">
        <span className="text-sm text-muted-foreground">Pending</span>
        <p className="text-xl font-semibold mt-1">
          ${pendingAmount.toLocaleString()}
        </p>
      </div>
      <div className="p-4 rounded-lg border bg-card">
        <span className="text-sm text-muted-foreground">Overdue</span>
        <p className="text-xl font-semibold mt-1 text-destructive">
          {overdueCount}
        </p>
      </div>
    </div>
  );
}
