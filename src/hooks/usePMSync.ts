/**
 * Sync project-management integrations from the Integration Hub or app pages.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { invalidateKeys } from '@/lib/cache';
import { isPMSyncProvider } from '@/lib/integration-preferences';
import { syncClickupLocal } from '@/lib/clickupLocalSync';
import { supabase } from '@/integrations/supabase/client';

const PROJECT_SYNC_FUNCTIONS: Record<string, string> = {
  activecollab: 'sync-projects-activecollab',
  jira: 'sync-projects-jira',
  clickup: 'sync-clickup',
  workamajig: 'sync-workamajig',
};

const TASK_SYNC_FUNCTIONS: Record<string, string> = {
  jira: 'sync-tasks-jira',
};

export interface PMSyncResult {
  projects_synced?: number;
  tasks_synced?: number;
  message?: string;
}

export function usePMSync(defaultProviderSlug = '') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (providerSlug?: string): Promise<PMSyncResult> => {
      const slug = providerSlug || defaultProviderSlug;
      if (!slug || !isPMSyncProvider(slug)) {
        throw new Error(`Sync is not supported for "${slug}".`);
      }

      if (slug === 'clickup') {
        const result = await syncClickupLocal();
        return {
          projects_synced: result.projects_synced,
          tasks_synced: result.tasks_synced,
          message: `Synced ${result.projects_synced} projects and ${result.tasks_synced} tasks.`,
        };
      }

      const projectFn = PROJECT_SYNC_FUNCTIONS[slug];
      if (!projectFn) {
        throw new Error(`No sync function configured for ${slug}.`);
      }

      const { data: projectData, error: projectError } = await supabase.functions.invoke(
        projectFn,
        { body: {} }
      );
      if (projectError) throw projectError;

      let tasksSynced = 0;
      const taskFn = TASK_SYNC_FUNCTIONS[slug];
      if (taskFn) {
        let hasMore = true;
        while (hasMore) {
          const { data: taskData, error: taskError } = await supabase.functions.invoke(
            taskFn,
            { body: {} }
          );
          if (taskError) throw taskError;
          tasksSynced += (taskData as { synced?: number })?.synced ?? 0;
          hasMore = Boolean((taskData as { has_more?: boolean })?.has_more);
        }
      }

      const projectsSynced =
        (projectData as { synced?: number; projects_synced?: number })?.synced ??
        (projectData as { projects_synced?: number })?.projects_synced ??
        0;

      return {
        projects_synced: projectsSynced,
        tasks_synced: tasksSynced,
        message: `Synced ${projectsSynced} projects${taskFn ? ` and ${tasksSynced} tasks` : ''}.`,
      };
    },
    onSuccess: (result) => {
      invalidateKeys.projects(queryClient);
      invalidateKeys.tasks(queryClient);
      toast.success('Sync complete', {
        description: result.message,
      });
    },
    onError: (err: Error) => {
      toast.error('Sync failed', { description: err.message });
    },
  });
}
