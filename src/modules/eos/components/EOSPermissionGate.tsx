/**
 * Permission gate for EOS manage actions.
 */

import { usePermissions } from "@/hooks/usePermissions";
import type { ReactNode } from "react";

interface EOSPermissionGateProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function EOSPermissionGate({
  permission,
  children,
  fallback = null,
}: EOSPermissionGateProps) {
  const { hasPermission } = usePermissions();

  if (!hasPermission(permission) && !hasPermission("eos.admin")) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
