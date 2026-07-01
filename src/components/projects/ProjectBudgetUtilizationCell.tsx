import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ProjectBudgetUtilizationCellProps {
  projectId: string;
  budget: number | null;
  currency?: string;
  className?: string;
}

export function ProjectBudgetUtilizationCell({
  projectId,
  budget,
  currency = "USD",
  className,
}: ProjectBudgetUtilizationCellProps) {
  const { data: billing } = useQuery({
    queryKey: ["project-billing-invoiced", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_billing")
        .select("invoiced_amount")
        .eq("project_id", projectId)
        .maybeSingle();
      if (error) return null;
      return (data as { invoiced_amount: number | null } | null)?.invoiced_amount ?? 0;
    },
    enabled: !!projectId,
  });

  const invoiced = billing ?? 0;
  const pct = budget != null && budget > 0 ? Math.round((invoiced / budget) * 100) : null;

  if (budget == null || budget <= 0) {
    return <span className={cn("text-muted-foreground text-sm", className)}>—</span>;
  }

  return (
    <div className={cn("flex flex-col min-w-[70px]", className)}>
      <span className="font-semibold tabular-nums">{pct != null ? `${pct}%` : "—"}</span>
      {/* Optional: B: / NB: hours when available from backend */}
    </div>
  );
}
