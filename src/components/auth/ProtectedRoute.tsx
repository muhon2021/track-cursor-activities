import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMfaGate } from "@/hooks/useMfaGate";
import { Loader2 } from "lucide-react";

export function ProtectedRoute() {
  const { user, profile, loading, profileLoading, signOut } = useAuth();
  const { isLoading: mfaLoading, mustEnrollNow } = useMfaGate();
  const location = useLocation();

  // Wait for both auth session AND profile (including role) to finish loading.
  // Rendering child routes while profileLoading is true would let role-gated
  // components briefly render with an incomplete profile, causing access flickers.
  if (loading || (profileLoading && !profile) || (!!user && mfaLoading && !profile)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (profile?.is_active === false) {
    return <SuspendedScreen onSignOut={signOut} />;
  }

  if (mustEnrollNow && location.pathname !== "/mfa/enroll") {
    return <Navigate to="/mfa/enroll" replace />;
  }

  if (
    profile?.requires_password_change === true &&
    location.pathname !== "/auth/password-expired"
  ) {
    return <Navigate to="/auth/password-expired" replace />;
  }

  return <Outlet />;
}

function SuspendedScreen({ onSignOut }: { onSignOut: () => Promise<void> }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onSignOut();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onSignOut]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 text-center px-4">
      <h1 className="text-2xl font-semibold">Your access has been suspended</h1>
      <p className="text-muted-foreground max-w-md">
        Your account access has been suspended by an administrator. Please contact your
        administrator if you believe this is a mistake. You will be signed out shortly.
      </p>
    </div>
  );
}
