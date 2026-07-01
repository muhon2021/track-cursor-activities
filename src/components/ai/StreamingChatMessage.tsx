import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Bot,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Code,
  Globe,
  Search,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCall } from "@/hooks/useAgentChatStream";

interface StreamingChatMessageProps {
  content: string;
  isStreaming: boolean;
  toolCalls?: ToolCall[];
  agentAvatar?: string;
  agentName?: string;
  tokenCount?: number;
  timestamp?: Date;
  onCopy?: () => void;
}

export function StreamingChatMessage({
  content,
  isStreaming,
  toolCalls = [],
  agentAvatar,
  agentName = "Assistant",
  tokenCount = 0,
  timestamp,
  onCopy,
}: StreamingChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [showTools, setShowTools] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom while streaming
  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [content, isStreaming]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  };

  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case "code_interpreter":
      case "execute_code":
        return <Code className="h-3 w-3" />;
      case "web_search":
      case "search_web":
        return <Globe className="h-3 w-3" />;
      case "file_search":
      case "search_knowledge":
        return <Search className="h-3 w-3" />;
      default:
        return <Zap className="h-3 w-3" />;
    }
  };

  const getToolStatusColor = (status: ToolCall["status"]) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/30";
      case "executing":
        return "bg-blue-500/10 text-blue-600 border-blue-500/30";
      case "completed":
        return "bg-green-500/10 text-green-600 border-green-500/30";
      case "failed":
        return "bg-red-500/10 text-red-600 border-red-500/30";
      default:
        return "bg-muted";
    }
  };

  return (
    <div className="group flex gap-3">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback className="bg-primary/10 text-primary">
          {agentAvatar || <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 space-y-2" ref={contentRef}>
        {/* Tool calls display */}
        {toolCalls.length > 0 && (
          <Collapsible open={showTools} onOpenChange={setShowTools}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground"
              >
                {showTools ? (
                  <ChevronUp className="h-3 w-3 mr-1" />
                ) : (
                  <ChevronDown className="h-3 w-3 mr-1" />
                )}
                {toolCalls.length} tool{toolCalls.length !== 1 ? "s" : ""} used
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 mt-2">
              {toolCalls.map((tool) => (
                <div
                  key={tool.id}
                  className={cn(
                    "rounded-lg border p-2 text-xs",
                    getToolStatusColor(tool.status)
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getToolIcon(tool.name)}
                      <span className="font-medium">{tool.name}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        tool.status === "executing" && "animate-pulse"
                      )}
                    >
                      {tool.status}
                    </Badge>
                  </div>
                  {tool.input && Object.keys(tool.input).length > 0 && (
                    <pre className="mt-1 text-xs opacity-70 overflow-x-auto">
                      {JSON.stringify(tool.input, null, 2)}
                    </pre>
                  )}
                  {tool.result && (
                    <div className="mt-2 pt-2 border-t border-current/10">
                      <span className="font-medium">Result:</span>
                      <pre className="mt-1 text-xs opacity-70 overflow-x-auto">
                        {typeof tool.result === "string"
                          ? tool.result
                          : JSON.stringify(tool.result, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Message content */}
        <div className="rounded-lg bg-muted p-3">
          <div className="text-sm whitespace-pre-wrap">
            {content}
            {isStreaming && (
              <span className="inline-block w-2 h-4 ml-0.5 bg-primary/70 animate-pulse" />
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isStreaming ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Generating...</span>
                  {tokenCount > 0 && <span>({tokenCount} tokens)</span>}
                </>
              ) : (
                <>
                  {timestamp && (
                    <span>{format(timestamp, "h:mm a")}</span>
                  )}
                </>
              )}
            </div>

            {!isStreaming && content && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Streaming progress indicator */}
        {isStreaming && (
          <div className="flex items-center gap-2">
            <Progress value={undefined} className="h-1 flex-1" />
            <span className="text-xs text-muted-foreground">
              {tokenCount} tokens
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Typing indicator component
export function TypingIndicator({
  agentAvatar,
}: {
  agentAvatar?: string;
}) {
  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-primary/10 text-primary">
          {agentAvatar || <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <div className="rounded-lg bg-muted p-3">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}
