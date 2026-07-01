/**
 * Usage Stats Component
 * Displays integration usage statistics and cost estimates
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, DollarSign, Activity, CheckCircle2, XCircle } from 'lucide-react';
import { formatCost } from '@/lib/integration-utils';

interface UsageStatsProps {
  stats?: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalCost: number;
    successRate: number;
  };
  isLoading?: boolean;
  days?: number;
}

export function UsageStats({ stats, isLoading = false, days = 30 }: UsageStatsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage Statistics</CardTitle>
          <CardDescription>Last {days} days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.totalCalls === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage Statistics</CardTitle>
          <CardDescription>Last {days} days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Activity className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No usage data available</p>
            <p className="text-sm text-muted-foreground mt-1">
              Stats will appear once you start using this integration
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const successRateColor =
    stats.successRate >= 95
      ? 'text-green-600'
      : stats.successRate >= 80
        ? 'text-yellow-600'
        : 'text-red-600';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage Statistics</CardTitle>
        <CardDescription>Last {days} days</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Calls */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Activity className="h-4 w-4" />
              <p className="text-sm font-medium">Total Calls</p>
            </div>
            <p className="text-2xl font-bold">{stats.totalCalls.toLocaleString()}</p>
          </div>

          {/* Success Rate */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <p className="text-sm font-medium">Success Rate</p>
            </div>
            <p className={`text-2xl font-bold ${successRateColor}`}>
              {stats.successRate.toFixed(1)}%
            </p>
          </div>

          {/* Total Cost */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <p className="text-sm font-medium">Total Cost</p>
            </div>
            <p className="text-2xl font-bold">{formatCost(stats.totalCost)}</p>
          </div>

          {/* Status breakdown */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Status</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-muted-foreground">Success:</span>
                <span className="font-medium">{stats.successfulCalls.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-muted-foreground">Failed:</span>
                <span className="font-medium">{stats.failedCalls.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cost per call estimate */}
        {stats.totalCalls > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Average cost per call:</span>
              <Badge variant="secondary">
                {formatCost(stats.totalCost / stats.totalCalls)}
              </Badge>
            </div>
          </div>
        )}

        {/* Warning for low success rate */}
        {stats.successRate < 80 && stats.totalCalls > 10 && (
          <div className="mt-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
            <div className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-900 dark:text-yellow-100">
                  Low success rate detected
                </p>
                <p className="text-yellow-800 dark:text-yellow-200 mt-1">
                  Your integration has a success rate below 80%. Please check your configuration
                  and credentials.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
