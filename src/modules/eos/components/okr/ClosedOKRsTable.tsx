/**
 * Closed OKRs Table
 *
 * Table of archived OKRs with optional search and Reopen/Edit actions.
 */

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Archive, Search, MoreHorizontal, RotateCcw, Pencil } from "lucide-react";
import type { OKR } from "../../types";
import { formatDate } from "@/utils/okrHelpers";

const statusConfig: Record<string, { label: string; className: string }> = {
  completed: { label: "Completed", className: "bg-green-100 text-green-800" },
  closed: { label: "Closed", className: "bg-gray-100 text-gray-600" },
};

interface ClosedOKRsTableProps {
  okrs: OKR[];
  search?: string;
  onSearchChange?: (value: string) => void;
  onReopen?: (okr: OKR) => void;
  onEdit?: (okr: OKR) => void;
}

export function ClosedOKRsTable({
  okrs,
  search = "",
  onSearchChange,
  onReopen,
  onEdit,
}: ClosedOKRsTableProps) {
  const closedOkrs = [...okrs]
    .filter((okr) => okr.status === "completed" || okr.status === "closed" || okr.is_archived)
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

  return (
    <div className="space-y-4">
      {onSearchChange && (
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search closed OKRs..."
            className="pl-9"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      )}
      {closedOkrs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Archive className="h-8 w-8 mb-2" />
          <p>No closed OKRs</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead className="w-[100px]">Quarter</TableHead>
              <TableHead className="w-[110px]">Status</TableHead>
              <TableHead className="w-[160px]">Progress</TableHead>
              <TableHead className="w-[120px]">Closed Date</TableHead>
              <TableHead className="w-[140px]">Owner</TableHead>
              {(onReopen || onEdit) && (
                <TableHead className="w-[60px] text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {closedOkrs.map((okr) => {
              const config = statusConfig[okr.status];
              const progress =
                okr.key_results?.length
                  ? okr.key_results.reduce((s, kr) => {
                      const start = Number(kr.start_value ?? 0);
                      const curr = Number(kr.current_value ?? 0);
                      const t = Number(kr.target_value ?? 0);
                      const p = t !== start ? Math.max(0, Math.min(100, ((curr - start) / (t - start)) * 100)) : 0;
                      return s + p;
                    }, 0) / okr.key_results.length
                  : Number(okr.progress ?? 0);
              return (
                <TableRow key={okr.id}>
                  <TableCell>
                    <p className="font-medium">{okr.title}</p>
                    {okr.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {okr.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{okr.okr_type || "—"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{okr.quarter}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={config?.className || ""}>
                      {config?.label || okr.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={progress} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {Math.round(progress)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(okr.updated_at)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {okr.owner?.full_name || "Unassigned"}
                    </span>
                  </TableCell>
                  {(onReopen || onEdit) && (
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onReopen && (
                            <DropdownMenuItem onClick={() => onReopen(okr)}>
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Reopen
                            </DropdownMenuItem>
                          )}
                          {onEdit && (
                            <DropdownMenuItem onClick={() => onEdit(okr)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
