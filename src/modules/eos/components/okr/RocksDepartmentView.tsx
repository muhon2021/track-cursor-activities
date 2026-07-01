/**
 * Rocks grouped by department.
 */

import { useMemo } from "react";
import { useDepartments } from "@/hooks/useDepartments";
import { OKRCard } from "./OKRCard";
import type { OKR } from "../../types";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RocksDepartmentViewProps {
  okrs: OKR[];
  onSelect?: (okr: OKR) => void;
}

export function RocksDepartmentView({ okrs, onSelect }: RocksDepartmentViewProps) {
  const { data: departments, isLoading } = useDepartments();

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; okrs: OKR[] }>();
    map.set("unassigned", { name: "Unassigned", okrs: [] });

    for (const dept of departments || []) {
      map.set(dept.id, { name: dept.name, okrs: [] });
    }

    for (const okr of okrs) {
      const key = okr.department_id || "unassigned";
      if (!map.has(key)) {
        map.set(key, { name: "Unknown", okrs: [] });
      }
      map.get(key)!.okrs.push(okr);
    }

    return [...map.entries()].filter(([, v]) => v.okrs.length > 0);
  }, [okrs, departments]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!grouped.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No rocks assigned to departments yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {grouped.map(([deptId, { name, okrs: deptOkrs }]) => (
        <Collapsible key={deptId} defaultOpen>
          <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border p-3 hover:bg-muted/50">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium flex-1 text-left">{name}</span>
            <span className="text-sm text-muted-foreground">{deptOkrs.length} rocks</span>
            <ChevronDown className="h-4 w-4 transition-transform [[data-state=open]_&]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className={cn("pt-3 grid gap-3 md:grid-cols-2")}>
            {deptOkrs.map((okr) => (
              <div key={okr.id} onClick={() => onSelect?.(okr)}>
                <OKRCard okr={okr} />
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
