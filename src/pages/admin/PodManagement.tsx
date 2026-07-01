/**
 * POD Management — Admin page for managing PODs (teams) and their members.
 * Route: /admin/pods
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Layers,
  Search,
  Users,
  UserCheck,
  UserX,
  BarChart3,
  RefreshCw,
  Plus,
  Loader2,
} from 'lucide-react';
import { usePodsWithMembers, useSyncPodEmployeesFromHR, useDeletePod } from '@/hooks/usePods';
import { useUpdatePod } from '@/hooks/usePods';
import { PODsTable } from '@/components/admin/PODsTable';
import { PODManagementDialog } from '@/components/admin/PODManagementDialog';
import { PODMembersViewer } from '@/components/admin/PODMembersViewer';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function PODManagement() {
  const [search, setSearch] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editPodId, setEditPodId] = useState<string | null>(null);
  const [viewMembersPodId, setViewMembersPodId] = useState<string | null>(null);
  const [deletePodId, setDeletePodId] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = usePodsWithMembers(search);
  const syncHR = useSyncPodEmployeesFromHR();
  const deletePod = useDeletePod();
  const updatePod = useUpdatePod();

  const pods = data || [];
  const stats = {
    totalPods: pods.length,
    hrSynced: pods.reduce((sum, p) => sum + (p.hr_synced_count || 0), 0),
    rpMembers: pods.reduce((sum, p) => sum + (p.rp_members_count || 0), 0),
    hasLogin: pods.reduce((sum, p) => sum + (p.has_login_count || 0), 0),
    noProfile: pods.reduce((sum, p) => sum + (p.no_login_count || 0), 0),
  };

  const handleSyncHr = async () => {
    try {
      await syncHR.mutateAsync();
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleRefresh = () => {
    refetch();
    toast.success('Refreshed');
  };

  const handleEdit = (podId: string) => {
    setEditPodId(podId);
  };

  const handleViewMembers = (podId: string) => {
    setViewMembersPodId(podId);
  };

  const handleToggleResourceProjection = async (podId: string, currentValue: boolean) => {
    try {
      await updatePod.mutateAsync({
        id: podId,
        data: { show_in_resource_projection: !currentValue } as any,
      });
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleDelete = (podId: string) => {
    setDeletePodId(podId);
  };

  const confirmDelete = async () => {
    if (deletePodId) {
      try {
        await deletePod.mutateAsync(deletePodId);
        setDeletePodId(null);
      } catch (error) {
        // Error handled by hook
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">POD Management</h1>
        <p className="text-muted-foreground">Manage PODs (teams) and their members</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Layers className="h-4 w-4" />
              <span className="text-sm">Total PODs</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalPods}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="text-sm">HR Synced</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.hrSynced}</p>
            <p className="text-xs text-muted-foreground">From HR system</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm">RP Members</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.rpMembers}</p>
            <p className="text-xs text-muted-foreground">In projections</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserCheck className="h-4 w-4" />
              <span className="text-sm">Has Login</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.hasLogin}</p>
            <p className="text-xs text-muted-foreground">With profile</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserX className="h-4 w-4" />
              <span className="text-sm">No Profile</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.noProfile}</p>
            <p className="text-xs text-muted-foreground">Pending login</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search PODs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncHr}
          disabled={syncHR.isPending}
        >
          {syncHR.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Users className="h-4 w-4 mr-2" />
          )}
          Sync HR Data
        </Button>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
          <RefreshCw className={cn('h-4 w-4 mr-2', isFetching && 'animate-spin')} />
          Refresh
        </Button>
        <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create POD
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <PODsTable
            pods={pods}
            isLoading={isLoading}
            onViewMembers={handleViewMembers}
            onEdit={handleEdit}
            onToggleResourceProjection={handleToggleResourceProjection}
            onDelete={handleDelete}
          />
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <PODManagementDialog
        open={createDialogOpen || !!editPodId}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditPodId(null);
          }
        }}
        podId={editPodId || undefined}
      />

      {/* View Members Sheet */}
      <PODMembersViewer
        podId={viewMembersPodId}
        open={!!viewMembersPodId}
        onOpenChange={(open) => {
          if (!open) setViewMembersPodId(null);
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePodId} onOpenChange={(open) => !open && setDeletePodId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete POD</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this POD? This will soft-delete the POD (set it to
              inactive). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePod.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
