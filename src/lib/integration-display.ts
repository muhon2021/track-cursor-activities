/**
 * Shared helpers for where synced integration data appears in the app.
 */

import type { IntegrationDataDestination } from '@/lib/integration-preferences';

const DESTINATION_PATHS: Record<IntegrationDataDestination, string> = {
  projects: '/projects',
  tasks: '/tasks',
  clients: '/clients',
  deals: '/deals',
  contacts: '/contacts',
  schedule: '/meetings/schedule',
  transcripts: '/meetings/transcripts',
  'lead-followup': '/lead-followup',
  notifications: '/admin/notifications',
};

const DESTINATION_QUERY_KEY: Partial<
  Record<IntegrationDataDestination, 'source' | 'view' | 'tab'>
> = {
  projects: 'source',
  tasks: 'view',
  clients: 'source',
  deals: 'source',
  contacts: 'source',
  schedule: 'source',
  transcripts: 'source',
  'lead-followup': 'source',
  notifications: 'tab',
};

const DESTINATION_FIXED_QUERY: Partial<
  Record<IntegrationDataDestination, Record<string, string>>
> = {
  notifications: { tab: 'email' },
};

export function getIntegrationViewPath(
  destination: IntegrationDataDestination,
  providerSlug: string
): string {
  const base = DESTINATION_PATHS[destination];
  const params = new URLSearchParams(DESTINATION_FIXED_QUERY[destination] ?? {});

  const queryKey = DESTINATION_QUERY_KEY[destination] ?? 'source';
  if (queryKey === 'tab') {
    params.set('tab', params.get('tab') ?? 'email');
    params.set('source', providerSlug);
  } else {
    params.set(queryKey, providerSlug);
  }

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
