import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useRoles,
  useDeleteRole,
  useCloneRole,
  useRoleUsers,
  Role,
} from "@/hooks/useRoles";
import { Button } from "@/components/ui/button";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Copy,
  Grid3X3,
  Users,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissionCatalog } from "@/hooks/usePermissions";
import { format } from "date-fns";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";
import AgencyRoles from "@/pages/admin/AgencyRoles";

function RoleCatalog() {
  const { data: roles, isLoading, isError } = useRoles();
  const { data: permissions } = usePermissionCatalog();
  const deleteRole = useDeleteRole();
  const cloneRole = useCloneRole();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailRole, setDetailRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [reassignToRoleId, setReassignToRoleId] = useState<string>("");

  const { data: roleUsers } = useRoleUsers(detailRole?.id);

  const openDeleteDialog = (role: Role) => {
    setDeletingRole(role);
    setReassignToRoleId("");
    setDeleteDialogOpen(true);
  };

  const reassignableRoles = (roles ?? []).filter((r) => r.id !== deletingRole?.id);
  const needsReassignment = (deletingRole?.assigned_user_count ?? 0) > 0;

  const handleDelete = async () => {
    if (!deletingRole) return;
    if (needsReassignment && !reassignToRoleId) return;
    try {
      await deleteRole.mutateAsync({
        id: deletingRole.id,
        reassignToRoleId: needsReassignment ? reassignToRoleId : undefined,
      });
      setDeleteDialogOpen(false);
      setDeletingRole(null);
    } catch {
      // handled by mutation
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Role Catalog</h1>
          <p className="text-muted-foreground">Manage system roles and assignments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/roles/permissions">
              <Grid3X3 className="mr-2 h-4 w-4" />
              Permission Matrix
            </Link>
          </Button>
          <Button asChild>
            <Link to="/admin/roles/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Role
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{permissions?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">System Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {roles?.filter((r) => r.is_system).length ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Roles</CardTitle>
          <CardDescription>View, clone, and manage roles</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <p className="text-center text-destructive py-8">
              Failed to load roles. Ensure the RBAC migration has been applied.
            </p>
          ) : !roles?.length ? (
            <p className="text-center text-muted-foreground py-8">
              No roles found. Create your first role to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="flex items-center gap-2 text-left hover:underline"
                        onClick={() => setDetailRole(role)}
                      >
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{role.name}</span>
                        {role.is_system && (
                          <Badge variant="secondary" className="text-xs">
                            System
                          </Badge>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {role.description || "—"}
                    </TableCell>
                    <TableCell>{role.permission_count ?? 0}</TableCell>
                    <TableCell>{role.assigned_user_count ?? 0}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(role.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Clone role"
                          onClick={() => cloneRole.mutate(role.id)}
                          disabled={cloneRole.isPending}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" asChild disabled={role.is_system}>
                          <Link to={`/admin/roles/${role.id}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(role)}
                          disabled={role.is_system}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              {needsReassignment
                ? `This role has ${deletingRole?.assigned_user_count} assigned member(s). Choose a replacement role before deleting — they will be reassigned automatically.`
                : "This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {needsReassignment && (
            <div className="space-y-2 py-2">
              <Select value={reassignToRoleId} onValueChange={setReassignToRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select replacement role" />
                </SelectTrigger>
                <SelectContent>
                  {reassignableRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteRole.isPending || (needsReassignment && !reassignToRoleId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={!!detailRole} onOpenChange={(open) => !open && setDetailRole(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {detailRole && (
            <>
              <SheetHeader>
                <SheetTitle>{detailRole.name}</SheetTitle>
                <SheetDescription>{detailRole.description || "No description"}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Created</span>
                  <p>{format(new Date(detailRole.created_at), "PPP")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Permission Count</span>
                  <p>{detailRole.permission_count ?? 0}</p>
                </div>
                <div>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Users className="h-4 w-4" /> Assigned Users
                  </span>
                  <ul className="mt-2 space-y-1">
                    {!roleUsers?.length ? (
                      <li className="text-muted-foreground">No users assigned</li>
                    ) : (
                      roleUsers.map((entry: any) => (
                        <li key={entry.user_id}>
                          {entry.profiles?.full_name || entry.profiles?.email || entry.user_id}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function RoleManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "agency" ? "agency" : "permissions";

  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onValueChange={(value) => {
          const next = new URLSearchParams(searchParams);
          if (value === "permissions") next.delete("tab");
          else next.set("tab", value);
          setSearchParams(next, { replace: true });
        }}
      >
        <TabsList>
          <TabsTrigger value="permissions">Permissions & Role Catalog</TabsTrigger>
          <TabsTrigger value="agency">Agency Role & Dashboard</TabsTrigger>
        </TabsList>
        <TabsContent value="permissions" className="mt-4">
          <RoleCatalog />
        </TabsContent>
        <TabsContent value="agency" className="mt-4">
          <AgencyRoles />
        </TabsContent>
      </Tabs>
    </div>
  );
}
