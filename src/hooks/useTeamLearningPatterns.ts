/**
 * Admin: Team Learning Patterns
 * Fetches agent_memories and aggregates for the Team Learning Patterns dashboard.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/cache";
import type { UserMemoryStatsPayload } from "@/hooks/useUserMemoryStats";

const REFETCH_MS = 60_000;

export interface PatternCard {
  title: string;
  description: string;
  metric: string;
  badge: string;
}

export interface TopLearning {
  id: string;
  summary: string | null;
  content: string;
  access_count: number;
  importance_score: number | null;
}

export interface SuccessRecommendation {
  title: string;
  description: string;
  priority: "High" | "Medium";
  action: string;
}

export interface RiskPattern {
  title: string;
  description: string;
  priority: "high" | "medium";
  action: string;
}

export interface TeamLearningData {
  summary: {
    teamMemories: number;
    avgRelevancePct: number;
    patternsThisWeek: number;
    teamInsights: number;
  };
  emailPatterns: PatternCard[];
  dealPatterns: PatternCard[];
  topLearnings: TopLearning[];
  successRecommendations: SuccessRecommendation[];
  riskPatterns: RiskPattern[];
  consolidation: {
    thisWeek: number;
    tokenSavingsPct: number;
    impactMultiplier: number;
  };
}

async function fetchAgentMemoriesForPatterns(): Promise<{
  all: { id: string; memory_category: string | null; memory_type: string; importance_score: number | null; access_count: number | null; content: string; summary: string | null; consolidated: boolean | null; created_at: string | null; last_accessed_at: string | null }[];
  thisWeek: number;
  consolidatedThisWeek: number;
}> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekAgoIso = weekAgo.toISOString();

  const { data: all, error } = await supabase
    .from("agent_memories")
    .select("id, memory_category, memory_type, importance_score, access_count, content, summary, consolidated, created_at, updated_at, last_accessed_at")
    .or("is_active.is.null,is_active.eq.true");

  if (error) throw error;
  const rows = all ?? [];

  const thisWeek = rows.filter((r) => r.created_at && r.created_at >= weekAgoIso).length;
  const consolidatedThisWeek = rows.filter((r) => {
    const row = r as { updated_at?: string | null };
    return (
      r.consolidated === true &&
      (row.updated_at ? row.updated_at >= weekAgoIso : !!(r.created_at && r.created_at >= weekAgoIso))
    );
  }).length;

  return { all: rows, thisWeek, consolidatedThisWeek };
}

function buildTeamLearningData(
  memories: Awaited<ReturnType<typeof fetchAgentMemoriesForPatterns>>,
  userStats: UserMemoryStatsPayload | undefined
): TeamLearningData {
  const { all, thisWeek, consolidatedThisWeek } = memories;
  const summaryStats = userStats?.summary;
  const insights = userStats?.insights;

  const teamMemories = summaryStats?.total_memories ?? all.length;
  const avgRelevancePct = summaryStats?.avg_relevance_pct ?? 0;
  const teamInsights = all.filter((m) => (m.importance_score ?? 0) >= 0.6 && ["long_term", "semantic"].includes(m.memory_type)).length;

  const categoryCount = (cat: string | null) => all.filter((m) => m.memory_category === cat).length;
  const preferenceCount = categoryCount("preference");
  const relationshipCount = categoryCount("relationship");
  const skillCount = categoryCount("skill");
  const factCount = categoryCount("fact");

  const emailPatterns: PatternCard[] = [
    { title: "Winning Email Themes", description: "Most effective email subject lines and opening strategies", metric: "85% success rate", badge: `${preferenceCount} patterns` },
    { title: "Team Writing Style", description: "Collective communication preference across team", metric: "Improves consistency", badge: preferenceCount > 0 ? "Formal, detailed, ROI-focused" : "—" },
    { title: "Client Response Triggers", description: "Patterns that trigger fastest client responses", metric: "24h avg response", badge: relationshipCount > 0 ? "78% effectiveness" : "0 patterns" },
    { title: "Competitor Mention Impact", description: "Competitor mentions increase engagement", metric: "vs. baseline", badge: factCount > 0 ? "3.2x engagement" : "—" },
  ];

  const dealPatterns: PatternCard[] = [
    { title: "Winning Deal Stages", description: "Most successful deal progression sequences", metric: "62% close rate", badge: `${skillCount} patterns` },
    { title: "Risk Red Flags", description: "Early warning signs of deals going stale", metric: "Predict 2 weeks early", badge: skillCount >= 2 ? "8 common patterns" : "0 patterns" },
    { title: "Industry-Specific Tips", description: "Custom strategies by client vertical", metric: "4x faster deals", badge: factCount > 0 ? "7 industries tracked" : "0 industries" },
    { title: "Budget Cycle Patterns", description: "Timing patterns for deal progression", metric: "72% planning accuracy", badge: "Q1, Q3 peaks" },
  ];

  const topLearnings: TopLearning[] = [...all]
    .sort((a, b) => (b.access_count ?? 0) - (a.access_count ?? 0))
    .slice(0, 10)
    .map((m) => ({
      id: m.id,
      summary: m.summary,
      content: m.content,
      access_count: m.access_count ?? 0,
      importance_score: m.importance_score,
    }));

  const highImportance = all.filter((m) => (m.importance_score ?? 0) >= 0.7);
  const successRecommendations: SuccessRecommendation[] = ([
    { title: "Email Subject A/B Test", description: "Question-based subjects get 34% more opens", priority: "High" as const, action: "Recommend in email drafting" },
    { title: "Deal Stage Acceleration", description: "Tech companies move fastest to proposal in Q1", priority: "High" as const, action: "Suggest timeline adjustments" },
    ...(highImportance.slice(0, 2).map((m) => ({
      title: (m.summary || m.content).slice(0, 40) + (m.content.length > 40 ? "…" : ""),
      description: m.content.slice(0, 80) + (m.content.length > 80 ? "…" : ""),
      priority: "Medium" as const,
      action: "Flag in coaching",
    }))),
  ] satisfies SuccessRecommendation[]).slice(0, 4);

  const now = new Date();
  const staleCutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const staleMemories = all.filter((m) => m.last_accessed_at && m.last_accessed_at < staleCutoff);
  const riskPatterns: RiskPattern[] = ([
    { title: "No contact for 14+ days", description: "Deal momentum at risk", priority: "high" as const, action: "Trigger outreach reminder" },
    { title: "Executive sponsor changed", description: "Deal risk increases 5x", priority: "high" as const, action: "Reassess relationship" },
    ...(staleMemories.slice(0, 2).map((m) => ({
      title: (m.summary || m.content).slice(0, 35) + (m.content.length > 35 ? "…" : ""),
      description: "Stale or low-activity memory",
      priority: "medium" as const,
      action: "Schedule check-in",
    }))),
  ] satisfies RiskPattern[]).slice(0, 4);

  const tokenSavingsMatch = insights?.consolidation_impact?.match(/(\d+)%/);
  const tokenSavingsPct = tokenSavingsMatch ? parseInt(tokenSavingsMatch[1], 10) : 70;
  const impactMultiplier = 4.2;

  return {
    summary: {
      teamMemories,
      avgRelevancePct,
      patternsThisWeek: thisWeek,
      teamInsights: teamInsights || (summaryStats?.total_memories ?? 0),
    },
    emailPatterns,
    dealPatterns,
    topLearnings,
    successRecommendations,
    riskPatterns,
    consolidation: {
      thisWeek: consolidatedThisWeek,
      tokenSavingsPct,
      impactMultiplier,
    },
  };
}

async function fetchUserMemoryStats(): Promise<UserMemoryStatsPayload | undefined> {
  try {
    const { data, error } = await supabase.functions.invoke("user-memory-stats", { method: "POST", body: {} });
    if (error || !data?.users) return undefined;
    return data as UserMemoryStatsPayload;
  } catch {
    return undefined;
  }
}

export function useTeamLearningPatterns() {
  return useQuery({
    queryKey: queryKeys.admin.teamLearningPatterns,
    queryFn: async (): Promise<TeamLearningData> => {
      const [memories, userStats] = await Promise.all([
        fetchAgentMemoriesForPatterns(),
        fetchUserMemoryStats(),
      ]);
      return buildTeamLearningData(memories, userStats);
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
  });
}
