import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { MeetingFormData } from "@/lib/validation";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export interface Meeting {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  external_id: string | null;
  external_meeting_id: string | null;
  external_uuid: string | null;
  host_url: string | null;
  join_url: string | null;
  provider: string | null;
  zoom_meeting_id: string | null;
  zoom_join_url: string | null;
  zoom_start_url: string | null;
  zoom_uuid: string | null;
  zoom_id: string | null;
  status: string | null;
  client_id: string | null;
  organizer_id: string;
  location: string | null;
  meeting_type: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export function useMeetings(filters?: Record<string, any>) {
  return useQuery({
    queryKey: queryKeys.meetings.list(filters),
    queryFn: async () => {
      let query = supabase
        .from("meetings")
        .select("id, title, description, scheduled_at, duration_minutes, status, client_id, organizer_id, provider, location, meeting_type, slug, join_url, host_url, is_recurring, created_at, updated_at, clients(name)")
        .order("scheduled_at", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      if (filters?.clientId) {
        query = query.eq("client_id", filters.clientId);
      }

      if (filters?.meetingType) {
        query = query.eq("meeting_type", filters.meetingType);
      }

      // Pagination: default page=0, limit=50
      const page = filters?.page ?? 0;
      const limit = filters?.limit ?? 50;
      const from = page * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as (Meeting & { clients?: { name: string } | null })[];
    },
  });
}

export function useMeeting(id: string) {
  return useQuery({
    queryKey: queryKeys.meetings.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*, clients(name, email)")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as unknown as Meeting & { clients?: { name: string; email: string | null } | null };
    },
    enabled: !!id,
  });
}

export function useCreateMeeting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: MeetingFormData) => {
      const insertData = {
        title: data.title,
        description: data.description || null,
        scheduled_at: data.meeting_date || null,
        duration_minutes: data.duration_minutes || null,
        client_id: data.client_id || null,
        provider: data.provider || null,
        external_meeting_id: data.external_meeting_id || null,
        join_url: data.join_url || null,
        host_url: data.host_url || null,
        zoom_meeting_id: data.zoom_meeting_id || null,
        zoom_join_url: data.zoom_join_url || null,
        status: "scheduled",
        organizer_id: user?.id!,
      };

      const { data: meeting, error } = await supabase
        .from("meetings")
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;
      return meeting as Meeting;
    },
    onSuccess: () => {
      invalidateKeys.meetings(queryClient);
      toast({
        title: "Success",
        description: "Meeting created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create meeting",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateMeeting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MeetingFormData> }) => {
      const updateData: any = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description || null;
      if (data.meeting_date !== undefined) updateData.scheduled_at = data.meeting_date || null;
      if (data.duration_minutes !== undefined) updateData.duration_minutes = data.duration_minutes || null;
      if (data.client_id !== undefined) updateData.client_id = data.client_id || null;
      if (data.provider !== undefined) updateData.provider = data.provider || null;
      if (data.external_meeting_id !== undefined) updateData.external_meeting_id = data.external_meeting_id || null;
      if (data.join_url !== undefined) updateData.join_url = data.join_url || null;
      if (data.host_url !== undefined) updateData.host_url = data.host_url || null;
      if (data.zoom_meeting_id !== undefined) updateData.zoom_meeting_id = data.zoom_meeting_id || null;
      if (data.zoom_join_url !== undefined) updateData.zoom_join_url = data.zoom_join_url || null;

      const { data: meeting, error } = await supabase
        .from("meetings")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return meeting as Meeting;
    },
    onSuccess: () => {
      invalidateKeys.meetings(queryClient);
      toast({
        title: "Success",
        description: "Meeting updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update meeting",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteMeeting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("meetings")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.meetings(queryClient);
      toast({
        title: "Success",
        description: "Meeting deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete meeting",
        variant: "destructive",
      });
    },
  });
}
