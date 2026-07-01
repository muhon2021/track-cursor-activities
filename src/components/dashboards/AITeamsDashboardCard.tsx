/**
 * AI Teams Dashboard Card
 *
 * Bold, gradient-styled showcase of all agent teams on the dashboard.
 * Horizontally scrollable mini-cards with overlapping icons.
 */

import { useNavigate } from "react-router-dom";
import { icons, Sparkles, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { allTeams, type AgentTeamDef } from "@/components/ai/agentTeamConfig";
import { cn } from "@/lib/utils";

type AgencyRole = "owner" | "pm" | "ic" | "bd";

const ROLE_TEAM_MAP: Record<AgencyRole, string[] | "all"> = {
  owner: "all",
  pm: ["projects", "meetings"],
  bd: ["sales"],
  ic: ["projects", "meetings"],
};

function TeamMiniCard({ team }: { team: AgentTeamDef }) {
  const navigate = useNavigate();
  const previewIcons = team.agents.slice(0, 4).map((a) => ({
    Icon: icons[a.icon as keyof typeof icons],
    name: a.name,
  }));

  return (
    <div
      onClick={() => navigate(`/agents#team-${team.id}`)}
      className={cn(
        "group relative min-w-[240px] flex-shrink-0 rounded-2xl border border-border bg-card overflow-hidden",
        "shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer",
        team.accentColor,
        "border-b-4"
      )}
    >
      {/* Gradient glow top */}
      <div
        className="h-2 w-full"
        style={{
          background: `linear-gradient(90deg, hsl(${team.gradientFrom}), hsl(${team.gradientTo}))`,
        }}
      />

      <div className="p-5">
        {/* Overlapping icons */}
        <div className="flex -space-x-2.5 mb-4">
          {previewIcons.map(({ Icon, name }, i) => (
            <div
              key={name}
              className="w-10 h-10 rounded-full flex items-center justify-center ring-2 ring-background shadow-md transition-transform group-hover:scale-105"
              style={{
                background: `linear-gradient(135deg, hsl(${team.gradientFrom}), hsl(${team.gradientTo}))`,
                zIndex: 4 - i,
              }}
            >
              {Icon && <Icon className="h-4 w-4 text-white" />}
            </div>
          ))}
        </div>

        <h4 className="text-sm font-bold text-foreground leading-tight">{team.name}</h4>
        <p className="text-xs text-muted-foreground mt-0.5 mb-3">{team.agents.length} agents</p>

        <span className="text-xs font-medium text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
          Explore <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}

export function AITeamsDashboardCard({ className, agencyRole }: { className?: string; agencyRole?: AgencyRole }) {
  const navigate = useNavigate();

  const filteredTeams = agencyRole
    ? ROLE_TEAM_MAP[agencyRole] === "all"
      ? allTeams
      : allTeams.filter((t) => (ROLE_TEAM_MAP[agencyRole] as string[]).includes(t.id))
    : allTeams;

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-primary/20",
        className
      )}
    >
      {/* Subtle gradient border glow */}
      <div className="absolute inset-0 rounded-lg opacity-[0.03] pointer-events-none"
        style={{
          background: "linear-gradient(135deg, hsl(199 89% 48%), hsl(280 70% 50%), hsl(330 80% 55%))",
        }}
      />

      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          Your AI Team
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {filteredTeams.reduce((sum, t) => sum + t.agents.length, 0)} specialized agents across {filteredTeams.length} teams
        </p>
      </CardHeader>

      <CardContent>
        {/* Horizontal scroll container */}
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
          {filteredTeams.map((team) => (
            <TeamMiniCard key={team.id} team={team} />
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="mt-4 text-primary font-medium hover:text-primary"
          onClick={() => navigate("/agents")}
        >
          Browse All Agents <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
