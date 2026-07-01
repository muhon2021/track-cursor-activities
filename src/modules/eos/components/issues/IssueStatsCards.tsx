/**
 * Issue Stats Cards
 *
 * Shows summary statistics for EOS issues.
 */

import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Clock, CheckCircle2, Archive, AlertTriangle } from "lucide-react";
import type { IssueStats } from "../../types";

interface IssueStatsCardsProps {
  stats: IssueStats;
}

export function IssueStatsCards({ stats }: IssueStatsCardsProps) {
  const cards = [
    { label: "Total", value: stats.total, icon: AlertCircle, color: "text-blue-600" },
    { label: "Open", value: stats.open, icon: AlertCircle, color: "text-blue-500" },
    { label: "In Progress", value: stats.in_progress, icon: Clock, color: "text-yellow-500" },
    { label: "Solved", value: stats.solved, icon: CheckCircle2, color: "text-green-500" },
    { label: "Critical", value: stats.critical, icon: AlertTriangle, color: "text-red-500" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <card.icon className={`h-4 w-4 ${card.color}`} />
              <span className="text-sm text-muted-foreground">{card.label}</span>
            </div>
            <p className="text-2xl font-bold mt-1">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
