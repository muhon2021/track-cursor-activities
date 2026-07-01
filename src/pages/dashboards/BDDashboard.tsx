/**
 * Business Development Dashboard
 *
 * Personalized view for BD team members showing:
 * - Pipeline summary stats
 * - Recent deals table
 * - Hot contacts / leads
 * - Follow-up reminders
 * - Meetings this week
 * - AI teams (Sales Intelligence)
 * - Quick actions
 */

import { Link } from "react-router-dom";
import {
  Handshake,
  ArrowUpRight,
  TrendingUp,
  Users,
  Target,
  DollarSign,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MeetingsThisWeekCard } from "@/components/dashboards/MeetingsThisWeekCard";
import { QuickActionsCard } from "@/components/dashboards/QuickActionsCard";
import { AITeamsDashboardCard } from "@/components/dashboards/AITeamsDashboardCard";
import { DashboardPreferencesSheet } from "@/components/dashboards/DashboardPreferencesSheet";
import { useAuth } from "@/contexts/AuthContext";
import { useDealPipelineStats } from "@/modules/business-dev/hooks/useDeals";
import { useDeals } from "@/modules/business-dev/hooks/useDeals";
import { useContacts } from "@/modules/business-dev/hooks/useContacts";
import { useIsWidgetEnabled } from "@/hooks/useDashboardWidgets";
import { cn } from "@/lib/utils";

/* ─── Stage colors ─── */

const STAGE_BADGE: Record<string, string> = {
  lead: "bg-muted text-muted-foreground",
  discovery: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  qualified: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
  estimation: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  proposal: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  won: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  lost: "bg-destructive/15 text-destructive",
};

function formatCurrency(val: number | null): string {
  if (!val) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);
}

/* ─── Pipeline Stats Row ─── */

function PipelineStats() {
  const { data: stats, isLoading } = useDealPipelineStats();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const activeDeals =
    stats && stats.by_stage
      ? Object.entries(stats.by_stage)
          .filter(([stage]) => !["won", "lost"].includes(stage))
          .reduce((sum, [, v]) => sum + v.count, 0)
      : 0;

  const activeValue =
    stats && stats.by_stage
      ? Object.entries(stats.by_stage)
          .filter(([stage]) => !["won", "lost"].includes(stage))
          .reduce((sum, [, v]) => sum + v.value, 0)
      : 0;

  const wonDeals = stats?.by_stage?.won?.count ?? 0;
  const wonValue = stats?.by_stage?.won?.value ?? 0;

  const cards = [
    {
      label: "Active Deals",
      value: activeDeals,
      icon: Handshake,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Pipeline Value",
      value: formatCurrency(activeValue),
      icon: DollarSign,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "Deals Won",
      value: wonDeals,
      icon: TrendingUp,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Won Revenue",
      value: formatCurrency(wonValue),
      icon: DollarSign,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Link to="/deals" key={c.label} className="group">
            <Card className="transition-all duration-200 hover:shadow-md hover:border-primary/20">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", c.bg)}>
                    <Icon className={cn("h-5 w-5", c.color)} />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-semibold text-foreground">{c.value}</p>
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

/* ─── Recent Deals Table ─── */

function RecentDealsCard() {
  const { data: deals, isLoading } = useDeals();

  // Show most recent 8 active deals
  const recentDeals = (deals ?? [])
    .filter((d) => d.stage !== "won" && d.stage !== "lost")
    .slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Handshake className="h-4 w-4 text-muted-foreground" />
            Active Deals
          </CardTitle>
          <Button variant="ghost" size="sm" asChild className="text-primary">
            <Link to="/deals">View All <ArrowUpRight className="h-3 w-3 ml-1" /></Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : recentDeals.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center gap-2">
            <Handshake className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No active deals yet</p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/deals">Create a Deal</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {recentDeals.map((deal) => (
              <Link
                key={deal.id}
                to={`/deals/${deal.slug}`}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{deal.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {deal.client?.name || "No client"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-medium text-foreground">
                    {formatCurrency(deal.value)}
                  </span>
                  <Badge
                    variant="secondary"
                    className={cn("text-[10px] capitalize", STAGE_BADGE[deal.stage] ?? STAGE_BADGE.lead)}
                  >
                    {deal.stage}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Hot Contacts Card ─── */

function HotContactsCard() {
  const { data: contacts, isLoading } = useContacts();

  // Show leads that are follow-up enabled, sorted by score
  const hotContacts = (contacts ?? [])
    .filter((c: any) => c.is_lead_follow_up || c.lead_temperature === "hot" || c.lead_temperature === "warm")
    .sort((a: any, b: any) => (b.lead_score ?? 0) - (a.lead_score ?? 0))
    .slice(0, 6);

  const TEMP_COLORS: Record<string, string> = {
    hot: "bg-red-500/15 text-red-700 dark:text-red-400",
    warm: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    cold: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-muted-foreground" />
            Hot Leads
          </CardTitle>
          <Button variant="ghost" size="sm" asChild className="text-primary">
            <Link to="/lead-followup">Follow-Ups <ArrowUpRight className="h-3 w-3 ml-1" /></Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : hotContacts.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center gap-2">
            <Users className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No hot leads right now</p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/contacts">Browse Contacts</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {hotContacts.map((contact: any) => (
              <Link
                key={contact.id}
                to={`/contacts/${contact.id}`}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">
                      {(contact.first_name?.[0] ?? "").toUpperCase()}
                      {(contact.last_name?.[0] ?? "").toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {contact.first_name} {contact.last_name ?? ""}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {contact.company || contact.email || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {contact.lead_score != null && (
                    <span className="text-xs font-medium text-muted-foreground">
                      {contact.lead_score}pts
                    </span>
                  )}
                  {contact.lead_temperature && (
                    <Badge
                      variant="secondary"
                      className={cn("text-[10px] capitalize", TEMP_COLORS[contact.lead_temperature] ?? "")}
                    >
                      {contact.lead_temperature}
                    </Badge>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Main Dashboard ─── */

export default function BDDashboard() {
  const { profile } = useAuth();
  const showMeetings = useIsWidgetEnabled("meetings-this-week", "bd");
  const showAITeams = useIsWidgetEnabled("ai-teams", "bd");

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {greeting()}, {profile?.full_name?.split(" ")[0] || "there"}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Here's your business development overview
          </p>
        </div>
        <DashboardPreferencesSheet />
      </div>

      {/* Pipeline Stats */}
      <PipelineStats />

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2/3 — Deals */}
        <div className="lg:col-span-2 space-y-6">
          <RecentDealsCard />
          {showMeetings !== false && <MeetingsThisWeekCard />}
        </div>

        {/* Right 1/3 — Contacts + Quick Actions */}
        <div className="space-y-6">
          <QuickActionsCard />
          <HotContactsCard />
        </div>
      </div>

      {/* AI Teams */}
      {showAITeams !== false && <AITeamsDashboardCard agencyRole="bd" />}
    </div>
  );
}
