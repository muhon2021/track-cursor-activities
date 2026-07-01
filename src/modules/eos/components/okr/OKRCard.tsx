/**
 * OKR Card Component
 *
 * Matches reference UI: title, type/status badges, description, metadata row
 * (owner, due date, quarter), overall progress, View Details button,
 * expandable Key Results section, and actions dropdown.
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KeyResultCard } from "./KeyResultCard";
import { formatDateLong } from "@/utils/okrHelpers";
import {
  Eye,
  Calendar,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  Pencil,
  Copy,
  Archive,
  Trash2,
  AlertCircle,
} from "lucide-react";
import type { OKR } from "../../types";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  active: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  on_track: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  at_risk: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200",
  behind: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
  closed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

interface OKRCardProps {
  okr: OKR;
  onClick?: () => void;
  onSelect?: () => void;
  onClose?: () => void;
  onEdit?: (okr: OKR) => void;
  onDuplicate?: (okr: OKR) => void;
  onDelete?: (okr: OKR) => void;
}

export function OKRCard({
  okr,
  onSelect,
  onClick,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
}: OKRCardProps) {
  const [keyResultsOpen, setKeyResultsOpen] = useState(true);

  const progress =
    okr.key_results?.length
      ? okr.key_results.reduce((s, kr) => {
          const start = Number(kr.start_value ?? 0);
          const curr = Number(kr.current_value ?? 0);
          const t = Number(kr.target_value ?? 0);
          const p =
            t !== start
              ? Math.max(0, Math.min(100, ((curr - start) / (t - start)) * 100))
              : 0;
          return s + p;
        }, 0) / okr.key_results.length
      : Number(okr.progress ?? 0);

  const handleViewDetails = () => (onSelect || onClick)?.();

  const overdueUpdates = useMemo(() => {
    if (!okr.key_results?.length) return [];
    const now = new Date();
    const names: string[] = [];
    const seen = new Set<string>();
    for (const kr of okr.key_results) {
      if (kr.status === "completed") continue;
      const due = kr.next_update_due ? new Date(kr.next_update_due) : null;
      if (due && due < now && kr.owner?.full_name && !seen.has(kr.owner.full_name)) {
        seen.add(kr.owner.full_name);
        names.push(kr.owner.full_name);
      }
    }
    return names;
  }, [okr.key_results]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold leading-tight tracking-tight">
                {okr.title}
              </h3>
              {okr.okr_type && (
                <Badge
                  variant="secondary"
                  className="shrink-0 text-xs font-normal capitalize"
                >
                  {okr.okr_type}
                </Badge>
              )}
            </div>
            {okr.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {okr.description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge
              variant="secondary"
              className={statusColors[okr.status] || ""}
            >
              {okr.status.replace("_", " ")}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit?.(okr)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit OKR
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate?.(okr)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Create Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onClose?.()}>
                  <Archive className="mr-2 h-4 w-4" />
                  Close OKR
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete?.(okr)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete OKR
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-sm text-muted-foreground">
          {okr.owner && (
            <span className="flex items-center gap-1.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                {(okr.owner.full_name || okr.owner.email || "?").charAt(0).toUpperCase()}
              </span>
              {okr.owner.full_name}
            </span>
          )}
          {okr.end_date && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 shrink-0" />
              {formatDateLong(okr.end_date)}
            </span>
          )}
          <Badge
            variant="secondary"
            className="bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200 font-normal"
          >
            {okr.quarter}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {overdueUpdates.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Overdue updates: {overdueUpdates.join(", ")}</span>
          </div>
        )}

        <div className="flex justify-center">
          <Button onClick={handleViewDetails} variant="default" size="sm">
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </Button>
        </div>

        {okr.key_results && okr.key_results.length > 0 && (
          <Collapsible open={keyResultsOpen} onOpenChange={setKeyResultsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Key Results ({okr.key_results.length})
                {keyResultsOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-3 pt-2">
                {okr.key_results.map((kr) => (
                  <KeyResultCard key={kr.id} keyResult={kr} okrId={okr.id} />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
