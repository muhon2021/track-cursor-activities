/**
 * Channel Messages Section Component
 * Displays team/channel selectors and chat messages
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageSquare } from 'lucide-react';
import { TeamsChannelMessages, TeamsChannelMessagesRef } from './TeamsChannelMessages';
import { ChannelMessageInput } from './ChannelMessageInput';
import { useRef } from 'react';

interface StoredTeam {
  id: string;
  team_id: string;
  display_name: string;
  description?: string | null;
}

interface StoredChannel {
  id: string;
  channel_id: string;
  team_id: string;
  display_name: string;
}

interface ChannelMessagesSectionProps {
  teams: StoredTeam[];
  getChannelsForTeam: (teamId: string) => StoredChannel[];
}

export function ChannelMessagesSection({ teams, getChannelsForTeam }: ChannelMessagesSectionProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const messagesRef = useRef<TeamsChannelMessagesRef>(null);

  const availableChannels = selectedTeamId ? getChannelsForTeam(selectedTeamId) : [];

  const handleTeamChange = (teamId: string) => {
    setSelectedTeamId(teamId);
    setSelectedChannelId(''); // Reset channel when team changes
  };

  const handleMessageSent = useCallback(() => {
    // Refresh messages after sending
    messagesRef.current?.refresh();
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-orange-100 dark:bg-orange-900/30">
            <MessageSquare className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          Channel Messages
        </CardTitle>
        <CardDescription>
          View and send messages to Microsoft Teams channels
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Team and Channel Selectors */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Select value={selectedTeamId} onValueChange={handleTeamChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a team..." />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.team_id}>
                    {team.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Select 
              value={selectedChannelId} 
              onValueChange={setSelectedChannelId}
              disabled={!selectedTeamId || availableChannels.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  !selectedTeamId 
                    ? "Select a team first" 
                    : availableChannels.length === 0 
                      ? "Sync channels first" 
                      : "Select a channel..."
                } />
              </SelectTrigger>
              <SelectContent>
                {availableChannels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.channel_id}>
                    {channel.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Auto-refresh toggle */}
        {selectedTeamId && selectedChannelId && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-input"
              />
              Auto-refresh every 30 seconds
            </label>
          </div>
        )}

        {/* Messages Display */}
        <div className="border rounded-lg p-4 bg-muted/20">
          <TeamsChannelMessages
            ref={messagesRef}
            teamId={selectedTeamId}
            channelId={selectedChannelId}
            autoRefresh={autoRefresh}
          />
        </div>

        {/* Inline Message Input */}
        <div className="pt-2 border-t">
          <ChannelMessageInput
            teamId={selectedTeamId}
            channelId={selectedChannelId}
            onMessageSent={handleMessageSent}
          />
        </div>

        <div className="rounded-lg bg-muted/50 p-3 border border-muted">
          <p className="text-sm text-muted-foreground">
            View and send messages to your Teams channels. 
            Requires <code className="bg-background px-1.5 py-0.5 rounded text-xs font-mono">ChannelMessage.Read.All</code> and <code className="bg-background px-1.5 py-0.5 rounded text-xs font-mono">ChannelMessage.Send</code> permissions.
            If you see a permission error, disconnect and reconnect your Microsoft account.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
