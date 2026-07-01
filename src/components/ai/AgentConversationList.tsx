import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Search,
  MessageSquare,
  Archive,
  Loader2,
} from "lucide-react";
import {
  useAgentConversations,
  useCreateConversation,
  AgentConversation,
} from "@/hooks/useAgentConversations";
import { AgentConversationItem } from "./AgentConversationItem";

interface AgentConversationListProps {
  agentId: string;
  agentName?: string;
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string | null) => void;
  onNewConversation?: () => void;
}

export function AgentConversationList({
  agentId,
  agentName,
  selectedConversationId,
  onSelectConversation,
  onNewConversation,
}: AgentConversationListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: conversations, isLoading } = useAgentConversations(agentId);
  const createConversation = useCreateConversation();

  const handleNewConversation = async () => {
    try {
      const conversation = await createConversation.mutateAsync({
        agent_id: agentId,
      });
      if (conversation?.id) {
        onSelectConversation(conversation.id);
      }
      onNewConversation?.();
    } catch (error) {
      // Error handled by mutation
    }
  };

  // Filter conversations by search query
  const filteredConversations = conversations?.filter((conv: AgentConversation) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.title?.toLowerCase().includes(query) ||
      conv.summary?.toLowerCase().includes(query)
    );
  }) || [];

  // Separate pinned and unpinned conversations
  const pinnedConversations = filteredConversations.filter((c: AgentConversation) => c.is_pinned);
  const unpinnedConversations = filteredConversations.filter((c: AgentConversation) => !c.is_pinned);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-muted-foreground">
            Conversations
          </h3>
          <Button
            size="sm"
            onClick={handleNewConversation}
            disabled={createConversation.isPending}
          >
            {createConversation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span className="ml-1">New</span>
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? "No conversations match your search"
                : "No conversations yet"}
            </p>
            {!searchQuery && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleNewConversation}
                disabled={createConversation.isPending}
              >
                Start a conversation
              </Button>
            )}
          </div>
        ) : (
          <div className="p-2">
            {/* Pinned conversations */}
            {pinnedConversations.length > 0 && (
              <div className="mb-2">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  Pinned
                </div>
                {pinnedConversations.map((conversation: AgentConversation) => (
                  <AgentConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isSelected={selectedConversationId === conversation.id}
                    onClick={() => onSelectConversation(conversation.id)}
                  />
                ))}
              </div>
            )}

            {/* Other conversations */}
            {unpinnedConversations.length > 0 && (
              <div>
                {pinnedConversations.length > 0 && (
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    Recent
                  </div>
                )}
                {unpinnedConversations.map((conversation: AgentConversation) => (
                  <AgentConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isSelected={selectedConversationId === conversation.id}
                    onClick={() => onSelectConversation(conversation.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Footer with archived link */}
      {conversations && conversations.length > 0 && (
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
          >
            <Archive className="h-4 w-4 mr-2" />
            View archived
          </Button>
        </div>
      )}
    </div>
  );
}
