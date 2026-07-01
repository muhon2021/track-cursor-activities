/**
 * Email Drafting Performance – Admin AI Hub.
 * Route: /admin/ai/email-drafting
 * Agent email drafting success metrics powered by memory personalization.
 * Top metrics and "Emails Using Memory" use real data from ai_agent_runs.
 */
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Mail,
  CheckCircle2,
  TrendingUp,
  Users,
  BarChart3,
  Lightbulb,
  ArrowUpRight,
  AlertCircle,
} from "lucide-react";
import {
  useEmailDraftingStats,
  type EmailDraftingStatsDateRange,
} from "@/hooks/useEmailDraftingStats";

const DATE_RANGE_OPTIONS: { value: EmailDraftingStatsDateRange; label: string }[] = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

const TOP_METRIC_CONFIG = [
  {
    key: "drafts" as const,
    title: "Email Drafts",
    description: "Using agent memory",
    icon: Mail,
    iconBg: "bg-info/10 text-info dark:bg-blue-950/50 dark:text-blue-400",
  },
  {
    key: "successRate" as const,
    title: "Success Rate",
    descriptionKey: "positiveOutcomes" as const,
    icon: CheckCircle2,
    iconBg: "bg-success/10 text-success dark:bg-green-950/50 dark:text-green-400",
  },
  {
    key: "responseBoost" as const,
    title: "Response Boost",
    description: "vs. non-personalized",
    icon: TrendingUp,
    iconBg: "bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400",
  },
  {
    key: "avgOpenRate" as const,
    title: "Avg Open Rate",
    description: "Template-based drafts",
    icon: Users,
    iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400",
  },
];

const PERSONALIZATION_ROWS = [
  { metric: "Open Rate", baseline: "28%", personalized: "42%", change: "+50%" },
  { metric: "Response Rate", baseline: "14%", personalized: "28%", change: "+100%" },
  { metric: "Reply Time", baseline: "6.2 hrs", personalized: "4.2 hrs", change: "-32%" },
  { metric: "Emails Using Memory", baseline: "N/A", personalized: "80%", change: null, recommended: true },
];

const MEMORY_PATTERNS = [
  {
    title: "User Writing Style",
    description: "Personalized tone and formatting preferences",
    pct: "78% of drafts",
    benefit: "Improves consistency",
  },
  {
    title: "Client Profile",
    description: "Company, industry, decision-making style",
    pct: "82% of drafts",
    benefit: "65% better relevance",
  },
  {
    title: "Competitor Context",
    description: "Common competitor concerns and talking points",
    pct: "64% of drafts",
    benefit: "3.2x engagement",
  },
  {
    title: "Team Pattern",
    description: "Winning themes from similar deals",
    pct: "71% of drafts",
    benefit: "42% faster closes",
  },
  {
    title: "Email Draft History",
    description: "Previous successful emails to same client",
    pct: "56% of drafts",
    benefit: "Higher trust scores",
  },
  {
    title: "Effectiveness Patterns",
    description: "Question-based vs statement openings",
    pct: "47% of drafts",
    benefit: "34% more opens",
  },
];

const AGENT_CAPABILITIES = [
  { title: "Personalized Opening", description: "Adapts to client communication style", enabled: true },
  { title: "Competitor Positioning", description: "Auto-include relevant competitive differentiation", enabled: true },
  { title: "Subject Line A/B", description: "Suggests multiple subject line variations", enabled: true },
  { title: "Industry-Specific Language", description: "Uses vertical-specific terminology", enabled: true },
  { title: "Team Learning Integration", description: "Applies winning patterns from team", enabled: true },
  { title: "Send Time Optimization", description: "Suggests optimal send time by role/timezone", enabled: false },
];

const OPTIMIZATION_RECOMMENDATIONS = [
  {
    title: "CFO Outreach Strategy",
    description: "Questions outperform statements for finance leaders",
    action: "Use 'Have you considered...' opens",
    priority: "High" as const,
  },
  {
    title: "Tech Industry Timing",
    description: "Tuesday-Thursday emails get 40% faster responses",
    action: "Schedule for mid-week",
    priority: "High" as const,
  },
  {
    title: "Follow-up Cadence",
    description: "3-day gap maximizes response rate (28% avg)",
    action: "Schedule follow-ups automatically",
    priority: "Medium" as const,
  },
  {
    title: "Personalization Depth",
    description: "3+ specific references increase engagement 45%",
    action: "Encourage detailed client profiling",
    priority: "High" as const,
  },
];

export default function EmailDraftingPerformance(): JSX.Element {
  const [dateRange, setDateRange] = useState<EmailDraftingStatsDateRange>(30);
  const { data: stats, isLoading } = useEmailDraftingStats(dateRange);

  const emailDraftsCount = stats?.emailDraftsCount ?? 0;
  const successRatePct = stats?.successRatePct ?? 0;
  const positiveOutcomes = stats?.positiveOutcomes ?? 0;
  const responseBoostPct = stats?.responseBoostPct ?? null;
  const avgOpenRatePct = stats?.avgOpenRatePct ?? null;
  const draftsWithMemory = stats?.draftsWithMemoryEnabledAgent ?? 0;
  const emailsUsingMemoryPct =
    emailDraftsCount > 0
      ? Math.round((draftsWithMemory / emailDraftsCount) * 100)
      : null;

  const topMetricValues = {
    drafts: String(emailDraftsCount),
    successRate: `${successRatePct}%`,
    responseBoost: responseBoostPct != null ? `${responseBoostPct}%` : "—",
    avgOpenRate: avgOpenRatePct != null ? `${avgOpenRatePct}%` : "—",
  };
  const topMetricDescriptions: Record<string, string> = {
    positiveOutcomes: `${positiveOutcomes} positive outcomes`,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            Email Drafting Performance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Agent email drafting success metrics powered by memory personalization.
          </p>
        </div>
        <Select
          value={String(dateRange)}
          onValueChange={(v) => setDateRange(Number(v) as EmailDraftingStatsDateRange)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Top metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-20" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-12 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))
          : TOP_METRIC_CONFIG.map((m) => (
              <Card key={m.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardDescription>{m.title}</CardDescription>
                  <div className={`rounded-full p-2 ${m.iconBg}`}>
                    <m.icon className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {topMetricValues[m.key]}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {"descriptionKey" in m && m.descriptionKey
                      ? topMetricDescriptions[m.descriptionKey]
                      : m.description}
                  </p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Personalization Impact + Performance by Recipient Role */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Personalization Impact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {PERSONALIZATION_ROWS.map((row) => {
              const personalizedValue =
                row.metric === "Emails Using Memory" && emailsUsingMemoryPct != null
                  ? `${emailsUsingMemoryPct}%`
                  : row.personalized;
              return (
              <div
                key={row.metric}
                className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <span className="text-sm font-medium text-foreground">{row.metric}</span>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">Baseline: {row.baseline}</span>
                  <span className="text-success dark:text-green-400 font-medium">
                    {personalizedValue}
                    {row.recommended && (
                      <Badge className="ml-2 bg-success/10 text-success dark:bg-green-950/50 dark:text-green-300 border-0">
                        Recommended
                      </Badge>
                    )}
                  </span>
                  {row.change && (
                    <span className="text-success dark:text-green-400 font-medium">
                      {row.change}
                    </span>
                  )}
                </div>
              </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Performance by Recipient Role
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
              Chart or table by recipient role (placeholder)
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Emails Using Memory + Email Memory Patterns */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card px-4 py-3 shadow-sm">
          <span className="text-sm font-medium text-foreground">Emails Using Memory</span>
          <span className="text-muted-foreground">Baseline: N/A</span>
          {isLoading ? (
            <Skeleton className="h-5 w-16" />
          ) : (
            <span className="text-success dark:text-green-400 font-semibold">
              Personalized: {emailsUsingMemoryPct != null ? `${emailsUsingMemoryPct}%` : "—"}
            </span>
          )}
          <Badge className="bg-success/10 text-success dark:bg-green-950/50 dark:text-green-300 border-0">
            Recommended
          </Badge>
        </div>
        <h2 className="text-lg font-semibold tracking-tight">Email Memory Patterns</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MEMORY_PATTERNS.map((p) => (
            <Card key={p.title} className="bg-muted/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{p.title}</CardTitle>
                <CardDescription className="text-xs">{p.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <div className="flex items-center gap-2 text-sm text-primary font-medium">
                  <BarChart3 className="h-3.5 w-3.5" />
                  {p.pct}
                </div>
                <div className="flex items-center gap-2 text-sm text-success dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {p.benefit}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Performance by Industry: Agent Capabilities + Optimization Recommendations */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Performance by Industry</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="rounded-full bg-success/10 p-1.5 dark:bg-green-950/50">
                  <CheckCircle2 className="h-4 w-4 text-success dark:text-green-400" />
                </div>
                Agent Capabilities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {AGENT_CAPABILITIES.map((c, i) => (
                <div
                  key={c.title}
                  className={`flex items-start gap-3 py-3 ${i < AGENT_CAPABILITIES.length - 1 ? "border-b border-border" : ""}`}
                >
                  {c.enabled ? (
                    <div className="rounded-full bg-success/10 p-1 dark:bg-green-950/50 shrink-0 mt-0.5">
                      <CheckCircle2 className="h-4 w-4 text-success dark:text-green-400" />
                    </div>
                  ) : (
                    <div className="rounded-full bg-info/10 p-1 dark:bg-blue-950/50 shrink-0 mt-0.5">
                      <ArrowUpRight className="h-4 w-4 text-info dark:text-blue-400" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-sm text-foreground">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{c.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="rounded-full bg-amber-100 p-1.5 dark:bg-amber-950/50">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                Optimization Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[340px] overflow-y-auto">
              {OPTIMIZATION_RECOMMENDATIONS.map((r) => (
                <div
                  key={r.title}
                  className="rounded-lg border border-border bg-muted/20 p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm text-foreground">{r.title}</p>
                    <Badge
                      variant={r.priority === "High" ? "default" : "secondary"}
                      className={
                        r.priority === "High"
                          ? "bg-success text-primary-foreground border-0 shrink-0"
                          : "bg-amber-600 text-primary-foreground border-0 shrink-0"
                      }
                    >
                      {r.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.description}</p>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <Lightbulb className="h-3.5 w-3.5" />
                    {r.action}
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
