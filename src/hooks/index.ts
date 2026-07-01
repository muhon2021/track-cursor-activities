/**
 * Hooks Index - Centralized export for all application hooks
 *
 * This barrel file organizes all hooks into logical categories for easy discovery.
 * Import any hook like: import { useClients, useTasks } from '@/hooks';
 */

// ============================================
// Core & Configuration
// ============================================
export { useAppConfig, useUpdateAppConfig, useResetAppConfig } from './useAppConfig';
export { useFeatureFlags } from './useFeatureFlags';
export { useAuthConfig } from './useAuthConfig';
export { usePreferences } from './usePreferences';
export { useDashboardStats, useRecentActivity, getTimeAgo } from './useDashboard';
export { useOnboarding, useOnboardingRedirect } from './useOnboarding';
export { usePermissions, usePermissionCatalog, useRolePermissions } from './usePermissions';
export { useRoles } from './useRoles';

// ============================================
// Authentication & Users
// ============================================
export { useUserInvites } from './useUserInvites';
export { useIntegrationStatus } from './useIntegrationStatus';

// ============================================
// Data & CRUD Operations
// ============================================
export { useClients } from './useClients';
export { useTasks } from './useTasks';
export { useMeetings } from './useMeetings';
export { useNotifications } from './useNotifications';

// ============================================
// AI Features
// ============================================
export { useAIAgents } from './useAIAgents';
export { useAIChatAssistant } from './useAIChatAssistant';
export { useSemanticSearch } from './useSemanticSearch';
export { useAdminSemanticSearch } from './useAdminSemanticSearch';
export { useSyncModels, useSyncAllModels } from './useModelSync';

// ============================================
// Microsoft Integrations
// ============================================
export { useMicrosoftCalendar } from './useMicrosoftCalendar';
export { useMicrosoftTeams } from './useMicrosoftTeams';
export { useMicrosoftTeamsChannels } from './useMicrosoftTeamsChannels';
export { useMicrosoftTeamsMessages } from './useMicrosoftTeamsMessages';
export { useCreateTeamsMeeting } from './useCreateTeamsMeeting';
export { useSendTeamsChannelMessage } from './useSendTeamsChannelMessage';
export { useSyncTeamsMeetings } from './useSyncTeamsMeetings';
export { useGraphWebhookSubscriptions } from './useGraphWebhookSubscription';

// ============================================
// External Integrations
// ============================================
export {
  useIntegrationCategories,
  useIntegrationProviders,
  useIntegrationProvider,
  useIntegrationFields,
  useOrganizationIntegrations,
  useOrganizationIntegration,
  useUpdateIntegration,
  useTestConnection,
  useDisconnectIntegration,
  useIntegrationServices,
  useToggleService,
  useSetDefaultService,
  useIntegrationUsageLogs,
  useProviderUsageStats,
  useProvidersGroupedByCategory,
  integrationKeys,
} from './useIntegrations';
export {
  useIntegrationSettings,
  useSaveIntegrationSettings,
  useIntegrationPreferenceOptions,
  knowledgeRefsToKeys,
  knowledgeKeysToRefs,
} from './useIntegrationSettings';
export {
  useAIModelPolicy,
  useSaveAIModelPolicy,
  useSelectableChatModels,
  useAgentChatModels,
  persistAgentChatModelChoice,
} from './useAIModelPolicy';
export {
  useUserOAuthTokens,
  useUserOAuthToken,
  useAvailableUserProviders,
  useConnectOAuth,
  useDisconnectOAuth,
  useRefreshOAuthToken,
  useHasValidToken,
  useDriveFiles,
} from './useUserIntegrations';
export { useSyncZoom } from './useSyncZoom';
export { useZoomFiles } from './useZoomFiles';
export { useSyncGoogleMeet } from './useSyncGoogleMeet';

// ============================================
// UI Utilities
// ============================================
export { useIsMobile } from './use-mobile';
export { useToast } from './use-toast';
