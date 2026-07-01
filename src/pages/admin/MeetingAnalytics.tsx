/**
 * Meeting Analytics Dashboard
 * Sprint 8: Meetings Enhancement
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  Calendar,
  Clock,
  Users,
  Video,
  CheckSquare,
  TrendingUp,
  BarChart3,
  Sparkles,
  RefreshCw,
  Gauge,
  ListChecks,
  FileText,
} from 'lucide-react';
import { useMeetingEfficiency } from '@/modules/meetings/hooks/useMeetingEfficiency';

interface MeetingStats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  withSummaries: number;
  withActionItems: number;
  totalDuration: number;
  avgDuration: number;
  byMonth: { month: string; count: number }[];
  topClients: { name: string; count: number }[];
}

export default function MeetingAnalytics() {
  const [timeRange, setTimeRange] = useState('30');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: efficiency } = useMeetingEfficiency(parseInt(timeRange, 10));

  const { data: stats, isLoading, refetch } = useQuery<MeetingStats>({
    queryKey: ['meeting-analytics', timeRange],
    queryFn: async () => {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - parseInt(timeRange, 10));

      // Fetch meetings
      const { data: meetings, error } = await supabase
        .from('meetings')
        .select('*, clients(name)')
        .gte('created_at', fromDate.toISOString());

      if (error) throw error;

      const meetingList = meetings || [];

      // Calculate stats
      const byStatus: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      const clientCounts: Record<string, number> = {};
      const monthCounts: Record<string, number> = {};

      let withSummaries = 0;
      let withActionItems = 0;
      let totalDuration = 0;

      meetingList.forEach((meeting) => {
        // By status
        const status = meeting.status || 'unknown';
        byStatus[status] = (byStatus[status] || 0) + 1;

        // By category
        const metadata = meeting.metadata as Record<string, any> | null;
        const category = metadata?.category || 'Uncategorized';
        byCategory[category] = (byCategory[category] || 0) + 1;

        // With summaries
        if (metadata?.summary) withSummaries++;

        // With action items
        if (metadata?.action_items?.length > 0) withActionItems++;

        // Duration
        if (meeting.duration_minutes) {
          totalDuration += meeting.duration_minutes;
        }

        // By client
        const clientName = meeting.clients?.name || 'Unknown';
        clientCounts[clientName] = (clientCounts[clientName] || 0) + 1;

        // By month
        const month = new Date(meeting.created_at).toLocaleString('default', {
          month: 'short',
          year: '2-digit',
        });
        monthCounts[month] = (monthCounts[month] || 0) + 1;
      });

      // Sort and limit top clients
      const topClients = Object.entries(clientCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      // Convert month counts to array
      const byMonth = Object.entries(monthCounts)
        .map(([month, count]) => ({ month, count }))
        .reverse();

      return {
        total: meetingList.length,
        byStatus,
        byCategory,
        withSummaries,
        withActionItems,
        totalDuration,
        avgDuration: meetingList.length > 0 ? Math.round(totalDuration / meetingList.length) : 0,
        byMonth,
        topClients,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meeting Analytics</h1>
          <p className="text-muted-foreground">
            Insights into your meetings and AI-powered features
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Meetings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              In the last {timeRange} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.avgDuration || 0} min</div>
            <p className="text-xs text-muted-foreground">
              Total: {stats?.totalDuration || 0} minutes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Summaries</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.withSummaries || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.total ? Math.round((stats.withSummaries / stats.total) * 100) : 0}% of meetings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Action Items</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.withActionItems || 0}</div>
            <p className="text-xs text-muted-foreground">
              Meetings with actions extracted
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* By Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Meetings by Status
            </CardTitle>
            <CardDescription>Distribution of meeting statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats?.byStatus || {}).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-3 w-3 rounded-full ${
                        status === 'completed'
                          ? 'bg-success'
                          : status === 'scheduled'
                          ? 'bg-info'
                          : status === 'cancelled'
                          ? 'bg-destructive'
                          : 'bg-muted/500'
                      }`}
                    />
                    <span className="capitalize">{status}</span>
                  </div>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
              {Object.keys(stats?.byStatus || {}).length === 0 && (
                <p className="text-muted-foreground">No data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* By Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Meetings by Category
            </CardTitle>
            <CardDescription>AI-categorized meeting types</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats?.byCategory || {})
                .sort((a, b) => b[1] - a[1])
                .map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between">
                    <span>{category}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              {Object.keys(stats?.byCategory || {}).length === 0 && (
                <p className="text-muted-foreground">No categorized meetings</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Clients */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Clients
            </CardTitle>
            <CardDescription>Clients with most meetings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.topClients.map((client, index) => (
                <div key={client.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{index + 1}.</span>
                    <span>{client.name}</span>
                  </div>
                  <span className="font-semibold">{client.count} meetings</span>
                </div>
              ))}
              {stats?.topClients.length === 0 && (
                <p className="text-muted-foreground">No client data</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Monthly Trend
            </CardTitle>
            <CardDescription>Meeting count over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.byMonth.map((month) => (
                <div key={month.month} className="flex items-center justify-between">
                  <span>{month.month}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 bg-primary rounded"
                      style={{
                        width: `${Math.max(20, (month.count / (stats?.total || 1)) * 200)}px`,
                      }}
                    />
                    <span className="font-semibold w-8 text-right">{month.count}</span>
                  </div>
                </div>
              ))}
              {stats?.byMonth.length === 0 && (
                <p className="text-muted-foreground">No monthly data</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Meeting Efficiency */}
      {efficiency && (
        <Card className="border-success/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-success" />
              Meeting Efficiency
            </CardTitle>
            <CardDescription>
              Composite score based on agenda, takeaways, duration, and attendance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Efficiency Score */}
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold text-success">
                {efficiency.avgEfficiencyScore}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">Average Efficiency Score</p>
                <Progress value={efficiency.avgEfficiencyScore} className="h-3" />
              </div>
            </div>

            {/* Efficiency Breakdown */}
            <div className="grid gap-4 md:grid-cols-4">
              <div className="p-3 rounded-lg border">
                <div className="flex items-center gap-2 mb-1">
                  <ListChecks className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Agenda Rate</span>
                </div>
                <p className="text-xl font-bold">{efficiency.agendaRate}%</p>
                <p className="text-xs text-muted-foreground">
                  {efficiency.withAgenda} of {efficiency.totalMeetings} meetings
                </p>
              </div>
              <div className="p-3 rounded-lg border">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Takeaway Rate</span>
                </div>
                <p className="text-xl font-bold">{efficiency.takeawayRate}%</p>
                <p className="text-xs text-muted-foreground">
                  {efficiency.withTakeaways} of {efficiency.totalMeetings} meetings
                </p>
              </div>
              <div className="p-3 rounded-lg border">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Avg Participants</span>
                </div>
                <p className="text-xl font-bold">{efficiency.avgParticipants}</p>
                <p className="text-xs text-muted-foreground">
                  Per meeting average
                </p>
              </div>
              <div className="p-3 rounded-lg border">
                <div className="flex items-center gap-2 mb-1">
                  <CheckSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Avg Takeaways</span>
                </div>
                <p className="text-xl font-bold">{efficiency.avgTakeaways}</p>
                <p className="text-xs text-muted-foreground">
                  Per meeting average
                </p>
              </div>
            </div>

            {/* Monthly Efficiency Trend */}
            {efficiency.byMonth.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3">Monthly Efficiency Trend</h4>
                <div className="space-y-2">
                  {efficiency.byMonth.map((m) => (
                    <div key={m.month} className="flex items-center gap-3">
                      <span className="text-sm w-16 text-muted-foreground">{m.month}</span>
                      <div className="flex-1">
                        <Progress value={m.avgEfficiency} className="h-2" />
                      </div>
                      <span className="text-sm font-medium w-10 text-right">{m.avgEfficiency}</span>
                      <span className="text-xs text-muted-foreground w-20 text-right">
                        {m.meetings} mtg{m.meetings !== 1 ? "s" : ""}, {m.avgDuration}m avg
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI Insights */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Feature Adoption
          </CardTitle>
          <CardDescription>Usage of AI-powered meeting features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-primary/5">
              <p className="text-sm font-medium">AI Summaries Generated</p>
              <p className="text-2xl font-bold">{stats?.withSummaries || 0}</p>
              <p className="text-xs text-muted-foreground">
                {stats?.total ? `${Math.round((stats.withSummaries / stats.total) * 100)}%` : '0%'} adoption
              </p>
            </div>
            <div className="p-4 rounded-lg bg-primary/5">
              <p className="text-sm font-medium">Action Items Extracted</p>
              <p className="text-2xl font-bold">{stats?.withActionItems || 0}</p>
              <p className="text-xs text-muted-foreground">
                {stats?.total ? `${Math.round((stats.withActionItems / stats.total) * 100)}%` : '0%'} adoption
              </p>
            </div>
            <div className="p-4 rounded-lg bg-primary/5">
              <p className="text-sm font-medium">Categorized Meetings</p>
              <p className="text-2xl font-bold">
                {Object.entries(stats?.byCategory || {}).filter(([k]) => k !== 'Uncategorized').reduce((acc, [, v]) => acc + v, 0)}
              </p>
              <p className="text-xs text-muted-foreground">
                With AI categories assigned
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
