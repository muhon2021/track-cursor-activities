/**
 * Pod Management — Pod health dashboard
 * Route: /pod/management
 */

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { usePodHealth, usePodHealthRecords, usePodMemberPerformance, useAssignPodManager } from '@/hooks/usePodHealth';
import { PodHealthCards } from '@/components/pods/PodHealthCards';
import { PodHealthTable } from '@/components/pods/PodHealthTable';
import { PodMemberDrawer } from '@/components/pods/PodMemberDrawer';
import { Loader2 } from 'lucide-react';
import type { PodMemberPerformance } from '@/types/pods';

export default function PodManagement() {
  const [viewMembersPodId, setViewMembersPodId] = useState<string | null>(null);

  const { data: healthStats, isLoading: statsLoading } = usePodHealth();
  const { data: healthRecords, isLoading: recordsLoading } = usePodHealthRecords();
  const assignManager = useAssignPodManager();

  // Fetch member performance for all pods
  const podIds = useMemo(() => healthRecords?.map((r) => r.pod_id) || [], [healthRecords]);
  
  // Create a map of pod_id -> member performance
  const memberPerformanceMap = new Map<string, PodMemberPerformance[]>();
  
  // We'll fetch member performance on-demand when viewing members
  // For now, we'll just use the health records

  const handleViewMembers = (podId: string) => {
    setViewMembersPodId(podId);
  };

  const handleAssignManager = async (podId: string, employeeId: string | null) => {
    try {
      await assignManager.mutateAsync({ podId, employeeId });
    } catch (error) {
      // Error handled by hook
    }
  };

  const isLoading = statsLoading || recordsLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Pod Health Dashboard</h1>
        <p className="text-muted-foreground">Monitor pod performance, SLA adherence, and coaching needs</p>
      </div>

      {/* Health Stats Cards */}
      {healthStats && <PodHealthCards stats={healthStats} isLoading={statsLoading} />}

      {/* Health Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <PodHealthTable
              records={healthRecords || []}
              onViewMembers={handleViewMembers}
              onAssignManager={handleAssignManager}
              isLoading={recordsLoading}
            />
          )}
        </CardContent>
      </Card>

      {/* Member Drawer */}
      <PodMemberDrawer
        podId={viewMembersPodId}
        open={!!viewMembersPodId}
        onOpenChange={(open) => {
          if (!open) setViewMembersPodId(null);
        }}
      />
    </div>
  );
}

