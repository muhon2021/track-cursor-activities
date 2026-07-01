/**
 * AI Weekly Digest
 *
 * Self-contained weekly summary of AI suggestion activity including
 * stats overview, acceptance rate, type breakdown, and recent suggestions.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles,
  Bot,
  Clock,
  CheckCircle,
  XCircle,
  Lightbulb,
  GitBranch,
  Loader2,
} from "lucide-react";
import {
  useSuggestionStats,
  useAIIssueSuggestions,
} from "../../../hooks/useAIIssueSuggestions";
import { AISuggestionCard } from "./AISuggestionCard";

const typeLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  root_cause: { label: "Root Cause", icon: Lightbulb, color: "bg-purple-100 text-purple-800" },
  action_item: { label: "Action Item", icon: CheckCircle, color: "bg-blue-100 text-blue-800" },
  related_pattern: { label: "Related Pattern", icon: GitBranch, color: "bg-amber-100 text-amber-800" },
};

export function AIWeeklyDigest() {
  const { data: stats, isLoading: statsLoading } = useSuggestionStats();
  const { data: recentSuggestions, isLoading: suggestionsLoading } = useAIIssueSuggestions();

  const isLoading = statsLoading || suggestionsLoading;
  const recent = recentSuggestions?.slice(0, 10) ?? [];

  const acceptanceRate =
    stats && (stats.accepted + stats.rejected) > 0
      ? Math.round((stats.accepted / (stats.accepted + stats.rejected)) * 100)
      : 0;

  const miniStats = stats
    ? [
        { label: "Total", value: stats.total, icon: Bot, color: "text-blue-600" },
        { label: "Pending", value: stats.pending, icon: Clock, color: "text-yellow-600" },
        { label: "Accepted", value: stats.accepted, icon: CheckCircle, color: "text-green-600" },
        { label: "Rejected", value: stats.rejected, icon: XCircle, color: "text-red-600" },
      ]
    : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-yellow-500" />
          AI Weekly Digest
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {miniStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border p-3 text-center"
                >
                  <stat.icon className={`h-4 w-4 mx-auto mb-1 ${stat.color}`} />
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Acceptance rate */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Acceptance Rate</span>
                <span className="font-medium">{acceptanceRate}%</span>
              </div>
              <Progress value={acceptanceRate} className="h-2" />
            </div>

            {/* By type breakdown */}
            {stats && Object.keys(stats.byType).length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">By Type</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.byType).map(([type, count]) => {
                    const config = typeLabels[type];
                    if (!config) return null;
                    const TypeIcon = config.icon;
                    return (
                      <Badge
                        key={type}
                        variant="secondary"
                        className={config.color}
                      >
                        <TypeIcon className="h-3 w-3 mr-1" />
                        {config.label}: {count}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent suggestions */}
            {recent.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Recent Suggestions
                </p>
                <div className="space-y-2">
                  {recent.map((suggestion) => (
                    <AISuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      showActions={false}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
