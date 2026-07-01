import { Route } from "react-router-dom";
import { LegacyPathRedirect } from "@/components/routing/LegacyPathRedirect";

/**
 * Legacy route redirects — active when Four Spaces layout is enabled.
 * Maps old paths to new space-prefixed paths.
 */
export const legacyRedirectRoutes = (
  <>
    <Route path="/dashboard" element={<LegacyPathRedirect />} />
    <Route path="/admin/*" element={<LegacyPathRedirect />} />
    <Route path="/clients/*" element={<LegacyPathRedirect />} />
    <Route path="/contacts/*" element={<LegacyPathRedirect />} />
    <Route path="/deals/*" element={<LegacyPathRedirect />} />
    <Route path="/lead-followup/*" element={<LegacyPathRedirect />} />
    <Route path="/okrs" element={<LegacyPathRedirect />} />
    <Route path="/personal-knowledge" element={<LegacyPathRedirect />} />
    <Route path="/tasks/*" element={<LegacyPathRedirect />} />
    <Route path="/streams/*" element={<LegacyPathRedirect />} />
    <Route path="/projects/*" element={<LegacyPathRedirect />} />
    <Route path="/pod/management" element={<LegacyPathRedirect />} />
    <Route path="/productivity/*" element={<LegacyPathRedirect />} />
    <Route path="/process/*" element={<LegacyPathRedirect />} />
    <Route path="/notifications" element={<LegacyPathRedirect />} />
    <Route path="/feedback/*" element={<LegacyPathRedirect />} />
    <Route path="/ai-agents" element={<LegacyPathRedirect />} />
    <Route path="/agents/*" element={<LegacyPathRedirect />} />
    <Route path="/meetings/*" element={<LegacyPathRedirect />} />
    <Route path="/meetings-v2/*" element={<LegacyPathRedirect />} />
    <Route path="/knowledge/*" element={<LegacyPathRedirect />} />
    <Route path="/eos/issues/*" element={<LegacyPathRedirect />} />
    <Route path="/eos/scorecard" element={<LegacyPathRedirect />} />
  </>
);
