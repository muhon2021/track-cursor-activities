import { Fragment, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ColumnDef,
  type ExpandedState,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";
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
import type { AgentRunAuditLogEntry } from "@/hooks/useAgentAdmin";
import { cn } from "@/lib/utils";

function formatJson(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

interface AgentRunAuditTableProps {
  rows: AgentRunAuditLogEntry[];
  showAgentColumn?: boolean;
}

export function AgentRunAuditTable({
  rows,
  showAgentColumn = true,
}: AgentRunAuditTableProps) {
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const columns = useMemo<ColumnDef<AgentRunAuditLogEntry>[]>(() => {
    const cols: ColumnDef<AgentRunAuditLogEntry>[] = [
      {
        id: "expander",
        header: () => null,
        cell: ({ row }) => {
          const hasTools = row.original.tool_input != null || row.original.tool_output != null;
          if (!hasTools) return null;
          return (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={row.getToggleExpandedHandler()}
            >
              {row.getIsExpanded() ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          );
        },
        size: 40,
      },
      {
        accessorKey: "created_at",
        header: "Time",
        cell: ({ getValue }) => (
          <span className="text-xs whitespace-nowrap">
            {format(new Date(getValue<string>()), "MMM d, HH:mm:ss")}
          </span>
        ),
      },
    ];

    if (showAgentColumn) {
      cols.push({
        id: "agent",
        header: "Agent",
        cell: ({ row }) => (
          <span className="text-sm font-medium">
            {row.original.ai_agents?.name ?? "—"}
          </span>
        ),
      });
    }

    cols.push(
      {
        accessorKey: "event_type",
        header: "Event",
        cell: ({ getValue }) => (
          <Badge variant="outline" className="text-[10px] font-mono">
            {getValue<string>()}
          </Badge>
        ),
      },
      {
        accessorKey: "tool_name",
        header: "Tool",
        cell: ({ getValue }) => (
          <span className="text-sm">{getValue<string | null>() ?? "—"}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const status = getValue<string | null>();
          if (!status) return "—";
          const variant =
            status === "success" || status === "completed"
              ? "default"
              : status === "failed" || status === "error"
                ? "destructive"
                : "secondary";
          return <Badge variant={variant}>{status}</Badge>;
        },
      },
      {
        accessorKey: "latency_ms",
        header: "Latency",
        cell: ({ getValue }) => {
          const ms = getValue<number | null>();
          return ms != null ? `${ms}ms` : "—";
        },
      },
      {
        id: "user",
        header: "User",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground truncate max-w-[140px] block">
            {row.original.profiles?.email ?? "—"}
          </span>
        ),
      }
    );

    return cols;
  }, [showAgentColumn]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: (row) =>
      row.original.tool_input != null || row.original.tool_output != null,
  });

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                No audit log entries found.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <Fragment key={row.id}>
                <TableRow className={cn(row.getIsExpanded() && "border-b-0")}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
                {row.getIsExpanded() ? (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={columns.length} className="p-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2">
                            Tool input
                          </p>
                          <pre className="text-[11px] rounded-md border bg-background p-3 overflow-auto max-h-48">
                            {formatJson(row.original.tool_input)}
                          </pre>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2">
                            Tool output
                          </p>
                          <pre className="text-[11px] rounded-md border bg-background p-3 overflow-auto max-h-48">
                            {formatJson(row.original.tool_output)}
                          </pre>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
