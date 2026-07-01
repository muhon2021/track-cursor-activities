/**
 * PodHealthCards - Summary stat cards for pod health dashboard
 */

import { Card, CardContent } from '@/components/ui/card';
import { Layers, TrendingUp, Target, Users } from 'lucide-react';
import type { PodHealthStats } from '@/types/pods';

export interface PodHealthCardsProps {
  stats: PodHealthStats;
  isLoading?: boolean;
}

export function PodHealthCards({ stats, isLoading }: PodHealthCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <div className="h-20 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Layers className="h-4 w-4" />
            <span className="text-sm">Pods Tracked</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.pods_tracked}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Avg Throughput</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.avg_throughput_pct.toFixed(1)}%</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Target className="h-4 w-4" />
            <span className="text-sm">SLA Adherence</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.sla_adherence_pct.toFixed(1)}%</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Coaching Needs</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.coaching_needs_count}</p>
        </CardContent>
      </Card>
    </div>
  );
}

