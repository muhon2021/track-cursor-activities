import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { BarChart3, DollarSign, CircleX, Sparkles } from "lucide-react";

interface ProjectNameCellProps {
  projectId: string;
  name: string;
  description?: string | null;
  budget: number | null;
  currency: string;
  statusId: string | null;
  statusName?: string | null;
  statusColor?: string;
  isNew?: boolean;
}

export function ProjectNameCell({
  projectId,
  name,
  description,
  budget,
  currency,
  statusId,
  statusName,
  statusColor,
  isNew = false,
}: ProjectNameCellProps) {
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
  const pct = budget != null && budget > 0 ? Math.round((invoiced / budget) * 100) : 0;
  const isOverBudget = budget != null && budget > 0 && invoiced > budget;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        {isNew && (
          <Badge variant="secondary" className="text-xs font-normal gap-1 bg-primary/10 text-primary">
            <Sparkles className="h-3 w-3" />
            NEW
          </Badge>
        )}
        <p className="font-medium">{name}</p>
      </div>
      {description && <p className="text-xs text-muted-foreground line-clamp-1">{description}</p>}
      <div className="flex flex-wrap items-center gap-1.5 mt-1">
        <Badge variant="outline" className="text-xs font-normal gap-0.5">
          {pct}%
        </Badge>
        <Badge variant="outline" className="text-xs font-normal gap-0.5">
          $ {budget != null && budget > 0 ? budget.toLocaleString() : "0"}
        </Badge>
        <Badge variant="outline" className="text-xs font-normal gap-0.5 text-muted-foreground">
          <CircleX className="h-3 w-3" />
          No AC
        </Badge>
        {isOverBudget && (
          <Badge variant="outline" className="text-xs font-normal text-destructive border-destructive bg-destructive/10">
            Over Budget
          </Badge>
        )}
      </div>
    </div>
  );
}
