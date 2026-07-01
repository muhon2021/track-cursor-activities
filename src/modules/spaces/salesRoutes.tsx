import { Route } from "react-router-dom";
import { ModuleRoute } from "@/components/routing/ModuleRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { SalesSpaceDashboard } from "@/pages/spaces";
import Clients from "@/pages/Clients";
import ClientForm from "@/pages/ClientForm";
import ClientDetail from "@/pages/ClientDetail";
import ClientKnowledge from "@/pages/ClientKnowledge";
import DealsPage from "@/modules/business-dev/pages/DealsPage";
import DealDetailPage from "@/modules/business-dev/pages/DealDetailPage";
import DealFormPage from "@/modules/business-dev/pages/DealFormPage";
import ContactsPage from "@/modules/business-dev/pages/ContactsPage";
import ContactDetailPage from "@/modules/business-dev/pages/ContactDetailPage";
import LeadFollowUp from "@/modules/business-dev/pages/LeadFollowUp";
import LeadFollowUpContactDetail from "@/modules/business-dev/pages/LeadFollowUpContactDetail";
import LeadFollowUpEmailDraft from "@/modules/business-dev/pages/LeadFollowUpEmailDraft";
import LeadFollowUpEmailDraftStep1 from "@/modules/business-dev/pages/LeadFollowUpEmailDraftStep1";
import LeadFollowUpEmailDraftStep2 from "@/modules/business-dev/pages/LeadFollowUpEmailDraftStep2";
import LeadFollowUpCommunication from "@/modules/business-dev/pages/LeadFollowUpCommunication";
import LeadFollowUpAnalyze from "@/modules/business-dev/pages/LeadFollowUpAnalyze";
import LeadFollowUpAdmin from "@/modules/business-dev/pages/LeadFollowUpAdmin";
import DealCoaching from "@/pages/admin/ai/DealCoaching";
import EmailDraftingPerformance from "@/pages/admin/ai/EmailDraftingPerformance";
import MeetingAnalytics from "@/pages/admin/MeetingAnalytics";
import ProjectReports from "@/pages/admin/ProjectReports";
import ResourceUtilizationReports from "@/pages/admin/ResourceUtilizationReports";

export const salesSpaceRoutes = (
  <Route element={<ModuleRoute module="business-dev" requiresFeatureFlag="enableClients" />}>
    <Route path="/sales/dashboard" element={<SalesSpaceDashboard />} />
    <Route path="/sales/accounts" element={<Clients />} />
    <Route path="/sales/accounts/new" element={<ClientForm />} />
    <Route path="/sales/accounts/:id" element={<ClientDetail />} />
    <Route path="/sales/accounts/:id/edit" element={<ClientForm />} />
    <Route path="/sales/accounts/:clientId/knowledge" element={<ClientKnowledge />} />
    <Route path="/sales/deals" element={<DealsPage />} />
    <Route path="/sales/deals/new" element={<DealFormPage />} />
    <Route path="/sales/deals/:slug" element={<DealDetailPage />} />
    <Route path="/sales/deals/:slug/edit" element={<DealFormPage />} />
    <Route path="/sales/contacts" element={<ContactsPage />} />
    <Route path="/sales/contacts/:id" element={<ContactDetailPage />} />
    <Route path="/sales/lead-followup" element={<LeadFollowUp />} />
    <Route path="/sales/lead-followup/admin" element={<LeadFollowUpAdmin />} />
    <Route path="/sales/lead-followup/:contactSlug" element={<LeadFollowUpContactDetail />} />
    <Route path="/sales/lead-followup/:contactSlug/email-draft" element={<LeadFollowUpEmailDraft />} />
    <Route path="/sales/lead-followup/:contactSlug/email-draft-step1" element={<LeadFollowUpEmailDraftStep1 />} />
    <Route path="/sales/lead-followup/:contactSlug/email-draft-step2" element={<LeadFollowUpEmailDraftStep2 />} />
    <Route path="/sales/lead-followup/:contactSlug/communication" element={<LeadFollowUpCommunication />} />
    <Route path="/sales/lead-followup/:contactSlug/analyze" element={<LeadFollowUpAnalyze />} />
    <Route element={<AdminRoute />}>
      <Route path="/sales/deal-coaching" element={<DealCoaching />} />
      <Route path="/sales/email-drafting" element={<EmailDraftingPerformance />} />
      <Route path="/sales/meeting-analytics" element={<MeetingAnalytics />} />
      <Route path="/sales/reports/projects" element={<ProjectReports />} />
      <Route path="/sales/reports/resource-utilization" element={<ResourceUtilizationReports />} />
    </Route>
  </Route>
);
