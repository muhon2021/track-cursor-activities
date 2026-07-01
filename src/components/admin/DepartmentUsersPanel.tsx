/**
 * DepartmentUsersPanel - View and manage users assigned to a department
 */

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Building2, Loader2, Plus, Search, UserMinus, Users } from "lucide-react";
import { getInitials } from "@/lib/utils";
import {
  useDepartment,
  useDepartmentUsers,
  useAvailableDepartmentUsers,
  useAssignDepartmentUser,
  useRemoveDepartmentUser,
  type DepartmentUser,
} from "@/hooks/useDepartments";

export interface DepartmentUsersPanelProps {
  departmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DepartmentUsersPanel({
  departmentId,
  open,
  onOpenChange,
}: DepartmentUsersPanelProps) {
  const [search, setSearch] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [removingUser, setRemovingUser] = useState<DepartmentUser | null>(null);

  const { data: department, isLoading: deptLoading } = useDepartment(departmentId || undefined);
  const { data: users = [], isLoading: usersLoading } = useDepartmentUsers(departmentId || undefined);
  const { data: availableUsers = [], isLoading: availableLoading } = useAvailableDepartmentUsers(
    departmentId || undefined,
    assignSearch
  );
  const assignUser = useAssignDepartmentUser();
  const removeUser = useRemoveDepartmentUser();

  const filteredUsers = users.filter((user) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (user.profile?.full_name || "").toLowerCase().includes(q) ||
      (user.profile?.email || "").toLowerCase().includes(q)
    );
  });

  const handleAssign = async (userId: string) => {
    if (!departmentId) return;
    try {
      await assignUser.mutateAsync({ departmentId, userId });
      setAssignOpen(false);
      setAssignSearch("");
    } catch {
      // Handled by mutation hook
    }
  };

  const handleRemove = async () => {
    if (!departmentId || !removingUser) return;
    try {
      await removeUser.mutateAsync({
        departmentId,
        userId: removingUser.user_id,
        assignmentId: removingUser.id,
      });
      setRemovingUser(null);
    } catch {
      // Handled by mutation hook
    }
  };

  const isLoading = deptLoading || usersLoading;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg w-full">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {department?.name || "Department"}
            </SheetTitle>
            <SheetDescription>
              {department?.description || "Manage users assigned to this department."}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search assigned users..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Popover open={assignOpen} onOpenChange={setAssignOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Assign
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search users..."
                      value={assignSearch}
                      onValueChange={setAssignSearch}
                    />
                    <CommandList>
                      {availableLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : availableUsers.length === 0 ? (
                        <CommandEmpty>No available users found.</CommandEmpty>
                      ) : (
                        <CommandGroup>
                          {availableUsers.map((profile) => (
                            <CommandItem
                              key={profile.id}
                              value={profile.id}
                              onSelect={() => handleAssign(profile.id)}
                              disabled={assignUser.isPending}
                            >
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={profile.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(profile.full_name || profile.email || "?")}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">{profile.full_name || "Unnamed"}</p>
                                  <p className="text-xs text-muted-foreground">{profile.email}</p>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mb-4 opacity-40" />
                <p className="text-lg font-medium">No users assigned</p>
                <p className="text-sm">Assign users to this department using the button above.</p>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-220px)]">
                <div className="space-y-2 pr-4">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.profile?.avatar_url || undefined} />
                          <AvatarFallback>
                            {getInitials(user.profile?.full_name || user.profile?.email || "?")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">
                            {user.profile?.full_name || "Unnamed User"}
                          </p>
                          <p className="text-xs text-muted-foreground">{user.profile?.email}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Remove from department"
                        onClick={() => setRemovingUser(user)}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!removingUser} onOpenChange={(open) => !open && setRemovingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove user from department?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove{" "}
              <strong>{removingUser?.profile?.full_name || removingUser?.profile?.email}</strong> from{" "}
              <strong>{department?.name}</strong>. This action can be undone by re-assigning the user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} disabled={removeUser.isPending}>
              {removeUser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
