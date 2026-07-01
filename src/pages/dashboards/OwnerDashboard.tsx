import { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HealthMetricsCard } from "@/components/dashboards/HealthMetricsCard";
import { MeetingsThisWeekCard } from "@/components/dashboards/MeetingsThisWeekCard";
import { WatchListCard } from "@/components/dashboards/WatchListCard";
import { QuickActionsCard } from "@/components/dashboards/QuickActionsCard";
import { AITeamsDashboardCard } from "@/components/dashboards/AITeamsDashboardCard";
import { DashboardCustomizeModal } from "@/components/dashboards/DashboardCustomizeModal";
import { DashboardFilterBar } from "@/components/dashboards/DashboardFilterBar";
import { useAuth } from "@/contexts/AuthContext";
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
    slug: "meetings",
    label: "Meetings This Week",
    description: "Upcoming meetings and calendar",
  },
];

/**
 * Owner Dashboard — for agency owners without EOS.
 * Widget visibility respects both admin-level (dashboard_widgets registry)
 * and user-level (user_dashboard_preferences) settings.
 */
export default function OwnerDashboard() {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const { preferences } = useUserDashboardPreferences("owner");

  const showHealth = useIsWidgetEnabled("health_metrics", "owner");
  const showWatchList = useIsWidgetEnabled("watch_list", "owner");

  const isWidgetVisible = (slug: string) => {
    const pref = preferences[slug];
    return pref?.is_visible ?? true;
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Good {getTimeOfDay()}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground">Here's your agency overview.</p>
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

      {/* Row 1: Quick actions */}
      <QuickActionsCard />

      {/* AI Team showcase */}
      <AITeamsDashboardCard agencyRole="owner" />

      {/* Row 2: Health metrics */}
      {showHealth && isWidgetVisible("health-metrics") && <HealthMetricsCard />}

      {/* Row 3: Meetings + Watch List */}
      <div className="grid gap-6 lg:grid-cols-2">
        {isWidgetVisible("meetings") && <MeetingsThisWeekCard />}
        {showWatchList && isWidgetVisible("watch-list") && <WatchListCard />}
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
