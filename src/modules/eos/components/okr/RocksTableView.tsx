/**
 * Rocks table view — dense list with status and progress.
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { OKR, RockStatus } from "../../types";
import { ROCK_STATUS_LABELS } from "../../types";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<RockStatus, string> = {
  on_track: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  at_risk: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  off_track: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

interface RocksTableViewProps {
  okrs: OKR[];
  onSelect?: (okr: OKR) => void;
}

export function RocksTableView({ okrs, onSelect }: RocksTableViewProps) {
  if (!okrs.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No rocks found. Create your first quarterly rock.
      </p>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[120px]">Progress</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {okrs.map((okr) => {
            const rs = (okr.rock_status || "on_track") as RockStatus;
            const pct = okr.progress_pct ?? okr.progress ?? 0;
            return (
              <TableRow
                key={okr.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSelect?.(okr)}
              >
                <TableCell className="font-medium">{okr.title}</TableCell>
                <TableCell>{okr.owner?.full_name ?? "—"}</TableCell>
                <TableCell>{okr.end_date ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("border-0", STATUS_VARIANT[rs])}>
                    {ROCK_STATUS_LABELS[rs]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={pct} className="h-2 flex-1" />
                    <span className="text-xs w-8">{pct}%</span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
