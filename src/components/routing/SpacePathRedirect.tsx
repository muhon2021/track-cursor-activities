import { Navigate, useLocation } from "react-router-dom";
import { resolveSpaceToLegacyRedirect } from "@/lib/space-routes";

/** Redirects Four Spaces URLs back to legacy routes when the feature is disabled. */
export function SpacePathRedirect() {
  const location = useLocation();
  const target =
    resolveSpaceToLegacyRedirect(location.pathname, location.search) ?? "/dashboard";
  return <Navigate to={target} replace />;
}
