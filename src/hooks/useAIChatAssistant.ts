import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  metadata?: any;
}

export interface ChatOptions {
  agent_slug?: string;
  include_history?: boolean;
  max_tokens?: number;
  temperature?: number;
  model_id?: string;
}

const DEFAULT_GREETING = "Hello! I'm your AI assistant. How can I help you today?";

export function useAIChatAssistant(initialMessage?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);

  // Load existing conversation history for this user's most recent session
  useEffect(() => {
    if (!user || historyLoaded) return;

    async function loadHistory() {
      const { data, error } = await supabase
        .from("ai_chat_history")
        .select("id, role, content, metadata, created_at, session_id")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        // No history — show greeting
        setMessages([
          {
            id: "greeting",
            role: "assistant",
            content: initialMessage || DEFAULT_GREETING,
            timestamp: new Date(),
          },
        ]);
        setHistoryLoaded(true);
        return;
      }

      // Load last session's messages
      const lastSessionId = data[0].session_id;
      const { data: history } = await supabase
        .from("ai_chat_history")
        .select("id, role, content, metadata, created_at")
        .eq("user_id", user!.id)
        .eq("session_id", lastSessionId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (history && history.length > 0) {
        setMessages(
          history.map((row) => ({
            id: row.id,
            role: row.role as "user" | "assistant",
            content: row.content,
            timestamp: new Date(row.created_at),
            metadata: row.metadata,
          }))
        );
      } else {
        setMessages([
          {
            id: "greeting",
            role: "assistant",
            content: initialMessage || DEFAULT_GREETING,
            timestamp: new Date(),
          },
        ]);
      }
      setHistoryLoaded(true);
    }

    loadHistory();
  }, [user, historyLoaded, initialMessage]);

  // Persist a message to ai_chat_history
  const persistMessage = useCallback(
    async (msg: ChatMessage) => {
      if (!user) return;
      await supabase.from("ai_chat_history").insert({
        user_id: user.id,
        session_id: sessionId,
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata ?? null,
      });
    },
    [user, sessionId]
  );

  const sendMessage = useCallback(
    async (content: string, options: ChatOptions = {}) => {
      if (!content.trim() || !user) {
        toast({ title: "Please enter a message", variant: "destructive" });
        return null;
      }

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      // Persist user message
      persistMessage(userMessage);

      try {
        const { data, error } = await supabase.functions.invoke("ai-chat-assistant", {
          body: {
            message: content,
            session_id: sessionId,
            user_id: user.id,
            include_history: options.include_history ?? true,
            agent_slug: options.agent_slug,
            max_tokens: options.max_tokens,
            temperature: options.temperature,
            model_id: options.model_id,
          },
        });

        if (error) throw error;

        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.response || "Sorry, I couldn't generate a response.",
          timestamp: new Date(),
          metadata: data.metadata,
        };

        setMessages((prev) => [...prev, aiMessage]);

        // Persist AI response
        persistMessage(aiMessage);

        return aiMessage;
      } catch (error: any) {
        console.error("AI Chat error:", error);

        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Error: ${
            error.message ||
            "Failed to connect to AI assistant. Please ensure the edge function is deployed and OPENAI_API_KEY is configured."
          }`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);

        toast({ title: "Failed to get AI response", description: "Check deployment status.", variant: "destructive" });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [user, sessionId, persistMessage]
  );

  const clearHistory = useCallback(async () => {
    // Clear local state
    setMessages([
      {
        id: "greeting",
        role: "assistant",
        content: initialMessage || DEFAULT_GREETING,
        timestamp: new Date(),
      },
    ]);

    // Delete persisted history for this user's current session
    if (user) {
      await supabase
        .from("ai_chat_history")
        .delete()
        .eq("user_id", user.id)
        .eq("session_id", sessionId);
    }
  }, [user, sessionId, initialMessage]);

  const removeMessage = useCallback(
    async (messageId: string) => {
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));

      // Also remove from persistence
      if (user) {
        await supabase.from("ai_chat_history").delete().eq("id", messageId);
      }
    },
    [user]
  );

  return {
    messages,
    isLoading,
    sessionId,
    historyLoaded,
    sendMessage,
    clearHistory,
    removeMessage,
  };
}
