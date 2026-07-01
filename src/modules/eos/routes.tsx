/**
 * EOS Module Routes
 *
 * V/TO, OKRs, Issues (with sub-views), Scorecard, and Accountability pages.
 * Gated by the "eos" module.
 */
import { Route } from "react-router-dom";
import { ModuleRoute } from "@/components/routing/ModuleRoute";

// Module-owned pages
import EOSHubPage from "./pages/EOSHubPage";
import VTOPage from "./pages/VTOPage";
import OKRsPage from "./pages/OKRsPage";
import IssuesPage from "./pages/IssuesPage";
import IssueDetailPage from "./pages/IssueDetailPage";
import IssuesAllPage from "./pages/IssuesAllPage";
import IssuesSolvedPage from "./pages/IssuesSolvedPage";
import IssuesArchivedPage from "./pages/IssuesArchivedPage";
import IssuesAnonymousPage from "./pages/IssuesAnonymousPage";
import IssuesAIPage from "./pages/IssuesAIPage";
import IssuesByPodPage from "./pages/IssuesByPodPage";
import IssuesPodOverviewPage from "./pages/IssuesPodOverviewPage";
import EOSIssuesAIAnalyzePage from "./pages/EOSIssuesAIAnalyzePage";
import ScorecardPage from "./pages/ScorecardPage";
import AccountabilityPage from "./pages/AccountabilityPage";
import MyAccountabilityPage from "./pages/MyAccountabilityPage";
import PeopleAnalyzerPage from "./pages/PeopleAnalyzerPage";
import EOSTodosPage from "./pages/EOSTodosPage";
import EOSAnalyticsPage from "./pages/EOSAnalyticsPage";
import L10MeetingRunnerPage from "./pages/L10MeetingRunnerPage";

export const eosRoutes = (
  <Route element={<ModuleRoute module="eos" />}>
    <Route path="/eos" element={<EOSHubPage />} />
    <Route path="/eos/vto" element={<VTOPage />} />
    <Route path="/eos/issues" element={<IssuesPage />} />
    <Route path="/eos/issues/all" element={<IssuesAllPage />} />
    <Route path="/eos/issues/solved" element={<IssuesSolvedPage />} />
    <Route path="/eos/issues/archived" element={<IssuesArchivedPage />} />
    <Route path="/eos/issues/anonymous" element={<IssuesAnonymousPage />} />
    <Route path="/eos/issues/ai" element={<IssuesAIPage />} />
    <Route path="/eos/issues/ai/analyze" element={<EOSIssuesAIAnalyzePage />} />
    <Route path="/eos/issues/pod-overview" element={<IssuesPodOverviewPage />} />
    <Route path="/eos/issues/pod/:podId" element={<IssuesByPodPage />} />
    <Route path="/eos/issues/:issueId" element={<IssueDetailPage />} />
    <Route path="/eos/scorecard" element={<ScorecardPage />} />
    <Route path="/eos/accountability" element={<AccountabilityPage />} />
    <Route path="/eos/accountability-chart" element={<AccountabilityPage />} />
    <Route path="/eos/people-analyzer" element={<PeopleAnalyzerPage />} />
    <Route path="/eos/todos" element={<EOSTodosPage />} />
    <Route path="/eos/analytics" element={<EOSAnalyticsPage />} />
    <Route path="/eos/meetings/l10/:meetingId" element={<L10MeetingRunnerPage />} />
    <Route path="/eos/my-accountability" element={<MyAccountabilityPage />} />
    <Route path="/okrs" element={<OKRsPage />} />
  </Route>
);
