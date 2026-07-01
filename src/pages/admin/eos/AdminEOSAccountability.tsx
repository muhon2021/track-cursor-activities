/**
 * EOS Accountability Admin — Analytics, SLA targets, and org chart.
 *
 * - Analytics: approval rate and cycle time KPIs and trends by pod/role.
 * - SLA targets: configure approval % and cycle time (days) per pod/role and fallback.
 * - Org chart: chart versions, responsibilities, publish, GWC assessments.
 */

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Network, CheckCircle2, Archive, Pencil, Trash2, UserPlus, ClipboardCheck, Clock } from "lucide-react";
import {
  AreaChart,
  Area,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  useAccountabilityCharts,
  useAccountabilityChart,
  useCreateChart,
  useAddResponsibility,
} from "@/modules/eos/hooks/useAccountability";
import { useEOSPods } from "@/modules/eos/hooks/useEOSPods";
import { useSLATargets, useSaveSLATargets, type SaveSLATargetsInput } from "@/modules/eos/hooks/useSLATargets";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { AccountabilityResponsibility } from "@/modules/eos/types";
import { ChartHistoryTimeline } from "@/modules/eos/components/accountability/ChartHistoryTimeline";
import { EmployeeAccountabilityModal } from "@/modules/eos/components/accountability/EmployeeAccountabilityModal";
import { GWCAssessmentDialog } from "@/modules/eos/components/accountability/GWCAssessmentDialog";

const DEFAULT_ROLE_OPTIONS = ["Product Owner", "Tech Lead", "Project Manager"];

// Mock monthly trend data for Analytics (Jan–Jun)
const MOCK_APPROVAL_DATA = [
  { month: "Jan", value: 72, sla: 90 },
  { month: "Feb", value: 76, sla: 90 },
  { month: "Mar", value: 82, sla: 90 },
  { month: "Apr", value: 85, sla: 90 },
  { month: "May", value: 88, sla: 90 },
  { month: "Jun", value: 91.3, sla: 90 },
];
const MOCK_CYCLE_DATA = [
  { month: "Jan", value: 6.2, sla: 5 },
  { month: "Feb", value: 6, sla: 5 },
  { month: "Mar", value: 5.8, sla: 5 },
  { month: "Apr", value: 5.5, sla: 5 },
  { month: "May", value: 5.4, sla: 5 },
  { month: "Jun", value: 5.6, sla: 5 },
];

// Deterministic offset from filter key so chart/KPI values change per pod/role (mock filtering).
function filterOffset(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return (Math.abs(h) % 100) / 100; // 0..1
}

// ─── Analytics tab ────────────────────────────────────────────────────────
function AnalyticsTab() {
  const { data: pods = [] } = useEOSPods();
  const [podFilter, setPodFilter] = useState<string>("all-pods");
  const [roleFilter, setRoleFilter] = useState<string>("all-roles");
  const approvalSLA = 90;
  const cycleSLA = 5;

  const filterKey = podFilter !== "all-pods" ? podFilter : roleFilter !== "all-roles" ? roleFilter : "all";
  const offset = filterKey === "all" ? 0 : filterOffset(filterKey);

  const approvalKpi = useMemo(() => {
    const base = 91.3;
    if (filterKey === "all") return base;
    return Number((base - 8 + offset * 16).toFixed(1)); // vary ~83–99
  }, [filterKey, offset]);

  const cycleKpi = useMemo(() => {
    const base = 5.6;
    if (filterKey === "all") return base;
    return Number((base - 1.5 + offset * 3).toFixed(1)); // vary ~4.1–7.1
  }, [filterKey, offset]);

  const approvalChartData = useMemo(() => {
    if (filterKey === "all") return MOCK_APPROVAL_DATA;
    return MOCK_APPROVAL_DATA.map((d, i) => ({
      ...d,
      value: Number((d.value - 6 + offset * 12 + i * 0.5).toFixed(1)),
    })).map((d) => ({ ...d, value: Math.min(98, Math.max(62, d.value)) }));
  }, [filterKey, offset]);

  const cycleChartData = useMemo(() => {
    if (filterKey === "all") return MOCK_CYCLE_DATA;
    return MOCK_CYCLE_DATA.map((d, i) => ({
      ...d,
      value: Number((d.value - 1 + offset * 2 + i * 0.1).toFixed(1)),
    })).map((d) => ({ ...d, value: Math.min(8, Math.max(3, d.value)) }));
  }, [filterKey, offset]);

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-primary">EOS Accountability Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Track approval performance, pod cycle times, and SLA adherence to keep pods aligned.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>Pod</Label>
          <Select value={podFilter} onValueChange={setPodFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All pods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-pods">All pods</SelectItem>
              {pods.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-roles">All roles</SelectItem>
              {DEFAULT_ROLE_OPTIONS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {filterKey !== "all" && (
            <span className="text-sm text-muted-foreground">
              Showing: {podFilter !== "all-pods" ? pods.find((p) => p.id === podFilter)?.name ?? podFilter : roleFilter}
            </span>
          )}
          <Badge className="bg-primary text-primary-foreground px-3 py-1.5">
            <Clock className="h-3.5 w-3 mr-1.5" />
            Approval: {approvalKpi}% (SLA {approvalSLA}%)
          </Badge>
          <Badge className="bg-destructive text-destructive-foreground px-3 py-1.5">
            <Clock className="h-3.5 w-3 mr-1.5" />
            Cycle: {cycleKpi} days (SLA {cycleSLA}d)
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-center">Approval rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={approvalChartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[60, 100]} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v: number) => [`${v}%`, "Approval"]} labelFormatter={(l) => l} />
                  <ReferenceLine y={approvalSLA} stroke="#3b82f6" strokeDasharray="6 4" label={{ value: "SLA", position: "insideTopRight", fontSize: 11, fill: "#3b82f6" }} />
                  <Area type="monotone" dataKey="value" stroke="#64748b" fill="#64748b" fillOpacity={0.3} name="Approval" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-end mt-1">
              <Badge variant="secondary" className="text-xs">SLA {approvalSLA}%</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pod cycle times</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cycleChartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 8]} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}d`} />
                  <Tooltip formatter={(v: number) => [`${v} days`, "Cycle"]} labelFormatter={(l) => l} />
                  <ReferenceLine y={cycleSLA} stroke="#3b82f6" strokeDasharray="6 4" label={{ value: "SLA", position: "insideTopRight", fontSize: 11, fill: "#3b82f6" }} />
                  <Line type="monotone" dataKey="value" stroke="#64748b" strokeWidth={2} dot={{ r: 3 }} name="Cycle (days)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-end mt-1">
              <Badge variant="secondary" className="text-xs">SLA {cycleSLA}d</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ─── SLA targets tab ──────────────────────────────────────────────────────
function SLATargetsTab() {
  const { data: pods = [] } = useEOSPods();
  const { data: targets = [], isLoading } = useSLATargets();
  const saveTargets = useSaveSLATargets();

  const fallback = useMemo(() => targets.find((t) => t.pod_id == null && t.role_name == null), [targets]);
  const podTargets = useMemo(() => targets.filter((t) => t.pod_id != null), [targets]);
  const roleTargets = useMemo(() => targets.filter((t) => t.role_name != null), [targets]);

  const [podForm, setPodForm] = useState<Record<string, { approval_rate_pct: string; cycle_time_days: string }>>({});
  const [roleForm, setRoleForm] = useState<Record<string, { approval_rate_pct: string; cycle_time_days: string }>>({});
  const [fallbackForm, setFallbackForm] = useState({ approval_rate_pct: "90", cycle_time_days: "5" });
  const [selectedPodIds, setSelectedPodIds] = useState<Set<string>>(new Set());
  const [selectedRoleNames, setSelectedRoleNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (fallback) {
      setFallbackForm({
        approval_rate_pct: String(fallback.approval_rate_pct),
        cycle_time_days: String(fallback.cycle_time_days),
      });
    }
  }, [fallback?.id, fallback?.approval_rate_pct, fallback?.cycle_time_days]);

  const addPodTarget = (podId: string) => {
    setSelectedPodIds((s) => new Set(s).add(podId));
    setPodForm((f) => ({
      ...f,
      [podId]: {
        approval_rate_pct: String(podTargets.find((t) => t.pod_id === podId)?.approval_rate_pct ?? 90),
        cycle_time_days: String(podTargets.find((t) => t.pod_id === podId)?.cycle_time_days ?? 5),
      },
    }));
  };
  const addRoleTarget = (roleName: string) => {
    setSelectedRoleNames((s) => new Set(s).add(roleName));
    setRoleForm((f) => ({
      ...f,
      [roleName]: {
        approval_rate_pct: String(roleTargets.find((t) => t.role_name === roleName)?.approval_rate_pct ?? 90),
        cycle_time_days: String(roleTargets.find((t) => t.role_name === roleName)?.cycle_time_days ?? 5),
      },
    }));
  };

  const effectivePodIds = selectedPodIds.size > 0 ? selectedPodIds : new Set(podTargets.map((t) => t.pod_id!));
  const effectiveRoleNames = selectedRoleNames.size > 0 ? selectedRoleNames : new Set(roleTargets.map((t) => t.role_name!));
  const podMap = new Map(pods.map((p) => [p.id, p.name]));

  const buildPayload = (): SaveSLATargetsInput => ({
    fallback: {
      approval_rate_pct: Number(fallbackForm.approval_rate_pct) || 90,
      cycle_time_days: Number(fallbackForm.cycle_time_days) || 5,
    },
    pods: Array.from(effectivePodIds).map((podId) => ({
      pod_id: podId,
      approval_rate_pct: Number(podForm[podId]?.approval_rate_pct) || 90,
      cycle_time_days: Number(podForm[podId]?.cycle_time_days) || 5,
    })),
    roles: Array.from(effectiveRoleNames).map((roleName) => ({
      role_name: roleName,
      approval_rate_pct: Number(roleForm[roleName]?.approval_rate_pct) || 90,
      cycle_time_days: Number(roleForm[roleName]?.cycle_time_days) || 5,
    })),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">SLA targets by pod and role</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Pods</Label>
            <Select
              value=""
              onValueChange={(id) => {
                if (id && id !== "_none") addPodTarget(id);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Add pod target" />
              </SelectTrigger>
              <SelectContent>
                {pods.filter((p) => !effectivePodIds.has(p.id)).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
                {pods.filter((p) => !effectivePodIds.has(p.id)).length === 0 && <SelectItem value="_none" disabled>No more pods</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            {Array.from(effectivePodIds).map((podId) => {
              const name = podMap.get(podId) ?? podId;
              const form = podForm[podId] ?? {
                approval_rate_pct: String(podTargets.find((t) => t.pod_id === podId)?.approval_rate_pct ?? 90),
                cycle_time_days: String(podTargets.find((t) => t.pod_id === podId)?.cycle_time_days ?? 5),
              };
              return (
                <Card key={podId} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{name}</span>
                        <Badge variant="secondary" className="text-xs">Target</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Approval rate (%)</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={form.approval_rate_pct}
                            onChange={(e) => setPodForm((f) => ({ ...f, [podId]: { ...form, approval_rate_pct: e.target.value } }))}
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Cycle time (days)</Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            value={form.cycle_time_days}
                            onChange={(e) => setPodForm((f) => ({ ...f, [podId]: { ...form, cycle_time_days: e.target.value } }))}
                            className="h-9"
                          />
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedPodIds((s) => { const n = new Set(s); n.delete(podId); return n; });
                        setPodForm((f) => { const next = { ...f }; delete next[podId]; return next; });
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Roles</Label>
            <Select
              value=""
              onValueChange={(name) => {
                if (name && name !== "_none") addRoleTarget(name);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Add role target" />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_ROLE_OPTIONS.filter((r) => !effectiveRoleNames.has(r)).map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
                {DEFAULT_ROLE_OPTIONS.filter((r) => !effectiveRoleNames.has(r)).length === 0 && <SelectItem value="_none" disabled>No more roles</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            {Array.from(effectiveRoleNames).map((roleName) => {
              const form = roleForm[roleName] ?? {
                approval_rate_pct: String(roleTargets.find((t) => t.role_name === roleName)?.approval_rate_pct ?? 90),
                cycle_time_days: String(roleTargets.find((t) => t.role_name === roleName)?.cycle_time_days ?? 5),
              };
              return (
                <Card key={roleName} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{roleName}</span>
                        <Badge variant="secondary" className="text-xs">Target</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Approval rate (%)</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={form.approval_rate_pct}
                            onChange={(e) => setRoleForm((f) => ({ ...f, [roleName]: { ...form, approval_rate_pct: e.target.value } }))}
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Cycle time (days)</Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            value={form.cycle_time_days}
                            onChange={(e) => setRoleForm((f) => ({ ...f, [roleName]: { ...form, cycle_time_days: e.target.value } }))}
                            className="h-9"
                          />
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedRoleNames((s) => { const n = new Set(s); n.delete(roleName); return n; });
                        setRoleForm((f) => { const next = { ...f }; delete next[roleName]; return next; });
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="secondary">Fallback</Badge>
          <span className="text-sm text-muted-foreground">Used when a pod or role does not have a specific SLA.</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 max-w-md">
          <div>
            <Label className="text-xs">Default approval rate (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={fallbackForm.approval_rate_pct}
              onChange={(e) => setFallbackForm((f) => ({ ...f, approval_rate_pct: e.target.value }))}
              className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Default cycle time (days)</Label>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={fallbackForm.cycle_time_days}
              onChange={(e) => setFallbackForm((f) => ({ ...f, cycle_time_days: e.target.value }))}
              className="h-9"
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setFallbackForm({ approval_rate_pct: "90", cycle_time_days: "5" });
            setPodForm({});
            setRoleForm({});
            setSelectedPodIds(new Set());
            setSelectedRoleNames(new Set());
          }}
        >
          Reset
        </Button>
        <Button onClick={() => saveTargets.mutate(buildPayload())} disabled={saveTargets.isPending}>
          {saveTargets.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save targets
        </Button>
      </div>
    </>
  );
}

const ACCOUNTABILITY_KEY = "eos-accountability";

// ─── Admin mutations ─────────────────────────────────────────────────────────

function usePublishChart() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (chartId: string) => {
      // Unset all current charts
      await supabase
        .from("accountability_charts")
        .update({ is_current: false })
        .eq("is_current", true);

      // Set the selected chart as current
      const { error } = await supabase
        .from("accountability_charts")
        .update({
          is_current: true,
          published_at: new Date().toISOString(),
          published_by: user!.id,
        })
        .eq("id", chartId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACCOUNTABILITY_KEY] });
      toast.success("Chart published as current");
    },
    onError: (e: Error) => toast.error("Failed to publish chart", { description: e.message }),
  });
}

function useDeleteResponsibility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Also remove references
      await supabase
        .from("accountability_responsibilities")
        .update({ reports_to: null })
        .eq("reports_to", id);

      const { error } = await supabase
        .from("accountability_responsibilities")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACCOUNTABILITY_KEY] });
      toast.success("Role removed");
    },
    onError: (e: Error) => toast.error("Failed to remove role", { description: e.message }),
  });
}

function useUpdateResponsibility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AccountabilityResponsibility> }) => {
      const { error } = await supabase
        .from("accountability_responsibilities")
        .update({ ...data, updated_at: new Date().toISOString() } as any)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACCOUNTABILITY_KEY] });
      toast.success("Role updated");
    },
    onError: (e: Error) => toast.error("Failed to update role", { description: e.message }),
  });
}

function useSaveGWCAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      responsibility_id: string;
      gets_it: boolean;
      wants_it: boolean;
      has_capacity: boolean;
      notes?: string;
    }) => {
      const { error } = await (supabase as any)
        .from("gwc_assessments")
        .upsert(
          { ...data, assessment_date: new Date().toISOString() },
          { onConflict: "responsibility_id" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACCOUNTABILITY_KEY] });
      toast.success("GWC assessment saved");
    },
    onError: (e: Error) => toast.error("Failed to save assessment", { description: e.message }),
  });
}

interface RoleFormData {
  role_title: string;
  department: string;
  responsibilities: string;
}

const emptyRole: RoleFormData = { role_title: "", department: "", responsibilities: "" };

export default function AdminEOSAccountability() {
  const { data: charts, isLoading: chartsLoading } = useAccountabilityCharts();
  const { data: currentChart, isLoading: currentLoading } = useAccountabilityChart();
  const createChart = useCreateChart();
  const publishChart = usePublishChart();
  const addResponsibility = useAddResponsibility();
  const deleteResponsibility = useDeleteResponsibility();
  const updateResponsibility = useUpdateResponsibility();
  const saveGWCAssessment = useSaveGWCAssessment();

  const [chartDialog, setChartDialog] = useState(false);
  const [chartName, setChartName] = useState("");
  const [chartDesc, setChartDesc] = useState("");

  const [roleDialog, setRoleDialog] = useState(false);
  const [roleForm, setRoleForm] = useState<RoleFormData>(emptyRole);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<string | null>(null);
  const [publishTarget, setPublishTarget] = useState<string | null>(null);
  const [viewRoleId, setViewRoleId] = useState<string | null>(null);
  const [assessRoleId, setAssessRoleId] = useState<string | null>(null);

  const isLoading = chartsLoading || currentLoading;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Flatten responsibilities for table display
  const flattenResponsibilities = (
    items: AccountabilityResponsibility[],
    depth = 0
  ): (AccountabilityResponsibility & { depth: number })[] => {
    const result: (AccountabilityResponsibility & { depth: number })[] = [];
    for (const item of items) {
      result.push({ ...item, depth });
      if (item.direct_reports && item.direct_reports.length > 0) {
        result.push(...flattenResponsibilities(item.direct_reports, depth + 1));
      }
    }
    return result;
  };

  const flatRoles = currentChart?.responsibilities
    ? flattenResponsibilities(currentChart.responsibilities)
    : [];

  const viewedRole = viewRoleId ? flatRoles.find((r) => r.id === viewRoleId) ?? null : null;
  const assessedRole = assessRoleId ? flatRoles.find((r) => r.id === assessRoleId) ?? null : null;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="sla">SLA targets</TabsTrigger>
          <TabsTrigger value="charts">Org chart</TabsTrigger>
        </TabsList>

        {/* ─── Analytics tab ───────────────────────────────────────────────── */}
        <TabsContent value="analytics" className="space-y-6">
          <AnalyticsTab />
        </TabsContent>

        {/* ─── SLA targets tab ────────────────────────────────────────────── */}
        <TabsContent value="sla" className="space-y-6">
          <SLATargetsTab />
        </TabsContent>

        {/* ─── Org chart tab (existing) ───────────────────────────────────── */}
        <TabsContent value="charts" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accountability Charts</h1>
          <p className="text-muted-foreground">
            Manage organizational accountability charts, roles, and reporting structure.
          </p>
        </div>
        <Button
          onClick={() => {
            setChartName("");
            setChartDesc("");
            setChartDialog(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" /> New Chart Version
        </Button>
      </div>

      {/* Chart Versions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Chart Versions
          </CardTitle>
          <CardDescription>
            Each version is a snapshot. Only one can be the "current" published chart.
          </CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Version</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Published</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(charts || []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No accountability charts. Create the first one.
                </TableCell>
              </TableRow>
            ) : (
              (charts || []).map((chart) => (
                <TableRow key={chart.id}>
                  <TableCell>
                    <Badge variant="outline">v{chart.version}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{chart.name}</TableCell>
                  <TableCell>
                    {chart.is_current ? (
                      <Badge className="bg-success/10 text-success border-success/30">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Current
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {chart.published_at
                      ? new Date(chart.published_at).toLocaleDateString()
                      : "Not published"}
                  </TableCell>
                  <TableCell className="text-right">
                    {!chart.is_current && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPublishTarget(chart.id)}
                      >
                        <Archive className="h-4 w-4 mr-1" /> Publish
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Chart History Timeline */}
      {(charts || []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Version Timeline</CardTitle>
            <CardDescription>
              Visual history of chart versions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartHistoryTimeline charts={charts || []} />
          </CardContent>
        </Card>
      )}

      {/* Current Chart Responsibilities */}
      {currentChart && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  Current Chart: {currentChart.name} (v{currentChart.version})
                </CardTitle>
                <CardDescription>
                  {flatRoles.length} roles defined. Add or edit roles below.
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setRoleForm(emptyRole);
                  setEditingRole(null);
                  setRoleDialog(true);
                }}
              >
                <UserPlus className="h-4 w-4 mr-2" /> Add Role
              </Button>
            </div>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Responsibilities</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flatRoles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No roles defined. Click "Add Role" to build the chart.
                  </TableCell>
                </TableRow>
              ) : (
                flatRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <span style={{ paddingLeft: `${role.depth * 24}px` }} className="font-medium flex items-center gap-1">
                        {role.depth > 0 && <span className="text-muted-foreground">└</span>}
                        <button
                          type="button"
                          className="hover:underline hover:text-primary text-left"
                          onClick={() => setViewRoleId(role.id)}
                        >
                          {role.role_title}
                        </button>
                      </span>
                    </TableCell>
                    <TableCell>
                      {role.department ? (
                        <Badge variant="secondary" className="text-xs">{role.department}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-sm">
                      <span className="text-sm text-muted-foreground truncate block">
                        {role.responsibilities && role.responsibilities.length > 0
                          ? role.responsibilities.slice(0, 2).join(", ") + (role.responsibilities.length > 2 ? "…" : "")
                          : "No responsibilities listed"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="GWC Assessment"
                          onClick={() => setAssessRoleId(role.id)}
                        >
                          <ClipboardCheck className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRoleForm({
                              role_title: role.role_title,
                              department: role.department || "",
                              responsibilities: (role.responsibilities || []).join("\n"),
                            });
                            setEditingRole(role.id);
                            setRoleDialog(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteRoleTarget(role.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

        </TabsContent>
      </Tabs>

      {/* New Chart Dialog */}
      <Dialog open={chartDialog} onOpenChange={setChartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Chart Version</DialogTitle>
            <DialogDescription>Create a new accountability chart. It starts as a draft until you publish it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={chartName} onChange={(e) => setChartName(e.target.value)} placeholder="e.g. Q1 2026 Org Chart" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={chartDesc} onChange={(e) => setChartDesc(e.target.value)} placeholder="Optional description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChartDialog(false)}>Cancel</Button>
            <Button
              disabled={!chartName || createChart.isPending}
              onClick={() => createChart.mutate({ name: chartName, description: chartDesc }, { onSuccess: () => setChartDialog(false) })}
            >
              {createChart.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Role Dialog */}
      <Dialog open={roleDialog} onOpenChange={setRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Add Role"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Role Title</Label>
              <Input value={roleForm.role_title} onChange={(e) => setRoleForm({ ...roleForm, role_title: e.target.value })} placeholder="e.g. VP of Engineering" />
            </div>
            <div>
              <Label>Department</Label>
              <Input value={roleForm.department} onChange={(e) => setRoleForm({ ...roleForm, department: e.target.value })} placeholder="e.g. Engineering" />
            </div>
            <div>
              <Label>Responsibilities (one per line)</Label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={roleForm.responsibilities}
                onChange={(e) => setRoleForm({ ...roleForm, responsibilities: e.target.value })}
                placeholder={"Lead team standups\nOwn sprint planning\nCode review accountability"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog(false)}>Cancel</Button>
            <Button
              disabled={!roleForm.role_title || addResponsibility.isPending || updateResponsibility.isPending}
              onClick={() => {
                const responsibilitiesList = roleForm.responsibilities
                  .split("\n")
                  .map((r) => r.trim())
                  .filter(Boolean);

                if (editingRole) {
                  updateResponsibility.mutate(
                    {
                      id: editingRole,
                      data: {
                        role_title: roleForm.role_title,
                        department: roleForm.department || null,
                        responsibilities: responsibilitiesList,
                      },
                    },
                    { onSuccess: () => setRoleDialog(false) }
                  );
                } else if (currentChart) {
                  addResponsibility.mutate(
                    {
                      chart_id: currentChart.id,
                      role_title: roleForm.role_title,
                      department: roleForm.department || undefined,
                      responsibilities: responsibilitiesList,
                    },
                    { onSuccess: () => setRoleDialog(false) }
                  );
                }
              }}
            >
              {(addResponsibility.isPending || updateResponsibility.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRole ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Confirm */}
      <AlertDialog open={!!publishTarget} onOpenChange={() => setPublishTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish this chart?</AlertDialogTitle>
            <AlertDialogDescription>
              This will set this chart as the current active version. The previous current chart will be archived.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (publishTarget) publishChart.mutate(publishTarget, { onSuccess: () => setPublishTarget(null) }); }}>
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Role Confirm */}
      <AlertDialog open={!!deleteRoleTarget} onOpenChange={() => setDeleteRoleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this role?</AlertDialogTitle>
            <AlertDialogDescription>
              Roles that report to this position will have their reporting line removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteRoleTarget) deleteResponsibility.mutate(deleteRoleTarget, { onSuccess: () => setDeleteRoleTarget(null) }); }}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Employee Accountability Modal */}
      {viewedRole && (
        <EmployeeAccountabilityModal
          responsibility={viewedRole}
          open={!!viewRoleId}
          onOpenChange={(open) => { if (!open) setViewRoleId(null); }}
        />
      )}

      {/* GWC Assessment Dialog */}
      {assessedRole && (
        <GWCAssessmentDialog
          responsibilityId={assessedRole.id}
          roleTitle={assessedRole.role_title}
          currentAssessment={assessedRole.gwc ?? null}
          open={!!assessRoleId}
          onOpenChange={(open) => { if (!open) setAssessRoleId(null); }}
          onSave={(data) => {
            saveGWCAssessment.mutate(data, {
              onSuccess: () => setAssessRoleId(null),
            });
          }}
          isSaving={saveGWCAssessment.isPending}
        />
      )}
    </div>
  );
}
