/**
 * Agent Team Configuration
 *
 * Static mapping of agent teams to sections. Each team has a set of agents
 * with Lucide icon names, descriptions, and gradient colors.
 */

export interface AgentTeamAgent {
  name: string;
  slug: string;
  description: string;
  icon: string; // Lucide icon name
  capabilities?: string[];
  howToUse?: string[];
  whereToFind?: { label: string; path: string };
}

export interface AgentTeamDef {
  id: string;
  name: string;
  tagline: string;
  accentColor: string; // Tailwind border color class
  gradientFrom: string; // HSL values for gradient start
  gradientTo: string; // HSL values for gradient end
  agents: AgentTeamAgent[];
}

export const agentTeams: Record<string, AgentTeamDef> = {
  sales: {
    id: "sales",
    name: "Sales Intelligence Team",
    tagline: "AI agents that help you close deals faster",
    accentColor: "border-b-red-500",
    gradientFrom: "280 70% 50%",
    gradientTo: "330 80% 55%",
    agents: [
      {
        name: "Deal Coach",
        slug: "deal-coach",
        description: "Get real-time coaching and strategy suggestions for your active deals",
        icon: "Trophy",
        capabilities: [
          "Analyzes your deal pipeline and suggests next-best actions",
          "Identifies at-risk deals before they stall",
          "Provides competitor insights and objection-handling tips",
          "Drafts personalized outreach strategies per deal stage",
        ],
        howToUse: [
          "Navigate to the Deals page from the sidebar",
          "Open any active deal to see its detail view",
          "Click the 'AI Coach' button or ask a question in the deal chat",
          "Review strategy suggestions and apply them to your workflow",
        ],
        whereToFind: { label: "Deals Pipeline", path: "/deals" },
      },
      {
        name: "Daily Briefing",
        slug: "deal-daily-briefing",
        description: "Start your day with an AI-curated summary of pipeline changes",
        icon: "Newspaper",
        capabilities: [
          "Summarizes overnight pipeline movement and new leads",
          "Highlights deals approaching close date",
          "Flags stalled deals that need attention",
          "Provides revenue forecast updates",
        ],
        howToUse: [
          "Open the AI Hub from the sidebar",
          "Select 'Daily Briefing' from the Sales Intelligence team",
          "Click 'Run Agent' to generate today's briefing",
          "Review key changes and take action directly from suggestions",
        ],
        whereToFind: { label: "AI Hub", path: "/ai-agents" },
      },
      {
        name: "Quick Deal Email",
        slug: "quick-deal-email",
        description: "Draft personalized follow-up emails in seconds",
        icon: "Mail",
        capabilities: [
          "Generates context-aware follow-up emails based on deal history",
          "Adapts tone and style to match your communication patterns",
          "Includes relevant deal details and talking points automatically",
          "Supports multiple email templates: intro, follow-up, close attempt",
        ],
        howToUse: [
          "Open a deal or contact detail page",
          "Click the 'Quick Email' or 'Draft Email' button",
          "Review the AI-generated draft and customize as needed",
          "Send directly or copy to your email client",
        ],
        whereToFind: { label: "Deals & Contacts", path: "/deals" },
      },
      {
        name: "Deal AI Chat",
        slug: "deal-ai-chat",
        description: "Ask anything about your deals, clients, and pipeline",
        icon: "MessageSquare",
        capabilities: [
          "Answers questions about deal status, history, and contacts",
          "Cross-references information across your entire pipeline",
          "Provides data-driven insights on win rates and patterns",
          "Helps prepare for client meetings with deal context",
        ],
        howToUse: [
          "Navigate to AI Hub → Sales Intelligence Team",
          "Select 'Deal AI Chat' to start a conversation",
          "Ask questions like 'What deals are closing this month?'",
          "Use follow-up questions to drill deeper into insights",
        ],
        whereToFind: { label: "AI Hub", path: "/ai-agents" },
      },
    ],
  },
  meetings: {
    id: "meetings",
    name: "Meeting AI Team",
    tagline: "Never miss a detail from any meeting again",
    accentColor: "border-b-blue-500",
    gradientFrom: "190 80% 45%",
    gradientTo: "210 85% 55%",
    agents: [
      {
        name: "Meeting Summarizer",
        slug: "meeting-summarizer",
        description: "Get concise, actionable summaries from any meeting transcript",
        icon: "FileText",
        capabilities: [
          "Generates executive summaries from raw meeting transcripts",
          "Extracts key decisions made during the meeting",
          "Identifies participants and their contributions",
          "Creates structured notes organized by topic",
        ],
        howToUse: [
          "Go to Meetings → Transcripts from the sidebar",
          "Open any meeting that has a transcript uploaded",
          "Click 'Summarize' to generate an AI summary",
          "Review the summary and share it with your team",
        ],
        whereToFind: { label: "Meeting Transcripts", path: "/meetings/transcripts" },
      },
      {
        name: "Action Extractor",
        slug: "action-item-extractor",
        description: "Automatically pull action items and assign owners",
        icon: "ListChecks",
        capabilities: [
          "Scans transcripts for commitments and to-dos",
          "Identifies who is responsible for each action item",
          "Sets suggested deadlines based on conversation context",
          "Exports action items to your task management system",
        ],
        howToUse: [
          "Open a meeting detail page with a transcript",
          "Navigate to the 'Takeaways' tab",
          "Click 'Extract Actions' to pull all action items",
          "Review, edit owners, and convert to tasks",
        ],
        whereToFind: { label: "Meeting Detail → Takeaways", path: "/meetings/transcripts" },
      },
      {
        name: "Efficiency Analyzer",
        slug: "meeting-efficiency-analyzer",
        description: "Analyze meeting quality and get tips to improve",
        icon: "Gauge",
        capabilities: [
          "Scores meeting efficiency based on structure and outcomes",
          "Identifies time wasted on off-topic discussions",
          "Suggests optimal meeting duration and agenda structure",
          "Tracks improvement trends over time",
        ],
        howToUse: [
          "Navigate to AI Hub → Meeting AI Team",
          "Select 'Efficiency Analyzer' and run it",
          "Provide a meeting transcript or select recent meetings",
          "Review the efficiency report with actionable recommendations",
        ],
        whereToFind: { label: "AI Hub", path: "/ai-agents" },
      },
      {
        name: "Client Call Analyzer",
        slug: "client-call-analyzer",
        description: "Deep-dive analysis of client conversations and sentiment",
        icon: "PhoneCall",
        capabilities: [
          "Analyzes sentiment shifts throughout client calls",
          "Detects upsell and cross-sell opportunities",
          "Flags potential churn signals early",
          "Provides talk-to-listen ratio analysis",
        ],
        howToUse: [
          "Open a client-tagged meeting transcript",
          "Click 'Analyze Call' to run deep analysis",
          "Review sentiment timeline and key moments",
          "Use insights to plan your next client interaction",
        ],
        whereToFind: { label: "Meeting Transcripts", path: "/meetings/transcripts" },
      },
    ],
  },
  eos: {
    id: "eos",
    name: "Strategy AI Team",
    tagline: "AI-powered strategic planning and execution",
    accentColor: "border-b-amber-500",
    gradientFrom: "30 90% 50%",
    gradientTo: "45 95% 55%",
    agents: [
      {
        name: "EOS Coach",
        slug: "eos-coach",
        description: "Get guidance on implementing EOS methodology",
        icon: "GraduationCap",
        capabilities: [
          "Guides you through EOS processes like L10 meetings and rocks",
          "Helps identify and resolve organizational issues using the IDS method",
          "Provides templates for VTO, accountability charts, and scorecards",
          "Coaches on proper meeting cadence and quarterly planning",
        ],
        howToUse: [
          "Navigate to the Strategy section in the sidebar",
          "Open any EOS tool — Rocks, Scorecard, or Issues",
          "Click the AI Coach button for contextual guidance",
          "Ask questions about EOS methodology and best practices",
        ],
        whereToFind: { label: "Strategy Section", path: "/eos" },
      },
      {
        name: "Pattern Detective",
        slug: "eos-pattern-detective",
        description: "Identify recurring patterns in your organizational issues",
        icon: "Search",
      },
      {
        name: "Pod Health",
        slug: "eos-pod-health",
        description: "Analyze team health metrics and get improvement suggestions",
        icon: "HeartPulse",
      },
      {
        name: "Quarterly Digest",
        slug: "eos-quarterly-digest",
        description: "Generate comprehensive quarterly performance reports",
        icon: "CalendarRange",
      },
    ],
  },
  projects: {
    id: "projects",
    name: "Project AI Team",
    tagline: "Smarter project management with AI assistance",
    accentColor: "border-b-emerald-500",
    gradientFrom: "150 70% 40%",
    gradientTo: "170 75% 50%",
    agents: [
      {
        name: "Project Analyst",
        slug: "project-analyst",
        description: "Get insights on project health, risks, and resource allocation",
        icon: "BarChart3",
        capabilities: [
          "Monitors project health across timeline, budget, and scope",
          "Flags at-risk projects with early warning indicators",
          "Analyzes resource utilization and suggests reallocation",
          "Generates project status reports for stakeholders",
        ],
        howToUse: [
          "Go to Projects from the main sidebar",
          "Open any active project to view its dashboard",
          "Click 'AI Analysis' to generate a health report",
          "Review risk scores and recommended actions",
        ],
        whereToFind: { label: "Projects Section", path: "/projects" },
      },
      {
        name: "Bug & Feature Planner",
        slug: "bug-feature-planner",
        description: "Organize and prioritize bugs and feature requests",
        icon: "Bug",
      },
      {
        name: "Technical Planner",
        slug: "technical-plan-generator",
        description: "Generate detailed technical implementation plans",
        icon: "Cpu",
      },
      {
        name: "Code Reviewer",
        slug: "code-review-generator",
        description: "AI-powered code review suggestions and best practices",
        icon: "Code",
      },
    ],
  },
};

export const allTeams = Object.values(agentTeams);

/** Find which team an agent belongs to by slug */
export function findTeamForAgent(slug: string): AgentTeamDef | undefined {
  return allTeams.find((t) => t.agents.some((a) => a.slug === slug));
}

/** Find an agent definition by slug across all teams */
export function findAgentBySlug(slug: string): { agent: AgentTeamAgent; team: AgentTeamDef } | undefined {
  for (const team of allTeams) {
    const agent = team.agents.find((a) => a.slug === slug);
    if (agent) return { agent, team };
  }
  return undefined;
}
