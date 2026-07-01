import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { toast } from "sonner";

export interface AdminSessionRow {
  session_id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string | null;
  not_after: string | null;
}

export function useAdminSessions() {
  return useQuery({
    queryKey: queryKeys.adminSessions.list,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_user_sessions");
      if (error) throw error;
      return (data ?? []) as AdminSessionRow[];
    },
  });
}

export function useTerminateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.rpc("admin_terminate_session", { p_session_id: sessionId });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.adminSessions(queryClient);
      toast.success("Session terminated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to terminate session");
    },
  });
}

export function useTerminateAllUserSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("admin_terminate_user_sessions", { p_user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.adminSessions(queryClient);
      toast.success("All sessions for this user were terminated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to terminate sessions");
    },
  });
}
