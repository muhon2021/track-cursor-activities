import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Shield,
  Settings,
  Activity,
  Database,
  Zap,
  TrendingUp,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function Admin() {
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0);

  useEffect(() => {
    const fetchPendingFeedback = async () => {
      const { count } = await supabase
        .from("feedback")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      setPendingFeedbackCount(count || 0);
    };
    fetchPendingFeedback();
  }, []);

  const stats = [
    {
      title: "Total Users",
      value: "42",
      change: "+5 this month",
      icon: Users,
    },
    {
      title: "Active Sessions",
      value: "12",
      change: "Currently online",
      icon: Activity,
    },
    {
      title: "Database Size",
      value: "2.4 GB",
      change: "+120 MB this week",
      icon: Database,
    },
    {
      title: "Edge Functions",
      value: "24",
      change: "Ready to deploy",
      icon: Zap,
    },
  ];

  const systemHealth = [
    { service: "Supabase Database", status: "operational", uptime: "99.9%" },
    { service: "Edge Functions", status: "operational", uptime: "99.8%" },
    { service: "Authentication", status: "operational", uptime: "100%" },
    { service: "Storage", status: "operational", uptime: "99.7%" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-muted-foreground">
          Manage users, settings, and system configuration
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.change}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>Manage user accounts and permissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">View All Users</p>
                <p className="text-sm text-muted-foreground">Manage user accounts</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/users">View</Link>
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Roles & Permissions</p>
                <p className="text-sm text-muted-foreground">Manage access levels</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/roles">Manage</Link>
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Activity Logs</p>
                <p className="text-sm text-muted-foreground">Monitor user activity</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/logs">View Logs</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* System Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              System Settings
            </CardTitle>
            <CardDescription>Configure system parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">System Settings</p>
                <p className="text-sm text-muted-foreground">Platform configuration</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/settings">Configure</Link>
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Dashboard Widgets</p>
                <p className="text-sm text-muted-foreground">Enable, disable, and reorder role dashboard cards</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/settings/dashboard-widgets">Manage</Link>
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Agency Roles</p>
                <p className="text-sm text-muted-foreground">Assign Owner / PM / IC dashboard roles to users</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/settings/agency-roles">Assign</Link>
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Integrations</p>
                <p className="text-sm text-muted-foreground">Third-party API connections</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/integrations">Configure</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feedback Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Feedback Management
            {pendingFeedbackCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingFeedbackCount} pending
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Review and manage user feedback</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">All Feedback</p>
              <p className="text-sm text-muted-foreground">Bug reports, features & suggestions</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/feedback">Manage</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            System Health
          </CardTitle>
          <CardDescription>Monitor service status and uptime</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {systemHealth.map((service) => (
              <div
                key={service.service}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                  </div>
                  <div>
                    <p className="font-medium">{service.service}</p>
                    <p className="text-sm text-muted-foreground">
                      Uptime: {service.uptime}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">{service.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>Security settings and audit logs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Activity Logs</p>
              <p className="text-sm text-muted-foreground">View system activity</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/logs">View Logs</Link>
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Row Level Security</p>
              <p className="text-sm text-muted-foreground">Database access policies</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">
                Configure
              </a>
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">API Access</p>
              <p className="text-sm text-muted-foreground">Manage API keys</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">
                Manage
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Recent Alerts
          </CardTitle>
          <CardDescription>System notifications and warnings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No active alerts</p>
            <p className="text-xs text-muted-foreground">All systems operating normally</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
