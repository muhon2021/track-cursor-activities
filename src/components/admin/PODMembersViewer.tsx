/**
 * PODMembersViewer - Sheet/drawer to view members of a pod
 */

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePod } from '@/hooks/usePods';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, UserCheck, UserX, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PodMember } from '@/types/pods';

export interface PODMembersViewerProps {
  podId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PODMembersViewer({ podId, open, onOpenChange }: PODMembersViewerProps) {
  const { data: pod, isLoading: podLoading } = usePod(podId || undefined);

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['pod-members', podId],
    queryFn: async (): Promise<PodMember[]> => {
      if (!podId) return [];

      // Get pod_employees
      const { data: podEmployees, error: peError } = await (supabase as any)
        .from('pod_employees')
        .select('*')
        .eq('pod_id', podId)
        .eq('is_active', true);

      if (peError) throw peError;
      if (!podEmployees || podEmployees.length === 0) return [];

      // Get employee IDs
      const employeeIds = podEmployees.map((pe) => pe.employee_id).filter(Boolean);
      const userIds = podEmployees.map((pe) => pe.user_id).filter(Boolean);

      // Fetch employee data
      const [employeesRes, profilesRes] = await Promise.all([
        employeeIds.length > 0
          ? supabase
              .from('employee_profiles')
              .select('id, email, full_name, title, department, location')
              .in('id', employeeIds)
          : { data: [], error: null },
        userIds.length > 0
          ? supabase
              .from('profiles')
              .select('id, email, full_name')
              .in('id', userIds)
          : { data: [], error: null },
      ]);

      const employees = (employeesRes.data || []) as any[];
      const profiles = (profilesRes.data || []) as any[];

      const employeeMap = new Map<string, any>();
      employees.forEach((emp) => {
        employeeMap.set(emp.id, emp);
      });

      const profileMap = new Map<string, any>();
      profiles.forEach((prof) => {
        profileMap.set(prof.id, prof);
      });

      // Combine data
      return podEmployees.map((pe) => {
        const employee = pe.employee_id ? employeeMap.get(pe.employee_id) : null;
        const profile = pe.user_id ? profileMap.get(pe.user_id) : null;

        return {
          id: pe.id,
          pod_id: pe.pod_id,
          user_id: pe.user_id,
          employee_id: pe.employee_id,
          has_login: pe.has_login,
          source: pe.source,
          role: pe.role,
          employee: employee
            ? {
                id: employee.id,
                name: employee.full_name || employee.email,
                email: employee.email,
                title: employee.title,
                department: employee.department,
                location: employee.location,
              }
            : undefined,
          profile: profile
            ? {
                id: profile.id,
                email: profile.email,
                full_name: profile.full_name,
              }
            : undefined,
        } as PodMember;
      });
    },
    enabled: !!podId && open,
  });

  const isLoading = podLoading || membersLoading;

  // Calculate stats
  const rpMembersCount = members?.length || 0;
  const hasLoginCount = members?.filter((m) => m.has_login).length || 0;
  const noLoginCount = members?.filter((m) => !m.has_login).length || 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[600px]">
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
              <SheetDescription>
                {pod?.description || 'View and manage pod members'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4 mt-6">
            {/* Summary badges */}
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3 w-3" />
                {rpMembersCount} RP Members
              </Badge>
              <Badge variant="secondary" className="bg-success/10 text-success border-success/30 gap-1">
                <UserCheck className="h-3 w-3" />
                {hasLoginCount} Has Login
              </Badge>
              <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200 gap-1">
                <UserX className="h-3 w-3" />
                {noLoginCount} No Login
              </Badge>
            </div>

            {/* Member list */}
            <ScrollArea className="h-[calc(100vh-250px)]">
              <div className="space-y-2">
                {members && members.length > 0 ? (
                  members.map((member) => {
                    const name =
                      member.employee?.name ||
                      member.profile?.full_name ||
                      member.employee?.email ||
                      member.profile?.email ||
                      'Unknown';
                    const email = member.employee?.email || member.profile?.email || '';
                    const department = member.employee?.department || '—';
                    const location = member.employee?.location || '—';

                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{name}</p>
                            {member.role === 'manager' && (
                              <Badge variant="outline" className="text-xs">
                                Manager
                              </Badge>
                            )}
                            {member.source === 'synced' && (
                              <Badge variant="secondary" className="text-xs">
                                HR Synced
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{email}</p>
                          <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                            <span>{department}</span>
                            <span>{location}</span>
                          </div>
                        </div>
                        <div className="ml-4">
                          {member.has_login ? (
                            <Badge
                              variant="secondary"
                              className="bg-success/10 text-success border-success/30"
                            >
                              <UserCheck className="h-3 w-3 mr-1" />
                              Login
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="bg-orange-100 text-orange-700 border-orange-200"
                            >
                              <UserX className="h-3 w-3 mr-1" />
                              No Login
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-40" />
                    <p>No members in this pod</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

