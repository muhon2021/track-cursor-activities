/**
 * React hook for Microsoft Teams integration
 * Handles fetching and syncing user's joined Teams
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getMyJoinedTeams, MicrosoftTeam, ForbiddenError } from '@/lib/microsoftGraphClient';
import { useAuth } from '@/contexts/AuthContext';

export interface StoredTeam {
  id: string;
  user_id: string;
  team_id: string;
  display_name: string;
  description: string | null;
  visibility: string | null;
  web_url: string | null;
  is_archived: boolean;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export function useMicrosoftTeams() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch teams from database
  const teamsQuery = useQuery({
    queryKey: ['microsoft-teams', user?.id],
    queryFn: async () => {
      console.log('[useMicrosoftTeams] Fetching teams from database...');
      const { data, error } = await supabase
        .from('user_microsoft_teams')
        .select('*')
        .order('display_name');
      
      if (error) {
        console.error('[useMicrosoftTeams] Error fetching teams:', error);
        throw error;
      }
      console.log('[useMicrosoftTeams] Fetched teams:', data?.length ?? 0);
      return data as StoredTeam[];
    },
    enabled: !!user?.id,
    staleTime: 0, // Always consider data stale
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });

  // Sync teams from Microsoft Graph
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      // 1. Fetch from Graph API
      const graphTeams = await getMyJoinedTeams();
      
      // 2. Upsert to database
      const teamsToUpsert = graphTeams.map(team => ({
        user_id: user.id,
        team_id: team.id,
        display_name: team.displayName,
        description: team.description || null,
        visibility: team.visibility || null,
        web_url: team.webUrl || null,
        is_archived: team.isArchived || false,
        synced_at: new Date().toISOString(),
      }));

      if (teamsToUpsert.length > 0) {
        const { error } = await supabase
          .from('user_microsoft_teams')
          .upsert(teamsToUpsert, { 
            onConflict: 'user_id,team_id',
            ignoreDuplicates: false 
          });

        if (error) throw error;
      }
      
      return graphTeams;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['microsoft-teams'] });
    },
  });

  return {
    teams: teamsQuery.data ?? [],
    isLoading: teamsQuery.isLoading,
    error: teamsQuery.error,
    syncTeams: syncMutation.mutateAsync,
    isSyncing: syncMutation.isPending,
    syncError: syncMutation.error,
    lastSynced: teamsQuery.data?.[0]?.synced_at,
  };
}
