import { Route, Navigate } from "react-router-dom";
import { ModuleRoute } from "@/components/routing/ModuleRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { OperationsSpaceDashboard } from "@/pages/spaces";
import UserManagement from "@/pages/admin/UserManagement";
import UserInvitations from "@/pages/admin/UserInvitations";
import RoleManagement from "@/pages/admin/RoleManagement";
import PermissionMatrix from "@/pages/admin/PermissionMatrix";
import ActivityLogs from "@/pages/admin/ActivityLogs";
import DepartmentManagement from "@/pages/admin/DepartmentManagement";
import PODManagement from "@/pages/admin/PodManagement";
import TasksPage from "@/modules/actions/pages/TasksPage";
import TaskDetailPage from "@/modules/actions/pages/TaskDetailPage";
import StreamsPage from "@/modules/actions/pages/StreamsPage";
import StreamTasksPage from "@/modules/actions/pages/StreamTasksPage";
import { TaskDetailRedirect } from "@/modules/actions/components/TaskDetailRedirect";
import { StreamRedirect } from "@/modules/actions/components/StreamRedirect";
import { TaskEditRedirect } from "@/modules/actions/components/TaskEditRedirect";
import Projects from "@/pages/Projects";
import ProjectFormPage from "@/modules/projects/pages/ProjectFormPage";
import ProjectDetail from "@/pages/projects/ProjectDetail";
import ProjectKnowledge from "@/pages/projects/ProjectKnowledge";
import ProjectIssuesAIAnalyzePage from "@/pages/ProjectIssuesAIAnalyzePage";
import Performance from "@/pages/projects/Performance";
import { operationsNotificationRoutes } from "@/modules/notifications/routes";
import Feedback from "@/pages/Feedback";
import FeedbackDetail from "@/pages/FeedbackDetail";
import FeedbackManagement from "@/pages/admin/FeedbackManagement";
import ProductivityPage from "@/modules/productivity/pages/ProductivityPage";
import EmployeeDetailPage from "@/modules/productivity/pages/EmployeeDetailPage";
import ProcessPage from "@/modules/productivity/pages/ProcessPage";
import ProcessFormPage from "@/modules/productivity/pages/ProcessFormPage";
import PodManagement from "@/pages/PodManagement";
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
import MCPServers from "@/pages/MCPServers";
import SystemSettings from "@/pages/admin/SystemSettings";
import BrandingSettings from "@/pages/admin/settings/BrandingSettings";
import WorkspaceHub from "@/pages/admin/settings/WorkspaceHub";
import AdvancedSettings from "@/pages/admin/settings/AdvancedSettings";
import SecuritySettings from "@/pages/admin/settings/SecuritySettings";
import ProjectStatusSettings from "@/pages/admin/ProjectStatusSettings";
import ProjectModules from "@/pages/admin/ProjectModules";
import DashboardWidgets from "@/pages/admin/DashboardWidgets";
import AgencyRoles from "@/pages/admin/AgencyRoles";

export const operationsSpaceRoutes = (
  <>
    <Route path="/operations/dashboard" element={<OperationsSpaceDashboard />} />

    <Route element={<ModuleRoute module="actions" requiresFeatureFlag="enableTasks" />}>
      <Route path="/operations/tasks" element={<TasksPage />} />
      <Route path="/operations/tasks/streams" element={<StreamsPage />} />
      <Route path="/operations/tasks/stream/:slug" element={<StreamTasksPage />} />
      <Route path="/operations/tasks/:idOrSlug" element={<TaskDetailPage />} />
      <Route path="/operations/tasks/new" element={<Navigate to="/operations/tasks" replace />} />
      <Route path="/operations/tasks/:id/edit" element={<TaskEditRedirect />} />
      <Route path="/operations/tasks/t/:slug" element={<TaskDetailRedirect />} />
    </Route>

    <Route element={<ModuleRoute module="projects" />}>
      <Route path="/operations/projects" element={<Projects />} />
      <Route path="/operations/projects/new" element={<ProjectFormPage />} />
      <Route path="/operations/projects/:slug/edit" element={<ProjectFormPage />} />
      <Route path="/operations/projects/:slug/knowledge" element={<ProjectKnowledge />} />
      <Route path="/operations/projects/:slug/issues/ai/analyze" element={<ProjectIssuesAIAnalyzePage />} />
      <Route path="/operations/projects/:slug/performance" element={<Performance />} />
      <Route path="/operations/projects/:slug/:tab" element={<ProjectDetail />} />
      <Route path="/operations/projects/:slug" element={<ProjectDetail />} />
    </Route>

    <Route element={<ModuleRoute module="productivity" />}>
      <Route path="/operations/productivity" element={<ProductivityPage />} />
      <Route path="/operations/productivity/employee/:email" element={<EmployeeDetailPage />} />
      <Route path="/operations/processes" element={<ProcessPage />} />
      <Route path="/operations/processes/new" element={<ProcessFormPage />} />
      <Route path="/operations/processes/:category" element={<ProcessPage />} />
      <Route path="/operations/processes/:category/new" element={<ProcessFormPage />} />
      <Route path="/operations/processes/:category/:slug" element={<ProcessPage />} />
      <Route path="/operations/processes/:category/:slug/edit" element={<ProcessFormPage />} />
    </Route>

    {operationsNotificationRoutes}

    <Route element={<ModuleRoute requiresFeatureFlag="enableFeedback" />}>
      <Route path="/operations/feedback" element={<Feedback />} />
      <Route path="/operations/feedback/:id" element={<FeedbackDetail />} />
    </Route>

    <Route element={<AdminRoute />}>
      <Route path="/operations/users" element={<UserManagement />} />
      <Route path="/operations/users/invitations" element={<UserInvitations />} />
      <Route path="/operations/roles" element={<RoleManagement />} />
      <Route path="/operations/roles/permissions" element={<PermissionMatrix />} />
      <Route path="/operations/departments" element={<DepartmentManagement />} />
      <Route path="/operations/activity-logs" element={<ActivityLogs />} />
      <Route path="/operations/pods" element={<PODManagement />} />
      <Route path="/operations/pods/management" element={<PodManagement />} />
      <Route path="/operations/feedback/admin" element={<FeedbackManagement />} />
      <Route path="/operations/mcp-servers" element={<MCPServers />} />
      <Route path="/operations/integrations" element={<Integrations />} />
      <Route path="/operations/integrations/oauth/callback" element={<OAuthCallback />} />
      <Route path="/operations/integrations/analytics" element={<IntegrationAnalytics />} />
      <Route path="/operations/integrations/microsoft-teams" element={<MicrosoftTeamsIntegration />} />
      <Route path="/operations/integrations/microsoft-teams/meetings" element={<TeamsMeetings />} />
      <Route path="/operations/integrations/zoom" element={<ZoomIntegration />} />
      <Route path="/operations/integrations/clickup" element={<ClickUpIntegration />} />
      <Route path="/operations/integrations/activecollab" element={<ActiveCollabIntegration />} />
      <Route path="/operations/integrations/zoom/meetings" element={<ZoomMeetings />} />
      <Route path="/operations/integrations/zoom/documentation" element={<ZoomDocumentation />} />
      <Route path="/operations/integrations/google-meet" element={<GoogleMeetIntegration />} />
      <Route path="/operations/integrations/google-meet/meetings" element={<GoogleMeetMeetings />} />
      <Route path="/operations/integrations/google-drive" element={<GoogleDriveIntegration />} />
      <Route path="/operations/integrations/sendgrid" element={<SendGrid />} />
      <Route path="/operations/integrations/:slug" element={<ProviderDetail />} />
      <Route path="/operations/settings" element={<SystemSettings />} />
      <Route path="/operations/settings/branding" element={<BrandingSettings />} />
      <Route path="/operations/settings/workspace" element={<WorkspaceHub />} />
      <Route path="/operations/settings/notifications" element={<Navigate to="/admin/notifications?tab=email" replace />} />
      <Route path="/operations/settings/advanced" element={<AdvancedSettings />} />
      <Route path="/operations/settings/security" element={<SecuritySettings />} />
      <Route path="/operations/settings/project-statuses" element={<ProjectStatusSettings />} />
      <Route path="/operations/settings/project-modules" element={<ProjectModules />} />
      <Route path="/operations/settings/dashboard-widgets" element={<DashboardWidgets />} />
      <Route path="/operations/settings/agency-roles" element={<AgencyRoles />} />
      <Route path="/operations/tasks/streams/:streamId" element={<StreamTasksPage />} />
    </Route>
  </>
);
