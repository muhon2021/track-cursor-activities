/**
 * PodMemberDrawer - Dialog showing member details with productivity
 */

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { usePod } from '@/hooks/usePods';
import { usePodMemberPerformance } from '@/hooks/usePodHealth';
import { Loader2, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PodMemberDrawerProps {
  podId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PodMemberDrawer({ podId, open, onOpenChange }: PodMemberDrawerProps) {
  const { data: pod } = usePod(podId || undefined);
  const { data: members, isLoading } = usePodMemberPerformance(podId || undefined);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[700px]">
        <SheetHeader>
          <div className="flex items-center gap-3">
            {pod && (
              <div
                className="h-10 w-10 rounded-full shrink-0"
                style={{ backgroundColor: pod.color || '#3b82f6' }}
              />
            )}
            <div>
              <SheetTitle>{pod?.name || 'Pod Members'}</SheetTitle>
              <SheetDescription>Member productivity and performance details</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="mt-6">
            {members && members.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Productivity</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.employee_id}>
                      <TableCell className="font-medium">{member.employee_name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {member.email}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {member.department || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {member.location || '—'}
                      </TableCell>
                      <TableCell>
                        {member.productivity_pct !== null ? (
                          <Badge
                            variant={
                              member.productivity_pct >= 85
                                ? 'default'
                                : member.productivity_pct >= 60
                                  ? 'secondary'
                                  : 'destructive'
                            }
                            className={cn(
                              member.productivity_pct >= 85 && 'bg-green-100 text-green-700',
                              member.productivity_pct >= 60 &&
                                member.productivity_pct < 85 &&
                                'bg-yellow-100 text-yellow-700',
                              member.productivity_pct < 60 && 'bg-red-100 text-red-700'
                            )}
                          >
                            {member.productivity_pct.toFixed(1)}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">No data</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {member.role === 'manager' ? (
                          <Badge variant="outline">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Manager
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Member</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No member data available</p>
                <p className="text-sm mt-1">Productivity data will appear here once available</p>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

