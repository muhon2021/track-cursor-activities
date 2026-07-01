/**
 * Inline Chat Input Component
 * Simple text input with send button for Teams channel messages
 */

import { useState, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2 } from 'lucide-react';
import { useSendTeamsChannelMessage } from '@/hooks/useSendTeamsChannelMessage';

interface ChannelMessageInputProps {
  teamId: string;
  channelId: string;
  onMessageSent?: () => void;
  disabled?: boolean;
}

export function ChannelMessageInput({ 
  teamId, 
  channelId, 
  onMessageSent,
  disabled = false 
}: ChannelMessageInputProps) {
  const [message, setMessage] = useState('');
  const { sendMessage, isSending } = useSendTeamsChannelMessage();

  const isDisabled = disabled || !teamId || !channelId || isSending;
  const canSend = message.trim().length > 0 && !isDisabled;

  const handleSend = async () => {
    if (!canSend) return;

    const result = await sendMessage({
      teamId,
      channelId,
      content: message.trim(),
    });

    if (result.success) {
      setMessage('');
      onMessageSent?.();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && canSend) {
      e.preventDefault();
      handleSend();
    }
  };

  const getPlaceholder = () => {
    if (!teamId) return 'Select a team first...';
    if (!channelId) return 'Select a channel first...';
    return 'Type a message...';
  };

  return (
    <div className="flex gap-2">
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={getPlaceholder()}
        disabled={isDisabled}
        className="flex-1"
      />
      <Button
        onClick={handleSend}
        disabled={!canSend}
        size="icon"
        className="shrink-0"
      >
        {isSending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
