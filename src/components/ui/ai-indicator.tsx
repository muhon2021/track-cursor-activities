/**
 * AI Status Indicator Components
 * 
 * Provides visual AI status indicators for showing
 * AI is active, thinking, learning, or processing.
 */

import { cn } from "@/lib/utils";
import { Sparkles, Brain, Zap, Activity } from "lucide-react";

interface AIIndicatorProps {
  variant?: "dot" | "badge" | "orb" | "inline";
  status?: "active" | "thinking" | "learning" | "idle";
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

const statusLabels = {
  active: "AI Active",
  thinking: "AI Thinking",
  learning: "AI Learning",
  idle: "AI Ready",
};

const statusIcons = {
  active: Sparkles,
  thinking: Brain,
  learning: Zap,
  idle: Activity,
};

export function AIIndicator({
  variant = "dot",
  status = "active",
  size = "md",
  label,
  className,
}: AIIndicatorProps) {
  const Icon = statusIcons[status];
  const displayLabel = label || statusLabels[status];

  const sizeClasses = {
    sm: "h-1.5 w-1.5",
    md: "h-2 w-2",
    lg: "h-3 w-3",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  if (variant === "dot") {
    return (
      <span
        className={cn(
          "ai-status-dot",
          sizeClasses[size],
          className
        )}
        title={displayLabel}
      />
    );
  }

  if (variant === "badge") {
    return (
      <span
        className={cn(
          "badge-ai inline-flex items-center gap-1.5",
          size === "sm" && "text-[10px] px-2 py-0.5",
          size === "md" && "text-xs px-3 py-1",
          size === "lg" && "text-sm px-4 py-1.5",
          className
        )}
      >
        <span className="ai-status-dot h-1.5 w-1.5" />
        <Icon className={iconSizes[size]} />
        <span>{displayLabel}</span>
      </span>
    );
  }

  if (variant === "orb") {
    return (
      <div
        className={cn(
          "ai-orb rounded-full flex items-center justify-center",
          size === "sm" && "h-8 w-8",
          size === "md" && "h-12 w-12",
          size === "lg" && "h-16 w-16",
          className
        )}
        title={displayLabel}
      >
        <Icon
          className={cn(
            "relative z-10 text-white",
            size === "sm" && "h-4 w-4",
            size === "md" && "h-6 w-6",
            size === "lg" && "h-8 w-8"
          )}
        />
      </div>
    );
  }

  // inline variant
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-primary",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        size === "lg" && "text-base",
        className
      )}
    >
      <span className="ai-status-dot h-1.5 w-1.5" />
      <Icon className={iconSizes[size]} />
      <span className="font-medium">{displayLabel}</span>
    </span>
  );
}

/**
 * AI Powered Badge - Shows that a feature is AI-enhanced
 */
export function AIPoweredBadge({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "badge-ai inline-flex items-center gap-1.5",
        size === "sm" && "text-[10px] px-2 py-0.5",
        size === "md" && "text-xs px-3 py-1",
        size === "lg" && "text-sm px-4 py-1.5",
        className
      )}
    >
      <Sparkles
        className={cn(
          size === "sm" && "h-2.5 w-2.5",
          size === "md" && "h-3 w-3",
          size === "lg" && "h-4 w-4"
        )}
      />
      <span>AI Powered</span>
    </span>
  );
}

/**
 * AI Thinking Indicator - Shows AI is processing
 */
export function AIThinkingIndicator({
  className,
  message = "AI is thinking...",
}: {
  className?: string;
  message?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3",
        className
      )}
    >
      <div className="ai-orb h-8 w-8 rounded-full flex items-center justify-center">
        <Brain className="h-4 w-4 text-white relative z-10" />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{message}</span>
        <span className="text-xs text-muted-foreground">Processing your request</span>
      </div>
    </div>
  );
}

/**
 * AI Gradient Text - Text with AI gradient styling
 */
export function AIGradientText({
  children,
  className,
  as: Component = "span",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "span" | "h1" | "h2" | "h3" | "h4" | "p";
}) {
  return (
    <Component className={cn("ai-gradient-text", className)}>
      {children}
    </Component>
  );
}

/**
 * AI Card Wrapper - Wraps content with AI-styled card
 */
export function AICard({
  children,
  className,
  showIndicator = true,
}: {
  children: React.ReactNode;
  className?: string;
  showIndicator?: boolean;
}) {
  return (
    <div className={cn("ai-card p-6", className)}>
      {showIndicator && (
        <div className="absolute top-4 right-4">
          <AIIndicator variant="dot" size="sm" />
        </div>
      )}
      {children}
    </div>
  );
}
