import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Brain, MessageSquare, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AgentConversationView } from "@/components/ai/AgentConversationView";
import { AgentConversationList } from "@/components/ai/AgentConversationList";
import {
  useAgentConversations,
  useCreateConversation,
} from "@/hooks/useAgentConversations";
import { toast } from "sonner";

interface AIAgent {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_enabled: boolean;
  memory_enabled: boolean;
}

export default function AIChat() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);

  const selectedAgentId = searchParams.get("agent") || "";
  const selectedConversationId = searchParams.get("conversation") || null;

  useEffect(() => {
    fetchAgents();
  }, []);

  useEffect(() => {
    if (!selectedAgentId && agents.length > 0) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("agent", agents[0].id);
        next.delete("conversation");
        return next;
      });
    }
  }, [agents, selectedAgentId, setSearchParams]);

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("id, name, slug, description, is_enabled, memory_enabled")
        .eq("is_enabled", true)
        .order("name");

      if (error) throw error;
      setAgents((data || []) as AIAgent[]);
    } catch (error: unknown) {
      console.error("Fetch agents error:", error);
    } finally {
      setLoadingAgents(false);
    }
  };

  const handleAgentChange = (agentId: string) => {
    setSearchParams({ agent: agentId });
  };

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  const { data: conversations } = useAgentConversations(selectedAgentId || undefined);
  const createConversation = useCreateConversation();

  const handleSelectConversation = (conversationId: string | null) => {
    if (!selectedAgentId) return;
    if (conversationId) {
      setSearchParams({ agent: selectedAgentId, conversation: conversationId });
    } else {
      setSearchParams({ agent: selectedAgentId });
    }
  };

  const handleNewConversation = async () => {
    if (!selectedAgentId) return;
    try {
      const conversation = await createConversation.mutateAsync({
        agent_id: selectedAgentId,
      });
      if (conversation?.id) {
        setSearchParams({ agent: selectedAgentId, conversation: conversation.id });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof (err as { message?: string })?.message === "string"
            ? (err as { message: string }).message
            : "Failed to start conversation";
      console.error("Create conversation error:", err);
      toast.error(message);
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Chat</h1>
          <p className="text-muted-foreground">
            Chat with AI agents to get insights and assistance
          </p>
        </div>
        {agents.length > 0 && (
          <Badge variant="outline" className="flex items-center gap-1">
            <Brain className="h-3 w-3" />
            {agents.length} agents available
          </Badge>
        )}
      </div>

      {/* Agent Selector */}
      {agents.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Select AI Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedAgentId} onValueChange={handleAgentChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🤖</span>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span>{agent.name}</span>
                          {agent.memory_enabled && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 flex items-center gap-1">
                              <Brain className="h-2.5 w-2.5" />
                              Memory
                            </Badge>
                          )}
                        </div>
                        {agent.description && (
                          <span className="text-xs text-muted-foreground">
                            {agent.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Chat area: only when an agent is selected */}
      {!selectedAgentId && agents.length > 0 && (
        <Card className="flex-1 flex items-center justify-center">
          <div className="text-center p-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Select an agent above to start chatting.</p>
          </div>
        </Card>
      )}

      {!selectedAgentId && loadingAgents && (
        <Card className="flex-1 flex items-center justify-center">
          <div className="text-center p-8 text-muted-foreground">
            Loading agents…
          </div>
        </Card>
      )}

      {selectedAgentId && selectedAgent && (
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Conversation list sidebar */}
          <div className="w-64 flex-shrink-0 hidden sm:block">
            <AgentConversationList
              agentId={selectedAgentId}
              agentName={selectedAgent.name}
              selectedConversationId={selectedConversationId}
              onSelectConversation={handleSelectConversation}
              onNewConversation={handleNewConversation}
            />
          </div>

          {/* Main chat area */}
          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {selectedConversationId ? (
              <AgentConversationView
                conversationId={selectedConversationId}
                agentId={selectedAgentId}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8">
                <MessageSquare className="h-14 w-14 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
                <p className="text-muted-foreground text-center max-w-sm mb-6">
                  Start a new chat with {selectedAgent.name} or pick an existing
                  conversation from the list.
                </p>
                <Button onClick={handleNewConversation} disabled={createConversation.isPending}>
                  <Plus className="h-4 w-4 mr-2" />
                  New conversation
                </Button>
                {conversations && conversations.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-4">
                    Or select a conversation from the sidebar
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {selectedAgentId && !selectedAgent && agents.length > 0 && (
        <Card className="flex-1 flex items-center justify-center">
          <div className="text-center p-8 text-muted-foreground">
            Selected agent not found. Choose another from the list above.
          </div>
        </Card>
      )}

      {agents.length === 0 && !loadingAgents && (
        <Card className="flex-1 flex items-center justify-center">
          <div className="text-center p-8 text-muted-foreground">
            No AI agents are available. Contact your administrator to enable agents.
          </div>
        </Card>
      )}
    </div>
  );
}
