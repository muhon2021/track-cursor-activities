import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CsaAuditCharts } from "@/types/csaAuditReport";
import { CSA_AUDIT_BAR_CHARTS } from "@/lib/csaAuditPresentation";

function recordToChartData(data: Record<string, number>) {
  return Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
}

function BarChartCard({ title, data }: { title: string; data: Record<string, number> }) {
  const chartData = recordToChartData(data);
  if (chartData.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
            <XAxis type="number" className="text-xs" />
            <YAxis type="category" dataKey="name" width={100} className="text-xs" tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface CsaAuditChartsPanelProps {
  charts: CsaAuditCharts;
}

export function CsaAuditChartsPanel({ charts }: CsaAuditChartsPanelProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {CSA_AUDIT_BAR_CHARTS.map(({ title, key, optional }) => {
        const data = charts[key] ?? {};
        if (optional && Object.keys(data).length === 0) return null;
        if (!optional && Object.keys(data).length === 0) return null;
        return <BarChartCard key={key} title={title} data={data} />;
      })}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Satisfaction estimate</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-6">
          <span className="text-4xl font-bold text-primary">{charts.satisfaction_estimate}%</span>
          <p className="text-xs text-muted-foreground mt-2 text-center">AI-estimated productivity alignment</p>
        </CardContent>
      </Card>
    </div>
  );
}
