/**
 * PODManagementDialog - Create/Edit dialog with tabs
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, UserCheck, UserX } from 'lucide-react';
import { usePod, useCreatePod, useUpdatePod } from '@/hooks/usePods';
import { useEmployeeDirectory } from '@/hooks/useEmployeeDirectory';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { ResourceProjectionTab } from './ResourceProjectionTab';
import type { PodFormData, AppModule } from '@/types/pods';

const POD_COLORS = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#22c55e', label: 'Green' },
  { value: '#f97316', label: 'Orange' },
  { value: '#a855f7', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#ef4444', label: 'Red' },
];

export interface PODManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  podId?: string; // If provided, edit mode; otherwise create mode
}

export function PODManagementDialog({
  open,
  onOpenChange,
  podId,
}: PODManagementDialogProps) {
  const isEditMode = !!podId;
  const { data: pod } = usePod(podId);
  const createPod = useCreatePod();
  const updatePod = useUpdatePod();

  const [formData, setFormData] = useState<PodFormData>({
    name: '',
    description: '',
    color: POD_COLORS[0].value,
    show_in_resource_projection: true,
    members: [],
    permissions: [],
  });

  const [membersSearch, setMembersSearch] = useState('');
  const [permissionsSearch, setPermissionsSearch] = useState('');

  const { data: employees, isLoading: employeesLoading } = useEmployeeDirectory();

  // Fetch app modules for permissions tab
  const { data: modules } = useQuery({
    queryKey: ['app-modules'],
    queryFn: async (): Promise<AppModule[]> => {
      const { data, error } = await supabase
        .from('app_modules')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return (data || []) as AppModule[];
    },
  });

  // Fetch current pod members and permissions
  const { data: currentMembers } = useQuery({
    queryKey: ['pod-members-for-dialog', podId],
    queryFn: async (): Promise<string[]> => {
      if (!podId) return [];
      const { data, error } = await (supabase as any)
        .from('pod_employees')
        .select('employee_id')
        .eq('pod_id', podId)
        .eq('source', 'manual')
        .eq('is_active', true);

      if (error) throw error;
      return (data || []).map((m: any) => m.employee_id).filter(Boolean);
    },
    enabled: isEditMode && !!podId,
  });

  const { data: currentPermissions } = useQuery({
    queryKey: ['pod-permissions-for-dialog', podId],
    queryFn: async (): Promise<string[]> => {
      if (!podId) return [];
      const { data, error } = await (supabase as any)
        .from('pod_permissions')
        .select('module_id')
        .eq('pod_id', podId);

      if (error) throw error;
      return (data || []).map((p: any) => p.module_id);
    },
    enabled: isEditMode && !!podId,
  });

  // Initialize form data when pod loads
  useEffect(() => {
    if (pod) {
      setFormData({
        name: pod.name,
        description: pod.description || '',
        color: pod.color || POD_COLORS[0].value,
        show_in_resource_projection: pod.show_in_resource_projection,
        members: currentMembers || [],
        permissions: currentPermissions || [],
      });
    } else if (!isEditMode) {
      // Reset for create mode
      setFormData({
        name: '',
        description: '',
        color: POD_COLORS[0].value,
        show_in_resource_projection: true,
        members: [],
        permissions: [],
      });
    }
  }, [pod, currentMembers, currentPermissions, isEditMode]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      return;
    }

    if (isEditMode && podId) {
      await updatePod.mutateAsync({ id: podId, data: formData });
    } else {
      await createPod.mutateAsync(formData);
    }
    onOpenChange(false);
  };

  const filteredEmployees =
    employees?.filter(
      (emp) =>
        membersSearch.trim() === '' ||
        emp.full_name.toLowerCase().includes(membersSearch.toLowerCase()) ||
        emp.email.toLowerCase().includes(membersSearch.toLowerCase())
    ) || [];

  const filteredModules =
    modules?.filter(
      (mod) =>
        permissionsSearch.trim() === '' ||
        mod.name.toLowerCase().includes(permissionsSearch.toLowerCase()) ||
        mod.description?.toLowerCase().includes(permissionsSearch.toLowerCase())
    ) || [];

  const toggleMember = (employeeId: string) => {
    const current = formData.members || [];
    if (current.includes(employeeId)) {
      setFormData({ ...formData, members: current.filter((id) => id !== employeeId) });
    } else {
      setFormData({ ...formData, members: [...current, employeeId] });
    }
  };

  const togglePermission = (moduleId: string) => {
    const current = formData.permissions || [];
    if (current.includes(moduleId)) {
      setFormData({ ...formData, permissions: current.filter((id) => id !== moduleId) });
    } else {
      setFormData({ ...formData, permissions: [...current, moduleId] });
    }
  };

  const isLoading = createPod.isPending || updatePod.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit POD' : 'Create New POD'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update pod details, members, and permissions'
              : 'Create a new pod (team) and configure its settings'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="members">
              Members ({formData.members?.length || 0})
            </TabsTrigger>
            {isEditMode && (
              <TabsTrigger value="rp">Resource Projection</TabsTrigger>
            )}
            <TabsTrigger value="permissions">
              Permissions ({formData.permissions?.length || 0})
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden mt-4">
            <TabsContent value="details" className="space-y-4 mt-0 h-full overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="pod-name">
                  POD Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="pod-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter POD name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pod-desc">Description</Label>
                <Textarea
                  id="pod-desc"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter description (optional)"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2 flex-wrap">
                  {POD_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      aria-label={c.label}
                      onClick={() => setFormData({ ...formData, color: c.value })}
                      className={cn(
                        'h-9 w-9 rounded-full border-2 transition-shadow focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                        formData.color === c.value
                          ? 'border-foreground shadow-md ring-2 ring-offset-2 ring-primary'
                          : 'border-transparent hover:border-muted-foreground/50'
                      )}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-in-rp"
                  checked={formData.show_in_resource_projection}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, show_in_resource_projection: !!checked })
                  }
                />
                <Label htmlFor="show-in-rp" className="cursor-pointer">
                  Show in Resource Projection
                </Label>
              </div>
            </TabsContent>

            <TabsContent value="members" className="space-y-4 mt-0 h-full overflow-y-auto">
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search employees..."
                    value={membersSearch}
                    onChange={(e) => setMembersSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <ScrollArea className="h-[400px] border rounded-lg p-4">
                  {employeesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : filteredEmployees.length > 0 ? (
                    <div className="space-y-2">
                      {filteredEmployees.map((emp) => {
                        const isSelected = formData.members?.includes(emp.id);
                        return (
                          <div
                            key={emp.id}
                            className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-accent cursor-pointer"
                            onClick={() => toggleMember(emp.id)}
                          >
                            <Checkbox checked={isSelected} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{emp.full_name}</p>
                              <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                              {emp.title && (
                                <p className="text-xs text-muted-foreground">{emp.title}</p>
                              )}
                            </div>
                            {emp.has_login ? (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <UserCheck className="h-3 w-3" />
                                Has Login
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs gap-1">
                                <UserX className="h-3 w-3" />
                                No Login
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No employees found</p>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>

            {isEditMode && (
              <TabsContent value="rp" className="mt-0 h-full overflow-y-auto">
                <ResourceProjectionTab
                  podId={podId!}
                  currentMembers={formData.members || []}
                  onMembersChange={(members) => setFormData({ ...formData, members })}
                />
              </TabsContent>
            )}

            <TabsContent value="permissions" className="space-y-4 mt-0 h-full overflow-y-auto">
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search modules..."
                    value={permissionsSearch}
                    onChange={(e) => setPermissionsSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <ScrollArea className="h-[400px] border rounded-lg p-4">
                  {filteredModules && filteredModules.length > 0 ? (
                    <div className="space-y-2">
                      {filteredModules.map((mod) => {
                        const isSelected = formData.permissions?.includes(mod.id);
                        return (
                          <div
                            key={mod.id}
                            className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-accent cursor-pointer"
                            onClick={() => togglePermission(mod.id)}
                          >
                            <Checkbox checked={isSelected} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{mod.name}</p>
                              {mod.description && (
                                <p className="text-xs text-muted-foreground">{mod.description}</p>
                              )}
                              {mod.page_route && (
                                <p className="text-xs text-muted-foreground">{mod.page_route}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No modules found</p>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !formData.name.trim()}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEditMode ? 'Update POD' : 'Create POD'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

