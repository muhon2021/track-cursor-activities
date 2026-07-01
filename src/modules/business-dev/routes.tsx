/**
 * Business Development Module Routes
 *
 * Client management, deals pipeline, and contacts.
 * Gated by the "business-dev" module / "enableClients" feature flag.
 */
import { Route } from "react-router-dom";
import { ModuleRoute } from "@/components/routing/ModuleRoute";

import Clients from "@/pages/Clients";
import ClientForm from "@/pages/ClientForm";
import ClientDetail from "@/pages/ClientDetail";
import ClientKnowledge from "@/pages/ClientKnowledge";
import DealsPage from "./pages/DealsPage";
import DealDetailPage from "./pages/DealDetailPage";
import DealFormPage from "./pages/DealFormPage";
import ContactsPage from "./pages/ContactsPage";
import ContactDetailPage from "./pages/ContactDetailPage";
import LeadFollowUp from "./pages/LeadFollowUp";
import LeadFollowUpContactDetail from "./pages/LeadFollowUpContactDetail";
import LeadFollowUpEmailDraft from "./pages/LeadFollowUpEmailDraft";
import LeadFollowUpEmailDraftStep1 from "./pages/LeadFollowUpEmailDraftStep1";
import LeadFollowUpEmailDraftStep2 from "./pages/LeadFollowUpEmailDraftStep2";
import LeadFollowUpCommunication from "./pages/LeadFollowUpCommunication";
import LeadFollowUpAnalyze from "./pages/LeadFollowUpAnalyze";
import LeadFollowUpAdmin from "./pages/LeadFollowUpAdmin";

export const businessDevRoutes = (
  <Route element={<ModuleRoute module="business-dev" requiresFeatureFlag="enableClients" />}>
    <Route path="/clients" element={<Clients />} />
    <Route path="/clients/new" element={<ClientForm />} />
    <Route path="/clients/:id" element={<ClientDetail />} />
    <Route path="/clients/:id/edit" element={<ClientForm />} />
    <Route path="/clients/:clientId/knowledge" element={<ClientKnowledge />} />
    <Route path="/deals" element={<DealsPage />} />
    <Route path="/deals/new" element={<DealFormPage />} />
    <Route path="/deals/:slug" element={<DealDetailPage />} />
    <Route path="/deals/:slug/edit" element={<DealFormPage />} />
    <Route path="/contacts" element={<ContactsPage />} />
    <Route path="/contacts/:id" element={<ContactDetailPage />} />
    <Route path="/lead-followup" element={<LeadFollowUp />} />
    <Route path="/lead-followup/admin" element={<LeadFollowUpAdmin />} />
    <Route path="/lead-followup/:contactSlug" element={<LeadFollowUpContactDetail />} />
    <Route path="/lead-followup/:contactSlug/email-draft" element={<LeadFollowUpEmailDraft />} />
    <Route path="/lead-followup/:contactSlug/email-draft-step1" element={<LeadFollowUpEmailDraftStep1 />} />
    <Route path="/lead-followup/:contactSlug/email-draft-step2" element={<LeadFollowUpEmailDraftStep2 />} />
    <Route path="/lead-followup/:contactSlug/communication" element={<LeadFollowUpCommunication />} />
    <Route path="/lead-followup/:contactSlug/analyze" element={<LeadFollowUpAnalyze />} />
  </Route>
);
