import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Loader2 } from "lucide-react";
import { PermissionDenied } from "@/components/auth/PermissionDenied";

interface PermissionRouteProps {
  permission: string;
  fallbackPermission?: string;
}

export function PermissionRoute({ permission, fallbackPermission }: PermissionRouteProps) {
  const { user, loading, profileLoading, profile } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();

  if (loading || profileLoading || permissionsLoading || (user && !profile)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const allowed =
    hasPermission(permission) ||
    (fallbackPermission ? hasPermission(fallbackPermission) : false);

  if (!allowed) {
    return <PermissionDenied message={`You do not have permission: ${permission}`} />;
  }

  return <Outlet />;
}
