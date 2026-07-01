/**
 * Issue Filters Bar
 *
 * Filter controls for EOS issues (status, priority, category, search).
 */

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import type { IssueFilters } from "../../types";

interface IssueFiltersBarProps {
  filters: IssueFilters;
  onFiltersChange: (filters: IssueFilters) => void;
}

export function IssueFiltersBar({ filters, onFiltersChange }: IssueFiltersBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search issues..."
          className="pl-9"
          value={filters.search || ""}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value || undefined })
          }
        />
      </div>

      <Select
        value={filters.status || "all"}
        onValueChange={(v) =>
          onFiltersChange({ ...filters, status: v === "all" ? undefined : (v as any) })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="solved">Solved</SelectItem>
          <SelectItem value="archived">Archived</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.priority || "all"}
        onValueChange={(v) =>
          onFiltersChange({ ...filters, priority: v === "all" ? undefined : (v as any) })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priority</SelectItem>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.category || "all"}
        onValueChange={(v) =>
          onFiltersChange({ ...filters, category: v === "all" ? undefined : (v as any) })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          <SelectItem value="people">People</SelectItem>
          <SelectItem value="process">Process</SelectItem>
          <SelectItem value="system">System</SelectItem>
          <SelectItem value="external">External</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
