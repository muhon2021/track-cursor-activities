import * as React from "react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusTone = "success" | "info" | "warning" | "destructive" | "neutral";

const toneClasses: Record<StatusTone, string> = {
  success: "border-success/30 bg-success/10 text-success",
  info: "border-info/30 bg-info/10 text-info",
  warning: "border-warning/30 bg-warning/10 text-warning",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive",
  neutral: "border-border bg-muted text-muted-foreground",
};

export interface StatusBadgeProps extends Omit<BadgeProps, "variant"> {
  tone?: StatusTone;
}

export function StatusBadge({ tone = "neutral", className, ...props }: StatusBadgeProps) {
  return <Badge variant="outline" className={cn("rounded-full", toneClasses[tone], className)} {...props} />;
}
