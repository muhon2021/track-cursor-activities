/**
 * React Hook for fetching Microsoft Teams Channel Messages
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getChannelMessages, TeamsChannelMessage } from '@/lib/microsoftTeamsService';
import { useToast } from '@/hooks/use-toast';

interface UseMessagesOptions {
  teamId?: string;
  channelId?: string;
  enabled?: boolean;
  refetchInterval?: number | false;
}

export function useMicrosoftTeamsMessages(options: UseMessagesOptions = {}) {
  const { teamId, channelId, enabled = true, refetchInterval = false } = options;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for fetching messages
  const messagesQuery = useQuery({
    queryKey: ['microsoft-teams-messages', teamId, channelId],
    queryFn: async () => {
      if (!teamId || !channelId) return [];
      return getChannelMessages(teamId, channelId, { top: 50 });
    },
    enabled: enabled && !!teamId && !!channelId,
    refetchInterval,
    staleTime: 30000, // Consider data stale after 30 seconds
  });

  // Mutation for refreshing messages manually
  const refreshMutation = useMutation({
    mutationFn: async () => {
      if (!teamId || !channelId) throw new Error('Team and channel IDs required');
      return getChannelMessages(teamId, channelId, { top: 50 });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['microsoft-teams-messages', teamId, channelId], data);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to refresh messages',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    messages: messagesQuery.data ?? [],
    isLoading: messagesQuery.isLoading,
    isError: messagesQuery.isError,
    error: messagesQuery.error,
    refreshMessages: () => refreshMutation.mutate(),
    isRefreshing: refreshMutation.isPending,
  };
}
