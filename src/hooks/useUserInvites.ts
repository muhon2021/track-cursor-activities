import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { logActivity } from "@/lib/activity-logger";

export interface UserInvite {
  id: string;
  email: string;
  role: string;
  role_id: string | null;
  department_id: string | null;
  pod_id: string | null;
  welcome_message: string | null;
  status: "pending" | "accepted" | "expired" | "cancelled";
  invited_by: string | null;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
  roles?: { name: string; slug: string } | null;
}

export interface CreateInviteParams {
  email: string;
  role_id?: string;
  role?: string;
  department_id?: string;
  pod_id?: string;
  welcome_message?: string;
}

export function useUserInvites(status?: UserInvite["status"]) {
  return useQuery({
    queryKey: ["user_invites", status ?? "all"],
    queryFn: async () => {
      let query = (supabase as any)
        .from("user_invites")
        .select("*, roles(name, slug)")
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as UserInvite[];
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateUserInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateInviteParams) => {
      const result = await invokeEdgeFunction<{ invite: UserInvite; email_sent: boolean }>(
        "send-user-invite",
        params
      );
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["user_invites"] });
      if (data.email_sent) {
        toast.success(`Invitation sent to ${data.invite.email}`);
      } else {
        toast.warning(`Invite created for ${data.invite.email} but email could not be sent`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send invitation");
    },
  });
}

export function useCancelUserInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await (supabase as any)
        .from("user_invites")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", inviteId);

      if (error) throw error;
      return inviteId;
    },
    onSuccess: (inviteId) => {
      queryClient.invalidateQueries({ queryKey: ["user_invites"] });
      void logActivity({
        action: "invitation.revoked",
        resourceType: "user_invite",
        resourceId: inviteId,
        details: { reason: "cancelled" },
      });
      toast.success("Invitation cancelled");
    },
    onError: () => toast.error("Failed to cancel invitation"),
  });
}

/** @deprecated Use useCancelUserInvite */
export const useDeleteUserInvite = useCancelUserInvite;

export function useResendUserInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      return invokeEdgeFunction("send-user-invite", {
        invite_id: inviteId,
        resend: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_invites"] });
      toast.success("Invitation resent");
    },
    onError: () => toast.error("Failed to resend invitation"),
  });
}
