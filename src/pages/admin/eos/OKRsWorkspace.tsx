/**
 * OKRs Workspace — Admin visibility and operational controls for EOS OKRs.
 *
 * Why this exists:
 * - Gives administrators a single place to review OKR health across teams.
 * - Enables basic lifecycle actions (close/reopen) without visiting each detail page.
 * - Improves quarterly planning governance and auditability.
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Search, RefreshCw, ExternalLink } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const ADMIN_OKRS_KEY = "admin-eos-okrs";

type OkrRow = {
  id: string;
  title: string;
  status: string;
  quarter: string;
  progress: number | null;
  owner_id: string | null;
  pod_id: string | null;
  updated_at: string;
};

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (["at_risk", "behind"].includes(status)) return "destructive";
  if (["completed", "closed", "on_track"].includes(status)) return "default";
  if (["draft", "active"].includes(status)) return "secondary";
  return "outline";
}

export default function OKRsWorkspace() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [quarter, setQuarter] = useState<string>("all");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: [ADMIN_OKRS_KEY, status, quarter, search],
    queryFn: async (): Promise<OkrRow[]> => {
      let query = supabase
        .from("okrs")
        .select("id,title,status,quarter,progress,owner_id,pod_id,updated_at")
        .order("updated_at", { ascending: false })
        .limit(200);

      if (status !== "all") query = query.eq("status", status);
      if (quarter !== "all") query = query.eq("quarter", quarter);
      if (search.trim()) query = query.ilike("title", `%${search.trim()}%`);

      const { data: rows, error } = await query;
      if (error) throw error;
      return (rows || []) as OkrRow[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, nextStatus }: { id: string; nextStatus: string }) => {
      const { error } = await supabase
        .from("okrs")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("OKR status updated");
      queryClient.invalidateQueries({ queryKey: [ADMIN_OKRS_KEY] });
    },
    onError: (error: Error) => {
      toast.error("Failed to update OKR status", { description: error.message });
    },
  });

  const stats = useMemo(() => {
    const rows = data || [];
    const total = rows.length;
    const active = rows.filter((okr) => ["active", "on_track", "at_risk", "behind"].includes(okr.status)).length;
    const closed = rows.filter((okr) => ["completed", "closed"].includes(okr.status)).length;
    const averageProgress =
      total === 0
        ? 0
        : Math.round(rows.reduce((sum, okr) => sum + Number(okr.progress || 0), 0) / total);

    return { total, active, closed, averageProgress };
  }, [data]);

  const quarterOptions = useMemo(() => {
    const values = Array.from(new Set((data || []).map((okr) => okr.quarter).filter(Boolean)));
    return values.sort();
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">OKRs Workspace</h1>
          <p className="text-muted-foreground">
            Admin controls for EOS OKR oversight, triage, and lifecycle management.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total OKRs</CardDescription></CardHeader>
          <CardContent><CardTitle className="text-2xl">{stats.total}</CardTitle></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Active</CardDescription></CardHeader>
          <CardContent><CardTitle className="text-2xl">{stats.active}</CardTitle></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Closed / Completed</CardDescription></CardHeader>
          <CardContent><CardTitle className="text-2xl">{stats.closed}</CardTitle></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Average Progress</CardDescription></CardHeader>
          <CardContent><CardTitle className="text-2xl">{stats.averageProgress}%</CardTitle></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              placeholder="Search title"
              aria-label="Search OKRs by title"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on_track">On Track</SelectItem>
              <SelectItem value="at_risk">At Risk</SelectItem>
              <SelectItem value="behind">Behind</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={quarter} onValueChange={setQuarter}>
            <SelectTrigger>
              <SelectValue placeholder="Quarter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Quarters</SelectItem>
              {quarterOptions.map((q) => (
                <SelectItem key={q} value={q}>{q}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent OKRs</CardTitle>
          <CardDescription>Up to 200 records to support fast operational triage.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading OKRs...</p>
          ) : (data || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No OKRs match the current filters.</p>
          ) : (
            <div className="space-y-3">
              {(data || []).map((okr) => (
                <article
                  key={okr.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-[260px] flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="font-medium">{okr.title}</h2>
                      <Badge variant={getStatusVariant(okr.status)}>{okr.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Quarter: {okr.quarter || "N/A"} · Progress: {Math.round(Number(okr.progress || 0))}% · Updated: {new Date(okr.updated_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateStatus.mutate({
                          id: okr.id,
                          nextStatus: ["completed", "closed"].includes(okr.status) ? "active" : "closed",
                        })
                      }
                      disabled={updateStatus.isPending}
                    >
                      {["completed", "closed"].includes(okr.status) ? "Reopen" : "Close"}
                    </Button>

                    <Button size="sm" asChild>
                      <Link to="/okrs" aria-label={`Open OKRs page to view ${okr.title}`}>
                        Open
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
