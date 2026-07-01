/**
 * Scorecard Workspace — Admin EOS Scorecards (exact plan).
 * Path: /admin/eos/scorecards
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
import { Loader2, Plus, Pencil, Trash2, BarChart3, Target, FileText, Layers, LineChart as LineChartIcon, Download, RefreshCw, Users, CheckCircle2, History, AlertCircle, Settings2, Filter } from "lucide-react";
import {
  useScorecardTemplates,
  useScorecardMetrics,
  useAllMetricsForCounts,
  usePodsDirectory,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useCreateMetric,
  useUpdateMetricAdmin,
  useDeleteMetric,
  parseMetricNotes,
  type CreateMetricInput,
  type UpdateMetricInput,
} from "@/hooks/useScorecardAdmin";
import { downloadCSV } from "@/lib/csv";
import { toast } from "sonner";
import { format, subWeeks } from "date-fns";
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
} from "recharts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EOSScorecard } from "@/modules/eos/types";

const DEFAULT_ROLES = ["Executive", "Sales", "Marketing", "Delivery", "Finance", "People", "Ops"];

interface TemplateFormData {
  name: string;
  description: string;
  is_active: boolean;
}

interface MetricFormData {
  scorecard_id: string;
  metric_name: string;
  measurable: string;
  goal_value: string;
  actual_value: string;
  week_date: string;
  owner_id: string;
  podId: string;
  role: string;
  commentary: string;
}

const emptyTemplateForm: TemplateFormData = { name: "", description: "", is_active: true };
const emptyMetricForm: MetricFormData = {
  scorecard_id: "",
  metric_name: "",
  measurable: "",
  goal_value: "",
  actual_value: "",
  week_date: format(new Date(), "yyyy-MM-dd"),
  owner_id: "",
  podId: "",
  role: "",
  commentary: "",
};

const defaultStartDate = format(subWeeks(new Date(), 12), "yyyy-MM-dd");
const defaultEndDate = format(new Date(), "yyyy-MM-dd");

export default function ScorecardWorkspace() {
  const { data: templates = [], isLoading: loadingTemplates } = useScorecardTemplates();
  const { data: pods = [] } = usePodsDirectory();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const createMetric = useCreateMetric();
  const updateMetric = useUpdateMetricAdmin();
  const deleteMetric = useDeleteMetric();

  const [activeTab, setActiveTab] = useState<"templates" | "metrics" | "performance">("templates");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [metricDialogOpen, setMetricDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EOSScorecard | null>(null);
  const [editingMetric, setEditingMetric] = useState<{
    id: string;
    scorecard_id: string;
    name: string;
    description: string | null;
    target_value: number | null;
    current_value: number;
    week_of: string | null;
    status: string | null;
    notes?: string | null;
  } | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateFormData>(emptyTemplateForm);
  const [metricForm, setMetricForm] = useState<MetricFormData>(emptyMetricForm);
  const [filters, setFilters] = useState({
    search: "",
    podId: "",
    role: "",
    startDate: defaultStartDate,
    endDate: defaultEndDate,
  });

  // Auto-select first template when templates load
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  // Sync metric form scorecard when selection changes
  useEffect(() => {
    if (selectedTemplateId && !metricDialogOpen) {
      setMetricForm((prev) => ({ ...prev, scorecard_id: selectedTemplateId }));
    }
  }, [selectedTemplateId, metricDialogOpen]);

  const { data: allMetricsForCounts = [] } = useAllMetricsForCounts();
  const metricCountByTemplate = (() => {
    const counts: Record<string, number> = {};
    for (const m of allMetricsForCounts) {
      counts[m.scorecard_id] = (counts[m.scorecard_id] || 0) + 1;
    }
    return counts;
  })();

  const { data: metrics = [], isLoading: loadingMetrics } = useScorecardMetrics({
    scorecardId: selectedTemplateId,
    startDate: filters.startDate,
    endDate: filters.endDate,
    search: filters.search || undefined,
  });

  // Client filter by pod and role from notes
  const filteredMetrics = metrics.filter((m) => {
    const notes = parseMetricNotes((m as { notes?: string | null }).notes);
    if (filters.podId && notes.podId !== filters.podId) return false;
    if (filters.role && notes.role !== filters.role) return false;
    return true;
  });

  const activeTemplates = templates.filter((t) => t.is_active);
  const templateStats = {
    active: activeTemplates.length,
    inactive: templates.length - activeTemplates.length,
  };
  const metricHealth = {
    onTrack: filteredMetrics.filter((m) => m.status === "on_track").length,
    offTrack: filteredMetrics.filter((m) => m.status === "off_track").length,
    pending: filteredMetrics.filter((m) => m.status !== "on_track" && m.status !== "off_track").length,
  };

  // performanceSeries for charts
  const performanceSeries = (() => {
    const byWeek = new Map<
      string,
      { week: string; label: string; goalTotal: number; actualTotal: number; count: number; onTrack: number }
    >();
    for (const m of filteredMetrics) {
      const week = m.week_of ? format(new Date(m.week_of), "yyyy-MM-dd") : "";
      if (!week) continue;
      const label = m.week_of ? format(new Date(m.week_of), "MMM d") : "";
      const entry = byWeek.get(week) || { week, label, goalTotal: 0, actualTotal: 0, count: 0, onTrack: 0 };
      entry.goalTotal += m.target_value ?? 0;
      entry.actualTotal += m.current_value ?? 0;
      entry.count += 1;
      if (m.status === "on_track") entry.onTrack += 1;
      byWeek.set(week, entry);
    }
    return Array.from(byWeek.values())
      .map((e) => ({
        ...e,
        goal: e.count ? e.goalTotal / e.count : 0,
        actual: e.count ? e.actualTotal / e.count : 0,
        onTrackRate: e.count ? Math.round((e.onTrack / e.count) * 100) : 0,
      }))
      .sort((a, b) => new Date(a.week).getTime() - new Date(b.week).getTime());
  })();

  const openTemplateModal = (template?: EOSScorecard) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({
        name: template.name,
        description: template.description || "",
        is_active: template.is_active ?? true,
      });
    } else {
      setEditingTemplate(null);
      setTemplateForm(emptyTemplateForm);
    }
    setTemplateDialogOpen(true);
  };

  const openMetricModal = (metric?: typeof editingMetric) => {
    if (metric) {
      const notes = parseMetricNotes((metric as { notes?: string | null }).notes);
      setEditingMetric(metric);
      setMetricForm({
        scorecard_id: metric.scorecard_id,
        metric_name: metric.name,
        measurable: metric.description || "",
        goal_value: String(metric.target_value ?? ""),
        actual_value: String(metric.current_value ?? ""),
        week_date: metric.week_of ? format(new Date(metric.week_of), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
        owner_id: "",
        podId: notes.podId || "",
        role: notes.role || "",
        commentary: notes.commentary || "",
      });
    } else {
      setEditingMetric(null);
      setMetricForm({
        ...emptyMetricForm,
        scorecard_id: selectedTemplateId || "",
        week_date: format(new Date(), "yyyy-MM-dd"),
      });
    }
    setMetricDialogOpen(true);
  };

  const handleTemplateSave = async () => {
    if (!templateForm.name.trim()) {
      toast.error("Name is required", { description: "Templates need a name to identify them." });
      return;
    }
    try {
      if (editingTemplate) {
        await updateTemplate.mutateAsync({
          id: editingTemplate.id,
          data: { name: templateForm.name, description: templateForm.description || null, is_active: templateForm.is_active },
        });
      } else {
        await createTemplate.mutateAsync(templateForm);
      }
      setTemplateDialogOpen(false);
    } catch {
      // Toast handled by hook
    }
  };

  const handleMetricSave = async () => {
    if (!metricForm.scorecard_id) {
      toast.error("Select a template", { description: "Assign the metric to a scorecard template." });
      return;
    }
    if (!metricForm.metric_name.trim() || !metricForm.measurable.trim()) {
      toast.error("Metric details missing", { description: "Please provide both the metric name and measurable description." });
      return;
    }
    if (!metricForm.week_date) {
      toast.error("Week required", { description: "Log the week the metric applies to." });
      return;
    }
    const goal = metricForm.goal_value ? parseFloat(metricForm.goal_value) : undefined;
    const actual = metricForm.actual_value ? parseFloat(metricForm.actual_value) : undefined;
    try {
      if (editingMetric) {
        await updateMetric.mutateAsync({
          id: editingMetric.id,
          scorecard_id: metricForm.scorecard_id,
          metric_name: metricForm.metric_name,
          measurable: metricForm.measurable,
          goal_value: goal,
          actual_value: actual,
          week_date: metricForm.week_date,
          podId: metricForm.podId || undefined,
          role: metricForm.role || undefined,
          commentary: metricForm.commentary || undefined,
        });
      } else {
        await createMetric.mutateAsync({
          scorecard_id: metricForm.scorecard_id,
          metric_name: metricForm.metric_name,
          measurable: metricForm.measurable,
          goal_value: goal,
          actual_value: actual,
          week_date: metricForm.week_date,
          podId: metricForm.podId || undefined,
          role: metricForm.role || undefined,
          commentary: metricForm.commentary || undefined,
        });
      }
      setMetricDialogOpen(false);
    } catch {
      // Toast handled by hook
    }
  };

  const handleTemplateDelete = (template: EOSScorecard) => {
    if (!window.confirm(`Delete template "${template.name}"?`)) return;
    deleteTemplate.mutate(template.id, {
      onSuccess: () => {
        if (selectedTemplateId === template.id) {
          const remaining = templates.filter((t) => t.id !== template.id);
          setSelectedTemplateId(remaining[0]?.id);
        }
      },
    });
  };

  const handleMetricDelete = (metric: { id: string; name: string; scorecard_id: string }) => {
    if (!window.confirm(`Delete metric "${metric.name}"?`)) return;
    deleteMetric.mutate(metric.id);
  };

  const exportCsv = () => {
    if (filteredMetrics.length === 0) return;
    const templateMap = new Map(templates.map((t) => [t.id, t.name]));
    const podMap = new Map(pods.map((p) => [p.id, p.name]));
    const escape = (v: string | number | null | undefined) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = ["Template", "Metric", "Measurable", "Goal", "Actual", "Week", "On Track", "Pod", "Role", "Notes"];
    const rows = filteredMetrics.map((m) => {
      const notes = parseMetricNotes((m as { notes?: string | null }).notes);
      return [
        escape(templateMap.get(m.scorecard_id)),
        escape(m.name),
        escape(m.description),
        m.target_value ?? "",
        m.current_value ?? "",
        escape(m.week_of ? format(new Date(m.week_of), "yyyy-MM-dd") : null),
        m.status === "on_track" ? "Yes" : "No",
        escape(notes.podId ? podMap.get(notes.podId) ?? notes.podId : null),
        escape(notes.role),
        escape(notes.commentary),
      ];
    });
    const content = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadCSV(content, "scorecard-metrics");
    toast.success("Metrics exported");
  };

  const clearFilters = () => {
    setFilters((f) => ({ ...f, podId: "", role: "" }));
  };

  if (loadingTemplates) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with tabs on right */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">Scorecard Admin Workspace</h1>
            <p className="text-muted-foreground">Manage EOS scorecard templates, metric definitions, and performance dashboards with pod-aware visibility.</p>
          </div>
          <div className="flex gap-2">
            <Button variant={activeTab === "templates" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("templates")}>
              <FileText className="h-4 w-4 mr-2" /> Templates
            </Button>
            <Button variant={activeTab === "metrics" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("metrics")}>
              <Layers className="h-4 w-4 mr-2" /> Metric Library
            </Button>
            <Button variant={activeTab === "performance" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("performance")}>
              <LineChartIcon className="h-4 w-4 mr-2" /> Performance
            </Button>
          </div>
        </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{templateStats.active}</p>
            <p className="text-sm text-muted-foreground">Active templates</p>
            <p className="text-xs text-muted-foreground">{templateStats.inactive} archived</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{filteredMetrics.length}</p>
            <p className="text-sm text-muted-foreground">Metrics tracked</p>
            <p className="text-xs text-muted-foreground">Filtered by date and pod</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-success">{metricHealth.onTrack}</p>
            <p className="text-sm text-muted-foreground">On-track metrics</p>
            <p className="text-xs text-muted-foreground">{metricHealth.offTrack} at risk</p>
          </CardContent>
        </Card>
      </div>

      <TabsList className="grid w-full max-w-md grid-cols-3">
        <TabsTrigger value="templates">Templates</TabsTrigger>
        <TabsTrigger value="metrics">Metric Library</TabsTrigger>
        <TabsTrigger value="performance">Performance</TabsTrigger>
      </TabsList>

        {/* Templates tab */}
        <TabsContent value="templates" className="space-y-6 mt-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Template management
              </h2>
              <p className="text-sm text-muted-foreground">Create reusable scorecard templates, define ownership expectations, and assign them to pods and roles.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedTemplateId(undefined)}>
                <RefreshCw className="h-4 w-4 mr-2" /> Reset selection
              </Button>
              <Button size="sm" onClick={() => openTemplateModal()}>
                <Plus className="h-4 w-4 mr-2" /> New template
              </Button>
            </div>
          </div>

          {loadingTemplates ? (
            <p className="text-muted-foreground">Loading templates…</p>
          ) : templates.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => (
                <Card key={t.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      {t.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">{t.description || "No description"}</CardDescription>
                    <Badge variant={t.is_active ? "outline" : "secondary"}>{t.is_active ? "Active" : "Inactive"}</Badge>
                  </CardHeader>
                  <CardContent className="pt-0 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{metricCountByTemplate[t.id] ?? 0} metrics</span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openTemplateModal(t)}>Edit</Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleTemplateDelete(t)}>Delete</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <h3 className="text-lg font-semibold">No templates yet</h3>
                <p className="text-muted-foreground mb-4">Start with a base template to unlock metric tracking.</p>
                <Button onClick={() => openTemplateModal()}>
                  <Plus className="h-4 w-4 mr-2" /> New template
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Metric Library tab */}
        <TabsContent value="metrics" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" /> Metric library
              </CardTitle>
              <CardDescription>Manage reusable metric definitions with pod and role context.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4 flex-wrap">
            <Select
              value={selectedTemplateId ?? "choose"}
              onValueChange={(v) => setSelectedTemplateId(v === "choose" ? undefined : v)}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Choose template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="choose">Choose template</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={filteredMetrics.length === 0}>
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
              <Button size="sm" onClick={() => openMetricModal()} disabled={!selectedTemplateId}>
                <Plus className="h-4 w-4 mr-2" /> Add metric
              </Button>
            </div>
          </div>

          {/* Filter row (5 columns) */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Search metric</Label>
              <Input placeholder="Search by name" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Pod</Label>
              <Select value={filters.podId || "all-pods"} onValueChange={(v) => setFilters((f) => ({ ...f, podId: v === "all-pods" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Pod" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-pods">All pods</SelectItem>
                  {pods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={filters.role || "all-roles"} onValueChange={(v) => setFilters((f) => ({ ...f, role: v === "all-roles" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-roles">All roles</SelectItem>
                  {DEFAULT_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start</Label>
              <Input type="date" value={filters.startDate} onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>End</Label>
              <Input type="date" value={filters.endDate} onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>

          <Separator />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead>Goal</TableHead>
                <TableHead>Actual</TableHead>
                <TableHead>Week</TableHead>
                <TableHead>Pod</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingMetrics ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">Loading metrics…</TableCell>
                </TableRow>
              ) : filteredMetrics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">No metrics match the filters.</TableCell>
                </TableRow>
              ) : (
                filteredMetrics.map((m) => {
                  const notes = parseMetricNotes((m as { notes?: string | null }).notes);
                  const podName = notes.podId ? (pods.find((p) => p.id === notes.podId)?.name ?? notes.podId) : "—";
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <span className="font-medium">{m.name}</span>
                        <p className="text-xs text-muted-foreground">{m.description ?? "—"}</p>
                      </TableCell>
                      <TableCell>{m.target_value ?? "—"}</TableCell>
                      <TableCell>{m.current_value ?? "—"}</TableCell>
                      <TableCell>{m.week_of ? format(new Date(m.week_of), "yyyy-MM-dd") : "—"}</TableCell>
                      <TableCell>{podName}</TableCell>
                      <TableCell>{notes.role ?? "—"}</TableCell>
                      <TableCell>
                        {m.status == null || (m.status as string) === "pending" || m.status === "needs_attention" ? (
                          <Badge variant="outline">Pending</Badge>
                        ) : m.status === "on_track" ? (
                          <Badge className="bg-success/10 text-success border-success/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> On Track
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-700 border-amber-200">
                            <AlertCircle className="h-3 w-3 mr-1" /> At Risk
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><Filter className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openMetricModal(m)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleMetricDelete(m)}>Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance tab */}
        <TabsContent value="performance" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" /> Performance dashboards
              </CardTitle>
              <CardDescription>Track historical performance, pod assignments, and role-level accountability across scorecards.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Select
              value={selectedTemplateId ?? "choose"}
              onValueChange={(v) => setSelectedTemplateId(v === "choose" ? undefined : v)}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Choose template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="choose">Choose template</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <RefreshCw className="h-4 w-4 mr-2" /> Clear filters
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{filters.podId ? "Focused" : pods.length}</p>
                    <p className="text-sm text-muted-foreground">Pod coverage</p>
                    <p className="text-xs text-muted-foreground">{pods.length} pods available</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <div>
                    <p className="text-2xl font-bold">
                      {filteredMetrics.length ? Math.round((metricHealth.onTrack / filteredMetrics.length) * 100) : 0}%
                    </p>
                    <p className="text-sm text-muted-foreground">On-track rate</p>
                    <p className="text-xs text-muted-foreground">{metricHealth.offTrack} at risk</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{performanceSeries.length}</p>
                    <p className="text-sm text-muted-foreground">Historical points</p>
                    <p className="text-xs text-muted-foreground">Date range respects filters</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <LineChartIcon className="h-4 w-4" /> Goal vs actual (avg)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {performanceSeries.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={performanceSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v: number) => v.toFixed(1)} />
                      <Area type="monotone" dataKey="goal" stroke="#3b82f6" fill="#3b82f6/20" name="Goal" />
                      <Area type="monotone" dataKey="actual" stroke="#22c55e" fill="#22c55e/20" name="Actual" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="py-12 text-center text-muted-foreground text-sm">No data</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" /> On-track trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {performanceSeries.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={performanceSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} domain={[0, 100]} />
                      <Tooltip formatter={(v: number) => `${v}%`} />
                      <Line type="monotone" dataKey="onTrackRate" stroke="#22c55e" name="On-track %" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="py-12 text-center text-muted-foreground text-sm">No data</div>
                )}
              </CardContent>
            </Card>
          </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Template Create/Edit Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit template" : "New template"}</DialogTitle>
            <DialogDescription>
              Define reusable scorecard templates with clear ownership expectations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={templateForm.name}
                onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Weekly leadership scorecard"
              />
            </div>
            <div>
              <Label htmlFor="template-description">Description</Label>
              <Textarea
                id="template-description"
                value={templateForm.description}
                onChange={(e) => setTemplateForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Key KPIs, cadence, and ownership details."
                rows={3}
                className="resize-y"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <Label htmlFor="template-active">Active template</Label>
              <Switch
                id="template-active"
                checked={templateForm.is_active}
                onCheckedChange={(checked) => setTemplateForm((f) => ({ ...f, is_active: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!templateForm.name.trim() || createTemplate.isPending || updateTemplate.isPending}
              onClick={handleTemplateSave}
            >
              {(createTemplate.isPending || updateTemplate.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTemplate ? "Save changes" : "Create template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Metric Create/Edit Dialog */}
      <Dialog open={metricDialogOpen} onOpenChange={setMetricDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMetric ? "Edit metric" : "New metric"}</DialogTitle>
            <DialogDescription>Define metric with goal, actual, and pod/role context.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={metricForm.scorecard_id || "choose"} onValueChange={(v) => setMetricForm((f) => ({ ...f, scorecard_id: v === "choose" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Choose template" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="choose">Choose template</SelectItem>
                  {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Metric name</Label>
                <Input value={metricForm.metric_name} onChange={(e) => setMetricForm((f) => ({ ...f, metric_name: e.target.value }))} placeholder="Weekly revenue" />
              </div>
              <div className="space-y-2">
                <Label>Measurable</Label>
                <Input value={metricForm.measurable} onChange={(e) => setMetricForm((f) => ({ ...f, measurable: e.target.value }))} placeholder="Dollars booked this week" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Goal value</Label>
                <Input type="number" value={metricForm.goal_value} onChange={(e) => setMetricForm((f) => ({ ...f, goal_value: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Actual value</Label>
                <Input type="number" value={metricForm.actual_value} onChange={(e) => setMetricForm((f) => ({ ...f, actual_value: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Week</Label>
              <Input type="date" value={metricForm.week_date} onChange={(e) => setMetricForm((f) => ({ ...f, week_date: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pod assignment</Label>
                <Select value={metricForm.podId || "no-pod"} onValueChange={(v) => setMetricForm((f) => ({ ...f, podId: v === "no-pod" ? "" : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-pod">No pod</SelectItem>
                    {pods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Role alignment</Label>
                <Select value={metricForm.role || "no-role"} onValueChange={(v) => setMetricForm((f) => ({ ...f, role: v === "no-role" ? "" : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-role">No role</SelectItem>
                    {DEFAULT_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={metricForm.commentary} onChange={(e) => setMetricForm((f) => ({ ...f, commentary: e.target.value }))} placeholder="Context, risks, and historical notes" rows={3} className="resize-y" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMetricDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!metricForm.scorecard_id || !metricForm.metric_name?.trim() || !metricForm.measurable?.trim() || !metricForm.week_date || createMetric.isPending || updateMetric.isPending}
              onClick={handleMetricSave}
            >
              {(createMetric.isPending || updateMetric.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingMetric ? "Save changes" : "Create metric"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
