/**
 * Agents Browse Page — /agents
 * Bold grid of agent teams + featured individual agents
 */

import { useNavigate } from "react-router-dom";
import { icons, Sparkles, ArrowRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { allTeams, type AgentTeamDef } from "@/components/ai/agentTeamConfig";
import { useAIAgents } from "@/hooks/useAIAgents";
import { useActiveAgentThreads, type ActiveAgentThread } from "@/hooks/useActiveAgentThreads";
import { cn } from "@/lib/utils";

/* ─── Team Card ─── */

function TeamCard({ team }: { team: AgentTeamDef }) {
  const navigate = useNavigate();
  const previewIcons = team.agents.slice(0, 4).map((a) => ({
    Icon: icons[a.icon as keyof typeof icons],
    name: a.name,
  }));

  return (
    <div
      className={cn(
        "relative rounded-2xl border border-border bg-card overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer group",
        team.accentColor,
        "border-b-4"
      )}
      onClick={() => {
        document.getElementById(`team-${team.id}`)?.scrollIntoView({ behavior: "smooth" });
      }}
    >
      <div className="p-6">
        <div className="flex -space-x-3 mb-5">
          {previewIcons.map(({ Icon, name }, i) => (
            <div
              key={name}
              className="w-12 h-12 rounded-full flex items-center justify-center ring-3 ring-background shadow-md"
              style={{
                background: `linear-gradient(135deg, hsl(${team.gradientFrom}), hsl(${team.gradientTo}))`,
                zIndex: 4 - i,
              }}
            >
              {Icon && <Icon className="h-5 w-5 text-white" />}
            </div>
          ))}
        </div>

        <h3 className="text-xl font-bold text-foreground mb-1">{team.name}</h3>
        <p className="text-sm text-muted-foreground mb-4">{team.tagline}</p>

        <Button
          variant="outline"
          size="sm"
          className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
        >
          Explore Team <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

const CATEGORY_COLORS: Record<string, { from: string; to: string; badge: string }> = {
  sales: { from: "280 70% 50%", to: "330 80% 55%", badge: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300" },
  meetings: { from: "190 80% 45%", to: "210 85% 55%", badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  strategy: { from: "30 90% 50%", to: "45 95% 55%", badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  projects: { from: "150 70% 40%", to: "170 75% 50%", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  general: { from: "199 89% 48%", to: "187 100% 42%", badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300" },
};

function getCategoryStyle(category: string | null) {
  if (!category) return CATEGORY_COLORS.general;
  const lower = category.toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_COLORS)) {
    if (lower.includes(key)) return val;
  }
  return CATEGORY_COLORS.general;
}

function AgentBrowseCard({
  agent,
  activeThread,
}: {
  agent: { name: string; slug: string; description: string | null; category: string | null };
  activeThread?: ActiveAgentThread;
}) {
  const navigate = useNavigate();
  const style = getCategoryStyle(agent.category);
  const iconName = getIconForSlug(agent.slug);
  const IconComponent = icons[iconName as keyof typeof icons] || icons["Bot"];

  const continueChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeThread) return;
    navigate(
      `/admin/ai/chat?agent=${activeThread.agentId}&conversation=${activeThread.conversationId}`
    );
  };

  return (
    <div className="group relative flex flex-col rounded-2xl border border-border bg-card shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden">
      {activeThread ? (
        <div className="absolute top-3 right-3 z-10">
          <Badge className="gap-1 bg-primary text-primary-foreground shadow-sm">
            <MessageCircle className="h-3 w-3" />
            Continue chat
          </Badge>
        </div>
      ) : null}

      <div
        className="h-24 relative cursor-pointer"
        style={{
          background: `linear-gradient(135deg, hsl(${style.from}), hsl(${style.to}))`,
        }}
        onClick={() => navigate(`/agents/${agent.slug}`)}
      >
        <div className="absolute -bottom-6 left-5 w-12 h-12 rounded-full bg-foreground/90 dark:bg-card flex items-center justify-center shadow-lg ring-3 ring-background">
          {IconComponent && (
            <IconComponent className="h-6 w-6 text-primary-foreground dark:text-foreground" />
          )}
        </div>
      </div>

      <div className="pt-10 px-5 pb-5 flex flex-col flex-1 gap-2">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-lg font-semibold text-foreground leading-tight">{agent.name}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">By Control Tower</p>
          </div>
          {agent.category ? (
            <Badge variant="secondary" className={cn("text-[10px] px-2 py-0.5 font-medium", style.badge)}>
              {agent.category}
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 flex-1 mt-1">
          {agent.description || "An AI agent ready to assist you."}
        </p>

        {activeThread ? (
          <p className="text-xs text-primary font-medium">
            {activeThread.messageCount} message{activeThread.messageCount !== 1 ? "s" : ""} in
            active thread
            {activeThread.title ? ` · ${activeThread.title}` : ""}
          </p>
        ) : null}

        <div className="mt-3 flex flex-col gap-2">
          {activeThread ? (
            <Button
              size="sm"
              className="w-full font-medium"
              onClick={continueChat}
            >
              <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
              Continue conversation
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={activeThread ? "outline" : "outline"}
            className="w-full font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
            onClick={() => navigate(`/agents/${agent.slug}`)}
          >
            Learn More <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function getIconForSlug(slug: string): string {
  const map: Record<string, string> = {
    "deal-coach": "Trophy",
    "meeting-summarizer": "FileText",
    "eos-coach": "GraduationCap",
    "project-analyst": "BarChart3",
    "action-item-extractor": "ListChecks",
    "meeting-efficiency-analyzer": "Gauge",
    "client-call-analyzer": "PhoneCall",
    "deal-daily-briefing": "Newspaper",
    "quick-deal-email": "Mail",
    "deal-ai-chat": "MessageSquare",
    "eos-pattern-detective": "Search",
    "eos-pod-health": "HeartPulse",
    "eos-quarterly-digest": "CalendarRange",
    "bug-feature-planner": "Bug",
    "technical-plan-generator": "Cpu",
    "code-review-generator": "Code",
    "lead-followup-research": "Target",
  };
  return map[slug] || "Bot";
}

function TeamDetailSection({
  team,
  threadBySlug,
}: {
  team: AgentTeamDef;
  threadBySlug: Map<string, ActiveAgentThread>;
}) {
  return (
    <section id={`team-${team.id}`} className="scroll-mt-24">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, hsl(${team.gradientFrom}), hsl(${team.gradientTo}))`,
          }}
        >
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{team.name}</h2>
          <p className="text-sm text-muted-foreground">{team.tagline}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {team.agents.map((agent) => (
          <AgentBrowseCard
            key={agent.slug}
            agent={{ ...agent, category: team.id, description: agent.description }}
            activeThread={threadBySlug.get(agent.slug)}
          />
        ))}
      </div>
    </section>
  );
}

export default function AgentsBrowse() {
  const { data: dbAgents = [] } = useAIAgents();
  const { data: activeThreads } = useActiveAgentThreads();

  const threadBySlug = activeThreads ?? new Map();

  const teamSlugs = new Set(allTeams.flatMap((t) => t.agents.map((a) => a.slug)));
  const otherAgents = dbAgents.filter((a) => a.is_enabled && !teamSlugs.has(a.slug));

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Sparkles className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">AI Agents</h1>
        </div>
        <p className="text-muted-foreground text-base">
          Browse and run specialized AI agents across your workspace
        </p>
      </div>

      <section>
        <h2 className="text-lg font-bold text-foreground mb-4">Agent Teams</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {allTeams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      </section>

      {allTeams.map((team) => (
        <TeamDetailSection key={team.id} team={team} threadBySlug={threadBySlug} />
      ))}

      {otherAgents.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4">More Agents</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {otherAgents.map((agent) => (
              <AgentBrowseCard
                key={agent.id}
                agent={{
                  name: agent.name,
                  slug: agent.slug,
                  description: agent.description,
                  category: agent.category,
                }}
                activeThread={threadBySlug.get(agent.slug)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
