import * as React from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  delta?: React.ReactNode;
  icon?: React.ReactNode;
}

export function StatCard({ label, value, delta, icon, className, ...props }: StatCardProps) {
  return (
    <Card className={cn("shadow-sm", className)} {...props}>
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.01em] text-muted-foreground">{label}</p>
          <p className="text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-foreground">{value}</p>
          {delta ? <div className="text-sm text-muted-foreground">{delta}</div> : null}
        </div>
        {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      </CardContent>
    </Card>
  );
}
