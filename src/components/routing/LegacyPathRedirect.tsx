import { Navigate, useLocation } from "react-router-dom";
import { resolveLegacyRedirect } from "@/lib/space-routes";

/** Redirects legacy paths to Four Spaces routes when enableFourSpaces is active */
export function LegacyPathRedirect() {
  const location = useLocation();
  const target =
    resolveLegacyRedirect(location.pathname, location.search) ??
    "/sales/dashboard";
  return <Navigate to={target} replace />;
}
