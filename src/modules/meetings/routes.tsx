/**
 * Meetings Module Routes
 *
 * Meeting management with schedule, detail (tabbed), series, transcripts,
 * AI match results, pending assignments, and knowledge base views.
 * Gated by the "meetings" module / "enableMeetings" feature flag.
 */
import { Route, Navigate } from "react-router-dom";
import { ModuleRoute } from "@/components/routing/ModuleRoute";

// V2 module-owned pages
import MeetingsSchedulePage from "./pages/MeetingsSchedulePage";
import MeetingDetailV2Page from "./pages/MeetingDetailV2Page";
import MeetingSeriesPage from "./pages/MeetingSeriesPage";
import MeetingTranscriptsPage from "./pages/MeetingTranscriptsPage";
import TranscriptDetailPage from "./pages/TranscriptDetailPage";
import MeetingAiMatchResultsPage from "./pages/MeetingAiMatchResultsPage";
import MeetingPendingAssignmentsPage from "./pages/MeetingPendingAssignmentsPage";
import MeetingIdRedirectPage from "./pages/MeetingIdRedirectPage";
import KnowledgeMeetingsPage from "./pages/KnowledgeMeetingsPage";
import FellowActionItemsPage from "./pages/FellowActionItemsPage";
import MeetingAnalytics from "@/pages/admin/MeetingAnalytics";

// Legacy pages (still used for create/edit forms)
import MeetingForm from "@/pages/MeetingForm";

export const meetingsRoutes = (
  <Route element={<ModuleRoute module="meetings" requiresFeatureFlag="enableMeetings" />}>
    {/* Main redirect: /meetings -> /meetings/transcripts */}
    <Route path="/meetings" element={<Navigate to="/meetings/transcripts" replace />} />

    {/* All Meetings (Schedule) */}
    <Route path="/meetings/schedule" element={<MeetingsSchedulePage />} />
    <Route path="/meetings/fellow-action-items" element={<FellowActionItemsPage />} />
    <Route path="/meetings/schedule/:idOrSlug" element={<MeetingDetailV2Page />} />

    {/* Transcripts */}
    <Route path="/meetings/transcripts" element={<MeetingTranscriptsPage />} />
    <Route path="/meetings/transcripts/:slug" element={<TranscriptDetailPage />} />

    {/* Analytics (moved from /admin/meeting-analytics) */}
    <Route path="/meetings/analytics" element={<MeetingAnalytics />} />

    {/* Additional features — redirected to tabs */}
    <Route path="/meetings/series" element={<Navigate to="/meetings/schedule?view=series" replace />} />
    <Route path="/meetings/transcripts/ai-match" element={<Navigate to="/meetings/transcripts?view=ai-match" replace />} />
    <Route path="/meetings/pending-assignments" element={<Navigate to="/meetings/transcripts?view=pending" replace />} />

    {/* Knowledge base integration */}
    <Route path="/knowledge/meetings" element={<KnowledgeMeetingsPage />} />

    {/* Detail & redirect - UUID redirects to slug-based URL */}
    <Route path="/meetings/:id" element={<MeetingIdRedirectPage />} />

    {/* Legacy create/edit forms */}
    <Route path="/meetings/new" element={<MeetingForm />} />
    <Route path="/meetings/:id/edit" element={<MeetingForm />} />

    {/* Legacy redirects */}
    <Route path="/meetings-v2" element={<Navigate to="/meetings/schedule" replace />} />
    <Route path="/meetings-v2/:id" element={<MeetingIdRedirectPage />} />
  </Route>
);

