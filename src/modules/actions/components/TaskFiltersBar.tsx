import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Settings } from "lucide-react";
import type { TaskFilters, TaskStream, TaskCategory } from "../types/tasks";

interface TaskFiltersBarProps {
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
  streams?: TaskStream[];
  categories?: TaskCategory[];
}

export function TaskFiltersBar({ filters, onFiltersChange, streams, categories }: TaskFiltersBarProps) {
  const update = (patch: Partial<TaskFilters>) => {
    onFiltersChange({ ...filters, ...patch });
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Filters icon (cog) */}
      <div className="flex items-center gap-2 shrink-0 text-muted-foreground" aria-hidden>
        <Settings className="h-4 w-4" />
      </div>
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          value={filters.search || ""}
          onChange={(e) => update({ search: e.target.value })}
          className="pl-9 h-9"
        />
      </div>

      {/* Status */}
      <Select
        value={filters.status || "all"}
        onValueChange={(v) => update({ status: v as any })}
      >
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="todo">To Do</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="paused">Paused</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      {/* Priority */}
      <Select
        value={filters.priority || "all"}
        onValueChange={(v) => update({ priority: v as any })}
      >
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priority</SelectItem>
          <SelectItem value="urgent">Urgent</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>

      {/* Stream */}
      {streams && streams.length > 0 && (
        <Select
          value={filters.stream_id || "all"}
          onValueChange={(v) => update({ stream_id: v === "all" ? undefined : v })}
        >
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Stream" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Streams</SelectItem>
            {streams.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Category */}
      {categories && categories.length > 0 && (
        <Select
          value={filters.category_id || "all"}
          onValueChange={(v) => update({ category_id: v === "all" ? undefined : v })}
        >
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
