import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Target,
  AlertTriangle,
  MessageSquare,
  Calendar,
  ListTodo,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, isPast } from "date-fns";
import { toast } from "sonner";
import {
  ClientProgressRing,
  ClientMilestoneTimeline,
  ClientRisksTimeline,
  ClientInvoiceSummary,
  ClientDeadlineCountdown,
  ClientSprintTimeline,
} from "@/components/client-portal";

interface AuthData {
  client_access_id: string;
  project_id: string;
  client_email: string;
  client_name: string | null;
}

interface DashboardData {
  project: {
    id: string;
    name: string;
    client_name: string | null;
    status: string | null;
    progress_percentage: number;
    start_date: string | null;
    end_date: string | null;
    budget: number | null;
    estimated_hours: number | null;
    actual_hours: number | null;
  } | null;
  sprints: Array<{
    name: string;
    tasks: Array<{
      id: string;
      task_name: string;
      status: string;
      due_date: string | null;
      assignee_name: string | null;
      completed_at: string | null;
    }>;
    total: number;
    completed: number;
  }>;
  milestones: Array<{
    id: string;
    name: string;
    description: string | null;
    target_date: string | null;
    completion_date: string | null;
    status: string;
    progress_percentage?: number;
    pm_notes?: string | null;
    order_index?: number;
    amount?: number | null;
    payment_due_date?: string | null;
    invoice_link?: string | null;
    payment_status?: string | null;
  }>;
  comments: Array<{
    id: string;
    comment_text: string;
    sprint_name: string | null;
    milestone_id: string | null;
    created_at: string;
  }>;
  risks: Array<{
    id: string;
    title: string;
    description: string | null;
    priority: string;
    status: string;
    identified_at: string;
    mitigation_plan: string | null;
  }>;
  invoiceSummary: {
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    overdueCount: number;
  };
}

export default function ClientPortalDashboard() {
  const { slug, token } = useParams<{ slug: string; token: string }>();
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authData, setAuthData] = useState<AuthData | null>(null);
  const [authError, setAuthError] = useState("");
  const [isRevoked, setIsRevoked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (token) {
      const stored = localStorage.getItem(`client_auth_${token}`);
      if (stored) {
        try {
          const auth = JSON.parse(stored);
          setAuthData(auth);
          setIsAuthenticated(true);
        } catch {
          localStorage.removeItem(`client_auth_${token}`);
        }
      }
    }
  }, [token]);

  useEffect(() => {
    if (isAuthenticated && authData) {
      fetchDashboardData();
    }
  }, [isAuthenticated, authData]);

  const handleLogin = async () => {
    if (!token || !password) {
      setAuthError("Please enter your password");
      return;
    }
    setIsLoading(true);
    setAuthError("");
    try {
      const { data, error } = await supabase.functions.invoke("client-dashboard-api", {
        body: { action: "authenticate", access_token: token, password },
      });
      if (error || !data?.success) {
        if (data?.revoked || data?.error === "ACCESS_REVOKED") {
          setIsRevoked(true);
          return;
        }
        setAuthError(data?.error || "Invalid credentials");
        return;
      }
      setAuthData(data.data);
      setIsAuthenticated(true);
      localStorage.setItem(`client_auth_${token}`, JSON.stringify(data.data));
    } catch {
      setAuthError("Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    if (!authData) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("client-dashboard-api", {
        body: { action: "get-dashboard", project_id: authData.project_id },
      });
      if (error || !data?.success) {
        toast.error("Failed to load dashboard data");
        return;
      }
      setDashboardData(data.data);
    } catch {
      toast.error("Failed to load dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Access</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Invalid or missing access token.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isRevoked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md shadow-xl border-0 bg-card/95 backdrop-blur">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-bold">Access Revoked</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Your access to this project has been revoked.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-muted/30">
        <Card className="w-full max-w-md shadow-xl border-0 bg-card/95 backdrop-blur">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Target className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Project Portal</CardTitle>
            <CardDescription className="text-base">
              Enter your password to access project details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div>
              <Label htmlFor="password" className="sr-only">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Enter your password"
                className="h-12 text-base"
              />
              {authError && (
                <p className="text-sm text-destructive mt-2">{authError}</p>
              )}
            </div>
            <Button
              onClick={handleLogin}
              className="w-full h-12 text-base"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
              Access Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading && !dashboardData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your project dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboardData?.project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Project Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">The requested project could not be found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { project, sprints, milestones, comments, risks, invoiceSummary } = dashboardData;
  const progress = project.progress_percentage || 0;
  const completedMilestones = milestones.filter((m) => m.status === "completed").length;
  const daysToDeadline = project.end_date
    ? differenceInDays(new Date(project.end_date), new Date())
    : null;
  const isOverdue = project.end_date ? isPast(new Date(project.end_date)) : false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/30 via-background to-muted/20">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>Welcome, {authData?.client_name || authData?.client_email}</span>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold mb-2">{project.name}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {project.status && (
                  <Badge
                    variant={project.status === "active" ? "default" : "secondary"}
                    className="capitalize"
                  >
                    {project.status}
                  </Badge>
                )}
                {project.start_date && (
                  <span>Start: {format(new Date(project.start_date), "MMM d, yyyy")}</span>
                )}
                {project.end_date && (
                  <span>End: {format(new Date(project.end_date), "MMM d, yyyy")}</span>
                )}
                {project.budget != null && (
                  <span>Budget: ${Number(project.budget).toLocaleString()}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <ClientProgressRing progress={progress} size={72} strokeWidth={8} />
              <ClientDeadlineCountdown endDate={project.end_date} />
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="milestones">Milestones</TabsTrigger>
            <TabsTrigger value="risks">Risks</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ListTodo className="h-5 w-5" />
                    Milestones ({completedMilestones}/{milestones.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ClientMilestoneTimeline milestones={milestones} />
                </CardContent>
              </Card>
              {sprints.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Sprints</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ClientSprintTimeline sprints={sprints} />
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="milestones" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Milestones</CardTitle>
                <CardDescription>Project milestones and delivery dates</CardDescription>
              </CardHeader>
              <CardContent>
                <ClientMilestoneTimeline milestones={milestones} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="risks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Risks
                </CardTitle>
                <CardDescription>Identified risks and mitigation</CardDescription>
              </CardHeader>
              <CardContent>
                <ClientRisksTimeline risks={risks} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  PM Comments
                </CardTitle>
              </CardHeader>
              <CardContent>
                {comments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No comments yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {comments.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-lg border bg-muted/30"
                      >
                        <p className="text-sm">{c.comment_text}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(c.created_at), "MMM d, yyyy 'at' HH:mm")}
                          {c.sprint_name && ` • ${c.sprint_name}`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Billing Summary</CardTitle>
                <CardDescription>Invoice and payment overview</CardDescription>
              </CardHeader>
              <CardContent>
                <ClientInvoiceSummary
                  totalAmount={invoiceSummary.totalAmount}
                  paidAmount={invoiceSummary.paidAmount}
                  pendingAmount={invoiceSummary.pendingAmount}
                  overdueCount={invoiceSummary.overdueCount}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
