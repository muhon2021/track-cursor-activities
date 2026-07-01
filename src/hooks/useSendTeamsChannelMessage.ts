/**
 * React hook for sending messages to Microsoft Teams channels
 */

import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { sendChannelMessage, SendMessageResult } from '@/lib/microsoftTeamsNotificationService';

interface SendMessageParams {
  teamId: string;
  channelId: string;
  content: string;
}

export function useSendTeamsChannelMessage() {
  const { toast } = useToast();
  
  const mutation = useMutation({
    mutationFn: async (params: SendMessageParams): Promise<SendMessageResult> => {
      return sendChannelMessage({
        teamId: params.teamId,
        channelId: params.channelId,
        content: params.content,
        contentType: 'text',
      });
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: "Message Sent",
          description: "Your message was posted to the Teams channel.",
        });
      } else {
        // Handle specific error types with appropriate messaging
        const title = result.errorType === 'permission' 
          ? "Permission Denied"
          : result.errorType === 'not_found'
          ? "Not Found"
          : result.errorType === 'rate_limit'
          ? "Rate Limited"
          : "Failed to Send";
        
        toast({
          title,
          description: result.error,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Send Message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    sendMessage: mutation.mutateAsync,
    isSending: mutation.isPending,
    error: mutation.error,
    lastResult: mutation.data,
    reset: mutation.reset,
  };
}
