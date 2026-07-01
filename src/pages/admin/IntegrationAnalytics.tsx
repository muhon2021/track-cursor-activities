/**
 * Integration Usage Analytics Page
 * Dashboard for tracking integration usage, costs, and performance
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Activity,
  DollarSign,
  TrendingUp,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
} from 'lucide-react';
import {
  useIntegrationCategories,
  useIntegrationProviders,
  useIntegrationUsageLogs,
} from '@/hooks/useIntegrations';
import { formatCost } from '@/lib/integration-utils';
import { UsageChart } from '@/components/integrations/UsageChart';
import { ProviderUsageTable } from '@/components/integrations/ProviderUsageTable';
import { exportUsageDataToCSV, exportUsageDataToExcel } from '@/lib/export-utils';

type DateRange = '7d' | '30d' | '90d' | 'all';

interface UsageLog {
  id: string;
  provider_id: string | null;
  service_id: string | null;
  user_id: string | null;
  action: string;
  status: 'success' | 'error';
  estimated_cost: number | null;
  error_message: string | null;
  request_metadata: Record<string, unknown> | null;
  response_metadata: Record<string, unknown> | null;
  created_at: string;
  provider: { name: string; slug: string };
  service: { name: string; service_key: string };
  user: { email: string };
}

export default function IntegrationAnalytics() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);

  // Fetch data
  const { data: categories } = useIntegrationCategories();
  const { data: providers } = useIntegrationProviders();
  const { data: usageLogs, isLoading } = useIntegrationUsageLogs({
    dateRange,
    categoryId: selectedCategory !== 'all' ? selectedCategory : undefined,
    providerId: selectedProvider !== 'all' ? selectedProvider : undefined,
  });

  // Transform logs with proper typing
  const typedUsageLogs: UsageLog[] = useMemo(() => {
    return (usageLogs || []).map((log) => ({
      ...log,
      status: log.status as 'success' | 'error',
    }));
  }, [usageLogs]);

  // Calculate statistics
  const stats = calculateStats(typedUsageLogs);

  // Handle export
  const handleExport = async (format: 'csv' | 'excel') => {
    setIsExporting(true);
    try {
      const filename = `integration-usage-${dateRange}-${Date.now()}`;

      if (format === 'csv') {
        await exportUsageDataToCSV(typedUsageLogs, filename);
      } else {
        await exportUsageDataToExcel(typedUsageLogs, filename);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Filter providers by selected category
  const filteredProviders = selectedCategory === 'all'
    ? providers
    : providers?.filter((p) => p.category_id === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integration Analytics</h1>
          <p className="text-muted-foreground mt-2">
            Monitor usage, costs, and performance across all integrations
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleExport('csv')}
            disabled={isExporting || !typedUsageLogs?.length}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport('excel')}
            disabled={isExporting || !typedUsageLogs?.length}
          >
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter analytics by date range, category, and provider</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Provider Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Provider</label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="All providers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All providers</SelectItem>
                  {filteredProviders?.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total API Calls */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total API Calls</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCalls.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {dateRange === '7d' && 'Last 7 days'}
              {dateRange === '30d' && 'Last 30 days'}
              {dateRange === '90d' && 'Last 90 days'}
              {dateRange === 'all' && 'All time'}
            </p>
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.successRate.toFixed(1)}%
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1 text-success" />
                {stats.successfulCalls}
              </Badge>
              <Badge variant="outline" className="text-xs">
                <XCircle className="h-3 w-3 mr-1 text-destructive" />
                {stats.failedCalls}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Total Cost */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCost(stats.totalCost)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg: {formatCost(stats.avgCostPerCall)}/call
            </p>
          </CardContent>
        </Card>

        {/* Avg Response Time */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgResponseTime}ms</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.avgResponseTime < 500 ? 'Excellent' : stats.avgResponseTime < 1000 ? 'Good' : 'Needs attention'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Usage Over Time
          </CardTitle>
          <CardDescription>API calls by day showing success and failure rates</CardDescription>
        </CardHeader>
        <CardContent>
          <UsageChart data={typedUsageLogs} dateRange={dateRange} isLoading={isLoading} />
        </CardContent>
      </Card>

      {/* Provider Usage Table */}
      <Card>
        <CardHeader>
          <CardTitle>Provider Breakdown</CardTitle>
          <CardDescription>Detailed usage statistics by provider</CardDescription>
        </CardHeader>
        <CardContent>
          <ProviderUsageTable
            usageLogs={typedUsageLogs}
            providers={providers || []}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// Calculate aggregate statistics
function calculateStats(logs: UsageLog[]) {
  if (!logs || logs.length === 0) {
    return {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      successRate: 0,
      totalCost: 0,
      avgCostPerCall: 0,
      avgResponseTime: 0,
    };
  }

  const totalCalls = logs.length;
  const successfulCalls = logs.filter((log) => log.status === 'success').length;
  const failedCalls = totalCalls - successfulCalls;
  const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0;
  const totalCost = logs.reduce((sum, log) => sum + (log.estimated_cost || 0), 0);
  const avgCostPerCall = totalCalls > 0 ? totalCost / totalCalls : 0;
  const totalResponseTime = logs.reduce((sum, log) => {
    const responseTime = (log.response_metadata as Record<string, number> | null)?.response_time || 0;
    return sum + responseTime;
  }, 0);
  const avgResponseTime = totalCalls > 0 ? Math.round(totalResponseTime / totalCalls) : 0;

  return {
    totalCalls,
    successfulCalls,
    failedCalls,
    successRate,
    totalCost,
    avgCostPerCall,
    avgResponseTime,
  };
}