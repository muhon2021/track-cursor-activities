/**
 * VTO Hook
 *
 * Fetches and updates Vision/Traction Organizer sections.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import type { VTOSection } from "../types";

/**
 * Fetch all VTO sections ordered by sort_order.
 */
export function useVTO() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.eos.vto,
    queryFn: async (): Promise<VTOSection[]> => {
      const { data, error } = await supabase
        .from("eos_vto")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as VTOSection[];
    },
    enabled: !!user,
  });
}

/**
 * Update a VTO section's content.
 */
export function useUpdateVTO() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      section,
      content,
    }: {
      section: string;
      content: Record<string, unknown>;
    }) => {
      const { data, error } = await supabase
        .from("eos_vto")
        .update({ content: JSON.parse(JSON.stringify(content)), updated_by: user!.id, updated_at: new Date().toISOString() })
        .eq("section", section)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateKeys.eos(queryClient);
      toast.success("VTO section updated");
    },
    onError: (error: Error) => {
      toast.error("Failed to update VTO", { description: error.message });
    },
  });
}
