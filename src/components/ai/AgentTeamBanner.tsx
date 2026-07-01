/**
 * AgentTeamBanner — Contextual banner showing relevant AI agent team
 * Drops into any section page to surface agents where they matter.
 */

import { useState } from "react";
import { icons, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { agentTeams } from "./agentTeamConfig";
import { AgentTeamCard } from "./AgentTeamCard";
import { cn } from "@/lib/utils";

interface AgentTeamBannerProps {
  team: keyof typeof agentTeams;
  className?: string;
}

export function AgentTeamBanner({ team, className }: AgentTeamBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const config = agentTeams[team];

  if (!config) return null;

  // Get first icons for collapsed preview
  const previewIcons = config.agents.slice(0, 4).map((a) => {
    const Icon = icons[a.icon as keyof typeof icons];
    return { icon: Icon, name: a.name };
  });

  return (
    <div
      className={cn(
        "relative rounded-2xl border border-border bg-card overflow-hidden transition-all duration-300",
        config.accentColor,
        "border-b-4",
        className
      )}
    >
      {/* Collapsed header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/30 transition-colors"
      >
        {/* Overlapping icon circles */}
        <div className="flex -space-x-2 flex-shrink-0">
          {previewIcons.map(({ icon: Icon, name }, i) => (
            <div
              key={name}
              className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm ring-2 ring-background"
              style={{
                background: `linear-gradient(135deg, hsl(${config.gradientFrom}), hsl(${config.gradientTo}))`,
                zIndex: 4 - i,
              }}
            >
              {Icon && <Icon className="h-4 w-4 text-white" />}
            </div>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            <h3 className="text-sm font-bold text-foreground truncate">{config.name}</h3>
          </div>
          <p className="text-xs text-muted-foreground truncate">{config.tagline}</p>
        </div>

        <div className="flex-shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded cards */}
      {expanded && (
        <div className="px-5 pb-5 pt-1">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {config.agents.map((agent) => (
              <AgentTeamCard
                key={agent.slug}
                agent={agent}
                gradientFrom={config.gradientFrom}
                gradientTo={config.gradientTo}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
