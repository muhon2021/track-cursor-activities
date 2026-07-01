/**
 * Platform Module Routes
 *
 * Core user-facing routes: dashboard, profile, settings, feedback,
 * notifications, and auth callbacks.
 * These are always available regardless of module configuration.
 */
import { Route } from "react-router-dom";
import { ModuleRoute } from "@/components/routing/ModuleRoute";
import { notificationRoutes } from "@/modules/notifications/routes";

// Public pages
import Index from "@/pages/Index";
import LandingPage from "@/pages/LandingPage";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import AuthCallback from "@/pages/AuthCallback";
import MicrosoftAuthCallback from "@/pages/MicrosoftAuthCallback";
import TermsAndConditions from "@/pages/TermsAndConditions";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import AcceptInvite from "@/pages/AcceptInvite";
import Onboarding from "@/pages/Onboarding";
import NotFound from "@/pages/NotFound";

// Core protected pages (always available)
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";
import AccountSecurity from "@/pages/AccountSecurity";
import Sessions from "@/pages/Sessions";
import Help from "@/pages/Help";
import Feedback from "@/pages/Feedback";
import FeedbackDetail from "@/pages/FeedbackDetail";

import AIAgents from "@/pages/AIAgents";
import AgentsBrowse from "@/pages/AgentsBrowse";
import AgentDetail from "@/pages/AgentDetail";
import PersonalKnowledge from "@/modules/knowledge/pages/PersonalKnowledge";

/**
 * Public routes - no auth required
 */
export const publicRoutes = (
  <>
    <Route path="/" element={<LandingPage />} />
    <Route path="/home" element={<Index />} />
    <Route path="/login" element={<Login />} />
    <Route path="/signup" element={<Signup />} />
    <Route path="/invite/accept" element={<AcceptInvite />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/auth-callback" element={<MicrosoftAuthCallback />} />
    <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
  </>
);

/**
 * Core protected routes - always available to authenticated users
 */
export const coreProtectedRoutes = (
  <>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/onboarding" element={<Onboarding />} />
    <Route path="/profile" element={<Profile />} />
    <Route path="/settings" element={<Settings />} />
    <Route path="/settings/security" element={<AccountSecurity />} />
    <Route path="/sessions" element={<Sessions />} />
    <Route path="/help" element={<Help />} />
    <Route path="/feedback" element={<Feedback />} />
    <Route path="/feedback/:id" element={<FeedbackDetail />} />

    {notificationRoutes}

    {/* AI features */}
    <Route element={<ModuleRoute requiresFeatureFlag="enableAIAgents" />}>
      <Route path="/ai-agents" element={<AIAgents />} />
      <Route path="/agents" element={<AgentsBrowse />} />
      <Route path="/agents/:slug" element={<AgentDetail />} />
    </Route>

    {/* Personal knowledge */}
    <Route path="/personal-knowledge" element={<PersonalKnowledge />} />
  </>
);

/**
 * 404 catch-all
 */
export const catchAllRoute = <Route path="*" element={<NotFound />} />;
