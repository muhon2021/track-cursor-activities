import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  createGraphSubscription,
  renewGraphSubscription,
  deleteGraphSubscription,
  listGraphSubscriptions,
  CreateSubscriptionParams,
  GraphWebhookSubscription,
  isSubscriptionExpiringSoon,
} from '@/lib/microsoftGraphWebhooks';

/**
 * Hook to manage Microsoft Graph webhook subscriptions
 */
export function useGraphWebhookSubscriptions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query to list all subscriptions
  const listQuery = useQuery({
    queryKey: ['graph-webhook-subscriptions'],
    queryFn: async () => {
      const result = await listGraphSubscriptions();
      if (!result.success) {
        throw new Error(result.error || 'Failed to list subscriptions');
      }
      return result.subscriptions || [];
    },
    staleTime: 60 * 1000, // 1 minute
    retry: 1,
  });

  // Mutation to create a subscription
  const createMutation = useMutation({
    mutationFn: async (params: CreateSubscriptionParams) => {
      const result = await createGraphSubscription(params);
      if (!result.success) {
        throw new Error(result.error || 'Failed to create subscription');
      }
      return result.subscription;
    },
    onSuccess: (subscription) => {
      toast({
        title: 'Subscription Created',
        description: `Now listening for changes to ${subscription?.resource}`,
      });
      queryClient.invalidateQueries({ queryKey: ['graph-webhook-subscriptions'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Create Subscription',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutation to renew a subscription
  const renewMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const result = await renewGraphSubscription(subscriptionId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to renew subscription');
      }
      return result.expirationDateTime;
    },
    onSuccess: () => {
      toast({
        title: 'Subscription Renewed',
        description: 'Subscription will be active for 3 more days.',
      });
      queryClient.invalidateQueries({ queryKey: ['graph-webhook-subscriptions'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Renew Subscription',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutation to delete a subscription
  const deleteMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const result = await deleteGraphSubscription(subscriptionId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete subscription');
      }
    },
    onSuccess: () => {
      toast({
        title: 'Subscription Deleted',
        description: 'You will no longer receive notifications for this resource.',
      });
      queryClient.invalidateQueries({ queryKey: ['graph-webhook-subscriptions'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Delete Subscription',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Helper to check for expiring subscriptions
  const getExpiringSubscriptions = (): GraphWebhookSubscription[] => {
    if (!listQuery.data) return [];
    return listQuery.data.filter(
      (sub) => sub.is_active && isSubscriptionExpiringSoon(sub.expiration_datetime)
    );
  };

  // Auto-renew expiring subscriptions
  const renewExpiringSubscriptions = async () => {
    const expiring = getExpiringSubscriptions();
    const results = await Promise.allSettled(
      expiring.map((sub) => renewMutation.mutateAsync(sub.subscription_id))
    );
    
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    
    if (failed > 0) {
      toast({
        title: 'Some Renewals Failed',
        description: `${succeeded} renewed, ${failed} failed. Check your Microsoft connection.`,
        variant: 'destructive',
      });
    } else if (succeeded > 0) {
      toast({
        title: 'Subscriptions Renewed',
        description: `${succeeded} subscription(s) renewed successfully.`,
      });
    }
  };

  return {
    // Queries
    subscriptions: listQuery.data || [],
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    error: listQuery.error,
    refetch: listQuery.refetch,

    // Mutations
    createSubscription: createMutation.mutate,
    createSubscriptionAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    renewSubscription: renewMutation.mutate,
    renewSubscriptionAsync: renewMutation.mutateAsync,
    isRenewing: renewMutation.isPending,

    deleteSubscription: deleteMutation.mutate,
    deleteSubscriptionAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,

    // Helpers
    getExpiringSubscriptions,
    renewExpiringSubscriptions,
    hasExpiringSubscriptions: getExpiringSubscriptions().length > 0,
  };
}
