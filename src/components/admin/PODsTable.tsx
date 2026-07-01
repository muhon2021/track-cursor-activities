/**
 * PODsTable - Reusable table component for listing pods
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Eye, EyeOff, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PodWithStats } from '@/types/pods';

export interface PODsTableProps {
  pods: PodWithStats[];
  onViewMembers?: (podId: string) => void;
  onEdit?: (podId: string) => void;
  onToggleResourceProjection?: (podId: string, currentValue: boolean) => void;
  onDelete?: (podId: string) => void;
  isLoading?: boolean;
}

export function PODsTable({
  pods,
  onViewMembers,
  onEdit,
  onToggleResourceProjection,
  onDelete,
  isLoading = false,
}: PODsTableProps) {
  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '—';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Loading pods...</p>
      </div>
    );
  }

  if (pods.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No pods found</p>
        <p className="text-sm">Create a pod to get started.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>POD Name</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>HR Synced</TableHead>
          <TableHead>RP Members</TableHead>
          <TableHead>Resource Projection</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="w-12">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pods.map((pod) => (
          <TableRow key={pod.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'h-8 w-8 rounded-full shrink-0',
                    pod.is_active !== false ? 'opacity-100' : 'opacity-50'
                  )}
                  style={{ backgroundColor: pod.color || '#3b82f6' }}
                />
                <span className="font-medium">{pod.name}</span>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
              {pod.description || '—'}
            </TableCell>
            <TableCell>
              <Badge variant="secondary" className="bg-success/10 text-success border-success/30">
                {pod.hr_synced_count || 0}
              </Badge>
            </TableCell>
            <TableCell>{pod.rp_members_count || 0}</TableCell>
            <TableCell>
              {pod.show_in_resource_projection ? (
                <Badge
                  variant="secondary"
                  className="bg-success/10 text-success border-success/30 gap-1"
                >
                  <BarChart2 className="h-3 w-3" />
                  Enabled
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <EyeOff className="h-3 w-3" />
                  Hidden
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {formatDate(pod.created_at)}
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onViewMembers && (
                    <DropdownMenuItem onClick={() => onViewMembers(pod.id)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Members
                    </DropdownMenuItem>
                  )}
                  {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(pod.id)}>
                      Edit POD
                    </DropdownMenuItem>
                  )}
                  {onToggleResourceProjection && (
                    <DropdownMenuItem
                      onClick={() =>
                        onToggleResourceProjection(pod.id, pod.show_in_resource_projection)
                      }
                    >
                      {pod.show_in_resource_projection ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-2" />
                          Hide from Resource Projection
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-2" />
                          Show in Resource Projection
                        </>
                      )}
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem
                      onClick={() => onDelete(pod.id)}
                      className="text-destructive"
                    >
                      Delete POD
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

