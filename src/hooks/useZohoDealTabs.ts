/**
 * Zoho CRM data cached per deal (attachments, timeline, events, enrichment).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys, cacheConfig } from "@/lib/cache";
import { API } from "@/shared/config/api";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AttachmentRow = Database["public"]["Tables"]["zoho_deal_attachments"]["Row"];
type EngagementRow = Database["public"]["Tables"]["zoho_deal_engagements"]["Row"];
type EventRow = Database["public"]["Tables"]["zoho_deal_events"]["Row"];
type ContactEnrichmentRow = Database["public"]["Tables"]["zoho_contact_enrichment"]["Row"];
type AccountEnrichmentRow = Database["public"]["Tables"]["zoho_account_enrichment"]["Row"];

export function isZohoCrmDealExternalId(externalId: string | null | undefined): boolean {
  return !!externalId?.startsWith("zoho-deal-");
}

export function useZohoDealAttachments(dealId: string, dealExternalId: string | null | undefined) {
  const enabled = !!dealId && isZohoCrmDealExternalId(dealExternalId);
  return useQuery({
    queryKey: queryKeys.zoho.attachments(dealId),
    enabled,
    staleTime: cacheConfig.staleTime.medium,
    queryFn: async (): Promise<AttachmentRow[]> => {
      const { data, error } = await supabase
        .from("zoho_deal_attachments")
        .select("*")
        .eq("deal_id", dealId)
        .order("synced_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useZohoDealEngagements(dealId: string, dealExternalId: string | null | undefined) {
  const enabled = !!dealId && isZohoCrmDealExternalId(dealExternalId);
  return useQuery({
    queryKey: queryKeys.zoho.engagements(dealId),
    enabled,
    staleTime: cacheConfig.staleTime.medium,
    queryFn: async (): Promise<EngagementRow[]> => {
      const { data, error } = await supabase
        .from("zoho_deal_engagements")
        .select("*")
        .eq("deal_id", dealId)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useZohoDealEvents(dealId: string, dealExternalId: string | null | undefined) {
  const enabled = !!dealId && isZohoCrmDealExternalId(dealExternalId);
  return useQuery({
    queryKey: queryKeys.zoho.events(dealId),
    enabled,
    staleTime: cacheConfig.staleTime.medium,
    queryFn: async (): Promise<EventRow[]> => {
      const { data, error } = await supabase
        .from("zoho_deal_events")
        .select("*")
        .eq("deal_id", dealId)
        .order("start_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useZohoContactEnrichment(dealId: string, dealExternalId: string | null | undefined) {
  const enabled = !!dealId && isZohoCrmDealExternalId(dealExternalId);
  return useQuery({
    queryKey: queryKeys.zoho.contactEnrichment(dealId),
    enabled,
    staleTime: cacheConfig.staleTime.medium,
    queryFn: async (): Promise<ContactEnrichmentRow | null> => {
      const { data, error } = await supabase.from("zoho_contact_enrichment").select("*").eq("deal_id", dealId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useZohoAccountEnrichment(dealId: string, dealExternalId: string | null | undefined) {
  const enabled = !!dealId && isZohoCrmDealExternalId(dealExternalId);
  return useQuery({
    queryKey: queryKeys.zoho.accountEnrichment(dealId),
    enabled,
    staleTime: cacheConfig.staleTime.medium,
    queryFn: async (): Promise<AccountEnrichmentRow | null> => {
      const { data, error } = await supabase.from("zoho_account_enrichment").select("*").eq("deal_id", dealId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function parseInvokeError(data: unknown): void {
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error(String((data as { error: string }).error));
  }
}

export function useRefreshZohoDealAttachments(dealId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(API.CRM.ZOHO_DEAL_ATTACHMENTS_SYNC, {
        body: { deal_id: dealId },
      });
      if (error) throw error;
      parseInvokeError(data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.zoho.attachments(dealId) });
      toast.success("Zoho attachments updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRefreshZohoDealEngagements(dealId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(API.CRM.ZOHO_DEAL_ENGAGEMENTS_SYNC, {
        body: { deal_id: dealId },
      });
      if (error) throw error;
      parseInvokeError(data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.zoho.engagements(dealId) });
      toast.success("Zoho activity updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRefreshZohoDealEvents(dealId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(API.CRM.ZOHO_DEAL_EVENTS_SYNC, {
        body: { deal_id: dealId },
      });
      if (error) throw error;
      parseInvokeError(data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.zoho.events(dealId) });
      toast.success("Zoho events updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRefreshZohoContactEnrichment(dealId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(API.CRM.ZOHO_DEAL_CONTACT_ENRICHMENT_SYNC, {
        body: { deal_id: dealId },
      });
      if (error) throw error;
      parseInvokeError(data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.zoho.contactEnrichment(dealId) });
      toast.success("Contact profile updated from Zoho");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRefreshZohoAccountEnrichment(dealId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(API.CRM.ZOHO_DEAL_ACCOUNT_ENRICHMENT_SYNC, {
        body: { deal_id: dealId },
      });
      if (error) throw error;
      parseInvokeError(data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.zoho.accountEnrichment(dealId) });
      toast.success("Account profile updated from Zoho");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
