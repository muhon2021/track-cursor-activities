/**
 * Issues Table Component
 *
 * Displays EOS issues in a sortable table with status badges and actions.
 */

import { useNavigate } from "react-router-dom";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ArrowUp, ArrowRight, ArrowDown, AlertTriangle } from "lucide-react";
import type { EOSIssue, IssueStatus } from "../../types";

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-blue-100 text-blue-800" },
  in_progress: { label: "In Progress", className: "bg-yellow-100 text-yellow-800" },
  solved: { label: "Solved", className: "bg-green-100 text-green-800" },
  archived: { label: "Archived", className: "bg-gray-100 text-gray-600" },
};

const priorityConfig: Record<string, { icon: React.ReactNode; label: string }> = {
  low: { icon: <ArrowDown className="h-3 w-3 text-gray-400" />, label: "Low" },
  medium: { icon: <ArrowRight className="h-3 w-3 text-yellow-500" />, label: "Medium" },
  high: { icon: <ArrowUp className="h-3 w-3 text-orange-500" />, label: "High" },
  critical: { icon: <AlertTriangle className="h-3 w-3 text-red-500" />, label: "Critical" },
};

const categoryColors: Record<string, string> = {
  people: "bg-purple-100 text-purple-800",
  process: "bg-blue-100 text-blue-800",
  system: "bg-orange-100 text-orange-800",
  external: "bg-gray-100 text-gray-800",
};

interface IssuesTableProps {
  issues: EOSIssue[];
  onStatusChange?: (id: string, status: IssueStatus) => void;
  onDelete?: (id: string) => void;
}

export function IssuesTable({ issues, onStatusChange, onDelete }: IssuesTableProps) {
  const navigate = useNavigate();

  if (issues.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <p>No issues found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Issue</TableHead>
          <TableHead className="w-[100px]">Priority</TableHead>
          <TableHead className="w-[100px]">Category</TableHead>
          <TableHead className="w-[120px]">Status</TableHead>
          <TableHead className="w-[100px]">Source</TableHead>
          <TableHead className="w-[50px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((issue) => (
          <TableRow
            key={issue.id}
            className="cursor-pointer"
            onClick={() => navigate(`/eos/issues/${issue.id}`)}
          >
            <TableCell>
              <div>
                <p className="font-medium">{issue.title}</p>
                {issue.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {issue.description}
                  </p>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1.5">
                {priorityConfig[issue.priority]?.icon}
                <span className="text-xs">{priorityConfig[issue.priority]?.label}</span>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="secondary" className={categoryColors[issue.category] || ""}>
                {issue.category}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant="secondary" className={statusConfig[issue.status]?.className || ""}>
                {statusConfig[issue.status]?.label || issue.status}
              </Badge>
            </TableCell>
            <TableCell>
              <span className="text-xs text-muted-foreground capitalize">{issue.source}</span>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {issue.status !== "in_progress" && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onStatusChange?.(issue.id, "in_progress");
                      }}
                    >
                      Mark In Progress
                    </DropdownMenuItem>
                  )}
                  {issue.status !== "solved" && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onStatusChange?.(issue.id, "solved");
                      }}
                    >
                      Mark Solved
                    </DropdownMenuItem>
                  )}
                  {issue.status !== "archived" && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onStatusChange?.(issue.id, "archived");
                      }}
                    >
                      Archive
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.(issue.id);
                    }}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
