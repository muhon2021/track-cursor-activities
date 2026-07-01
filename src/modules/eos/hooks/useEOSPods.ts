/**
 * EOS Pods Hooks
 *
 * CRUD operations for team pods.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { EOSPod } from "../types";

const PODS_KEY = "eos-pods";

/**
 * Fetch all active pods.
 */
export function useEOSPods() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [PODS_KEY],
    queryFn: async (): Promise<EOSPod[]> => {
      const { data, error } = await supabase
        .from("eos_pods")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}

/**
 * Create a new pod.
 */
export function useCreatePod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string; color?: string; lead_id?: string }) => {
      const { data: pod, error } = await supabase
        .from("eos_pods")
        .insert({
          name: data.name,
          description: data.description || null,
          color: data.color || "#6366f1",
          lead_id: data.lead_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return pod;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PODS_KEY] });
      toast.success("Pod created");
    },
    onError: (error: Error) => {
      toast.error("Failed to create pod", { description: error.message });
    },
  });
}
