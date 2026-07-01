/**
 * Create OKR Dialog
 *
 * Full form: Objective (title, description), Type, Owner, Quarter, Year,
 * Status, Due date; Key Results list (title, metric name, unit, start, target,
 * frequency, responsible). Submit creates OKR and key results.
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateOKR, useUpdateOKR } from "../../hooks/useOKRs";
import { OKRS_KEY } from "../../hooks/useOKRs";
import { getCurrentQuarterString, getCurrentQuarter } from "@/utils/okrHelpers";
import { Plus, Trash2 } from "lucide-react";
import type { CreateOKRInput, CreateKeyResultInput, OKRType } from "../../types";
import type { EOSPod, OKR } from "../../types";

const keyResultSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  metric_type: z.enum(["number", "percentage", "currency", "boolean"]).optional(),
  unit: z.string().optional(),
  start_value: z.coerce.number().min(0),
  target_value: z.coerce.number(),
  owner_id: z.string().optional().nullable(),
  update_frequency: z.enum(["daily", "weekly", "biweekly", "monthly"]).optional(),
});

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  okr_type: z.enum(["company", "team", "personal"]),
  owner_id: z.string().optional().nullable(),
  quarter: z.string().min(1),
  year: z.coerce.number(),
  status: z.enum(["draft", "active", "at_risk", "completed"]),
  end_date: z.string().optional(),
  pod_id: z.string().optional().nullable(),
  key_results: z.array(keyResultSchema),
});

type FormValues = z.infer<typeof formSchema>;

const QUARTERS = (() => {
  const { year } = getCurrentQuarter();
  const out: string[] = [];
  for (let q = 1; q <= 4; q++) out.push(`Q${q} ${year}`);
  return out;
})();

const UNIT_OPTIONS = [
  { value: "number", label: "Number" },
  { value: "percentage", label: "Percentage" },
  { value: "currency", label: "Currency" },
  { value: "custom", label: "Custom" },
];

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 Weeks" },
  { value: "monthly", label: "Monthly" },
];

interface CreateOKRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, form is prefilled for edit or duplicate. */
  initialOkr?: OKR | null;
  /** 'edit' = update existing OKR; 'duplicate' = create new with same data; 'create' = blank form. */
  mode?: "create" | "edit" | "duplicate";
}

export function CreateOKRDialog({ open, onOpenChange, initialOkr = null, mode = "create" }: CreateOKRDialogProps) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [pods, setPods] = useState<EOSPod[]>([]);

  const { data: profilesData } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });
  useEffect(() => {
    if (profilesData) setProfiles(profilesData as { id: string; full_name: string; email: string }[]);
  }, [profilesData]);

  const { data: podsData } = useQuery({
    queryKey: ["eos-pods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eos_pods")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });
  useEffect(() => {
    if (podsData) setPods(podsData as EOSPod[]);
  }, [podsData]);

  const defaultQuarter = getCurrentQuarterString();
  const { year: defaultYear } = getCurrentQuarter();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      okr_type: "personal",
      owner_id: user?.id ?? null,
      quarter: defaultQuarter,
      year: defaultYear,
      status: "draft",
      end_date: "",
      pod_id: null,
      key_results: [
        {
          title: "",
          description: "",
          metric_type: "number",
          unit: "",
          start_value: 0,
          target_value: 0,
          owner_id: null,
          update_frequency: "weekly",
        },
      ],
    },
  });

  const watchType = form.watch("okr_type");
  const watchKeyResults = form.watch("key_results");

  const createOKR = useCreateOKR();
  const updateOKR = useUpdateOKR();
  const queryClient = useQueryClient();

  // Prefill form when opening for edit or duplicate; reset to defaults when opening for create
  useEffect(() => {
    if (!open) return;
    if (!initialOkr || mode === "create") {
      form.reset({
        title: "",
        description: "",
        okr_type: "personal",
        owner_id: user?.id ?? null,
        quarter: defaultQuarter,
        year: defaultYear,
        status: "draft",
        end_date: "",
        pod_id: null,
        key_results: [
          {
            title: "",
            description: "",
            metric_type: "number",
            unit: "",
            start_value: 0,
            target_value: 0,
            owner_id: null,
            update_frequency: "weekly",
          },
        ],
      });
      return;
    }
    const okr = initialOkr;
    const yearFromQuarter = okr.quarter ? parseInt(okr.quarter.split(" ")[1] || String(defaultYear), 10) : defaultYear;
    const endDate = okr.end_date ? (okr.end_date.includes("T") ? okr.end_date.slice(0, 10) : okr.end_date) : "";
    form.reset({
      title: okr.title,
      description: okr.description || "",
      okr_type: (okr.okr_type as OKRType) || "personal",
      owner_id: okr.owner_id ?? null,
      quarter: okr.quarter || defaultQuarter,
      year: okr.year ?? yearFromQuarter,
      status: (["draft", "active", "at_risk", "completed"].includes(okr.status)
        ? okr.status
        : "draft") as FormValues["status"],
      end_date: endDate,
      pod_id: okr.pod_id ?? null,
      key_results:
        okr.key_results && okr.key_results.length > 0
          ? okr.key_results.map((kr) => ({
              title: kr.title,
              description: kr.description || "",
              metric_type: (kr.metric_type as "number" | "percentage" | "currency" | "boolean") || "number",
              unit: kr.unit || "",
              start_value: Number(kr.start_value ?? 0),
              target_value: Number(kr.target_value ?? 0),
              owner_id: kr.owner_id ?? null,
              update_frequency: (kr.update_frequency as "daily" | "weekly" | "biweekly" | "monthly") || "weekly",
            }))
          : [
              {
                title: "",
                description: "",
                metric_type: "number",
                unit: "",
                start_value: 0,
                target_value: 0,
                owner_id: null,
                update_frequency: "weekly",
              },
            ],
    });
  }, [open, initialOkr, mode, defaultQuarter, defaultYear, user?.id, form]);

  const onSubmit = async (values: FormValues) => {
    if (mode === "edit" && initialOkr) {
      await updateOKR.mutateAsync({
        id: initialOkr.id,
        data: {
          title: values.title,
          description: values.description || undefined,
          okr_type: values.okr_type,
          owner_id: values.owner_id || undefined,
          quarter: values.quarter,
          year: values.year,
          status: values.status,
          end_date: values.end_date || undefined,
          pod_id: values.pod_id || undefined,
        },
      });
      await queryClient.refetchQueries({ queryKey: [OKRS_KEY] });
      onOpenChange(false);
      return;
    }

    const payload: CreateOKRInput = {
      title: values.title,
      description: values.description || undefined,
      okr_type: values.okr_type as OKRType,
      owner_id: values.owner_id || undefined,
      quarter: values.quarter,
      year: values.year,
      status: values.status as "draft" | "active" | "at_risk" | "completed",
      end_date: values.end_date || undefined,
      pod_id: values.pod_id || undefined,
      key_results: values.key_results
        .filter((kr) => kr.title.trim())
        .map((kr): CreateKeyResultInput => ({
          title: kr.title,
          description: kr.description,
          metric_type: kr.metric_type || "number",
          unit: kr.unit,
          start_value: kr.start_value,
          target_value: kr.target_value,
          owner_id: kr.owner_id || undefined,
          update_frequency: kr.update_frequency || "weekly",
        })),
    };
    await createOKR.mutateAsync(payload);
    form.reset({
      title: "",
      description: "",
      okr_type: "personal",
      owner_id: user?.id ?? null,
      quarter: getCurrentQuarterString(),
      year: getCurrentQuarter().year,
      status: "draft",
      end_date: "",
      pod_id: null,
      key_results: [
        {
          title: "",
          description: "",
          metric_type: "number",
          unit: "",
          start_value: 0,
          target_value: 0,
          owner_id: null,
          update_frequency: "weekly",
        },
      ],
    });
    onOpenChange(false);
  };

  const dialogTitle =
    mode === "edit" ? "Edit OKR" : mode === "duplicate" ? "Duplicate OKR" : "Create New OKR";
  const submitLabel =
    mode === "edit" ? "Update OKR" : mode === "duplicate" ? "Create Duplicate" : "Create OKR";
  const isSubmitting = createOKR.isPending || updateOKR.isPending;

  const addKeyResult = () => {
    form.setValue("key_results", [
      ...watchKeyResults,
      {
        title: "",
        description: "",
        metric_type: "number",
        unit: "",
        start_value: 0,
        target_value: 0,
        owner_id: null,
        update_frequency: "weekly",
      },
    ]);
  };

  const removeKeyResult = (index: number) => {
    const next = watchKeyResults.filter((_, i) => i !== index);
    if (next.length === 0) next.push({ title: "", description: "", metric_type: "number", unit: "", start_value: 0, target_value: 0, owner_id: null, update_frequency: "weekly" });
    form.setValue("key_results", next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update the objective and details below."
              : mode === "duplicate"
                ? "A copy of the OKR is prefilled. Adjust and save to create a new OKR."
                : "Define your objective and measurable key results to track progress."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Objective */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Objective</h4>
            <div className="grid gap-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Become Market Leader in Q1"
                {...form.register("title")}
              />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What is this OKR about?"
                rows={3}
                className="resize-none"
                {...form.register("description")}
              />
            </div>
          </div>

          {/* OKR Details: two columns */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">OKR Details</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  value={form.watch("okr_type")}
                  onValueChange={(v) => form.setValue("okr_type", v as OKRType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">Company</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>OKR Owner</Label>
                <Select
                  value={form.watch("owner_id") ?? "none"}
                  onValueChange={(v) => form.setValue("owner_id", v === "none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner (defaults to you)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select owner (defaults to you)</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name || p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Only employees with system accounts can be assigned as owners
                </p>
              </div>
              <div className="space-y-2">
                <Label>Quarter</Label>
                <Select
                  value={form.watch("quarter")}
                  onValueChange={(v) => form.setValue("quarter", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUARTERS.map((q) => (
                      <SelectItem key={q} value={q}>
                        {q}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Input
                  type="number"
                  {...form.register("year", { valueAsNumber: true })}
                />
              </div>
              {watchType === "team" && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Pod / Team</Label>
                  <Select
                    value={form.watch("pod_id") ?? "none"}
                    onValueChange={(v) => form.setValue("pod_id", v === "none" ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select pod" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">All Teams / PODs</SelectItem>
                      {pods.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Status *</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(v) => form.setValue("status", v as FormValues["status"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="at_risk">At Risk</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date *</Label>
                <Input
                  type="date"
                  {...form.register("end_date")}
                  placeholder="Pick a date"
                />
              </div>
            </div>
          </div>

          {/* Key Results */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Key Results</h4>
            {watchKeyResults.map((_, index) => (
              <div key={index} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Key Result {index + 1}</span>
                  {watchKeyResults.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeKeyResult(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Title *</Label>
                    <Input
                      placeholder="e.g., Increase Monthly Revenue"
                      {...form.register(`key_results.${index}.title`)}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Metric Name *</Label>
                    <Input
                      placeholder="e.g., Revenue, NPS Score"
                      {...form.register(`key_results.${index}.description`)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Unit</Label>
                    <Select
                      value={form.watch(`key_results.${index}.metric_type`) ?? "number"}
                      onValueChange={(v) => form.setValue(`key_results.${index}.metric_type`, v as "number" | "percentage" | "currency" | "boolean")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIT_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Start</Label>
                    <Input
                      type="number"
                      {...form.register(`key_results.${index}.start_value`, { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Target *</Label>
                    <Input
                      type="number"
                      {...form.register(`key_results.${index}.target_value`, { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Frequency</Label>
                    <Select
                      value={form.watch(`key_results.${index}.update_frequency`) ?? "weekly"}
                      onValueChange={(v) => form.setValue(`key_results.${index}.update_frequency`, v as "daily" | "weekly" | "biweekly" | "monthly")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FREQUENCY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Responsible Team Member</Label>
                    <Select
                      value={form.watch(`key_results.${index}.owner_id`) ?? "none"}
                      onValueChange={(v) => form.setValue(`key_results.${index}.owner_id`, v === "none" ? null : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team member" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select team member</SelectItem>
                        {profiles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name || p.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addKeyResult} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Add Key Result
            </Button>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
