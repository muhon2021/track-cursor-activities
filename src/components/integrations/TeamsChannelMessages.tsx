/**
 * Teams Channel Messages Component
 * Displays a chat-style list of messages from a Microsoft Teams channel
 */

import { useMemo, forwardRef, useImperativeHandle } from 'react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import DOMPurify from 'dompurify';
import { Loader2, RefreshCw, User, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMicrosoftTeamsMessages } from '@/hooks/useMicrosoftTeamsMessages';
import { cn } from '@/lib/utils';

interface TeamsChannelMessagesProps {
  teamId: string;
  channelId: string;
  className?: string;
  autoRefresh?: boolean;
}

export interface TeamsChannelMessagesRef {
  refresh: () => void;
}

function formatMessageTime(dateString: string): string {
  const date = parseISO(dateString);
  const time = format(date, 'h:mm a');
  
  if (isToday(date)) {
    return `Today ${time}`;
  } else if (isYesterday(date)) {
    return `Yesterday ${time}`;
  } else {
    return format(date, 'MMM d, h:mm a');
  }
}

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br', 'p', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}

export const TeamsChannelMessages = forwardRef<TeamsChannelMessagesRef, TeamsChannelMessagesProps>(
  function TeamsChannelMessages({
    teamId,
    channelId,
    className,
    autoRefresh = false,
  }, ref) {
    const {
      messages,
      isLoading,
      isError,
      error,
      refreshMessages,
      isRefreshing,
    } = useMicrosoftTeamsMessages({
      teamId,
      channelId,
      enabled: !!teamId && !!channelId,
      refetchInterval: autoRefresh ? 30000 : false, // 30 seconds if auto-refresh enabled
    });

    // Expose refresh method via ref
    useImperativeHandle(ref, () => ({
      refresh: refreshMessages,
    }), [refreshMessages]);

    // Sort messages by date (oldest first for chat display)
    const sortedMessages = useMemo(() => {
      return [...messages].sort(
        (a, b) => new Date(a.createdDateTime).getTime() - new Date(b.createdDateTime).getTime()
      );
    }, [messages]);

  if (!teamId || !channelId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Select a team and channel to view messages
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive text-center">
          {error instanceof Error ? error.message : 'Failed to load messages'}
        </p>
        {error instanceof Error && error.message?.includes('permission') && (
          <p className="text-xs text-muted-foreground text-center">
            Try disconnecting and reconnecting your Microsoft account to grant read permissions.
          </p>
        )}
        <Button variant="outline" size="sm" onClick={refreshMessages}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header with refresh */}
      <div className="flex items-center justify-between pb-3 border-b">
        <span className="text-sm text-muted-foreground">
          {messages.length} message{messages.length !== 1 ? 's' : ''}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={refreshMessages}
          disabled={isRefreshing}
          className="h-8"
        >
          <RefreshCw className={cn('h-4 w-4 mr-1.5', isRefreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Messages list */}
      <ScrollArea className="h-80">
        {sortedMessages.length > 0 ? (
          <div className="space-y-3 py-3 pr-4">
            {sortedMessages.map((message) => {
              const senderName = message.from?.user?.displayName || 
                               message.from?.application?.displayName || 
                               'Unknown';
              const isHtml = message.body.contentType === 'html';
              const content = isHtml 
                ? sanitizeHtml(message.body.content)
                : message.body.content;

              return (
                <div key={message.id} className="flex gap-3 group">
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>

                  {/* Message content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-medium text-sm">{senderName}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatMessageTime(message.createdDateTime)}
                      </span>
                      {message.lastModifiedDateTime && 
                       message.lastModifiedDateTime !== message.createdDateTime && (
                        <span className="text-xs text-muted-foreground italic">(edited)</span>
                      )}
                    </div>
                    
                    {isHtml ? (
                      <div 
                        className="mt-0.5 text-sm break-words prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: content }}
                      />
                    ) : (
                      <p className="mt-0.5 text-sm break-words whitespace-pre-wrap">
                        {content}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No messages in this channel yet
          </div>
        )}
      </ScrollArea>
    </div>
  );
});
