/**
 * Admin Module Routes
 *
 * All /admin/* routes. Protected by AdminRoute guard.
 * These routes grow incrementally as new modules are added.
 */
import { Route, Navigate } from "react-router-dom";

// Admin pages
import Admin from "@/pages/Admin";
import UserManagement from "@/pages/admin/UserManagement";
import UserInvitations from "@/pages/admin/UserInvitations";
import RoleManagement from "@/pages/admin/RoleManagement";
import RoleBuilder from "@/pages/admin/RoleBuilder";
import PermissionMatrix from "@/pages/admin/PermissionMatrix";
import ActivityLogs from "@/pages/admin/ActivityLogs";
import SystemSettings from "@/pages/admin/SystemSettings";
import StorageSettings from "@/pages/admin/StorageSettings";
import ProjectStatusSettings from "@/pages/admin/ProjectStatusSettings";
import ProjectModules from "@/pages/admin/ProjectModules";

// Settings sub-pages
import BrandingSettings from "@/pages/admin/settings/BrandingSettings";
import AdvancedSettings from "@/pages/admin/settings/AdvancedSettings";
import SecuritySettings from "@/pages/admin/settings/SecuritySettings";
import TemplateSeeding from "@/pages/admin/settings/TemplateSeeding";

import Integrations from "@/pages/admin/Integrations";
import SendGrid from "@/pages/admin/integrations/SendGrid";
import ProviderDetail from "@/pages/admin/ProviderDetail";
import OAuthCallback from "@/pages/admin/OAuthCallback";
import MicrosoftTeamsIntegration from "@/pages/admin/integrations/MicrosoftTeamsIntegration";
import TeamsMeetings from "@/pages/admin/integrations/TeamsMeetings";
import ZoomIntegration from "@/pages/admin/integrations/ZoomIntegration";
import ClickUpIntegration from "@/pages/admin/integrations/ClickUpIntegration";
import ActiveCollabIntegration from "@/pages/admin/integrations/ActiveCollabIntegration";
import ZoomMeetings from "@/pages/admin/integrations/ZoomMeetings";
import ZoomDocumentation from "@/pages/admin/integrations/ZoomDocumentation";
import GoogleMeetIntegration from "@/pages/admin/integrations/GoogleMeetIntegration";
import GoogleMeetMeetings from "@/pages/admin/integrations/GoogleMeetMeetings";
import GoogleDriveIntegration from "@/pages/admin/integrations/GoogleDriveIntegration";
import IntegrationAnalytics from "@/pages/admin/IntegrationAnalytics";
import ProjectReports from "@/pages/admin/ProjectReports";
import ResourceUtilizationReports from "@/pages/admin/ResourceUtilizationReports";
import AIModelManagement from "@/pages/admin/AIModelManagement";
import OnboardingWizard from "@/pages/admin/OnboardingWizard";
import SSOSettings from "@/pages/admin/SSOSettings";
import MFAPolicyPage from "@/pages/admin/MFAPolicyPage";
import SignupWhitelistPage from "@/pages/admin/SignupWhitelistPage";
import AdminSessions from "@/pages/admin/AdminSessions";
import SecurityAnalyticsDashboard from "@/pages/admin/security/SecurityAnalyticsDashboard";
import MCPServers from "@/pages/MCPServers";

import DepartmentManagement from "@/pages/admin/DepartmentManagement";
import KnowledgeDashboard from "@/pages/admin/KnowledgeDashboard";
import KnowledgeContent from "@/pages/admin/KnowledgeContent";
import KnowledgeAccess from "@/pages/admin/KnowledgeAccess";
import MemoryAdministration from "@/pages/admin/MemoryAdministration";
import KnowledgeCategories from "@/pages/admin/KnowledgeCategories";
import KnowledgeFiles from "@/pages/admin/KnowledgeFiles";
import ImplementationStatus from "@/pages/admin/ImplementationStatus";
import DashboardWidgets from "@/pages/admin/DashboardWidgets";
import AgencyRoles from "@/pages/admin/AgencyRoles";
import EmbeddingsExplorer from "@/pages/admin/EmbeddingsExplorer";
import MemoryAnalytics from "@/pages/admin/MemoryAnalytics";
import AdminEOS from "@/pages/admin/eos/AdminEOS";
import VTOAdmin from "@/pages/admin/eos/VTOAdmin";
import ScorecardWorkspace from "@/pages/admin/eos/ScorecardWorkspace";
import AdminEOSAccountability from "@/pages/admin/eos/AdminEOSAccountability";
import OKRsWorkspace from "@/pages/admin/eos/OKRsWorkspace";
import OAuthClients from "@/pages/admin/OAuthClients";
import ApiKeys from "@/pages/admin/ApiKeys";
import StreamsPage from "@/modules/actions/pages/StreamsPage";
import StreamTasksPage from "@/modules/actions/pages/StreamTasksPage";
import PromptTemplateManagement from "@/pages/admin/ai/PromptTemplateManagement";
import AIAgentsAdmin from "@/pages/admin/ai/AIAgentsAdmin";
import AgentDetailsTabs from "@/pages/admin/ai/AgentDetailsTabs";
import AICostDashboard from "@/pages/admin/ai/AICostDashboard";
import AIRunAuditLog from "@/pages/admin/ai/AIRunAuditLog";
import AIChat from "@/pages/AIChat";
import AgentCategories from "@/pages/admin/ai/AgentCategories";
import EmailDraftingPerformance from "@/pages/admin/ai/EmailDraftingPerformance";
import DealCoaching from "@/pages/admin/ai/DealCoaching";
import AIAnalytics from "@/pages/admin/ai/AIAnalytics";
import KnowledgeSearch from "@/pages/admin/ai-hub/KnowledgeSearch";
import Memory from "@/pages/admin/ai-hub/Memory";
import { adminNotificationRoutes } from "@/modules/notifications/adminRoutes";
import GraphifyDashboard from "@/pages/admin/graphify/GraphifyDashboard";
import GraphifyConfig from "@/pages/admin/graphify/GraphifyConfig";
import GraphifySyncStatus from "@/pages/admin/graphify/GraphifySyncStatus";
import GraphifyAnalytics from "@/pages/admin/graphify/GraphifyAnalytics";
import GraphifyCoverage from "@/pages/admin/graphify/GraphifyCoverage";
import DesignTokens from "@/pages/admin/DesignTokens";

/**
 * Admin routes - require admin role
 */
export const adminRoutes = (
  <>
    {/* Dashboard */}
    <Route path="/admin" element={<Admin />} />
    <Route path="/admin/design-tokens" element={<DesignTokens />} />
    <Route path="/admin/ai/agent-categories" element={<AgentCategories />} />
    <Route path="/admin/ai/agents" element={<AIAgentsAdmin />} />
    <Route path="/admin/ai/agents/:agentId" element={<AgentDetailsTabs />} />
    <Route path="/admin/ai/cost-dashboard" element={<AICostDashboard />} />
    <Route path="/admin/ai/run-audit-log" element={<AIRunAuditLog />} />
    <Route path="/admin/ai/chat" element={<AIChat />} />
    <Route path="/admin/ai/prompt-templates" element={<PromptTemplateManagement />} />
    <Route path="/admin/ai/email-drafting" element={<EmailDraftingPerformance />} />
    <Route path="/admin/ai/deal-coaching" element={<DealCoaching />} />
    <Route path="/admin/ai/analytics" element={<AIAnalytics />} />
    <Route path="/admin/ai-hub/knowledge-search" element={<Navigate to="/admin/knowledge/access?tab=search" replace />} />
    <Route path="/admin/ai-hub/memory" element={<Memory />} />
    <Route path="/admin/implementation-status" element={<ImplementationStatus />} />

    {/* Memory – redirects from old paths to unified page */}
    <Route path="/admin/memory" element={<Navigate to="/admin/ai-hub/memory" replace />} />
    <Route path="/admin/memory/dashboard" element={<Navigate to="/admin/ai-hub/memory" replace />} />
    <Route path="/admin/memory/user-stats" element={<Navigate to="/admin/ai-hub/memory" replace />} />
    <Route path="/admin/memory/search" element={<Navigate to="/admin/ai-hub/memory" replace />} />
    <Route path="/admin/memory/team-learning-patterns" element={<Navigate to="/admin/ai-hub/memory" replace />} />

    {/* Users & Access */}
    <Route path="/admin/users" element={<UserManagement />} />
    <Route path="/admin/users/invitations" element={<UserInvitations />} />
    <Route path="/admin/roles" element={<RoleManagement />} />
    <Route path="/admin/roles/new" element={<RoleBuilder />} />
    <Route path="/admin/roles/:roleId/edit" element={<RoleBuilder />} />
    <Route path="/admin/roles/permissions" element={<PermissionMatrix />} />
    <Route path="/admin/departments" element={<DepartmentManagement />} />
    <Route path="/admin/department" element={<Navigate to="/admin/departments" replace />} />
    <Route path="/admin/team/departments" element={<Navigate to="/admin/departments" replace />} />
    <Route path="/admin/security" element={<Navigate to="/admin/security/authentication" replace />} />
    <Route path="/admin/security/authentication" element={<SecuritySettings />} />
    <Route path="/admin/security/sso" element={<SSOSettings />} />
    <Route path="/admin/security/mfa" element={<MFAPolicyPage />} />
    <Route path="/admin/security/signup-whitelist" element={<SignupWhitelistPage />} />
    <Route path="/admin/security/sessions" element={<AdminSessions />} />
    <Route path="/admin/security/analytics" element={<SecurityAnalyticsDashboard />} />
    <Route path="/admin/logs" element={<ActivityLogs />} />
    <Route path="/admin/audit-logs" element={<ActivityLogs />} />

    {adminNotificationRoutes}

    {/* System — Settings hub routes */}
    {/* /admin/settings (root) → legacy SystemSettings → redirects to /admin/settings/branding */}
    <Route path="/admin/settings" element={<SystemSettings />} />
    <Route path="/admin/storage" element={<StorageSettings />} />
    <Route path="/admin/settings/branding" element={<BrandingSettings />} />
    <Route path="/admin/settings/workspace" element={<Navigate to="/admin/settings/branding" replace />} />
    <Route path="/admin/settings/notifications" element={<Navigate to="/admin/notifications?tab=email" replace />} />
    <Route path="/admin/settings/advanced" element={<AdvancedSettings />} />
    <Route path="/admin/settings/security" element={<Navigate to="/admin/security/authentication" replace />} />
    <Route path="/admin/settings/seeding" element={<TemplateSeeding />} />
    {/* Workspace sub-pages (preserved, linked from WorkspaceHub) */}
    <Route path="/admin/settings/project-statuses" element={<ProjectStatusSettings />} />
    <Route path="/admin/settings/project-modules" element={<ProjectModules />} />
    <Route path="/admin/settings/dashboard-widgets" element={<DashboardWidgets />} />
    <Route path="/admin/settings/agency-roles" element={<Navigate to="/admin/roles?tab=agency" replace />} />
    {/* Backward compatibility — old SSO route redirects to security settings */}
    <Route path="/admin/sso-settings" element={<Navigate to="/admin/security/sso" replace />} />

    <Route path="/admin/integrations" element={<Integrations />} />
    <Route path="/admin/integrations/oauth/callback" element={<OAuthCallback />} />
    <Route path="/admin/integrations/analytics" element={<IntegrationAnalytics />} />
    <Route path="/admin/integrations/microsoft-teams" element={<MicrosoftTeamsIntegration />} />
    <Route path="/admin/integrations/microsoft-teams/meetings" element={<TeamsMeetings />} />
    <Route path="/admin/integrations/zoom" element={<ZoomIntegration />} />
    <Route path="/admin/integrations/clickup" element={<ClickUpIntegration />} />
    <Route path="/admin/integrations/activecollab" element={<ActiveCollabIntegration />} />
    <Route path="/admin/integrations/zoom/meetings" element={<ZoomMeetings />} />
    <Route path="/admin/integrations/zoom/documentation" element={<ZoomDocumentation />} />
    <Route path="/admin/integrations/google-meet" element={<GoogleMeetIntegration />} />
    <Route path="/admin/integrations/google-meet/meetings" element={<GoogleMeetMeetings />} />
    <Route path="/admin/integrations/google-drive" element={<GoogleDriveIntegration />} />
    <Route path="/admin/integrations/sendgrid" element={<SendGrid />} />
    <Route path="/admin/integrations/:slug" element={<ProviderDetail />} />

    {/* AI & Automation */}
    <Route path="/admin/ai-models" element={<AIModelManagement />} />
    <Route path="/admin/ai-usage" element={<Navigate to="/admin/ai/analytics" replace />} />
    <Route path="/admin/ai/agent-analytics" element={<Navigate to="/admin/ai/analytics" replace />} />
    <Route path="/admin/ai/semantic-search" element={<Navigate to="/admin/knowledge/access?tab=search" replace />} />
    <Route path="/admin/ai/embeddings" element={<Navigate to="/admin/knowledge/access?tab=search" replace />} />
    <Route path="/admin/mcp-servers" element={<MCPServers />} />

    {/* Task Streams (Admin) */}
    <Route path="/admin/tasks/streams" element={<StreamsPage />} />
    <Route path="/admin/tasks/streams/:streamId" element={<StreamTasksPage />} />

    {/* Pods (removed) */}
    <Route path="/admin/pods" element={<Navigate to="/admin" replace />} />
    <Route path="/admin/team/pods" element={<Navigate to="/admin" replace />} />


    {/* Knowledge Admin */}
    <Route path="/admin/knowledge/dashboard" element={<KnowledgeDashboard />} />
    <Route path="/admin/knowledge/content" element={<KnowledgeContent />} />
    <Route path="/admin/knowledge/access" element={<KnowledgeAccess />} />
    <Route path="/admin/knowledge/source-config" element={<Navigate to="/admin/integrations" replace />} />
    <Route path="/admin/knowledge/playground" element={<Navigate to="/admin/knowledge/access?tab=playground" replace />} />
    <Route path="/admin/knowledge/permissions" element={<Navigate to="/admin/knowledge/access?tab=permissions" replace />} />
    <Route path="/admin/memory/admin" element={<MemoryAdministration />} />
    <Route path="/admin/knowledge/categories" element={<Navigate to="/admin/knowledge/content?tab=categories" replace />} />
    <Route path="/admin/knowledge/files" element={<Navigate to="/admin/knowledge/content?tab=files" replace />} />
    <Route path="/admin/knowledge/embeddings" element={<EmbeddingsExplorer />} />
    <Route path="/admin/knowledge/memory-analytics" element={<MemoryAnalytics />} />
    <Route path="/admin/knowledge/analytics" element={<Navigate to="/admin/knowledge/dashboard" replace />} />
    <Route path="/admin/knowledge/common" element={<Navigate to="/admin/knowledge/dashboard" replace />} />
    <Route path="/admin/knowledge/sync-status" element={<Navigate to="/admin/knowledge/dashboard" replace />} />
    <Route path="/admin/knowledge/sources" element={<Navigate to="/admin/knowledge/dashboard" replace />} />
    <Route path="/admin/knowledge/gemini" element={<Navigate to="/admin/knowledge/dashboard" replace />} />

    {/* EOS Admin */}
    <Route path="/admin/eos" element={<AdminEOS />} />
    <Route path="/admin/eos/vto" element={<VTOAdmin />} />
    <Route path="/admin/eos/scorecards" element={<ScorecardWorkspace />} />
    <Route path="/admin/eos/accountability" element={<AdminEOSAccountability />} />
    <Route path="/admin/eos/okrs" element={<OKRsWorkspace />} />

    {/* Content & Feedback — merged with user-facing /feedback */}
    <Route path="/admin/feedback" element={<Navigate to="/feedback" replace />} />

    {/* Reports */}
    <Route path="/admin/reports/projects" element={<ProjectReports />} />
    <Route
      path="/admin/reports/resource-utilization"
      element={<ResourceUtilizationReports />}
    />

    {/* Deployment & Config */}
    <Route path="/admin/onboarding" element={<OnboardingWizard />} />

    {/* OAuth & API Access */}
    <Route path="/admin/oauth-clients" element={<OAuthClients />} />
    <Route path="/admin/api-keys" element={<ApiKeys />} />
    <Route path="/admin/meeting-analytics" element={<Navigate to="/meetings/analytics" replace />} />

    {/* Graphify Admin */}
    <Route path="/admin/graphify" element={<GraphifyDashboard />} />
    <Route path="/admin/graphify/analytics" element={<GraphifyAnalytics />} />
    <Route path="/admin/graphify/coverage" element={<GraphifyCoverage />} />
    <Route path="/admin/graphify/config" element={<GraphifyConfig />} />
    <Route path="/admin/graphify/sync" element={<GraphifySyncStatus />} />
  </>
);
