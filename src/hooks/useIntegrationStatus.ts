/**
 * Integration Status Hook
 * Provides integration connection statistics for status indicators
 */

import { useOrganizationIntegrations } from './useIntegrations';

export interface IntegrationStatus {
  total: number;
  connected: number;
  disconnected: number;
  errors: number;
  hasConnections: boolean;
  connectionRate: number;
}

/**
 * Get integration connection status
 * Returns statistics about connected integrations
 */
export function useIntegrationStatus(): {
  status: IntegrationStatus | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { data: integrations, isLoading, error } = useOrganizationIntegrations();

  if (isLoading || error || !integrations) {
    return {
      status: null,
      isLoading,
      error: error as Error | null,
    };
  }

  const total = integrations.length;
  const connected = integrations.filter((i) => i.connection_status === 'connected').length;
  const disconnected = integrations.filter((i) => i.connection_status === 'disconnected').length;
  const errors = integrations.filter((i) => i.connection_status === 'error').length;
  const hasConnections = connected > 0;
  const connectionRate = total > 0 ? (connected / total) * 100 : 0;

  return {
    status: {
      total,
      connected,
      disconnected,
      errors,
      hasConnections,
      connectionRate,
    },
    isLoading: false,
    error: null,
  };
}
