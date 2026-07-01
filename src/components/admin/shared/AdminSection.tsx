import * as React from "react";

import { cn } from "@/lib/utils";

type AdminSectionProps = React.HTMLAttributes<HTMLDivElement>;

export function AdminSection({ className, ...props }: AdminSectionProps) {
  return <div className={cn("space-y-6", className)} {...props} />;
}
