/**
 * React hook for Microsoft Teams Channels
 * Handles fetching and syncing channels for teams
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getTeamChannels, getChannelsForMultipleTeams } from '@/lib/microsoftTeamsService';
import { useAuth } from '@/contexts/AuthContext';

export interface StoredChannel {
  id: string;
  user_id: string;
  team_id: string;
  channel_id: string;
  display_name: string;
  description: string | null;
  membership_type: string | null;
  web_url: string | null;
  email: string | null;
  is_favorite: boolean;
  created_date_time: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

interface UseChannelsOptions {
  teamId?: string;
  autoRefresh?: boolean;
}

export function useMicrosoftTeamsChannels(options: UseChannelsOptions = {}) {
  const { teamId, autoRefresh = true } = options;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch channels from database
  const channelsQuery = useQuery({
    queryKey: ['microsoft-teams-channels', user?.id, teamId],
    queryFn: async () => {
      console.log('[useMicrosoftTeamsChannels] Fetching channels from database...');
      let query = supabase
        .from('user_microsoft_teams_channels')
        .select('*')
        .order('display_name');
      
      if (teamId) {
        query = query.eq('team_id', teamId);
      }
      
      const { data, error } = await query;
      if (error) {
        console.error('[useMicrosoftTeamsChannels] Error fetching channels:', error);
        throw error;
      }
      console.log('[useMicrosoftTeamsChannels] Fetched channels:', data?.length ?? 0);
      return data as StoredChannel[];
    },
    enabled: !!user?.id && autoRefresh,
    staleTime: 0, // Always consider data stale
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });

  // Sync channels for a single team
  const syncTeamChannelsMutation = useMutation({
    mutationFn: async (targetTeamId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const graphChannels = await getTeamChannels(targetTeamId);
      
      const channelsToUpsert = graphChannels.map(channel => ({
        user_id: user.id,
        team_id: targetTeamId,
        channel_id: channel.id,
        display_name: channel.displayName,
        description: channel.description || null,
        membership_type: channel.membershipType || null,
        web_url: channel.webUrl || null,
        email: channel.email || null,
        is_favorite: channel.isFavoriteByDefault || false,
        created_date_time: channel.createdDateTime || null,
        synced_at: new Date().toISOString(),
      }));

      if (channelsToUpsert.length > 0) {
        const { error } = await supabase
          .from('user_microsoft_teams_channels')
          .upsert(channelsToUpsert, { 
            onConflict: 'user_id,team_id,channel_id',
            ignoreDuplicates: false 
          });

        if (error) throw error;
      }
      
      return graphChannels;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['microsoft-teams-channels'] });
    },
  });

  // Sync channels for all teams at once
  const syncAllChannelsMutation = useMutation({
    mutationFn: async (teamIds: string[]) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const channelsMap = await getChannelsForMultipleTeams(teamIds);
      const allChannelsToUpsert: Array<{
        user_id: string;
        team_id: string;
        channel_id: string;
        display_name: string;
        description: string | null;
        membership_type: string | null;
        web_url: string | null;
        email: string | null;
        is_favorite: boolean;
        created_date_time: string | null;
        synced_at: string;
      }> = [];
      
      channelsMap.forEach((channels, tId) => {
        channels.forEach(channel => {
          allChannelsToUpsert.push({
            user_id: user.id,
            team_id: tId,
            channel_id: channel.id,
            display_name: channel.displayName,
            description: channel.description || null,
            membership_type: channel.membershipType || null,
            web_url: channel.webUrl || null,
            email: channel.email || null,
            is_favorite: channel.isFavoriteByDefault || false,
            created_date_time: channel.createdDateTime || null,
            synced_at: new Date().toISOString(),
          });
        });
      });

      if (allChannelsToUpsert.length > 0) {
        const { error } = await supabase
          .from('user_microsoft_teams_channels')
          .upsert(allChannelsToUpsert, { 
            onConflict: 'user_id,team_id,channel_id',
            ignoreDuplicates: false 
          });

        if (error) throw error;
      }
      
      return allChannelsToUpsert.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['microsoft-teams-channels'] });
    },
  });

  return {
    channels: channelsQuery.data ?? [],
    isLoading: channelsQuery.isLoading,
    error: channelsQuery.error,
    
    syncTeamChannels: syncTeamChannelsMutation.mutateAsync,
    isSyncingTeam: syncTeamChannelsMutation.isPending,
    syncTeamError: syncTeamChannelsMutation.error,
    
    syncAllChannels: syncAllChannelsMutation.mutateAsync,
    isSyncingAll: syncAllChannelsMutation.isPending,
    syncAllError: syncAllChannelsMutation.error,
    
    getChannelsForTeam: (tId: string) => 
      (channelsQuery.data ?? []).filter(c => c.team_id === tId),
  };
}
