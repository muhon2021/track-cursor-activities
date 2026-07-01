/**
 * SystemSettings — legacy entry point.
 * Redirected to the new /admin/settings/branding page.
 * Kept as a thin redirect to preserve any existing bookmarks or hardcoded links.
 */
import { Navigate } from "react-router-dom";

export default function SystemSettings() {
  return <Navigate to="/admin/settings/branding" replace />;
}
