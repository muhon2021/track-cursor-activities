import { Route, Navigate } from "react-router-dom";
import { ModuleRoute } from "@/components/routing/ModuleRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { EosSpaceDashboard } from "@/pages/spaces";
import EOSHubPage from "@/modules/eos/pages/EOSHubPage";
import VTOPage from "@/modules/eos/pages/VTOPage";
import OKRsPage from "@/modules/eos/pages/OKRsPage";
import IssuesPage from "@/modules/eos/pages/IssuesPage";
import IssueDetailPage from "@/modules/eos/pages/IssueDetailPage";
import IssuesAllPage from "@/modules/eos/pages/IssuesAllPage";
import IssuesSolvedPage from "@/modules/eos/pages/IssuesSolvedPage";
import IssuesArchivedPage from "@/modules/eos/pages/IssuesArchivedPage";
import IssuesAnonymousPage from "@/modules/eos/pages/IssuesAnonymousPage";
import IssuesAIPage from "@/modules/eos/pages/IssuesAIPage";
import IssuesByPodPage from "@/modules/eos/pages/IssuesByPodPage";
import IssuesPodOverviewPage from "@/modules/eos/pages/IssuesPodOverviewPage";
import EOSIssuesAIAnalyzePage from "@/modules/eos/pages/EOSIssuesAIAnalyzePage";
import ScorecardPage from "@/modules/eos/pages/ScorecardPage";
import AccountabilityPage from "@/modules/eos/pages/AccountabilityPage";
import MyAccountabilityPage from "@/modules/eos/pages/MyAccountabilityPage";
import AdminEOS from "@/pages/admin/eos/AdminEOS";
import VTOAdmin from "@/pages/admin/eos/VTOAdmin";
import ScorecardWorkspace from "@/pages/admin/eos/ScorecardWorkspace";
import AdminEOSAccountability from "@/pages/admin/eos/AdminEOSAccountability";
import OKRsWorkspace from "@/pages/admin/eos/OKRsWorkspace";
import MeetingsSchedulePage from "@/modules/meetings/pages/MeetingsSchedulePage";
import MeetingDetailV2Page from "@/modules/meetings/pages/MeetingDetailV2Page";
import MeetingSeriesPage from "@/modules/meetings/pages/MeetingSeriesPage";
import MeetingTranscriptsPage from "@/modules/meetings/pages/MeetingTranscriptsPage";
import TranscriptDetailPage from "@/modules/meetings/pages/TranscriptDetailPage";
import MeetingAiMatchResultsPage from "@/modules/meetings/pages/MeetingAiMatchResultsPage";
import MeetingPendingAssignmentsPage from "@/modules/meetings/pages/MeetingPendingAssignmentsPage";
import MeetingIdRedirectPage from "@/modules/meetings/pages/MeetingIdRedirectPage";
import FellowActionItemsPage from "@/modules/meetings/pages/FellowActionItemsPage";
import MeetingForm from "@/pages/MeetingForm";
import PeopleAnalyzerPage from "@/modules/eos/pages/PeopleAnalyzerPage";
import EOSTodosPage from "@/modules/eos/pages/EOSTodosPage";
import EOSAnalyticsPage from "@/modules/eos/pages/EOSAnalyticsPage";
import L10MeetingRunnerPage from "@/modules/eos/pages/L10MeetingRunnerPage";

export const eosSpaceRoutes = (
  <>
    <Route element={<ModuleRoute module="eos" />}>
      <Route path="/eos/dashboard" element={<EosSpaceDashboard />} />
      <Route path="/eos/vto" element={<VTOPage />} />
      <Route path="/eos/rocks" element={<OKRsPage />} />
      <Route path="/eos/scorecards" element={<ScorecardPage />} />
      <Route path="/eos/ids" element={<IssuesPage />} />
      <Route path="/eos/ids/all" element={<IssuesAllPage />} />
      <Route path="/eos/ids/solved" element={<IssuesSolvedPage />} />
      <Route path="/eos/ids/archived" element={<IssuesArchivedPage />} />
      <Route path="/eos/ids/anonymous" element={<IssuesAnonymousPage />} />
      <Route path="/eos/ids/ai" element={<IssuesAIPage />} />
      <Route path="/eos/ids/ai/analyze" element={<EOSIssuesAIAnalyzePage />} />
      <Route path="/eos/ids/pod-overview" element={<IssuesPodOverviewPage />} />
      <Route path="/eos/ids/pod/:podId" element={<IssuesByPodPage />} />
      <Route path="/eos/ids/:issueId" element={<IssueDetailPage />} />
      <Route path="/eos/accountability-chart" element={<AccountabilityPage />} />
      <Route path="/eos/people-analyzer" element={<PeopleAnalyzerPage />} />
      <Route path="/eos/todos" element={<EOSTodosPage />} />
      <Route path="/eos/analytics" element={<EOSAnalyticsPage />} />
      <Route path="/eos/accountability" element={<AccountabilityPage />} />
      <Route path="/eos/my-accountability" element={<MyAccountabilityPage />} />
      <Route path="/eos" element={<EOSHubPage />} />
    </Route>

    <Route element={<ModuleRoute module="meetings" requiresFeatureFlag="enableMeetings" />}>
      <Route path="/eos/meetings" element={<Navigate to="/eos/meetings/transcripts" replace />} />
      <Route path="/eos/meetings/schedule" element={<MeetingsSchedulePage />} />
      <Route path="/eos/meetings/fellow-action-items" element={<FellowActionItemsPage />} />
      <Route path="/eos/meetings/schedule/:idOrSlug" element={<MeetingDetailV2Page />} />
      <Route path="/eos/meetings/l10/:meetingId" element={<L10MeetingRunnerPage />} />
      <Route path="/eos/meetings/transcripts" element={<MeetingTranscriptsPage />} />
      <Route path="/eos/meetings/transcripts/:slug" element={<TranscriptDetailPage />} />
      <Route path="/eos/meetings/series" element={<MeetingSeriesPage />} />
      <Route path="/eos/meetings/transcripts/ai-match" element={<MeetingAiMatchResultsPage />} />
      <Route path="/eos/meetings/pending-assignments" element={<MeetingPendingAssignmentsPage />} />
      <Route path="/eos/meetings/new" element={<MeetingForm />} />
      <Route path="/eos/meetings/:id/edit" element={<MeetingForm />} />
      <Route path="/eos/meetings/:id" element={<MeetingIdRedirectPage />} />
    </Route>

    <Route element={<AdminRoute />}>
      <Route path="/eos/admin" element={<AdminEOS />} />
      <Route path="/eos/admin/vto" element={<VTOAdmin />} />
      <Route path="/eos/admin/scorecards" element={<ScorecardWorkspace />} />
      <Route path="/eos/admin/accountability" element={<AdminEOSAccountability />} />
      <Route path="/eos/admin/okrs" element={<OKRsWorkspace />} />
    </Route>
  </>
);
