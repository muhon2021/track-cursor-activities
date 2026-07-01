/**
 * AI Suggestion Stats
 *
 * Statistics panel displaying suggestion totals, average confidence,
 * and type breakdown.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Bot,
  Clock,
  CheckCircle,
  XCircle,
  Lightbulb,
  GitBranch,
} from "lucide-react";
import type { SuggestionStats } from "../../../hooks/useAIIssueSuggestions";

const typeLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  root_cause: { label: "Root Cause", icon: Lightbulb, color: "bg-purple-100 text-purple-800" },
  action_item: { label: "Action Item", icon: CheckCircle, color: "bg-blue-100 text-blue-800" },
  related_pattern: { label: "Related Pattern", icon: GitBranch, color: "bg-amber-100 text-amber-800" },
};

interface AISuggestionStatsProps {
  stats: SuggestionStats | undefined;
}

export function AISuggestionStats({ stats }: AISuggestionStatsProps) {
  if (!stats) return null;

  const statCards = [
    { label: "Total Suggestions", value: stats.total, icon: Bot, color: "text-blue-600" },
    { label: "Pending Review", value: stats.pending, icon: Clock, color: "text-yellow-600" },
    { label: "Accepted", value: stats.accepted, icon: CheckCircle, color: "text-green-600" },
    { label: "Rejected", value: stats.rejected, icon: XCircle, color: "text-red-600" },
  ];

  return (
    <div className="space-y-4">
      {/* Stat cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <card.icon className={`h-4 w-4 ${card.color}`} />
                <span className="text-sm text-muted-foreground">{card.label}</span>
              </div>
              <p className={`text-2xl font-bold mt-1 ${card.color}`}>
                {card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Average confidence */}
      <Card>
        <CardContent className="pt-4 pb-3 px-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Average Confidence</span>
            <span className="font-medium">{stats.avgConfidence}%</span>
          </div>
          <Progress value={stats.avgConfidence} className="h-2" />
        </CardContent>
      </Card>

      {/* By type breakdown */}
      {Object.keys(stats.byType).length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-3 px-4 space-y-2">
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
