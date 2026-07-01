/**
 * EOS SLA Targets — Approval rate and cycle time targets by pod/role.
 * Used by Admin EOS Accountability (SLA configuration and analytics).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { EOSSLATarget } from "../types";

const SLA_TARGETS_KEY = "eos-sla-targets";

/**
 * Fetch all SLA targets (fallback, pods, roles).
 */
export function useSLATargets() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [SLA_TARGETS_KEY],
    queryFn: async (): Promise<EOSSLATarget[]> => {
      const { data, error } = await supabase
        .from("eos_sla_targets" as never)
        .select("*")
        .order("pod_id", { ascending: true, nullsFirst: true })
        .order("role_name", { ascending: true, nullsFirst: true });

      if (error) throw error;
      return (data || []) as unknown as EOSSLATarget[];
    },
    enabled: !!user,
  });
}

export interface SaveSLATargetsInput {
  fallback: { approval_rate_pct: number; cycle_time_days: number };
  pods: { pod_id: string; approval_rate_pct: number; cycle_time_days: number }[];
  roles: { role_name: string; approval_rate_pct: number; cycle_time_days: number }[];
}

/**
 * Replace all SLA targets with the given payload (fallback + pod + role rows).
 */
export function useSaveSLATargets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveSLATargetsInput) => {
      const { data: existing } = await (supabase as any)
        .from("eos_sla_targets")
        .select("id, pod_id, role_name");

      const existingRows = (existing || []) as { id: string; pod_id: string | null; role_name: string | null }[];

      // Upsert fallback
      const fallbackRow = existingRows.find((r) => r.pod_id == null && r.role_name == null);
      if (fallbackRow) {
        await (supabase as any)
          .from("eos_sla_targets")
          .update({
            approval_rate_pct: input.fallback.approval_rate_pct,
            cycle_time_days: input.fallback.cycle_time_days,
            updated_at: new Date().toISOString(),
          })
          .eq("id", fallbackRow.id);
      } else {
        await (supabase as any).from("eos_sla_targets").insert({
          pod_id: null,
          role_name: null,
          approval_rate_pct: input.fallback.approval_rate_pct,
          cycle_time_days: input.fallback.cycle_time_days,
        });
      }

      // Pod targets: upsert each, delete removed
      const existingPodIds = new Set(
        existingRows.filter((r) => r.pod_id != null).map((r) => r.pod_id as string),
      );
      const inputPodIds = new Set(input.pods.map((p) => p.pod_id));

      for (const p of input.pods) {
        const row = existingRows.find((r) => r.pod_id === p.pod_id);
        const payload = {
          approval_rate_pct: p.approval_rate_pct,
          cycle_time_days: p.cycle_time_days,
          updated_at: new Date().toISOString(),
        };
        if (row) {
          await (supabase as any).from("eos_sla_targets").update(payload).eq("id", row.id);
        } else {
          await (supabase as any).from("eos_sla_targets").insert({
            pod_id: p.pod_id,
            role_name: null,
            ...payload,
          });
        }
      }
      for (const podId of existingPodIds) {
        if (!inputPodIds.has(podId)) {
          await (supabase as any).from("eos_sla_targets").delete().eq("pod_id", podId);
        }
      }

      // Role targets: upsert each, delete removed
      const existingRoleNames = new Set(
        existingRows.filter((r) => r.role_name != null).map((r) => r.role_name as string),
      );
      const inputRoleNames = new Set(input.roles.map((r) => r.role_name));

      for (const r of input.roles) {
        const row = existingRows.find((x) => x.role_name === r.role_name);
        const payload = {
          approval_rate_pct: r.approval_rate_pct,
          cycle_time_days: r.cycle_time_days,
          updated_at: new Date().toISOString(),
        };
        if (row) {
          await (supabase as any).from("eos_sla_targets").update(payload).eq("id", row.id);
        } else {
          await (supabase as any).from("eos_sla_targets").insert({
            pod_id: null,
            role_name: r.role_name,
            ...payload,
          });
        }
      }
      for (const roleName of existingRoleNames) {
        if (!inputRoleNames.has(roleName)) {
          await (supabase as any).from("eos_sla_targets").delete().eq("role_name", roleName);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SLA_TARGETS_KEY] });
      toast.success("SLA targets saved");
    },
    onError: (e: Error) => {
      toast.error("Failed to save SLA targets", { description: e.message });
    },
  });
}
