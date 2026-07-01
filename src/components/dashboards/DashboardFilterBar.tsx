import { usePods } from '@/hooks/usePods';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';
import { useUserDashboardPreferences } from '@/hooks/useUserDashboardPreferences';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface DashboardFilterBarProps {
  dashboardType: 'owner' | 'pm' | 'ic';
}

export function DashboardFilterBar({ dashboardType }: DashboardFilterBarProps) {
  const { data: pods = [] } = usePods();
  const filters = useDashboardFilters(dashboardType);
  const { updateFilters } = useUserDashboardPreferences(dashboardType);

  const handleFilterChange = (field: string, value: string | null) => {
    updateFilters.mutate({
      widgetSlug: 'dashboard-global',
      filters: {
        filter_pod_id: filters.pod_id,
        filter_client_status: filters.client_status,
        filter_project_status: filters.project_status,
        filter_risk_level: filters.risk_level,
        [field]: value,
      },
    });
  };

  const handleClearFilters = () => {
    updateFilters.mutate({
      widgetSlug: 'dashboard-global',
      filters: {
        filter_pod_id: null,
        filter_client_status: null,
        filter_project_status: null,
        filter_risk_level: null,
      },
    });
  };

  const hasActiveFilters =
    filters.pod_id ||
    filters.client_status ||
    filters.project_status ||
    filters.risk_level;

  return (
    <div className="flex flex-wrap gap-3 items-center bg-slate-50 dark:bg-slate-900 p-3 rounded-lg mb-4">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Filters:</span>

      <Select
        value={filters.pod_id || 'all'}
        onValueChange={(v) => handleFilterChange('filter_pod_id', v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Pods" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Pods</SelectItem>
          {pods.map((pod) => (
            <SelectItem key={pod.id} value={pod.id}>
              {pod.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.client_status || 'all'}
        onValueChange={(v) => handleFilterChange('filter_client_status', v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Client Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Client Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="prospective">Prospective</SelectItem>
          <SelectItem value="churned">Churned</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.project_status || 'all'}
        onValueChange={(v) => handleFilterChange('filter_project_status', v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Project Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Project Status</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="at_risk">At Risk</SelectItem>
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearFilters}
          className="ml-auto"
        >
          <X className="h-4 w-4 mr-1" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}
