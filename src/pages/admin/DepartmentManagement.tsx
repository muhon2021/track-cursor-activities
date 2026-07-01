/**
 * Department Management Admin Page
 * Route: /admin/departments
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Building2, Loader2, Plus, Search } from "lucide-react";
import {
  useDepartments,
  useDeleteDepartment,
  type DepartmentSortDir,
  type DepartmentSortField,
  type DepartmentWithStats,
} from "@/hooks/useDepartments";
import { DepartmentsTable } from "@/components/admin/DepartmentsTable";
import { DepartmentDialog } from "@/components/admin/DepartmentDialog";
import { DepartmentUsersPanel } from "@/components/admin/DepartmentUsersPanel";

export default function DepartmentManagement() {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<DepartmentSortField>("name");
  const [sortDir, setSortDir] = useState<DepartmentSortDir>("asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<DepartmentWithStats | null>(null);
  const [deletingDepartment, setDeletingDepartment] = useState<DepartmentWithStats | null>(null);
  const [usersPanelDepartmentId, setUsersPanelDepartmentId] = useState<string | null>(null);

  const { data: departments = [], isLoading } = useDepartments({
    search,
    sortField,
    sortDir,
    activeOnly: true,
  });
  const deleteDepartment = useDeleteDepartment();

  const handleSort = (field: DepartmentSortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handleCreate = () => {
    setEditingDepartment(null);
    setDialogOpen(true);
  };

  const handleEdit = (department: DepartmentWithStats) => {
    setEditingDepartment(department);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingDepartment) return;
    try {
      await deleteDepartment.mutateAsync(deletingDepartment.id);
      setDeletingDepartment(null);
    } catch {
      // Handled by mutation hook
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Department Management</h1>
          <p className="text-muted-foreground">
            Manage departments and assign users to organizational units
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Department
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search departments..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : departments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Building2 className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg font-medium">No departments found</p>
          <p className="text-sm">
            {search ? "Try a different search term." : "Create your first department to get started."}
          </p>
        </div>
      ) : (
        <Card>
          <DepartmentsTable
            departments={departments}
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
            onEdit={handleEdit}
            onDelete={setDeletingDepartment}
            onViewUsers={(dept) => setUsersPanelDepartmentId(dept.id)}
          />
        </Card>
      )}

      <DepartmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        department={editingDepartment}
      />

      <DepartmentUsersPanel
        departmentId={usersPanelDepartmentId}
        open={!!usersPanelDepartmentId}
        onOpenChange={(open) => !open && setUsersPanelDepartmentId(null)}
      />

      <AlertDialog
        open={!!deletingDepartment}
        onOpenChange={(open) => !open && setDeletingDepartment(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate department?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate <strong>{deletingDepartment?.name}</strong>.
              {deletingDepartment && deletingDepartment.user_count > 0 && (
                <>
                  {" "}
                  This department has <strong>{deletingDepartment.user_count}</strong> assigned user
                  {deletingDepartment.user_count === 1 ? "" : "s"}.
                </>
              )}
              {deletingDepartment && deletingDepartment.pod_count > 0 && (
                <>
                  {" "}
                  It is linked to <strong>{deletingDepartment.pod_count}</strong> active POD
                  {deletingDepartment.pod_count === 1 ? "" : "s"}.
                </>
              )}
              {" "}The department will be hidden from active lists but data will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteDepartment.isPending}>
              {deleteDepartment.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
