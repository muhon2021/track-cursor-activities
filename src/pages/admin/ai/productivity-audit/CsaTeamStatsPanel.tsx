import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, Activity, BarChart3 } from "lucide-react";
import type { CsaTeamSummary } from "@/lib/api/csaReportsService";

interface CsaTeamStatsPanelProps {
  summary: CsaTeamSummary | undefined;
  isLoading?: boolean;
}

export function CsaTeamStatsPanel({ summary, isLoading }: CsaTeamStatsPanelProps) {
  const stats = [
    {
      label: "Active Users",
      value: summary?.active_users ?? "—",
      icon: Users,
    },
    {
      label: "Total Agents",
      value: summary?.total_sessions ?? "—",
      icon: Activity,
    },
    {
      label: "Total Prompts",
      value: summary?.total_messages ?? "—",
      icon: MessageSquare,
    },
    {
      label: "Avg Prompts / Agent",
      value: summary?.avg_messages_per_session ?? "—",
      icon: BarChart3,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "…" : stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
