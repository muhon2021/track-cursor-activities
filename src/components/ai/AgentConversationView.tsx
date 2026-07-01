import { useState, useRef, useEffect, FormEvent } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Send,
  Bot,
  Loader2,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getInitials } from "@/lib/utils";
import {
  useAgentMessages,
  useAgentConversation,
  useSendMessage,
  AgentMessage,
} from "@/hooks/useAgentConversations";
import {
  useAgentChatModels,
  persistAgentChatModelChoice,
} from "@/hooks/useAIModelPolicy";
import { ModelSelect } from "@/components/ai/ModelSelect";
import { MemoryCitationPill, parseMemoryCitations } from "@/components/ai/MemoryCitationPill";
import {
  KnowledgeCitationBlock,
  parseKnowledgeCitations,
} from "@/components/ai/KnowledgeCitationBlock";
import { useOrganization } from "@/contexts/OrganizationContext";
import { AgentResponseMarkdown } from "@/components/ai/AgentResponseMarkdown";
import { MessageFeedbackRow } from "@/components/ai/MessageFeedbackRow";
import {
  ChatTimeoutAlert,
  isNetworkOrTimeoutError,
} from "@/components/ai/ChatTimeoutAlert";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AgentConversationViewProps {
  conversationId: string;
  agentId: string;
}

export function AgentConversationView({
  conversationId,
  agentId,
}: AgentConversationViewProps) {
  const { profile } = useAuth();
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [timeoutError, setTimeoutError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversation, isLoading: conversationLoading, isError: conversationError, refetch: refetchConversation } =
    useAgentConversation(conversationId);
  const { data: messages, isLoading: messagesLoading, isError: messagesError, refetch: refetchMessages } =
    useAgentMessages(conversationId);
  const sendMessage = useSendMessage();
  const org = useOrganization();

  const {
    visibleModels,
    resolvedModelId,
    showPicker,
    isLoading: modelsLoading,
    policy,
  } = useAgentChatModels();

  useEffect(() => {
    if (resolvedModelId) {
      setSelectedModel(resolvedModelId);
    }
  }, [resolvedModelId]);

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    if (policy?.selection_mode === "user_choice") {
      persistAgentChatModelChoice(modelId);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendMessage.isPending, timeoutError]);

  const agent = conversation?.ai_agents;
  const conversationStarters = agent?.conversation_starters || [];
  const welcomeMessage = agent?.welcome_message;

  const submitMessage = async (messageContent: string) => {
    setTimeoutError(null);
    setLastFailedMessage(null);

    try {
      await sendMessage.mutateAsync({
        conversation_id: conversationId,
        agent_id: agentId,
        content: messageContent,
        model_id: selectedModel || resolvedModelId || undefined,
        memory_enabled: agent?.memory_enabled ?? false,
      });
    } catch (err) {
      if (isNetworkOrTimeoutError(err)) {
        setTimeoutError(
          err instanceof Error ? err.message : "Network request failed"
        );
        setLastFailedMessage(messageContent);
      } else {
        const message =
          err instanceof Error ? err.message : "Failed to send message. Please try again.";
        toast.error(message);
        setInput(messageContent);
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sendMessage.isPending) return;
    const messageContent = input;
    setInput("");
    await submitMessage(messageContent);
  };

  const handleRetry = async () => {
    if (!lastFailedMessage || sendMessage.isPending) return;
    const messageContent = lastFailedMessage;
    setLastFailedMessage(null);
    await submitMessage(messageContent);
  };

  const handleCopyMessage = async (message: AgentMessage) => {
    await navigator.clipboard.writeText(message.content);
    setCopiedMessageId(message.id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleConversationStarter = (starter: string) => {
    setInput(starter);
  };

  const isLoading = conversationLoading || messagesLoading || modelsLoading;
  const hasMessages = messages && messages.length > 0;
  const loadError = conversationError || messagesError;
  const activeModel =
    visibleModels.find((m) => m.id === selectedModel) ??
    visibleModels.find((m) => m.id === resolvedModelId);

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <p className="text-sm text-muted-foreground text-center">
          Could not load this conversation.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            refetchConversation();
            refetchMessages();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary">
                {agent?.avatar || <Bot className="h-5 w-5" />}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="font-semibold">{agent?.name || "AI Assistant"}</h2>
              {conversation?.title ? (
                <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                  {conversation.title}
                </p>
              ) : null}
            </div>
          </div>

          {showPicker && selectedModel ? (
            <ModelSelect
              models={visibleModels}
              value={selectedModel}
              onChange={handleModelChange}
            />
          ) : null}

          {!showPicker && activeModel ? (
            <p className="text-sm text-muted-foreground shrink-0">
              Using {activeModel.provider_name} — {activeModel.name}
            </p>
          ) : null}
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[250px]" />
                  <Skeleton className="h-4 w-[200px]" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {!hasMessages ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Avatar className="h-16 w-16 mb-4">
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                    {agent?.avatar || <Bot className="h-8 w-8" />}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-lg font-semibold mb-2">
                  {agent?.name || "AI Assistant"}
                </h3>
                {welcomeMessage ? (
                  <p className="text-muted-foreground text-center max-w-md mb-6">
                    {welcomeMessage}
                  </p>
                ) : null}
                {agent?.description && !welcomeMessage ? (
                  <p className="text-muted-foreground text-center max-w-md mb-6">
                    {agent.description}
                  </p>
                ) : null}

                {conversationStarters.length > 0 ? (
                  <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                    {conversationStarters.map((starter: string, i: number) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="text-sm"
                        onClick={() => handleConversationStarter(starter)}
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        {starter}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {messages?.map((message) => {
              const memoryCitations = parseMemoryCitations(
                message.metadata,
                message.citations
              );
              const knowledgeCitations = parseKnowledgeCitations(
                message.metadata,
                message.citations
              );
              const responseReranked =
                org.features.enableKbCohere &&
                message.metadata?.reranked === true;

              return (
                <div
                  key={message.id}
                  className={cn(
                    "group flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" ? (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {agent?.avatar || <Bot className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                  ) : null}

                  <div
                    className={cn(
                      "relative max-w-[80%] rounded-lg p-3 space-y-2",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {message.role === "assistant" ? (
                      <AgentResponseMarkdown content={message.content} />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}

                    {message.role === "assistant" && memoryCitations.length > 0 ? (
                      <MemoryCitationPill citations={memoryCitations} />
                    ) : null}

                    {message.role === "assistant" && knowledgeCitations.length > 0 ? (
                      <KnowledgeCitationBlock
                        citations={knowledgeCitations}
                        reranked={responseReranked}
                      />
                    ) : null}

                    <div className="flex items-center justify-between mt-2 gap-2">
                      <p className="text-xs opacity-70">
                        {format(new Date(message.created_at), "h:mm a")}
                      </p>

                      {message.role === "assistant" ? (
                        <div className="flex items-center gap-1">
                          <MessageFeedbackRow
                            messageId={message.id}
                            agentId={agentId}
                            conversationId={conversationId}
                          />
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleCopyMessage(message)}
                            >
                              {copiedMessageId === message.id ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {message.role === "assistant" &&
                    (message.tokens_output || message.latency_ms) ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {message.tokens_output ? (
                          <span>{message.tokens_output} tokens</span>
                        ) : null}
                        {message.tokens_output && message.latency_ms ? (
                          <span>·</span>
                        ) : null}
                        {message.latency_ms ? (
                          <span>{(message.latency_ms / 1000).toFixed(1)}s</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {message.role === "user" ? (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback>
                        {getInitials(profile?.full_name || "U")}
                      </AvatarFallback>
                    </Avatar>
                  ) : null}
                </div>
              );
            })}

            {sendMessage.isPending ? (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {agent?.avatar || <Bot className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-lg bg-muted p-3 max-w-[80%]">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Thinking…</span>
                  </div>
                </div>
              </div>
            ) : null}

            {timeoutError ? (
              <ChatTimeoutAlert
                message={timeoutError}
                onRetry={handleRetry}
                retrying={sendMessage.isPending}
              />
            ) : null}

            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={sendMessage.isPending}
            className="flex-1"
          />
          <Button type="submit" disabled={sendMessage.isPending || !input.trim()}>
            {sendMessage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
