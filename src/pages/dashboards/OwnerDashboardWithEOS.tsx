import { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HealthMetricsCard } from "@/components/dashboards/HealthMetricsCard";
import { MeetingsThisWeekCard } from "@/components/dashboards/MeetingsThisWeekCard";
import { WatchListCard } from "@/components/dashboards/WatchListCard";
import { EOSIssuesCard } from "@/components/dashboards/EOSIssuesCard";
import { EOSRocksCard } from "@/components/dashboards/EOSRocksCard";
import { EOSScorecardCard } from "@/components/dashboards/EOSScorecardCard";
import { AIDigestCard } from "@/components/dashboards/AIDigestCard";
import { VisionProgressCard } from "@/modules/eos/components/dashboard/VisionProgressCard";
import { RocksSummaryCard } from "@/modules/eos/components/dashboard/RocksSummaryCard";
import { TeamHealthCard } from "@/modules/eos/components/dashboard/TeamHealthCard";
import { EOSTrendCharts } from "@/modules/eos/components/dashboard/EOSTrendCharts";
import { EOSQuickActionsCard } from "@/modules/eos/components/dashboard/EOSQuickActionsCard";
import { EOSMeetingsSummaryCard, EOSIDSSummaryCard } from "@/modules/eos/components/dashboard/EOSSummaryCards";
import { AITeamsDashboardCard } from "@/components/dashboards/AITeamsDashboardCard";
import { DashboardCustomizeModal } from "@/components/dashboards/DashboardCustomizeModal";
import { DashboardFilterBar } from "@/components/dashboards/DashboardFilterBar";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardPreferences } from "@/hooks/useDashboardPreferences";
import { useIsWidgetEnabled } from "@/hooks/useDashboardWidgets";
import { useUserDashboardPreferences } from "@/hooks/useUserDashboardPreferences";

const AVAILABLE_WIDGETS = [
  {
    slug: "health-metrics",
    label: "Health Metrics",
    description: "Revenue, utilization, team size, active clients",
  },
  {
    slug: "watch-list",
    label: "Watch List",
    description: "Projects at risk, requiring attention",
  },
  {
    slug: "ai-digest",
    label: "AI Weekly Digest",
    description: "AI-generated summary of your week",
  },
  {
    slug: "meetings",
    label: "Meetings This Week",
    description: "Upcoming meetings and calendar",
  },
  {
    slug: "eos-scorecard",
    label: "EOS Scorecard",
    description: "Weekly team metrics",
  },
  {
    slug: "eos-issues",
    label: "EOS Issues",
    description: "Open issues and accountability",
  },
  {
    slug: "eos-rocks",
    label: "Quarterly Rocks",
    description: "Quarterly objectives and progress",
  },
  {
    slug: "eos-vision",
    label: "Vision Progress",
    description: "Annual and quarterly goal progress",
  },
  {
    slug: "eos-team-health",
    label: "Team Health",
    description: "Composite EOS health score",
  },
  {
    slug: "eos-trends",
    label: "Issue Trends",
    description: "Weekly and quarterly issue trends",
  },
];

/**
 * Owner Dashboard — EOS variant.
 * Shown when the owner's profile has isEosUser = true.
 *
 * Widget visibility is triple-gated:
 *   1. Admin-level: dashboard_widgets.is_enabled (via useIsWidgetEnabled)
 *   2. User-level preferences: user_role_preferences (for ai_digest)
 *   3. User-level personalization: user_dashboard_preferences (widget visibility)
 */
export default function OwnerDashboardWithEOS() {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const { profile } = useAuth();
  const { preferences: rolePreferences } = useDashboardPreferences();
  const { preferences } = useUserDashboardPreferences("owner");
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  const showHealth = useIsWidgetEnabled("health_metrics", "owner");
  const showWatchList = useIsWidgetEnabled("watch_list", "owner");
  const showAiDigest = useIsWidgetEnabled("ai_digest", "owner");

  const isWidgetVisible = (slug: string) => {
    const pref = preferences[slug];
    return pref?.is_visible ?? true;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Good {getTimeOfDay()}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground">Your agency overview with EOS.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCustomizeOpen(true)}
        >
          <Settings className="h-4 w-4 mr-2" />
          Customize
        </Button>
      </div>

      <DashboardFilterBar dashboardType="owner" />

      {/* Row 1: EOS Quick Actions */}
      <EOSQuickActionsCard />

      {/* Row 1b: Vision + Team Health */}
      <div className="grid gap-6 lg:grid-cols-2">
        {isWidgetVisible("eos-vision") && <VisionProgressCard />}
        {isWidgetVisible("eos-team-health") && <TeamHealthCard />}
      </div>

      {/* AI Team showcase */}
      <AITeamsDashboardCard agencyRole="owner" />

      {/* Row 2: Agency health */}
      {showHealth && isWidgetVisible("health-metrics") && <HealthMetricsCard />}

      {/* Row 3: AI Digest — admin-enabled AND user-enabled AND personalization-visible */}
      {showAiDigest && rolePreferences.ai_digest_enabled && isWidgetVisible("ai-digest") && (
        <AIDigestCard />
      )}

      {/* Row 4: Watch List + Meetings */}
      <div className="grid gap-6 lg:grid-cols-2">
        {showWatchList && isWidgetVisible("watch-list") && <WatchListCard />}
        {isWidgetVisible("meetings") && <MeetingsThisWeekCard />}
      </div>

      {/* Row 5: EOS Scorecard + Issues + Rocks + Meetings + IDS */}
      <div className="grid gap-6 lg:grid-cols-3">
        {isWidgetVisible("eos-scorecard") && <EOSScorecardCard />}
        {isWidgetVisible("eos-issues") && <EOSIssuesCard />}
        {isWidgetVisible("eos-rocks") && <EOSRocksCard />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {isWidgetVisible("meetings") && <EOSMeetingsSummaryCard />}
        {isWidgetVisible("eos-issues") && <EOSIDSSummaryCard />}
      </div>

      {isWidgetVisible("eos-trends") && <EOSTrendCharts />}

      {/* Legacy rocks summary widget row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {isWidgetVisible("eos-rocks") && <RocksSummaryCard />}
      </div>

      <DashboardCustomizeModal
        isOpen={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        dashboardType="owner"
        availableWidgets={AVAILABLE_WIDGETS}
      />
    </div>
  );
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
