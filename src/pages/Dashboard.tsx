import { Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAgencyRole } from "@/hooks/useAgencyRole";
import { RoleSetupModal } from "@/components/dashboards/RoleSetupModal";
import { useDashboardStats, useRecentActivity, getTimeAgo, useAITeamSummary } from "@/hooks/useDashboard";

// Lazy-load role dashboards so they don't inflate the main bundle
const OwnerDashboard = lazy(() => import("@/pages/dashboards/OwnerDashboard"));
const OwnerDashboardWithEOS = lazy(() => import("@/pages/dashboards/OwnerDashboardWithEOS"));
const PMDashboard = lazy(() => import("@/pages/dashboards/PMDashboard"));
const BDDashboard = lazy(() => import("@/pages/dashboards/BDDashboard"));
const ICDashboard = lazy(() => import("@/pages/dashboards/ICDashboard"));
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AIIndicator, AICard } from "@/components/ui/ai-indicator";
import { AIAgentGuidePopover } from "@/components/dashboard/AIAgentGuidePopover";
import {
  Users,
  Calendar,
  BookOpen,
  Brain,
  Plus,
  ArrowUpRight,
  Clock,
  TrendingUp,
  Loader2,
  Sparkles,
  Bot,
  Compass,
} from "lucide-react";

const quickActions = [
  {
    title: "Add Client",
    description: "Create a new client record",
    icon: Users,
    href: "/clients/new",
    isAI: false,
  },
  {
    title: "Schedule Meeting",
    description: "Set up a new meeting",
    icon: Calendar,
    href: "/meetings/new",
    isAI: false,
  },
  {
    title: "Add Knowledge",
    description: "Upload to knowledge base",
    icon: BookOpen,
    href: "/knowledge/new",
    isAI: false,
  },
  {
    title: "AI Agents Guide",
    description: "See what your AI team can do",
    icon: Compass,
    href: "/ai-agents",
    isAI: true,
  },
];

function DashboardFallback() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function Dashboard() {
  const { profile, loading } = useAuth();
  const { agencyRole, isEosUser, isAdmin } = useAgencyRole();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: recentActivity, isLoading: activityLoading } = useRecentActivity();
  const { data: aiTeam, isLoading: aiTeamLoading } = useAITeamSummary();

  // Wait for auth to settle before routing — prevents flash to generic dashboard
  if (loading) return <DashboardFallback />;

  // Route to role-specific dashboards.
  // agencyRole takes priority — even admins get their role dashboard when set.
  if (agencyRole === "owner") {
    return (
      <Suspense fallback={<DashboardFallback />}>
        {isEosUser ? <OwnerDashboardWithEOS /> : <OwnerDashboard />}
      </Suspense>
    );
  }
  if (agencyRole === "pm") {
    return (
      <Suspense fallback={<DashboardFallback />}>
        <PMDashboard />
      </Suspense>
    );
  }
  if (agencyRole === "bd") {
    return (
      <Suspense fallback={<DashboardFallback />}>
        <BDDashboard />
      </Suspense>
    );
  }
  if (agencyRole === "ic") {
    return (
      <Suspense fallback={<DashboardFallback />}>
        <ICDashboard />
      </Suspense>
    );
  }
  // No agencyRole set: admins see generic dashboard; others pick a role
  if (!isAdmin && agencyRole === null) {
    return <RoleSetupModal open />;
  }

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "client":
        return Users;
      case "meeting":
        return Calendar;
      case "ai":
        return Brain;
      case "knowledge":
        return BookOpen;
      default:
        return Clock;
    }
  };

  const aiAgentCount = stats?.aiAgents.total || 0;
  const aiRunsToday = stats?.aiAgents.runsToday || 0;

  return (
    <div className="space-y-8">
      {/* AI Welcome Banner */}
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5 p-6 lg:p-8">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-accent/5 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <AIIndicator variant="orb" size="md" status="active" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {greeting()}, {profile?.full_name?.split(" ")[0] || "there"}
              </h1>
              <p className="mt-1 text-muted-foreground">
                {aiRunsToday > 0
                  ? `Your AI team processed ${aiRunsToday} task${aiRunsToday !== 1 ? "s" : ""} today.`
                  : aiAgentCount > 0
                    ? `${aiAgentCount} AI agent${aiAgentCount !== 1 ? "s" : ""} standing by to help.`
                    : "Set up AI agents to supercharge your workflow."}
              </p>
            </div>
          </div>
          <Button asChild className="ai-gradient border-0 text-white shadow-md hover:opacity-90 shrink-0">
            <Link to="/ai-agents" className="gap-2">
              <Bot className="h-4 w-4" />
              Meet Your AI Team
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      {statsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Clients */}
          <Link to="/clients" className="group">
            <Card className="transition-all duration-200 hover:border-border hover:shadow-soft">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-semibold text-foreground">{stats?.clients.total || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Clients</p>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  {(stats?.clients.thisMonth || 0) > 0 && <TrendingUp className="h-3 w-3 text-green-600" />}
                  <span>+{stats?.clients.thisMonth || 0} this month</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Meetings */}
          <Link to="/meetings" className="group">
            <Card className="transition-all duration-200 hover:border-border hover:shadow-soft">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-semibold text-foreground">{stats?.meetings.total || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Meetings</p>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{stats?.meetings.upcoming || 0} upcoming</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* AI Agents - Enhanced with AI card styling */}
          <Link to="/ai-agents" className="group">
            <Card className="relative transition-all duration-200 hover:shadow-ai border-primary/20 bg-gradient-to-b from-primary/[0.03] to-transparent">
              <div className="absolute inset-x-0 top-0 h-0.5 ai-gradient rounded-t-lg" />
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg ai-gradient">
                    <Brain className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    <AIIndicator variant="dot" size="sm" status="active" />
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-semibold text-foreground">{stats?.aiAgents.total || 0}</p>
                  <p className="text-sm text-muted-foreground">AI Agents</p>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{stats?.aiAgents.runsToday || 0} runs today</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Knowledge */}
          <Link to="/knowledge" className="group">
            <Card className="transition-all duration-200 hover:border-border hover:shadow-soft">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-semibold text-foreground">{stats?.knowledge.total || 0}</p>
                  <p className="text-sm text-muted-foreground">Knowledge Entries</p>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  {(stats?.knowledge.recent || 0) > 0 && <TrendingUp className="h-3 w-3 text-green-600" />}
                  <span>+{stats?.knowledge.recent || 0} this week</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      {/* Your AI Team */}
      <Card className="border-primary/10">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-medium">Your AI Team</CardTitle>
              <AIIndicator variant="dot" size="sm" status="active" />
            </div>
            <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary">
              <Link to="/ai-agents" className="gap-1">
                View All
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
          <CardDescription>AI agents ready to assist you</CardDescription>
        </CardHeader>
        <CardContent>
          {aiTeamLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !aiTeam || aiTeam.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No AI agents configured yet</p>
                <p className="text-xs text-muted-foreground">Set up your first AI teammate</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/ai-agents" className="gap-1">
                  <Plus className="h-3 w-3" />
                  Add Agent
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {aiTeam.map((agent) => (
                <AIAgentGuidePopover key={agent.id} agent={agent} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {quickActions.map((action, index) => (
                  <Link
                    key={index}
                    to={action.href}
                    className={`group flex items-center gap-4 rounded-lg border p-4 transition-all duration-200 ${
                      action.isAI
                        ? "border-primary/20 bg-gradient-to-r from-primary/[0.03] to-accent/[0.03] hover:border-primary/40 hover:shadow-ai"
                        : "border-border/50 hover:border-border hover:bg-muted/50"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        action.isAI ? "ai-gradient text-white" : "bg-primary/10"
                      }`}
                    >
                      <action.icon className={`h-5 w-5 ${action.isAI ? "" : "text-primary"}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{action.title}</p>
                        {action.isAI && <AIIndicator variant="dot" size="sm" status="active" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{action.description}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium">Recent Activity</CardTitle>
            <CardDescription>Latest updates and changes</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !recentActivity || recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <Clock className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((item) => {
                  const Icon = getActivityIcon(item.type);
                  return (
                    <div key={item.id} className="flex items-start gap-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        item.type === "ai" ? "ai-gradient" : "bg-muted"
                      }`}>
                        <Icon className={`h-4 w-4 ${item.type === "ai" ? "text-white" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium text-foreground">{item.action}</p>
                        <p className="text-xs text-muted-foreground">{item.detail}</p>
                        <p className="text-xs text-muted-foreground">{getTimeAgo(item.time)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}