/**
 * Dialog component for sending messages to Microsoft Teams channels
 */

import { useState, useEffect, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Send, CheckCircle2, ExternalLink, AlertCircle } from 'lucide-react';
import { useSendTeamsChannelMessage } from '@/hooks/useSendTeamsChannelMessage';
import { useMicrosoftTeams } from '@/hooks/useMicrosoftTeams';
import { useMicrosoftTeamsChannels } from '@/hooks/useMicrosoftTeamsChannels';

interface SendTeamsMessageDialogProps {
  trigger?: ReactNode;
}

const MAX_MESSAGE_LENGTH = 28000;

export function SendTeamsMessageDialog({ trigger }: SendTeamsMessageDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [sentWebUrl, setSentWebUrl] = useState<string | null>(null);

  const { teams } = useMicrosoftTeams();
  const { channels, getChannelsForTeam, syncTeamChannels, isSyncingTeam } = useMicrosoftTeamsChannels();
  const { sendMessage, isSending, lastResult, reset } = useSendTeamsChannelMessage();

  // Filter channels for selected team
  const teamChannels = selectedTeamId ? getChannelsForTeam(selectedTeamId) : [];

  // Reset channel selection when team changes
  useEffect(() => {
    setSelectedChannelId('');
    // Auto-sync channels if none exist for this team
    if (selectedTeamId && getChannelsForTeam(selectedTeamId).length === 0) {
      syncTeamChannels(selectedTeamId).catch(console.error);
    }
  }, [selectedTeamId]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      // Delay reset to allow closing animation
      setTimeout(() => {
        setSelectedTeamId('');
        setSelectedChannelId('');
        setMessage('');
        setSent(false);
        setSentWebUrl(null);
        reset();
      }, 200);
    }
  }, [open, reset]);

  const handleSend = async () => {
    if (!selectedTeamId || !selectedChannelId || !message.trim()) return;

    const result = await sendMessage({
      teamId: selectedTeamId,
      channelId: selectedChannelId,
      content: message.trim(),
    });

    if (result.success) {
      setSent(true);
      setSentWebUrl(result.webUrl || null);
    }
  };

  const isValid = selectedTeamId && selectedChannelId && message.trim().length > 0;
  const charCount = message.length;
  const isOverLimit = charCount > MAX_MESSAGE_LENGTH;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Send className="mr-2 h-4 w-4" />
            Send Message
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Teams Channel Message</DialogTitle>
          <DialogDescription>
            Post a message to a Microsoft Teams channel
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          // Success state
          <div className="py-6 text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-lg">Message Sent!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your message has been posted to the channel.
              </p>
            </div>
            {sentWebUrl && (
              <Button
                variant="outline"
                onClick={() => window.open(sentWebUrl, '_blank')}
                className="mt-4"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in Teams
              </Button>
            )}
            <div className="pt-4">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          // Form state
          <>
            <div className="grid gap-4 py-4">
              {/* Team Selection */}
              <div className="grid gap-2">
                <Label htmlFor="team">Team</Label>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger id="team">
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        No teams synced. Please sync your teams first.
                      </div>
                    ) : (
                      teams.map((team) => (
                        <SelectItem key={team.id} value={team.team_id}>
                          {team.display_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Channel Selection */}
              <div className="grid gap-2">
                <Label htmlFor="channel">Channel</Label>
                <Select 
                  value={selectedChannelId} 
                  onValueChange={setSelectedChannelId}
                  disabled={!selectedTeamId || isSyncingTeam}
                >
                  <SelectTrigger id="channel">
                    {isSyncingTeam ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading channels...</span>
                      </div>
                    ) : (
                      <SelectValue placeholder="Select a channel" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {teamChannels.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        {selectedTeamId 
                          ? "No channels found. Try syncing the team."
                          : "Select a team first"}
                      </div>
                    ) : (
                      teamChannels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.channel_id}>
                          # {channel.display_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Message Input */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="message">Message</Label>
                  <span className={`text-xs ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {charCount.toLocaleString()} / {MAX_MESSAGE_LENGTH.toLocaleString()}
                  </span>
                </div>
                <Textarea
                  id="message"
                  placeholder="Type your message here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className={isOverLimit ? 'border-destructive' : ''}
                />
                {isOverLimit && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Message exceeds maximum length
                  </p>
                )}
              </div>

              {/* Permission note */}
              <p className="text-xs text-muted-foreground">
                Requires <code className="bg-muted px-1 rounded">ChannelMessage.Send</code> permission.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={!isValid || isSending || isOverLimit}
              >
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Message
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
