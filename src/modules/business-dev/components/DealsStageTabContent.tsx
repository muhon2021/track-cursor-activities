/**
 * Stage Tab Content - Table or card view for deals by stage
 * Lead page: Deal Name, Client, Value, Owner, Pod, Close Date, Actions
 * Other stages: full columns including Stage, Amount, Probability, Updated
 */

import { useMemo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Grid, List, Handshake, Loader2, Eye, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useDeals } from "../hooks/useDeals";
import { getClientName } from "@/lib/utils";
import type { Deal, DealStage } from "../types";

type SortColumn = "title" | "value" | "updated_at" | "expected_close_date";
type SortDir = "asc" | "desc";

const STAGE_CONFIG: Record<DealStage, { label: string; color: string }> = {
  lead: { label: "Lead", color: "#6b7280" },
  discovery: { label: "Discovery", color: "#3b82f6" },
  qualified: { label: "Qualified", color: "#2563eb" },
  estimation: { label: "Estimation", color: "#8b5cf6" },
  proposal: { label: "Proposal", color: "#f59e0b" },
  won: { label: "Won", color: "#22c55e" },
  lost: { label: "Lost", color: "#ef4444" },
};

function formatShortCurrency(val: number) {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val}`;
}

function safeFormatDate(value?: string | null): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

export interface DealsStageTabContentProps {
  stage: DealStage | "all";
  stageLabel: string;
  viewMode: "card" | "table";
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  ownerId?: string;
  onOwnerChange?: (v: string | undefined) => void;
  bdRepId?: string;
  onBdRepChange?: (v: string | undefined) => void;
  clientId?: string;
  onClientIdChange?: (v: string | undefined) => void;
  showLostDeals?: boolean;
  onShowLostDealsChange?: (v: boolean) => void;
  onViewModeChange?: (mode: "card" | "table") => void;
  onViewDetails: (slug: string) => void;
  owners?: { id: string; full_name: string | null; email: string | null }[];
  clients?: { id: string; name: string }[];
}

export default function DealsStageTabContent({
  stage,
  stageLabel,
  viewMode,
  search,
  onSearchChange,
  searchPlaceholder = "Search all deals",
  ownerId,
  onOwnerChange,
  bdRepId,
  onBdRepChange,
  clientId,
  onClientIdChange,
  showLostDeals = false,
  onShowLostDealsChange,
  onViewModeChange,
  onViewDetails,
  owners = [],
  clients = [],
}: DealsStageTabContentProps) {
  const filters = useMemo(
    () => ({
      stage: stage === "all" ? undefined : (stage as DealStage),
      search: search || undefined,
      owner_id: ownerId || bdRepId || undefined,
      client_id: clientId || undefined,
      excludeLost: stage === "lost" ? false : !showLostDeals,
    }),
    [stage, search, ownerId, bdRepId, clientId, showLostDeals]
  );
  const { data: rawDeals = [], isLoading } = useDeals(filters);

  const [sortBy, setSortBy] = useState<SortColumn | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = useCallback((column: SortColumn) => {
    setSortBy((prev) => {
      if (prev === column) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return column;
      }
      setSortDir("asc");
      return column;
    });
  }, []);

  const deals = useMemo(() => {
    if (!sortBy) return rawDeals;
    return [...rawDeals].sort((a: Deal, b: Deal) => {
      let aVal: string | number | null, bVal: string | number | null;
      switch (sortBy) {
        case "title":
          aVal = (a.title || "").toLowerCase();
          bVal = (b.title || "").toLowerCase();
          break;
        case "value":
          aVal = a.value ?? -Infinity;
          bVal = b.value ?? -Infinity;
          break;
        case "updated_at":
          aVal = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          bVal = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          break;
        case "expected_close_date":
          aVal = a.expected_close_date ? new Date(a.expected_close_date).getTime() : 0;
          bVal = b.expected_close_date ? new Date(b.expected_close_date).getTime() : 0;
          break;
        default:
          return 0;
      }
      if (aVal === bVal) return 0;
      const cmp = aVal < bVal ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rawDeals, sortBy, sortDir]);

  const isSimpleColumnsView = stage === "lead" || stage === "discovery" || stage === "estimation" || stage === "proposal";
  const podForDeal = (deal: Deal): string => {
    const meta = deal.metadata as { assigned_pod?: string } | undefined;
    return meta?.assigned_pod ?? "—";
  };

  const handleRowClick = (slug: string) => {
    onViewDetails(slug);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Handshake className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-lg font-medium">No deals found</p>
        <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
      </div>
    );
  }

  const showFilters = onSearchChange || onOwnerChange || onBdRepChange || onClientIdChange || onViewModeChange || onShowLostDealsChange;
  const searchPlaceholderResolved = isSimpleColumnsView ? "Search deals..." : searchPlaceholder;

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="flex items-center gap-3 flex-wrap w-full justify-between">
          {onSearchChange && (
            <div className="relative flex-1 min-w-[200px] mr-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 w-full"
                placeholder={searchPlaceholderResolved}
                value={search || ""}
                onChange={(e) => onSearchChange(e.target.value || "")}
              />
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
          {onOwnerChange && (
            <Select value={ownerId || "all"} onValueChange={(v) => onOwnerChange(v === "all" ? undefined : v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Owners" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Owners</SelectItem>
                {owners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || p.email || "Unknown"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {onBdRepChange && (
            <Select value={bdRepId || "all"} onValueChange={(v) => onBdRepChange(v === "all" ? undefined : v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All BD Reps" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All BD Reps</SelectItem>
                {owners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || p.email || "Unknown"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {onShowLostDealsChange && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showLostDeals}
                onChange={(e) => onShowLostDealsChange(e.target.checked)}
                className="rounded border-input"
              />
              Show lost deals
            </label>
          )}
          {onViewModeChange && (
            <Select value={viewMode} onValueChange={(v) => onViewModeChange(v as "card" | "table")}>
              <SelectTrigger className="w-[120px]">
                {viewMode === "table" ? <Grid className="h-4 w-4 mr-2" /> : <List className="h-4 w-4 mr-2" />}
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="table">Table</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          )}
          </div>
        </div>
      )}

      {viewMode === "table" ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("title")}
                >
                  <span className="inline-flex items-center gap-1">
                    Deal Name
                    {sortBy === "title" ? (sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />}
                  </span>
                </TableHead>
                <TableHead>Client</TableHead>
                {!isSimpleColumnsView && <TableHead>Stage</TableHead>}
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("value")}
                >
                  <span className="inline-flex items-center gap-1">
                    {isSimpleColumnsView ? "Value" : "Amount"}
                    {sortBy === "value" ? (sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />}
                  </span>
                </TableHead>
                {!isSimpleColumnsView && <TableHead>Probability</TableHead>}
                <TableHead>Owner</TableHead>
                {isSimpleColumnsView && <TableHead>Pod</TableHead>}
                {!isSimpleColumnsView && (
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort("updated_at")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Updated
                      {sortBy === "updated_at" ? (sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />}
                    </span>
                  </TableHead>
                )}
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("expected_close_date")}
                >
                  <span className="inline-flex items-center gap-1">
                    Close Date
                    {sortBy === "expected_close_date" ? (sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />}
                  </span>
                </TableHead>
                <TableHead className="w-[60px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((deal) => (
                <TableRow
                  key={deal.id}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(deal.slug)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{deal.title}</p>
                      {deal.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {deal.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getClientName(deal.client)}</TableCell>
                  {!isSimpleColumnsView && (
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="rounded-md font-normal"
                        style={{
                          borderColor: STAGE_CONFIG[deal.stage]?.color,
                          color: STAGE_CONFIG[deal.stage]?.color,
                        }}
                      >
                        {STAGE_CONFIG[deal.stage]?.label?.toLowerCase() ?? deal.stage}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell>
                    {deal.value != null ? formatShortCurrency(deal.value) : (isSimpleColumnsView ? "Click to edit" : "$0")}
                  </TableCell>
                  {!isSimpleColumnsView && (
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <Progress value={deal.probability ?? 0} className="h-2 w-16" />
                        <span className="text-xs tabular-nums">{deal.probability ?? 0}%</span>
                      </div>
                    </TableCell>
                  )}
                  <TableCell>{deal.owner?.full_name || "—"}</TableCell>
                  {isSimpleColumnsView && <TableCell>{podForDeal(deal)}</TableCell>}
                  {!isSimpleColumnsView && <TableCell>{safeFormatDate(deal.updated_at)}</TableCell>}
                  <TableCell>{safeFormatDate(deal.expected_close_date)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size={isSimpleColumnsView ? "sm" : "icon"}
                      className={isSimpleColumnsView ? "h-8 gap-1.5" : "h-8 w-8"}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRowClick(deal.slug);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      {isSimpleColumnsView && <span>View</span>}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map((deal) => (
            <Card
              key={deal.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleRowClick(deal.slug)}
            >
              <CardContent className="p-4 space-y-2">
                <p className="font-medium leading-tight">{deal.title}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{getClientName(deal.client)}</span>
                  {deal.value != null && (
                    <span className="text-sm font-semibold">{formatShortCurrency(deal.value)}</span>
                  )}
                </div>
                {deal.owner && (
                  <p className="text-xs text-muted-foreground">{deal.owner.full_name}</p>
                )}
                <div className="flex items-center gap-2">
                  <Progress value={deal.probability ?? 0} className="h-1.5 flex-1" />
                  <span className="text-xs tabular-nums">{deal.probability ?? 0}%</span>
                </div>
                <Badge
                  variant="outline"
                  className="text-xs"
                  style={{
                    borderColor: STAGE_CONFIG[deal.stage]?.color,
                    color: STAGE_CONFIG[deal.stage]?.color,
                  }}
                >
                  {STAGE_CONFIG[deal.stage]?.label}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
