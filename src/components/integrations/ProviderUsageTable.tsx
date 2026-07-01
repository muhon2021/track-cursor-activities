/**
 * Provider Usage Table Component
 * Displays detailed usage statistics by provider
 */

import { useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCost, getProviderIcon } from '@/lib/integration-utils';
import type { IntegrationProvider } from '@/lib/integration-utils';

interface UsageLog {
  id: string;
  provider_id: string;
  status: 'success' | 'error';
  cost?: number;
  response_time?: number;
  created_at: string;
}

interface ProviderUsageTableProps {
  usageLogs: UsageLog[];
  providers: IntegrationProvider[];
  isLoading?: boolean;
}

interface ProviderStats {
  providerId: string;
  providerName: string;
  providerSlug: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  successRate: number;
  totalCost: number;
  avgCostPerCall: number;
  avgResponseTime: number;
}

export function ProviderUsageTable({
  usageLogs,
  providers,
  isLoading = false,
}: ProviderUsageTableProps) {
  // Calculate stats per provider
  const providerStats = useMemo(() => {
    if (!usageLogs || !providers) return [];

    // Group logs by provider
    const grouped = usageLogs.reduce((acc, log) => {
      if (!acc[log.provider_id]) {
        const provider = providers.find((p) => p.id === log.provider_id);
        if (!provider) return acc;

        acc[log.provider_id] = {
          providerId: log.provider_id,
          providerName: provider.name,
          providerSlug: provider.slug,
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          successRate: 0,
          totalCost: 0,
          avgCostPerCall: 0,
          avgResponseTime: 0,
          totalResponseTime: 0,
        };
      }

      const stats = acc[log.provider_id];
      stats.totalCalls++;
      if (log.status === 'success') {
        stats.successfulCalls++;
      } else {
        stats.failedCalls++;
      }
      stats.totalCost += log.cost || 0;
      stats.totalResponseTime += log.response_time || 0;

      return acc;
    }, {} as Record<string, any>);

    // Calculate averages and sort by total calls
    return Object.values(grouped)
      .map((stats: any) => {
        stats.successRate =
          stats.totalCalls > 0 ? (stats.successfulCalls / stats.totalCalls) * 100 : 0;
        stats.avgCostPerCall = stats.totalCalls > 0 ? stats.totalCost / stats.totalCalls : 0;
        stats.avgResponseTime =
          stats.totalCalls > 0 ? Math.round(stats.totalResponseTime / stats.totalCalls) : 0;
        delete stats.totalResponseTime;
        return stats as ProviderStats;
      })
      .sort((a, b) => b.totalCalls - a.totalCalls);
  }, [usageLogs, providers]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (providerStats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-muted-foreground">No usage data available</p>
        <p className="text-sm text-muted-foreground mt-1">
          Data will appear once integrations start being used
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Provider</TableHead>
            <TableHead className="text-right">Total Calls</TableHead>
            <TableHead className="text-right">Success Rate</TableHead>
            <TableHead className="text-right">Total Cost</TableHead>
            <TableHead className="text-right">Avg Cost/Call</TableHead>
            <TableHead className="text-right">Avg Response</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {providerStats.map((stats) => {
            const Icon = getProviderIcon(stats.providerSlug);
            const successRateColor =
              stats.successRate >= 95
                ? 'text-green-600'
                : stats.successRate >= 80
                  ? 'text-yellow-600'
                  : 'text-red-600';

            const responseTimeColor =
              stats.avgResponseTime < 500
                ? 'text-green-600'
                : stats.avgResponseTime < 1000
                  ? 'text-yellow-600'
                  : 'text-red-600';

            return (
              <TableRow key={stats.providerId}>
                {/* Provider */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="rounded-md border p-2 bg-muted/50">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="font-medium">{stats.providerName}</span>
                  </div>
                </TableCell>

                {/* Total Calls */}
                <TableCell className="text-right">
                  <div className="space-y-1">
                    <div className="font-medium">{stats.totalCalls.toLocaleString()}</div>
                    <div className="flex items-center justify-end gap-1 text-xs">
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
                        {stats.successfulCalls}
                      </Badge>
                      {stats.failedCalls > 0 && (
                        <Badge variant="outline" className="text-xs px-1 py-0">
                          <TrendingDown className="h-3 w-3 mr-1 text-red-600" />
                          {stats.failedCalls}
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>

                {/* Success Rate */}
                <TableCell className="text-right">
                  <span className={`font-medium ${successRateColor}`}>
                    {stats.successRate.toFixed(1)}%
                  </span>
                </TableCell>

                {/* Total Cost */}
                <TableCell className="text-right">
                  <span className="font-medium">{formatCost(stats.totalCost)}</span>
                </TableCell>

                {/* Avg Cost Per Call */}
                <TableCell className="text-right">
                  <span className="text-muted-foreground">
                    {formatCost(stats.avgCostPerCall)}
                  </span>
                </TableCell>

                {/* Avg Response Time */}
                <TableCell className="text-right">
                  <span className={`font-medium ${responseTimeColor}`}>
                    {stats.avgResponseTime}ms
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
