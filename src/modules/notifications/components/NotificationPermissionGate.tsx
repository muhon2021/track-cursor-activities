import { usePermissions } from "@/hooks/usePermissions";
import type { ReactNode } from "react";

interface NotificationPermissionGateProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function NotificationPermissionGate({
  permission,
  children,
  fallback = null,
}: NotificationPermissionGateProps) {
  const { hasPermission } = usePermissions();

  if (!hasPermission(permission) && !hasPermission("notifications.admin")) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
