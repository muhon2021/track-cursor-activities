import { useEffect, useRef } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Loader2 } from "lucide-react";
import { PermissionDenied } from "@/components/auth/PermissionDenied";
import { toast } from "sonner";

export function AdminRoute() {
  const { user, profile, loading, profileLoading } = useAuth();
  const {
    hasPermission,
    hasAnyPermission,
    isLoading: permissionsLoading,
    isSuccess: permissionsLoaded,
  } = usePermissions();

  if (
    loading ||
    (profileLoading && !profile) ||
    (user && !profile) ||
    (permissionsLoading && !permissionsLoaded)
  ) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const canAccessAdmin =
    hasPermission("settings.admin") ||
    hasAnyPermission(["users.admin", "settings.admin"]) ||
    profile?.role === "admin" ||
    profile?.role === "moderator";

  if (permissionsLoaded && !canAccessAdmin) {
    return <AdminAccessDenied />;
  }

  return <Outlet />;
}

function AdminAccessDenied() {
  const hasNotified = useRef(false);

  useEffect(() => {
    if (!hasNotified.current) {
      hasNotified.current = true;
      toast.error("Admin access required");
    }
  }, []);

  return (
    <PermissionDenied message="You do not have permission to access the admin panel." />
  );
}
