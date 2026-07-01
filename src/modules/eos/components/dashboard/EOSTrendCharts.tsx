import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useEOSIssueInsights } from "@/modules/eos/hooks/useEOSIssueInsights";
import { Skeleton } from "@/components/ui/skeleton";

export function EOSTrendCharts() {
  const { data: weekly, isLoading: wLoading } = useEOSIssueInsights(7);
  const { data: quarterly, isLoading: qLoading } = useEOSIssueInsights(90);

  if (wLoading || qLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  const weeklyData = weekly?.recentTrend ?? [];
  const quarterlyData = quarterly?.recentTrend ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Issue Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="weekly">
          <TabsList className="mb-4">
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
          </TabsList>
          <TabsContent value="weekly">
            <Chart data={weeklyData} />
          </TabsContent>
          <TabsContent value="quarterly">
            <Chart data={quarterlyData} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function Chart({ data }: { data: { date: string; opened: number; solved: number }[] }) {
  if (!data.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No trend data yet
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Line type="monotone" dataKey="opened" stroke="hsl(var(--destructive))" name="Opened" strokeWidth={2} />
        <Line type="monotone" dataKey="solved" stroke="hsl(var(--primary))" name="Solved" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
