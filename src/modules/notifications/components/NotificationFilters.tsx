import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { NotificationFilterType } from "../types";

const FILTERS: { key: NotificationFilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "mentions", label: "Mentions" },
  { key: "tasks", label: "Tasks" },
  { key: "meetings", label: "Meetings" },
  { key: "system", label: "System" },
  { key: "integrations", label: "Integrations" },
  { key: "ai", label: "AI" },
  { key: "eos", label: "EOS" },
  { key: "archived", label: "Archived" },
];

interface NotificationFiltersProps {
  filter: NotificationFilterType;
  search: string;
  onFilterChange: (filter: NotificationFilterType) => void;
  onSearchChange: (search: string) => void;
}

export function NotificationFilters({
  filter,
  search,
  onFilterChange,
  onSearchChange,
}: NotificationFiltersProps) {
  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search notifications..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            onClick={() => onFilterChange(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
