// Agent chat stream hooks - disabled (tables not yet created)
// These hooks will be enabled once agent_conversations and agent_messages tables exist

export interface StreamingState {
  isStreaming: boolean;
  streamedContent: string;
  toolCalls: never[];
  error: string | null;
  tokenCount: number;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: "pending" | "executing" | "completed" | "failed";
  result?: unknown;
  startedAt: Date;
  completedAt?: Date;
}

export interface StreamEvent {
  type: "start" | "token" | "tool_use" | "tool_result" | "complete" | "error";
  data: unknown;
}

// Stub implementation - returns disabled state
export function useAgentChatStream() {
  return {
    isStreaming: false,
    streamedContent: "",
    toolCalls: [],
    error: "Agent chat is not enabled - database tables not configured",
    tokenCount: 0,
    sendMessage: async () => {
      console.warn("Agent chat is not enabled");
    },
    stopStreaming: () => {},
  };
}

// Stub implementation - returns disabled state
export function useAgentChatWithTypingEffect() {
  return {
    isStreaming: false,
    streamedContent: "",
    toolCalls: [],
    error: "Agent chat is not enabled - database tables not configured",
    tokenCount: 0,
    sendMessage: async () => {
      console.warn("Agent chat is not enabled");
    },
    stopStreaming: () => {},
  };
}
