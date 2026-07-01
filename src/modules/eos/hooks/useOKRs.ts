/**
 * OKR Hooks
 *
 * CRUD operations for OKRs with key results and check-ins.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { OKR, OKRKeyResult, OKRCheckIn, OKRFormData, OKRFilters, CreateOKRInput, CreateKeyResultInput } from "../types";
import { getCurrentQuarter, getYearlyString } from "@/utils/okrHelpers";

const OKRS_KEY = "eos-okrs";

export { OKRS_KEY };

type ApprovalPendingResult = {
  approval_pending: true;
  approval_request_id?: string;
};

function isApprovalPendingResult(value: unknown): value is ApprovalPendingResult {
  return Boolean(
    value &&
      typeof value === "object" &&
      "approval_pending" in value &&
      (value as { approval_pending?: unknown }).approval_pending === true
  );
}

async function requestOKRApproval(params: {
  userId: string;
  actionDescription: string;
  requestType: "create" | "update" | "delete";
  payload: Record<string, unknown>;
}) {
  const { data, error } = await supabase.functions.invoke("request-approval", {
    body: {
      user_id: params.userId,
      agent_id: "eos-okr-governance",
      request_type: "data_change",
      action_description: params.actionDescription,
      tool_name: `okr.${params.requestType}`,
      tool_parameters: params.payload,
      risk_level: "medium",
      confidence_score: 1,
    },
  });

  if (error) throw error;
  return data as { requires_approval?: boolean; approval_request_id?: string };
}

/**
 * Build CreateOKRInput from an existing OKR for one-click duplicate.
 * New OKR gets same objective and key results (start/target copied; current reset to start).
 */
export function okrToCreatePayload(okr: OKR): CreateOKRInput {
  const formStatus = ["draft", "active", "at_risk", "completed"].includes(okr.status)
    ? okr.status
    : "draft";
  return {
    title: okr.title,
    description: okr.description || undefined,
    okr_type: (okr.okr_type as "company" | "team" | "personal") || "personal",
    owner_id: okr.owner_id || undefined,
    quarter: okr.quarter,
    year: okr.year ?? new Date().getFullYear(),
    status: formStatus as "draft" | "active" | "at_risk" | "completed",
    end_date: okr.end_date || undefined,
    pod_id: okr.pod_id || undefined,
    key_results: (okr.key_results || []).map((kr): CreateKeyResultInput => ({
      title: kr.title,
      description: kr.description || undefined,
      metric_type: (kr.metric_type as "number" | "percentage" | "currency" | "boolean") || "number",
      unit: kr.unit || undefined,
      start_value: Number(kr.start_value ?? 0),
      target_value: Number(kr.target_value ?? 0),
      owner_id: kr.owner_id || undefined,
      update_frequency: (kr.update_frequency as "daily" | "weekly" | "biweekly" | "monthly") || "weekly",
    })),
  };
}


/**
 * Fetch OKRs with optional filters (non-archived by default).
 * Loads owner profile, pod, and key results with responsible profile.
 */
export function useOKRs(filters?: OKRFilters) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [OKRS_KEY, filters],
    queryFn: async (): Promise<OKR[]> => {
      let query = supabase
        .from("okrs")
        .select("*")
        .or("is_archived.is.null,is_archived.eq.false")
        .order("created_at", { ascending: false });

      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters?.quarter !== undefined && filters?.quarter !== "all") {
        if (Array.isArray(filters.quarter)) {
          query = query.in("quarter", filters.quarter);
        } else {
          query = query.eq("quarter", filters.quarter);
        }
      }
      if (filters?.owner_id) {
        query = query.eq("owner_id", filters.owner_id);
      }
      if (filters?.pod_id) {
        query = query.eq("pod_id", filters.pod_id);
      }
      if (filters?.search) {
        query = query.ilike("title", `%${filters.search}%`);
      }

      const { data: rows, error } = await query;
      if (error) throw error;
      const okrs = (rows || []) as OKR[];

      if (okrs.length === 0) return okrs;

      const ownerIds = [...new Set(okrs.map((o) => o.owner_id).filter(Boolean))] as string[];
      const podIds = [...new Set(okrs.map((o) => o.pod_id).filter(Boolean))] as string[];

      let profilesMap = new Map<string, { full_name: string; email: string }>();
      let podsMap = new Map<string, { id: string; name: string; color: string; is_active: boolean }>();

      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ownerIds);
        (profiles || []).forEach((p: { id: string; full_name: string; email: string }) => {
          profilesMap.set(p.id, { full_name: p.full_name || "", email: p.email || "" });
        });
      }
      if (podIds.length > 0) {
        const { data: pods } = await supabase
          .from("eos_pods")
          .select("id, name, color, is_active")
          .in("id", podIds);
        (pods || []).forEach((p: { id: string; name: string; color: string; is_active: boolean }) => {
          podsMap.set(p.id, p);
        });
      }

      const { data: krRows } = await supabase
        .from("okr_key_results")
        .select("*")
        .in("okr_id", okrs.map((o) => o.id))
        .order("sort_order", { ascending: true });

      const krList = (krRows || []) as OKRKeyResult[];
      const krOwnerIds = [...new Set(krList.map((k) => k.owner_id).filter(Boolean))] as string[];
      krOwnerIds.forEach((id) => {
        if (!profilesMap.has(id)) {
          profilesMap.set(id, { full_name: "", email: "" });
        }
      });
      if (krOwnerIds.length > 0 && profilesMap.size < ownerIds.length + krOwnerIds.length) {
        const { data: krProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", krOwnerIds);
        (krProfiles || []).forEach((p: { id: string; full_name: string; email: string }) => {
          profilesMap.set(p.id, { full_name: p.full_name || "", email: p.email || "" });
        });
      }

      const krByOkr = new Map<string, OKRKeyResult[]>();
      for (const kr of krList) {
        const list = krByOkr.get(kr.okr_id) || [];
        list.push({
          ...kr,
          owner: kr.owner_id ? profilesMap.get(kr.owner_id) ?? null : null,
        });
        krByOkr.set(kr.okr_id, list);
      }

      return okrs.map((o) => ({
        ...o,
        owner: o.owner_id ? profilesMap.get(o.owner_id) ?? null : null,
        pod: o.pod_id ? podsMap.get(o.pod_id) ?? null : null,
        key_results: krByOkr.get(o.id) || [],
      }));
    },
    enabled: !!user,
  });
}

/**
 * Resolve quarter filter for API: "current" -> current quarter string; "all" -> undefined.
 * For company tab, "current" can return [quarter, yearly] for the same year.
 */
export function resolveQuarterFilter(
  quarterValue: string | undefined,
  includeYearlyForCompany?: boolean
): string | string[] | undefined {
  if (!quarterValue || quarterValue === "all") return undefined;
  if (quarterValue === "current") {
    const { quarter, year } = getCurrentQuarter();
    const qStr = `${quarter} ${year}`;
    if (includeYearlyForCompany) return [qStr, getYearlyString(year)];
    return qStr;
  }
  return quarterValue;
}

/**
 * Fetch closed (archived) OKRs for the Closed tab.
 */
export function useClosedOKRs(filters?: Pick<OKRFilters, "search" | "quarter">) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [OKRS_KEY, "closed", filters],
    queryFn: async (): Promise<OKR[]> => {
      let query = supabase
        .from("okrs")
        .select("*")
        .eq("is_archived", true)
        .order("updated_at", { ascending: false });

      if (filters?.search) {
        query = query.ilike("title", `%${filters.search}%`);
      }
      if (filters?.quarter && filters.quarter !== "all") {
        const q = filters.quarter;
        if (Array.isArray(q)) {
          query = query.in("quarter", q);
        } else {
          query = query.eq("quarter", q);
        }
      }

      const { data: rows, error } = await query;
      if (error) throw error;
      const okrs = (rows || []) as OKR[];

      if (okrs.length === 0) return okrs;

      const ownerIds = [...new Set(okrs.map((o) => o.owner_id).filter(Boolean))] as string[];
      const podIds = [...new Set(okrs.map((o) => o.pod_id).filter(Boolean))] as string[];

      const profilesMap = new Map<string, { full_name: string; email: string }>();
      const podsMap = new Map<string, { id: string; name: string; color: string; is_active: boolean }>();

      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ownerIds);
        (profiles || []).forEach((p: { id: string; full_name: string; email: string }) => {
          profilesMap.set(p.id, { full_name: p.full_name || "", email: p.email || "" });
        });
      }
      if (podIds.length > 0) {
        const { data: pods } = await supabase
          .from("eos_pods")
          .select("id, name, color, is_active")
          .in("id", podIds);
        (pods || []).forEach((p: { id: string; name: string; color: string; is_active: boolean }) => {
          podsMap.set(p.id, p);
        });
      }

      const { data: krRows } = await supabase
        .from("okr_key_results")
        .select("*")
        .in("okr_id", okrs.map((o) => o.id))
        .order("sort_order", { ascending: true });

      const krList = (krRows || []) as OKRKeyResult[];
      const krOwnerIds = [...new Set(krList.map((k) => k.owner_id).filter(Boolean))] as string[];
      if (krOwnerIds.length > 0) {
        const { data: krProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", krOwnerIds);
        (krProfiles || []).forEach((p: { id: string; full_name: string; email: string }) => {
          profilesMap.set(p.id, { full_name: p.full_name || "", email: p.email || "" });
        });
      }

      const krByOkr = new Map<string, OKRKeyResult[]>();
      for (const kr of krList) {
        const list = krByOkr.get(kr.okr_id) || [];
        list.push({
          ...kr,
          owner: kr.owner_id ? profilesMap.get(kr.owner_id) ?? null : null,
        });
        krByOkr.set(kr.okr_id, list);
      }

      return okrs.map((o) => ({
        ...o,
        owner: o.owner_id ? profilesMap.get(o.owner_id) ?? null : null,
        pod: o.pod_id ? podsMap.get(o.pod_id) ?? null : null,
        key_results: krByOkr.get(o.id) || [],
      }));
    },
    enabled: !!user,
  });
}

/**
 * Fetch a single OKR with key results, owner, pod, and KR owners.
 */
export function useOKRDetail(id: string | undefined) {
  return useQuery({
    queryKey: [OKRS_KEY, "detail", id],
    queryFn: async (): Promise<OKR | null> => {
      if (!id) return null;

      const { data: okr, error } = await supabase
        .from("okrs")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (!okr) return null;

      const { data: keyResults } = await supabase
        .from("okr_key_results")
        .select("*")
        .eq("okr_id", id)
        .order("sort_order", { ascending: true });

      const krList = (keyResults || []) as OKRKeyResult[];
      const ownerIds = [
        ...new Set([
          okr.owner_id,
          ...krList.map((k) => k.owner_id).filter(Boolean),
        ].filter(Boolean)),
      ] as string[];
      const podId = okr.pod_id;

      let ownerMap = new Map<string, { full_name: string; email: string }>();
      let pod: { id: string; name: string } | null = null;

      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ownerIds);
        (profiles || []).forEach((p: { id: string; full_name: string; email: string }) => {
          ownerMap.set(p.id, { full_name: p.full_name || "", email: p.email || "" });
        });
      }
      if (podId) {
        const { data: podRow } = await supabase
          .from("eos_pods")
          .select("id, name")
          .eq("id", podId)
          .single();
        if (podRow) pod = { id: podRow.id, name: podRow.name };
      }

      const key_results = krList.map((kr) => ({
        ...kr,
        owner: kr.owner_id ? ownerMap.get(kr.owner_id) ?? null : null,
      }));

      return {
        ...okr,
        owner: okr.owner_id ? ownerMap.get(okr.owner_id) ?? null : null,
        pod,
        key_results,
      } as OKR;
    },
    enabled: !!id,
  });
}

/**
 * Fetch check-ins for an OKR (with user profile for display).
 */
export function useOKRCheckIns(okrId: string | undefined) {
  return useQuery({
    queryKey: [OKRS_KEY, "check-ins", okrId],
    queryFn: async (): Promise<OKRCheckIn[]> => {
      if (!okrId) return [];

      const { data, error } = await supabase
        .from("okr_check_ins")
        .select("*")
        .eq("okr_id", okrId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const list = (data || []) as unknown as OKRCheckIn[];

      const userIds = [...new Set(list.map((c) => c.user_id).filter(Boolean))] as string[];
      if (userIds.length === 0) return list;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      const profileMap = new Map<string, { full_name: string; email: string }>();
      (profiles || []).forEach((p: { id: string; full_name: string; email: string }) => {
        profileMap.set(p.id, { full_name: p.full_name || "", email: p.email || "" });
      });

      return list.map((c) => ({
        ...c,
        user: c.user_id ? profileMap.get(c.user_id) ?? null : null,
      }));
    },
    enabled: !!okrId,
  });
}

/**
 * Create a new OKR with optional key results.
 */
export function useCreateOKR() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateOKRInput) => {
      const approval = await requestOKRApproval({
        userId: user!.id,
        actionDescription: `Create OKR: ${data.title}`,
        requestType: "create",
        payload: data as unknown as Record<string, unknown>,
      });

      if (approval?.requires_approval) {
        return { approval_pending: true, approval_request_id: approval.approval_request_id } as ApprovalPendingResult;
      }

      const { data: okr, error: okrError } = await supabase
        .from("okrs")
        .insert({
          title: data.title,
          description: data.description || null,
          owner_id: data.owner_id || user!.id,
          status: data.status || "draft",
          quarter: data.quarter,
          year: data.year ?? new Date().getFullYear(),
          start_date: data.start_date || null,
          end_date: data.end_date || null,
          pod_id: data.pod_id || null,
          parent_okr_id: data.parent_okr_id || null,
          okr_type: data.okr_type || "personal",
          created_by: user!.id,
        })
        .select()
        .single();

      if (okrError) throw okrError;
      const okrId = (okr as { id: string }).id;

      const keyResults = data.key_results || [];
      if (keyResults.length > 0) {
        const inserts = keyResults.map((kr, i) => ({
          okr_id: okrId,
          title: kr.title,
          description: kr.description || null,
          metric_type: kr.metric_type || "number",
          target_value: kr.target_value,
          start_value: kr.start_value ?? 0,
          current_value: kr.start_value ?? 0,
          unit: kr.unit || "",
          owner_id: kr.owner_id || null,
          sort_order: i,
          update_frequency: kr.update_frequency || "weekly",
        }));
        const { error: krError } = await supabase
          .from("okr_key_results")
          .insert(inserts);
        if (krError) throw krError;
      }

      return okr;
    },
    onSuccess: (result) => {
      if (isApprovalPendingResult(result)) {
        toast.info("OKR creation submitted for approval", {
          description: `Request ID: ${String(result.approval_request_id || "").slice(0, 8)}...`,
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: [OKRS_KEY] });
      toast.success("OKR created");
    },
    onError: (error: Error) => {
      toast.error("Failed to create OKR", { description: error.message });
    },
  });
}

/**
 * Update an existing OKR.
 */
export function useUpdateOKR() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<OKRFormData> & { progress?: number; is_archived?: boolean } }) => {
      const isClosing = data.is_archived === true;
      if (!isClosing) {
        const approval = await requestOKRApproval({
          userId: user!.id,
          actionDescription: `Update OKR ${id}`,
          requestType: "update",
          payload: { id, ...data } as Record<string, unknown>,
        });
        if (approval?.requires_approval) {
          return { approval_pending: true, approval_request_id: approval.approval_request_id } as ApprovalPendingResult;
        }
      }

      const { data: okr, error } = await supabase
        .from("okrs")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
          updated_by: data.is_archived !== undefined ? user!.id : undefined,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return okr;
    },
    onSuccess: (result) => {
      if (isApprovalPendingResult(result)) {
        toast.info("OKR update submitted for approval", {
          description: `Request ID: ${String(result.approval_request_id || "").slice(0, 8)}...`,
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: [OKRS_KEY] });
      queryClient.invalidateQueries({ queryKey: [OKRS_KEY, "closed"] });
      toast.success("OKR updated");
    },
    onError: (error: Error) => {
      toast.error("Failed to update OKR", { description: error.message });
    },
  });
}

/**
 * Delete an OKR.
 */
export function useDeleteOKR() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const approval = await requestOKRApproval({
        userId: user!.id,
        actionDescription: `Delete OKR ${id}`,
        requestType: "delete",
        payload: { id },
      });

      if (approval?.requires_approval) {
        return { approval_pending: true, approval_request_id: approval.approval_request_id } as ApprovalPendingResult;
      }

      const { error } = await supabase.from("okrs").delete().eq("id", id);
      if (error) throw error;
      return { approval_pending: false } as unknown as ApprovalPendingResult;
    },
    onSuccess: (result) => {
      if (isApprovalPendingResult(result)) {
        toast.info("OKR deletion submitted for approval", {
          description: `Request ID: ${String(result.approval_request_id || "").slice(0, 8)}...`,
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: [OKRS_KEY] });
      toast.success("OKR deleted");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete OKR", { description: error.message });
    },
  });
}

/**
 * Add a key result to an OKR.
 */
export function useAddKeyResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      okr_id: string;
      title: string;
      description?: string;
      metric_type?: string;
      target_value: number;
      start_value?: number;
      unit?: string;
      owner_id?: string;
    }) => {
      const { data: kr, error } = await supabase
        .from("okr_key_results")
        .insert({
          okr_id: data.okr_id,
          title: data.title,
          description: data.description || null,
          metric_type: data.metric_type || "number",
          target_value: data.target_value,
          start_value: data.start_value || 0,
          current_value: data.start_value || 0,
          unit: data.unit || "",
          owner_id: data.owner_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return kr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [OKRS_KEY] });
      toast.success("Key result added");
    },
    onError: (error: Error) => {
      toast.error("Failed to add key result", { description: error.message });
    },
  });
}

/**
 * Record a check-in for a key result.
 */
export function useCheckIn() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      okr_id: string;
      key_result_id: string;
      previous_value: number;
      new_value: number;
      confidence?: "low" | "medium" | "high";
      notes?: string;
    }) => {
      // Create check-in record
      const { error: checkInError } = await supabase.from("okr_check_ins").insert({
        okr_id: data.okr_id,
        key_result_id: data.key_result_id,
        user_id: user!.id,
        previous_value: data.previous_value,
        new_value: data.new_value,
        confidence: data.confidence || "medium",
        notes: data.notes || null,
      });

      if (checkInError) throw checkInError;

      // Update the key result's current value
      const { error: updateError } = await supabase
        .from("okr_key_results")
        .update({
          current_value: data.new_value,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.key_result_id);

      if (updateError) throw updateError;

      // Write value change to audit history table (best-effort; table may not exist yet)
      const { error: historyError } = await supabase
        .from("key_result_history" as never)
        .insert({
          key_result_id: data.key_result_id,
          previous_value: data.previous_value,
          new_value: data.new_value,
          notes: data.notes || null,
          updated_by: user!.id,
        } as never);

      if (historyError) {
        // PGRST205 = table not found; allow check-in to succeed without history
        const isTableMissing =
          historyError.code === "PGRST205" ||
          (historyError.message && historyError.message.includes("key_result_history"));
        if (!isTableMissing) throw historyError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [OKRS_KEY] });
      toast.success("Check-in recorded");
    },
    onError: (error: Error) => {
      toast.error("Failed to record check-in", { description: error.message });
    },
  });
}
