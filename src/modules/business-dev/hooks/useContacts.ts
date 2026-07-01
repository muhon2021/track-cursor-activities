/**
 * Contacts Hook - CRUD operations for contacts and lead follow-ups
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Contact, ContactFormData, LeadFollowUp } from "../types";

const CONTACTS_KEY = "contacts";

export function useContacts(search?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [CONTACTS_KEY, search],
    queryFn: async (): Promise<Contact[]> => {
      const contactColumns =
        "id,first_name,last_name,email,phone,company,title,linkedin_url,client_id,source,tags,notes,last_contacted_at,created_by,created_at,updated_at,data_source,external_url,last_synced_at";
      let query = supabase
        .from("contacts")
        .select(`${contactColumns},followup:lead_followup_contacts(id,contact_id,status,priority,next_follow_up,follow_up_notes,assigned_to,converted_deal_id,created_at,updated_at)`)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true });

      if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((c: any) => {
        const followupList = Array.isArray(c.followup) ? c.followup : [];
        const ownFollowup = followupList.find((f: { contact_id?: string }) => f.contact_id === c.id) ?? followupList[0] ?? null;
        const { followup: _f, ...contactRow } = c;
        return { ...contactRow, followup: ownFollowup } as Contact;
      });
    },
    enabled: !!user,
  });
}

export function useContact(id: string) {
  return useQuery({
    queryKey: [CONTACTS_KEY, id],
    queryFn: async (): Promise<Contact> => {
      const contactColumns =
        "id,first_name,last_name,email,phone,company,title,linkedin_url,client_id,source,tags,notes,last_contacted_at,created_by,created_at,updated_at,data_source,external_url,last_synced_at";
      const { data, error } = await supabase
        .from("contacts")
        .select(`${contactColumns},followup:lead_followup_contacts(id,contact_id,status,priority,next_follow_up,follow_up_notes,assigned_to,converted_deal_id,created_at,updated_at)`)
        .eq("id", id)
        .single();
      if (error) throw error;
      const followupList = Array.isArray(data.followup) ? data.followup : [];
      const ownFollowup = followupList.find((f: { contact_id?: string }) => f.contact_id === data.id) ?? followupList[0] ?? null;
      const { followup: _f, ...contactRow } = data;
      return { ...contactRow, followup: ownFollowup } as Contact;
    },
    enabled: !!id,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: ContactFormData) => {
      const { data: contact, error } = await supabase.from("contacts").insert({
        first_name: data.first_name,
        last_name: data.last_name || null,
        email: data.email || null,
        phone: data.phone || null,
        company: data.company || null,
        title: data.title || null,
        client_id: data.client_id || null,
        created_by: user?.id || null,
      }).select().single();
      if (error) throw error;
      return contact;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] }); toast.success("Contact created"); },
    onError: (error: Error) => toast.error("Failed to create contact", { description: error.message }),
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ContactFormData> }) => {
      const { error } = await supabase.from("contacts").update({
        ...data,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] }); toast.success("Contact updated"); },
    onError: (error: Error) => toast.error("Failed to update contact", { description: error.message }),
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] }); toast.success("Contact deleted"); },
    onError: (error: Error) => toast.error("Failed to delete contact", { description: error.message }),
  });
}

export function useLeadFollowUps() {
  return useQuery({
    queryKey: [CONTACTS_KEY, "followups"],
    queryFn: async (): Promise<(LeadFollowUp & { contact: Contact })[]> => {
      const { data, error } = await supabase
        .from("lead_followup_contacts")
        .select("*, contact:contact_id(*, followup:lead_followup_contacts(*))")
        .order("next_follow_up", { ascending: true });
      if (error) throw error;
      return (data || []).map((f: any) => ({
        ...f,
        contact: f.contact ? {
          ...f.contact,
          followup: Array.isArray(f.contact.followup) ? f.contact.followup[0] || null : f.contact.followup,
        } : null,
      })) as (LeadFollowUp & { contact: Contact })[];
    },
  });
}

export function useCreateLeadFollowUp() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ contactId, priority, notes }: { contactId: string; priority?: string; notes?: string }) => {
      const { error } = await supabase.from("lead_followup_contacts").insert({
        contact_id: contactId,
        status: "new",
        priority: priority || "medium",
        follow_up_notes: notes || null,
        assigned_to: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] }); toast.success("Lead follow-up created"); },
    onError: (error: Error) => toast.error("Failed to create follow-up", { description: error.message }),
  });
}

export function useUpdateLeadFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<LeadFollowUp> }) => {
      const { error } = await supabase.from("lead_followup_contacts").update({
        ...data,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] }); toast.success("Follow-up updated"); },
    onError: (error: Error) => toast.error("Failed to update follow-up", { description: error.message }),
  });
}
