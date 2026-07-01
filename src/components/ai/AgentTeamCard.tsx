/**
 * AgentTeamCard — Bold gradient card for individual agents
 */

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { icons } from "lucide-react";
import type { AgentTeamAgent } from "./agentTeamConfig";

interface AgentTeamCardProps {
  agent: AgentTeamAgent;
  gradientFrom: string;
  gradientTo: string;
}

export function AgentTeamCard({ agent, gradientFrom, gradientTo }: AgentTeamCardProps) {
  const navigate = useNavigate();
  const IconComponent = icons[agent.icon as keyof typeof icons];

  return (
    <div className="group relative flex flex-col rounded-2xl border border-border bg-card shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden min-w-[220px] max-w-[260px] flex-shrink-0">
      {/* Gradient header */}
      <div
        className="h-20 relative"
        style={{
          background: `linear-gradient(135deg, hsl(${gradientFrom}), hsl(${gradientTo}))`,
        }}
      >
        {/* Icon circle overlapping header/body */}
        <div className="absolute -bottom-5 left-4 w-10 h-10 rounded-full bg-foreground/90 dark:bg-card flex items-center justify-center shadow-lg ring-2 ring-background">
          {IconComponent && (
            <IconComponent className="h-5 w-5 text-primary-foreground dark:text-foreground" />
          )}
        </div>
      </div>

      {/* Body */}
      <div className="pt-8 px-4 pb-4 flex flex-col flex-1 gap-2">
        <h4 className="text-base font-semibold text-foreground leading-tight">{agent.name}</h4>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
          {agent.description}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-2 w-full text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
          onClick={() => navigate(`/agents/${agent.slug}`)}
        >
          Learn More →
        </Button>
      </div>
    </div>
  );
}
