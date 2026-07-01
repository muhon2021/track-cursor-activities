/**
 * PodHealthTable - Table with SLA status, manager assignment, drill-down
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Eye, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PodHealthRecord, PodMemberPerformance } from '@/types/pods';

export interface PodHealthTableProps {
  records: PodHealthRecord[];
  memberPerformance?: Map<string, PodMemberPerformance[]>;
  onViewMembers?: (podId: string) => void;
  onAssignManager?: (podId: string, employeeId: string | null) => void;
  isLoading?: boolean;
}

export function PodHealthTable({
  records,
  memberPerformance,
  onViewMembers,
  onAssignManager,
  isLoading = false,
}: PodHealthTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Loading pod health data...</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No pod health data available</p>
        <p className="text-sm">Pods will appear here once they have members and productivity data</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Pod Name</TableHead>
          <TableHead>Manager</TableHead>
          <TableHead>Throughput</TableHead>
          <TableHead>SLA Status</TableHead>
          <TableHead>Coaching Needs</TableHead>
          <TableHead>Members</TableHead>
          <TableHead className="w-12">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record) => {
          const members = memberPerformance?.get(record.pod_id) || [];
          const managerOptions = members.filter((m) => m.role !== 'manager');

          return (
            <TableRow key={record.pod_id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div
                    className="h-6 w-6 rounded-full shrink-0"
                    style={{ backgroundColor: record.pod_color }}
                  />
                  <span className="font-medium">{record.pod_name}</span>
                </div>
              </TableCell>
              <TableCell>
                {onAssignManager ? (
                  <Select
                    value={record.manager_id || '__none__'}
                    onValueChange={(value) =>
                      onAssignManager(record.pod_id, value === '__none__' ? null : value)
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select manager..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No Manager</SelectItem>
                      {members
                        .filter((m) => m.role === 'manager')
                        .map((m) => (
                          <SelectItem key={m.employee_id} value={m.employee_id}>
                            {m.employee_name}
                          </SelectItem>
                        ))}
                      {managerOptions.map((m) => (
                        <SelectItem key={m.employee_id} value={m.employee_id}>
                          {m.employee_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-muted-foreground">
                    {record.manager_name || 'No Manager'}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <span className="font-medium">{record.throughput_pct.toFixed(1)}%</span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={record.is_out_of_sla ? 'destructive' : 'secondary'}
                    className={cn(
                      record.is_out_of_sla && 'bg-red-100 text-red-700 border-red-200'
                    )}
                  >
                    {record.sla_adherence_pct.toFixed(1)}%
                  </Badge>
                  {record.is_out_of_sla && (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </TableCell>
              <TableCell>
                {record.coaching_needs_count > 0 ? (
                  <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200">
                    {record.coaching_needs_count}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </TableCell>
              <TableCell>
                <span className="text-muted-foreground">{record.member_count}</span>
              </TableCell>
              <TableCell>
                {onViewMembers && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onViewMembers(record.pod_id)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

