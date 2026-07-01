import { Sparkles, ArrowRight, MessageSquare, Video, Target, FolderSearch, Compass, Mail, BarChart3, MapPin } from "lucide-react";
import { AIIndicator, AIGradientText } from "@/components/ui/ai-indicator";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const AI_AGENTS = [
  {
    name: "Meeting Summarizer",
    avatar: "📝",
    quote: "I turn your meetings into structured summaries with key decisions and next steps.",
    section: "Meetings Hub",
    icon: Video,
  },
  {
    name: "Action Item Extractor",
    avatar: "✅",
    quote: "I pull tasks and deadlines from your transcripts — nothing falls through the cracks.",
    section: "Meetings Hub",
    icon: Target,
  },
  {
    name: "Deal Coach",
    avatar: "💼",
    quote: "I help you close deals faster with strategy insights and objection handling.",
    section: "Sales Hub",
    icon: MessageSquare,
  },
  {
    name: "Project Analyst",
    avatar: "📊",
    quote: "I flag project risks and budget overruns before they become real problems.",
    section: "Work Management",
    icon: BarChart3,
  },
  {
    name: "Knowledge Search",
    avatar: "🔍",
    quote: "I find answers across your entire knowledge base in seconds — just ask.",
    section: "Knowledge",
    icon: FolderSearch,
  },
  {
    name: "EOS Coach",
    avatar: "🏗️",
    quote: "I guide your team through L10s, quarterly rocks, and the IDS process.",
    section: "Strategy",
    icon: Compass,
  },
  {
    name: "Email Drafter",
    avatar: "📧",
    quote: "I draft personalized follow-up emails that actually get replies.",
    section: "Sales Hub",
    icon: Mail,
  },
  {
    name: "Operations Advisor",
    avatar: "🧠",
    quote: "I spot productivity patterns and recommend where your team can improve.",
    section: "Operations",
    icon: BarChart3,
  },
];

export function AITeamShowcase() {
  return (
    <section className="relative overflow-hidden border-t border-border/30 bg-muted/30 py-24 lg:py-32">
      {/* Subtle background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Section Header */}
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">Always On</span>
          </div>
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-foreground lg:text-5xl">
            Meet Your{" "}
            <AIGradientText as="span" className="font-bold">
              AI Team
            </AIGradientText>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            They live inside your workflow — ready when you are. Each agent is a specialist, 
            embedded exactly where you need them.
          </p>
        </div>

        {/* Agent Grid */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
          {AI_AGENTS.map((agent) => (
            <div
              key={agent.name}
              className="group relative rounded-2xl border border-border/50 bg-card p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 lg:p-6"
            >
              {/* Active indicator */}
              <div className="absolute right-3 top-3">
                <AIIndicator variant="dot" status="active" size="sm" />
              </div>

              {/* Avatar */}
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-2xl transition-transform duration-300 group-hover:scale-110 lg:h-16 lg:w-16 lg:text-3xl">
                {agent.avatar}
              </div>

              {/* Name */}
              <h3 className="mb-2 text-sm font-bold text-foreground lg:text-base">
                {agent.name}
              </h3>

              {/* Quote */}
              <p className="mb-4 text-xs leading-relaxed text-muted-foreground lg:text-sm">
                "{agent.quote}"
              </p>

              {/* Section tag */}
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-primary/70 lg:text-xs">
                <MapPin className="h-3 w-3" />
                <span>{agent.section}</span>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <Button
            size="lg"
            className="rounded-full px-8 font-semibold"
            asChild
          >
            <Link to="/login">
              See All Agents
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
