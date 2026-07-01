import { Link } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { AIIndicator } from "@/components/ui/ai-indicator";
import { MapPin, ArrowRight } from "lucide-react";

interface AgentContext {
  whatIDo: string;
  whereToUseMe: string;
  link: string;
}

const AGENT_CONTEXT_MAP: Record<string, AgentContext> = {
  "meeting-summarizer": {
    whatIDo: "Summarizes your meetings automatically from transcripts",
    whereToUseMe: "Open any meeting with a transcript",
    link: "/meetings/transcripts",
  },
  "meeting-action-extractor": {
    whatIDo: "Pulls action items from meeting transcripts",
    whereToUseMe: "Meeting detail page → Takeaways tab",
    link: "/meetings/transcripts",
  },
  "meeting-followup-generator": {
    whatIDo: "Drafts follow-up emails after your meetings",
    whereToUseMe: "Meeting detail page",
    link: "/meetings/transcripts",
  },
  "meeting-prep-assistant": {
    whatIDo: "Creates briefing docs before meetings",
    whereToUseMe: "Meeting schedule → upcoming meetings",
    link: "/meetings/schedule",
  },
  "meeting-categorizer": {
    whatIDo: "Auto-categorizes your meeting types",
    whereToUseMe: "Runs automatically on new meetings",
    link: "/meetings/transcripts",
  },
  "meeting-transcript-analyzer": {
    whatIDo: "Deep analysis of transcript insights",
    whereToUseMe: "Meeting detail → Transcript tab",
    link: "/meetings/transcripts",
  },
  "meeting-efficiency-coach": {
    whatIDo: "Analyzes your meeting time patterns",
    whereToUseMe: "Meeting schedule overview",
    link: "/meetings/schedule",
  },
  "meeting-client-matcher": {
    whatIDo: "Matches meetings to clients and deals",
    whereToUseMe: "Pending assignments page",
    link: "/meetings/pending-assignments",
  },
  "deal-coach": {
    whatIDo: "Helps with deal strategy and drafting emails",
    whereToUseMe: "Deals pipeline",
    link: "/deals",
  },
  "operations-advisor": {
    whatIDo: "Analyzes team productivity trends",
    whereToUseMe: "Operations dashboard",
    link: "/admin/ai/agents",
  },
  "knowledge-search": {
    whatIDo: "Searches your knowledge base with AI",
    whereToUseMe: "Knowledge base",
    link: "/knowledge",
  },
  "eos-coach": {
    whatIDo: "Guides EOS processes — L10s, rocks, and more",
    whereToUseMe: "Strategy section",
    link: "/admin/ai/agents",
  },
  "project-analyst": {
    whatIDo: "Analyzes project health and flags risks",
    whereToUseMe: "Projects section",
    link: "/admin/ai/agents",
  },
  "client-mood-analyzer": {
    whatIDo: "Reads client engagement mood signals",
    whereToUseMe: "Lead follow-up or contact detail",
    link: "/lead-followup",
  },
  "email-draft-assistant": {
    whatIDo: "Drafts professional follow-up emails",
    whereToUseMe: "Lead follow-up email workflow",
    link: "/lead-followup",
  },
  "email-draft-generator": {
    whatIDo: "Generates email content for outreach",
    whereToUseMe: "Lead follow-up email workflow",
    link: "/lead-followup",
  },
};

interface AIAgentGuidePopoverProps {
  agent: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    avatar: string | null;
  };
}

export function AIAgentGuidePopover({ agent }: AIAgentGuidePopoverProps) {
  const context = AGENT_CONTEXT_MAP[agent.slug];

  const fallback: AgentContext = {
    whatIDo: agent.description || "AI-powered assistant",
    whereToUseMe: "Browse AI Agents to learn more",
    link: "/ai-agents",
  };

  const ctx = context || fallback;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="group flex w-full items-start gap-3 rounded-lg border border-border/50 p-4 text-left transition-all duration-200 hover:border-primary/30 hover:bg-primary/[0.02] hover:shadow-sm"
        >
          <div className="relative shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg ai-gradient text-white text-sm font-semibold">
              {agent.avatar ? (
                <img src={agent.avatar} alt={agent.name} className="h-full w-full rounded-lg object-cover" />
              ) : (
                agent.name.charAt(0).toUpperCase()
              )}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 ai-status-dot h-2.5 w-2.5 rounded-full border-2 border-background" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{agent.name}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {agent.description || "AI Assistant"}
            </p>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 border-primary/20 bg-gradient-to-b from-primary/[0.03] to-background p-0"
        sideOffset={8}
      >
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg ai-gradient text-white text-sm font-semibold shrink-0">
              {agent.avatar ? (
                <img src={agent.avatar} alt={agent.name} className="h-full w-full rounded-lg object-cover" />
              ) : (
                agent.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{agent.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <AIIndicator variant="dot" size="sm" status="active" />
                <span className="text-xs text-muted-foreground">Active</span>
              </div>
            </div>
          </div>

          {/* What I do */}
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground mb-0.5">What I do</p>
            <p className="text-sm text-foreground">{ctx.whatIDo}</p>
          </div>

          {/* Where to use me */}
          <div className="flex items-start gap-2 rounded-md border border-primary/10 bg-primary/[0.02] px-3 py-2">
            <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-0.5">Where to use me</p>
              <p className="text-sm text-foreground">{ctx.whereToUseMe}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
            <Button asChild size="sm" className="ai-gradient border-0 text-white w-full hover:opacity-90">
              <Link to={ctx.link} className="gap-2">
                Go There
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
