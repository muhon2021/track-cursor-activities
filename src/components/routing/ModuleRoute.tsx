import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useModuleAccess } from "@/shared/hooks/useModuleAccess";
import { isModuleBundled, type ModuleId } from "@/shared/config/modules";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { useEffect, useRef } from "react";
import type { AppConfig } from "@/hooks/useAppConfig";

type FeatureKey = keyof AppConfig["features"];

interface ModuleRouteProps {
  module?: ModuleId;
  requiredRole?: "admin" | "moderator" | "user";
  requiresFeatureFlag?: FeatureKey;
  children?: React.ReactNode;
}

export function ModuleRoute({
  module: moduleId,
  requiredRole,
  requiresFeatureFlag,
  children,
}: ModuleRouteProps) {
  const { user, profile, loading, profileLoading } = useAuth();
  const { isFeatureEnabled, isLoading: flagsLoading } = useFeatureFlags();
  const { hasModule, isLoading: moduleAccessLoading } = useModuleAccess();
  const toastShownRef = useRef(false);

  useEffect(() => {
    if (!flagsLoading && requiresFeatureFlag && !isFeatureEnabled(requiresFeatureFlag) && !toastShownRef.current) {
      toastShownRef.current = true;
      toast.error("This feature is currently disabled", {
        description: "Contact your administrator to enable this module.",
      });
    }
  }, [flagsLoading, requiresFeatureFlag, isFeatureEnabled]);

  if (moduleId && !isModuleBundled(moduleId)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading || flagsLoading || moduleAccessLoading || (requiredRole && profileLoading)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (moduleId && !hasModule(moduleId)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requiresFeatureFlag && !isFeatureEnabled(requiresFeatureFlag)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requiredRole) {
    const hasRole = checkRole(profile?.role, requiredRole);
    if (!hasRole) {
      return (
        <div className="flex h-screen items-center justify-center p-4">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              You don&apos;t have the required permissions to access this module.
              Required role: {requiredRole}
            </AlertDescription>
          </Alert>
        </div>
      );
    }
  }

  return children ? <>{children}</> : <Outlet />;
}

function checkRole(
  userRole: string | undefined,
  requiredRole: "admin" | "moderator" | "user"
): boolean {
  if (!userRole) return false;

  const roleHierarchy: Record<string, number> = {
    user: 1,
    moderator: 2,
    admin: 3,
  };

  return (roleHierarchy[userRole] || 0) >= (roleHierarchy[requiredRole] || 0);
}
