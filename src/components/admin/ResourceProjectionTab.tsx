/**
 * ResourceProjectionTab - Tab inside dialog for managing RP members
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, Plus, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmployeeDirectory } from '@/hooks/useEmployeeDirectory';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ResourceProjectionTabProps {
  podId: string;
  currentMembers: string[]; // employee_ids
  onMembersChange: (memberIds: string[]) => void;
}

export function ResourceProjectionTab({
  podId,
  currentMembers,
  onMembersChange,
}: ResourceProjectionTabProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: employees, isLoading } = useEmployeeDirectory();

  // Get current member details
  const { data: currentMemberDetails } = useQuery({
    queryKey: ['rp-members', podId],
    queryFn: async () => {
      if (!currentMembers || currentMembers.length === 0) return [];

      const { data, error } = await (supabase as any)
        .from('employee_profiles')
        .select('id, email, full_name, title, department, location')
        .in('id', currentMembers);

      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        email: string;
        full_name: string;
        title: string | null;
        department: string | null;
        location: string | null;
      }>;
    },
    enabled: currentMembers.length > 0,
  });

  const availableEmployees =
    employees?.filter(
      (emp) =>
        !currentMembers.includes(emp.id) &&
        (search.trim() === '' ||
          emp.full_name.toLowerCase().includes(search.toLowerCase()) ||
          emp.email.toLowerCase().includes(search.toLowerCase()))
    ) || [];

  const handleAddMember = (employeeId: string) => {
    onMembersChange([...currentMembers, employeeId]);
    setOpen(false);
    setSearch('');
  };

  const handleRemoveMember = (employeeId: string) => {
    onMembersChange(currentMembers.filter((id) => id !== employeeId));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Resource Projection Members</p>
          <p className="text-xs text-muted-foreground">
            Add employees who should appear in Resource Projection for this pod
          </p>
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="end">
            <Command>
              <CommandInput
                placeholder="Search employees..."
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                <CommandEmpty>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    'No employees found'
                  )}
                </CommandEmpty>
                <CommandGroup>
                  {availableEmployees.map((emp) => (
                    <CommandItem
                      key={emp.id}
                      value={emp.id}
                      onSelect={() => handleAddMember(emp.id)}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{emp.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                          {emp.title && (
                            <p className="text-xs text-muted-foreground">{emp.title}</p>
                          )}
                        </div>
                        {emp.has_login ? (
                          <Badge variant="secondary" className="text-xs">
                            Has Login
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            No Login
                          </Badge>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Current members list */}
      <ScrollArea className="h-[300px] border rounded-lg p-4">
        {currentMemberDetails && currentMemberDetails.length > 0 ? (
          <div className="space-y-2">
            {currentMemberDetails.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-2 border rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{member.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  <div className="flex gap-2 mt-1">
                    {member.title && (
                      <Badge variant="outline" className="text-xs">
                        {member.title}
                      </Badge>
                    )}
                    {member.department && (
                      <Badge variant="outline" className="text-xs">
                        {member.department}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 ml-2"
                  onClick={() => handleRemoveMember(member.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No members added yet</p>
            <p className="text-xs mt-1">Click "Add Member" to add employees to Resource Projection</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

