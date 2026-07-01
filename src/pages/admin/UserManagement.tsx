import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, UserPlus, Edit, Trash2, Shield, Mail, Calendar, Loader2, Ban, RefreshCw, X, MoreHorizontal, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { getInitials, formatDate } from "@/lib/utils";
import { useUserInvites, useCreateUserInvite, useDeleteUserInvite, useResendUserInvite } from "@/hooks/useUserInvites";
import { useDepartments } from "@/hooks/useDepartments";
import { BulkInviteDialog } from "@/components/admin/BulkInviteDialog";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_active: boolean;
  deactivated_at: string | null;
  deactivated_by: string | null;
  department_id: string | null;
}

async function extractEdgeFunctionError(error: { message?: string; context?: Response }): Promise<string> {
  try {
    const body = await error.context?.clone().json();
    return body?.message || body?.error || error.message || "Action failed";
  } catch {
    return error.message || "Action failed";
  }
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [bulkInviteDialogOpen, setBulkInviteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [editRole, setEditRole] = useState("");
  const [processing, setProcessing] = useState(false);

  // Invite hooks
  const { data: pendingInvites = [], isLoading: invitesLoading } = useUserInvites();
  const createInvite = useCreateUserInvite();
  const deleteInvite = useDeleteUserInvite();
  const resendInvite = useResendUserInvite();
  const { data: departments = [] } = useDepartments({ activeOnly: true });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url, created_at, is_active, deactivated_at, deactivated_by")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: deptAssignments } = await supabase
        .from("department_users")
        .select("user_id, department_id");

      const departmentByUser = new Map(
        (deptAssignments || []).map((row) => [row.user_id, row.department_id])
      );

      // Fetch roles for each user
      const usersWithRoles = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id)
            .single();

          return {
            ...profile,
            role: roleData?.role || null,
            last_sign_in_at: null, // Would need auth.users table access
            is_active: profile.is_active ?? true,
            department_id: departmentByUser.get(profile.id) || null,
          };
        })
      );

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    setProcessing(true);
    try {
      await createInvite.mutateAsync({
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("user");
    } catch (error: any) {
      // Error handling is done in the mutation hook
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateUserRole = async () => {
    if (!selectedUser) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("rbac-manage", {
        body: {
          action: "change_user_role",
          target_user_id: selectedUser.id,
          new_role: editRole,
        },
      });

      if (error) {
        toast.error(await extractEdgeFunctionError(error));
        return;
      }
      if (data?.error) {
        toast.error(data.message || data.error);
        return;
      }

      toast.success("User role updated successfully");
      setEditDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error("Error updating user role:", error);
      toast.error("Failed to update user role");
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (
      !confirm(
        "Permanently delete this user? Their account, profile, and related data will be removed from the database. This cannot be undone."
      )
    ) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("manage-user-status", {
        body: { action: "remove", target_user_id: userId },
      });

      if (error) {
        toast.error(await extractEdgeFunctionError(error));
        return;
      }
      if (data?.error) {
        toast.error(data.message || data.error);
        return;
      }

      toast.success("User permanently deleted");
      fetchUsers();
    } catch (error: any) {
      console.error("Error removing user:", error);
      toast.error("Failed to remove user");
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-user-status", {
        body: {
          action: currentStatus ? "suspend" : "reactivate",
          target_user_id: userId,
        },
      });

      if (error) {
        toast.error(await extractEdgeFunctionError(error));
        return;
      }
      if (data?.error) {
        toast.error(data.message || data.error);
        return;
      }

      toast.success(`User ${currentStatus ? "deactivated" : "activated"} successfully`);
      fetchUsers();
    } catch (error: any) {
      console.error("Error toggling user status:", error);
      toast.error("Failed to update user status");
    }
  };

  const openEditDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setEditRole(user.role || "user");
    setEditDialogOpen(true);
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || (user.role || "user") === roleFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && user.is_active) ||
      (statusFilter === "suspended" && !user.is_active);
    const matchesDepartment =
      departmentFilter === "all" || user.department_id === departmentFilter;

    return matchesSearch && matchesRole && matchesStatus && matchesDepartment;
  });

  const adminCount = users.filter((u) => u.role === "admin").length;

  const getRoleBadgeVariant = (role: string | null): "default" | "secondary" | "destructive" | "outline" => {
    switch (role) {
      case "admin":
        return "destructive";
      case "manager":
        return "default";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkInviteDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Bulk Invite (CSV)
          </Button>
          <Button onClick={() => setInviteDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite User
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter((u) => u.is_active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter((u) => u.role === "admin").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending Invites</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingInvites.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>Users who have been invited but haven't accepted yet</CardDescription>
          </CardHeader>
          <CardContent>
            {invitesLoading ? (
              <div className="flex h-20 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{invite.email}</p>
                        <p className="text-sm text-muted-foreground">
                          Role: {invite.role} • Expires {formatDate(invite.expires_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resendInvite.mutate(invite.id)}
                        disabled={resendInvite.isPending}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteInvite.mutate(invite.id)}
                        disabled={deleteInvite.isPending}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>View and manage all user accounts</CardDescription>
          <div className="flex flex-col gap-3 mt-4 sm:flex-row sm:items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} className={!user.is_active ? "opacity-60" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(user.full_name || user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {user.full_name || "Unnamed User"}
                          </span>
                          {user.id === currentUser?.id && (
                            <Badge variant="outline" className="text-xs">
                              You
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {user.role || "user"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? "outline" : "secondary"}>
                          {user.is_active ? "Active" : "Suspended"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(user.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        {(() => {
                          const isSelf = user.id === currentUser?.id;
                          const isLastAdmin = user.role === "admin" && adminCount <= 1;
                          const roleChangeDisabled = isSelf || isLastAdmin;
                          const roleChangeReason = isSelf
                            ? "You cannot change your own role"
                            : isLastAdmin
                            ? "Cannot change the role of the last remaining admin"
                            : null;
                          const statusActionDisabled = isSelf || (user.is_active && isLastAdmin);
                          const statusActionReason = isSelf
                            ? "You cannot suspend your own account"
                            : "Cannot suspend the last remaining admin";
                          const removeDisabled = isSelf || isLastAdmin;
                          const removeReason = isSelf
                            ? "You cannot delete your own account"
                            : "Cannot delete the last remaining admin";

                          return (
                            <TooltipProvider>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {roleChangeDisabled ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div>
                                          <DropdownMenuItem disabled>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Change Role
                                          </DropdownMenuItem>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>{roleChangeReason}</TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <DropdownMenuItem onClick={() => openEditDialog(user)}>
                                      <Edit className="mr-2 h-4 w-4" />
                                      Change Role
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  {statusActionDisabled ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div>
                                          <DropdownMenuItem disabled>
                                            {user.is_active ? (
                                              <Ban className="mr-2 h-4 w-4" />
                                            ) : (
                                              <UserCheck className="mr-2 h-4 w-4" />
                                            )}
                                            {user.is_active ? "Suspend" : "Reactivate"}
                                          </DropdownMenuItem>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>{statusActionReason}</TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                                    >
                                      {user.is_active ? (
                                        <Ban className="mr-2 h-4 w-4" />
                                      ) : (
                                        <UserCheck className="mr-2 h-4 w-4" />
                                      )}
                                      {user.is_active ? "Suspend" : "Reactivate"}
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  {removeDisabled ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div>
                                          <DropdownMenuItem disabled className="text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete user
                                          </DropdownMenuItem>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>{removeReason}</TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteUser(user.id)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete user
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TooltipProvider>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invite User Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite New User</DialogTitle>
            <DialogDescription>
              Send an invitation email to a new user
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={processing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole} disabled={processing}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInviteDialogOpen(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button onClick={handleInviteUser} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Role Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
            <DialogDescription>
              Change the role for {selectedUser?.full_name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editRole">Role</Label>
              <Select value={editRole} onValueChange={setEditRole} disabled={processing}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateUserRole} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Update Role
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkInviteDialog open={bulkInviteDialogOpen} onOpenChange={setBulkInviteDialogOpen} />
    </div>
  );
}
