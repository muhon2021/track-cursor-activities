import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Search,
  List,
  LayoutGrid,
  Download,
  RefreshCw,
  AlertTriangle,
  Calendar as CalendarIcon,
  MoreHorizontal,
  ChevronDown,
  ArrowDownUp,
  ArrowDown,
  FilterX,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface ProjectsToolbarFilters {
  searchQuery: string;
  selectedManager: string;
  selectedClient: string;
  selectedTeam: string;
  selectedCategory: string;
  dateFrom: string;
  dateTo: string;
  showArchived: boolean;
  showOverBudgetOnly: boolean;
  sortBy: "name" | "start_date" | "end_date" | "updated_at" | "over_budget_gap";
  sortAsc: boolean;
}

interface ProjectsToolbarProps {
  filters: ProjectsToolbarFilters;
  onFiltersChange: (f: Partial<ProjectsToolbarFilters>) => void;
  viewMode: "list" | "grid";
  onViewModeChange: (m: "list" | "grid") => void;
  onExport: () => void;
  onSync?: () => void;
  /** Pull projects + issues from Jira (Edge functions; requires JIRA_* secrets). */
  onSyncFromJira?: () => void;
  syncFromJiraPending?: boolean;
  totalCount?: number;
  activeTab?: string;
  onAllClick?: () => void;
  managers: { id: string; full_name: string | null }[];
  clients: { id: string; name: string }[];
  teams: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}

export function ProjectsToolbar({
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
  onExport,
  onSync,
  onSyncFromJira,
  syncFromJiraPending = false,
  totalCount = 0,
  activeTab,
  onAllClick,
  managers,
  clients,
  teams,
  categories,
}: ProjectsToolbarProps) {
  const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : undefined;
  const dateTo = filters.dateTo ? new Date(filters.dateTo) : undefined;
  const hasDates = dateFrom || dateTo;
  const [datePickerOpen, setDatePickerOpen] = useState<"from" | "to" | null>(null);

  return (
    <div className="space-y-3">
      {/* Row 1: Search + filters (All Managers, All Clients, All Teams, All Categories, Dates, ..., Over Budget, Sort) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9"
            placeholder="Search..."
            value={filters.searchQuery}
            onChange={(e) => onFiltersChange({ searchQuery: e.target.value })}
          />
        </div>
        <Select
          value={filters.selectedManager || "all"}
          onValueChange={(v) => onFiltersChange({ selectedManager: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="All Managers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Managers</SelectItem>
            {managers.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.full_name || m.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.selectedClient || "all"}
          onValueChange={(v) => onFiltersChange({ selectedClient: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.selectedTeam || "all"}
          onValueChange={(v) => onFiltersChange({ selectedTeam: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-[120px] h-9">
            <SelectValue placeholder="All Teams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.selectedCategory || "all"}
          onValueChange={(v) => onFiltersChange({ selectedCategory: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Popover onOpenChange={(open) => !open && setDatePickerOpen(null)}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 justify-start text-left font-normal min-w-[120px]",
                !hasDates && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {hasDates
                ? dateFrom && dateTo
                  ? `${format(dateFrom, "MMM d")} – ${format(dateTo, "MMM d")}`
                  : dateFrom
                    ? format(dateFrom, "MMM d")
                    : dateTo
                      ? format(dateTo, "MMM d")
                      : "Dates"
                : "Dates"}
              <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="start">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">From Date</label>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-9 pl-3",
                    !dateFrom && "text-muted-foreground"
                  )}
                  onClick={() => setDatePickerOpen((prev) => (prev === "from" ? null : "from"))}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "MMM d, yyyy") : "Pick a date"}
                </Button>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">To Date</label>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-9 pl-3",
                    !dateTo && "text-muted-foreground"
                  )}
                  onClick={() => setDatePickerOpen((prev) => (prev === "to" ? null : "to"))}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, "MMM d, yyyy") : "Pick a date"}
                </Button>
              </div>
              {datePickerOpen === "from" && (
                <div className="space-y-2">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(d) => {
                      onFiltersChange({ dateFrom: d ? format(d, "yyyy-MM-dd") : "" });
                      setDatePickerOpen(null);
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      onFiltersChange({ dateFrom: "" });
                      setDatePickerOpen(null);
                    }}
                  >
                    Clear date
                  </Button>
                </div>
              )}
              {datePickerOpen === "to" && (
                <div className="space-y-2">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(d) => {
                      onFiltersChange({ dateTo: d ? format(d, "yyyy-MM-dd") : "" });
                      setDatePickerOpen(null);
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      onFiltersChange({ dateTo: "" });
                      setDatePickerOpen(null);
                    }}
                  >
                    Clear date
                  </Button>
                </div>
              )}
              {hasDates && (
                <Button
                  variant="link"
                  size="sm"
                  className="w-full text-muted-foreground h-auto py-1"
                  onClick={() => {
                    onFiltersChange({ dateFrom: "", dateTo: "" });
                    setDatePickerOpen(null);
                  }}
                >
                  Clear dates
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onFiltersChange({ showArchived: !filters.showArchived })}>
              {filters.showArchived ? "Hide archived" : "Show archived"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                onFiltersChange({
                  searchQuery: "",
                  selectedManager: "",
                  selectedClient: "",
                  selectedTeam: "",
                  selectedCategory: "",
                  dateFrom: "",
                  dateTo: "",
                  showOverBudgetOnly: false,
                })
              }
            >
              Clear all filters
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="outline"
          size="sm"
          className="h-9 border-muted-foreground/30 bg-muted/30 hover:bg-muted/50"
          onClick={() => onFiltersChange({ showOverBudgetOnly: !filters.showOverBudgetOnly })}
        >
          <AlertTriangle className="h-4 w-4 mr-1" />
          Over Budget
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {filters.sortBy === "over_budget_gap" ? (
                <Button
                  variant="default"
                  size="sm"
                  className="h-9"
                  onClick={() =>
                    onFiltersChange({
                      sortBy: "updated_at",
                      sortAsc: false,
                    })
                  }
                >
                  <ArrowDownUp className="h-4 w-4 mr-1" />
                  Budget Gap
                  <ArrowDown className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 border-orange-500/50 bg-orange-500/10 text-orange-700 hover:bg-orange-500/20 dark:text-orange-400 dark:hover:bg-orange-500/20"
                  onClick={() =>
                    onFiltersChange({
                      sortBy: "over_budget_gap",
                      sortAsc: false,
                    })
                  }
                >
                  <ArrowDownUp className="h-4 w-4 mr-1" />
                  Sort
                </Button>
              )}
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[240px]">
              {filters.sortBy === "over_budget_gap"
                ? "Click to show Sort again"
                : "Sort by over-budget gap (most over-budget first)"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Row 2: List | Grid | All (N) | Sync | Export | [spacer] | + New Project */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted/50">
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => onViewModeChange("list")}
            title="List view"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => onViewModeChange("grid")}
            title="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
        {onAllClick != null && (
          <Button
            variant={activeTab === "all" ? "secondary" : "outline"}
            size="sm"
            className="h-9"
            onClick={onAllClick}
          >
            All ({totalCount})
          </Button>
        )}
        {onSync && (
          <Button variant="outline" size="sm" className="h-9" onClick={onSync} title="Refresh this list from the database">
            <RefreshCw className="h-4 w-4 mr-1" />
            Sync
          </Button>
        )}
        {onSyncFromJira && (
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={onSyncFromJira}
            disabled={syncFromJiraPending}
            title="Run sync-projects-jira then sync-tasks-jira (set JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN in Supabase Edge secrets)"
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${syncFromJiraPending ? "animate-spin" : ""}`}
            />
            Sync Jira
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-9" onClick={onExport}>
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-muted-foreground hover:text-foreground"
          onClick={() =>
            onFiltersChange({
              searchQuery: "",
              selectedManager: "",
              selectedClient: "",
              selectedTeam: "",
              selectedCategory: "",
              dateFrom: "",
              dateTo: "",
              showArchived: false,
              showOverBudgetOnly: false,
              sortBy: "updated_at",
              sortAsc: false,
            })
          }
        >
          <FilterX className="h-4 w-4 mr-1" />
          Clear filters
        </Button>
        <CreateProjectDialog />
      </div>
    </div>
  );
}
