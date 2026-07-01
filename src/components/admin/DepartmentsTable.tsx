/**
 * DepartmentsTable - Sortable department list with actions
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDown, ArrowUp, ArrowUpDown, Edit, Trash2, Users } from "lucide-react";
import type { DepartmentSortDir, DepartmentSortField, DepartmentWithStats } from "@/hooks/useDepartments";
import { formatDate } from "@/lib/utils";

export interface DepartmentsTableProps {
  departments: DepartmentWithStats[];
  sortField: DepartmentSortField;
  sortDir: DepartmentSortDir;
  onSort: (field: DepartmentSortField) => void;
  onEdit: (department: DepartmentWithStats) => void;
  onDelete: (department: DepartmentWithStats) => void;
  onViewUsers: (department: DepartmentWithStats) => void;
}

function SortIcon({
  field,
  sortField,
  sortDir,
}: {
  field: DepartmentSortField;
  sortField: DepartmentSortField;
  sortDir: DepartmentSortDir;
}) {
  if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-40" />;
  return sortDir === "asc" ? (
    <ArrowUp className="h-4 w-4 ml-1" />
  ) : (
    <ArrowDown className="h-4 w-4 ml-1" />
  );
}

export function DepartmentsTable({
  departments,
  sortField,
  sortDir,
  onSort,
  onEdit,
  onDelete,
  onViewUsers,
}: DepartmentsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <button
              type="button"
              className="flex items-center font-medium hover:text-foreground"
              onClick={() => onSort("name")}
            >
              Department
              <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
            </button>
          </TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Head</TableHead>
          <TableHead>Users</TableHead>
          <TableHead>PODs</TableHead>
          <TableHead>
            <button
              type="button"
              className="flex items-center font-medium hover:text-foreground"
              onClick={() => onSort("created_at")}
            >
              Created
              <SortIcon field="created_at" sortField={sortField} sortDir={sortDir} />
            </button>
          </TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {departments.map((dept) => (
          <TableRow key={dept.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                {dept.color && (
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: dept.color }}
                  />
                )}
                <p className="font-medium">{dept.name}</p>
              </div>
            </TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground line-clamp-2">
                {dept.description || "—"}
              </span>
            </TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground">{dept.head_name || "—"}</span>
            </TableCell>
            <TableCell>{dept.user_count}</TableCell>
            <TableCell>{dept.pod_count}</TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground">
                {dept.created_at ? formatDate(dept.created_at) : "—"}
              </span>
            </TableCell>
            <TableCell>
              <Badge variant={dept.is_active ? "default" : "secondary"}>
                {dept.is_active ? "Active" : "Inactive"}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="View users"
                  onClick={() => onViewUsers(dept)}
                >
                  <Users className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Edit department"
                  onClick={() => onEdit(dept)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Deactivate department"
                  onClick={() => onDelete(dept)}
                  disabled={!dept.is_active}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
