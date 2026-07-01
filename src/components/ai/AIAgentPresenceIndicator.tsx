/**
 * AIAgentPresenceIndicator — Animated pill showing an AI agent is available on this page.
 * Clicking navigates to the agent's detail page.
 */

import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIAgentPresenceIndicatorProps {
  agentName: string;
  agentSlug: string;
  gradientFrom?: string;
  gradientTo?: string;
  className?: string;
}

export function AIAgentPresenceIndicator({
  agentName,
  agentSlug,
  gradientFrom = "199 89% 48%",
  gradientTo = "187 100% 42%",
  className,
}: AIAgentPresenceIndicatorProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/agents/${agentSlug}`)}
      className={cn(
        "group inline-flex items-center gap-2 px-3 py-1.5 rounded-full",
        "border border-border bg-card shadow-sm",
        "hover:shadow-md transition-all duration-300 animate-fade-in",
        "cursor-pointer",
        className
      )}
      style={{
        borderColor: `hsl(${gradientFrom} / 0.3)`,
      }}
    >
      {/* Pulsing dot */}
      <span className="relative flex h-2.5 w-2.5">
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
          style={{ backgroundColor: `hsl(${gradientFrom})` }}
        />
        <span
          className="relative inline-flex rounded-full h-2.5 w-2.5"
          style={{ backgroundColor: `hsl(${gradientFrom})` }}
        />
      </span>

      {/* Icon */}
      <Sparkles
        className="h-3.5 w-3.5 animate-pulse"
        style={{ color: `hsl(${gradientFrom})` }}
      />

      {/* Agent name */}
      <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
        {agentName}
      </span>

      <span className="text-[10px] text-muted-foreground">AI</span>
    </button>
  );
}
