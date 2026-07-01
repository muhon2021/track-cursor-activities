/**
 * Chart Version History Component
 *
 * Table-based view of chart versions with status badges,
 * publish actions, and row selection.
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
import { Upload } from "lucide-react";
import type { AccountabilityChart } from "../../types";

interface ChartVersionHistoryProps {
  charts: AccountabilityChart[];
  onPublish: (id: string) => void;
  onSelect: (id: string) => void;
  currentChartId?: string;
}

function getStatusBadge(chart: AccountabilityChart) {
  if (chart.is_current) {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        Current
      </Badge>
    );
  }
  if (chart.published_at) {
    return (
      <Badge className="bg-blue-100 text-blue-800 border-blue-200">
        Published
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-gray-200">
      Draft
    </Badge>
  );
}

export function ChartVersionHistory({
  charts,
  onPublish,
  onSelect,
  currentChartId,
}: ChartVersionHistoryProps) {
  const sorted = [...charts].sort((a, b) => b.version - a.version);

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        No chart versions found.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[80px]">Version</TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="w-[120px]">Status</TableHead>
          <TableHead className="w-[160px]">Published Date</TableHead>
          <TableHead className="w-[100px] text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((chart) => (
          <TableRow
            key={chart.id}
            className={`cursor-pointer hover:bg-muted/50 ${
              chart.id === currentChartId ? "bg-muted/30" : ""
            }`}
            onClick={() => onSelect(chart.id)}
          >
            <TableCell>
              <Badge variant="outline" className="font-mono text-xs">
                v{chart.version}
              </Badge>
            </TableCell>
            <TableCell className="font-medium">{chart.name}</TableCell>
            <TableCell>{getStatusBadge(chart)}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {chart.published_at
                ? new Date(chart.published_at).toLocaleDateString()
                : "--"}
            </TableCell>
            <TableCell className="text-right">
              {!chart.is_current && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPublish(chart.id);
                  }}
                >
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  Publish
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
