/**
 * AI Run Audit Log — Phase C
 * Route: /admin/ai/run-audit-log
 */
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  History,
  RefreshCw,
  Search,
  AlertTriangle,
} from "lucide-react";
import { useAgentRunAuditLog } from "@/hooks/useAgentAdmin";
import { useAIAgents } from "@/hooks/useAIAgents";
import { AgentRunAuditTable } from "@/components/admin/AgentRunAuditTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function AIRunAuditLog() {
  const [searchParams] = useSearchParams();
  const initialAgent = searchParams.get("agent") ?? "all";

  const [agentFilter, setAgentFilter] = useState(initialAgent);
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: agents } = useAIAgents();

  const filters = useMemo(
    () => ({
      agentId: agentFilter === "all" ? undefined : agentFilter,
      status: statusFilter,
      eventType: eventFilter,
      search,
      limit: 200,
    }),
    [agentFilter, statusFilter, eventFilter, search]
  );

  const { data: rows, isLoading, isError, error, refetch, isFetching } =
    useAgentRunAuditLog(filters);

  const eventTypes = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows ?? []) {
      if (row.event_type) set.add(row.event_type);
    }
    return Array.from(set).sort();
  }, [rows]);

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-sm text-muted-foreground max-w-lg text-center">
          {(error as Error)?.message ?? "Failed to load audit log"}
        </p>
        <Button onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-2" asChild>
          <Link to="/admin/ai/agents">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Agent catalog
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <History className="h-8 w-8 text-primary" />
          Run Audit Log
        </h1>
        <p className="text-muted-foreground">
          Full audit trail of agent runs, tool calls, and execution events
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>
            Expand rows to inspect tool input/output JSON
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tools, events, JSON…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-full lg:w-[200px]">
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {(agents ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Event type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                {eventTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {isLoading ? "Loading…" : `${rows?.length ?? 0} entries`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !rows?.length ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <History className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No audit log entries match your filters.
              </p>
            </div>
          ) : (
            <AgentRunAuditTable rows={rows} showAgentColumn={agentFilter === "all"} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
