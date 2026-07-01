/**
 * Usage Chart Component
 * Visualizes API usage over time
 */

import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';

interface UsageLog {
  id: string;
  created_at: string;
  status: 'success' | 'error';
  cost?: number;
}

interface UsageChartProps {
  data: UsageLog[];
  dateRange: '7d' | '30d' | '90d' | 'all';
  isLoading?: boolean;
}

interface DayData {
  date: string;
  success: number;
  error: number;
  total: number;
  cost: number;
}

export function UsageChart({ data, dateRange, isLoading = false }: UsageChartProps) {
  // Group data by day
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Group by date
    const grouped = data.reduce((acc, log) => {
      const date = new Date(log.created_at).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { date, success: 0, error: 0, total: 0, cost: 0 };
      }
      acc[date].total++;
      if (log.status === 'success') {
        acc[date].success++;
      } else {
        acc[date].error++;
      }
      acc[date].cost += log.cost || 0;
      return acc;
    }, {} as Record<string, DayData>);

    // Convert to array and sort by date
    const result = Object.values(grouped).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // Fill in missing days
    if (result.length > 0) {
      const startDate = new Date(result[0].date);
      const endDate = new Date(result[result.length - 1].date);
      const filledData: DayData[] = [];

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const existing = result.find((r) => r.date === dateStr);
        filledData.push(
          existing || { date: dateStr, success: 0, error: 0, total: 0, cost: 0 }
        );
      }

      return filledData;
    }

    return result;
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-muted-foreground">No usage data available</p>
        <p className="text-sm text-muted-foreground mt-1">
          Data will appear once integrations start being used
        </p>
      </div>
    );
  }

  // Find max value for scaling
  const maxValue = Math.max(...chartData.map((d) => d.total));

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span>Success</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span>Error</span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-64 flex items-end gap-1">
        {chartData.map((day, index) => {
          const height = maxValue > 0 ? (day.total / maxValue) * 100 : 0;
          const successHeight = day.total > 0 ? (day.success / day.total) * height : 0;
          const errorHeight = day.total > 0 ? (day.error / day.total) * height : 0;

          return (
            <div
              key={day.date}
              className="flex-1 flex flex-col justify-end group relative"
              style={{ minWidth: '8px' }}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <div className="bg-popover border rounded-lg shadow-lg p-3 text-xs whitespace-nowrap">
                  <div className="font-semibold mb-1">
                    {new Date(day.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Total:</span>
                      <span className="font-medium">{day.total}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-green-600">Success:</span>
                      <span className="font-medium">{day.success}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-red-600">Error:</span>
                      <span className="font-medium">{day.error}</span>
                    </div>
                    {day.cost > 0 && (
                      <div className="flex items-center justify-between gap-3 pt-1 border-t">
                        <span className="text-muted-foreground">Cost:</span>
                        <span className="font-medium">${day.cost.toFixed(4)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bar */}
              <div
                className="w-full bg-muted rounded-t overflow-hidden transition-all hover:opacity-80"
                style={{ height: `${height}%` }}
              >
                {/* Error portion (red) */}
                {errorHeight > 0 && (
                  <div
                    className="w-full bg-red-500"
                    style={{ height: `${(errorHeight / height) * 100}%` }}
                  />
                )}
                {/* Success portion (green) */}
                {successHeight > 0 && (
                  <div
                    className="w-full bg-green-500"
                    style={{ height: `${(successHeight / height) * 100}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {new Date(chartData[0].date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
        {chartData.length > 2 && (
          <span>
            {new Date(chartData[Math.floor(chartData.length / 2)].date).toLocaleDateString(
              'en-US',
              { month: 'short', day: 'numeric' }
            )}
          </span>
        )}
        <span>
          {new Date(chartData[chartData.length - 1].date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>
    </div>
  );
}
