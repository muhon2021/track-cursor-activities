/**
 * Custom hook for managing API keys
 * 
 * NOTE: Requires the api_keys table and related RPC functions to be created via migration.
 * Until then, operations will fail gracefully with informative error messages.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ApiKey {
  id: string;
  name: string;
  description?: string;
  key_prefix: string;
  key_hash: string;
  created_by: string;
  organization_id?: string;
  scopes: string[];
  allowed_endpoints: string[];
  allowed_ips: string[];
  rate_limit_per_minute: number;
  enabled: boolean;
  expires_at?: string;
  last_used_at?: string;
  last_used_ip?: string;
  total_requests: number;
  created_at: string;
  updated_at: string;
}

export function useApiKeys() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: apiKeys,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async (): Promise<ApiKey[]> => {
      try {
        const { data, error } = await supabase
          .from("api_keys" as never)
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.warn("api_keys table not available:", error.message);
          return [];
        }
        return (data || []) as ApiKey[];
      } catch {
        return [];
      }
    },
  });

  const createApiKey = useMutation({
    mutationFn: async (keyData: {
      name: string;
      description?: string;
      scopes: string[];
      allowed_endpoints?: string[];
      allowed_ips?: string[];
      rate_limit_per_minute?: number;
      expires_at?: string;
    }) => {
      // Generate a simple API key (in production, use a proper RPC function)
      const apiKey = `sk_live_${crypto.randomUUID().replace(/-/g, '')}`;

      // Simple hash using Web Crypto API
      const encoder = new TextEncoder();
      const data = encoder.encode(apiKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Extract prefix for display
      const keyPrefix = apiKey.substring(0, 20) + "...";

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Insert into database
      const { data: insertData, error } = await supabase
        .from("api_keys" as never)
        .insert([
          {
            name: keyData.name,
            description: keyData.description,
            key_prefix: keyPrefix,
            key_hash: keyHash,
            created_by: user.id,
            scopes: keyData.scopes,
            allowed_endpoints: keyData.allowed_endpoints || [],
            allowed_ips: keyData.allowed_ips || [],
            rate_limit_per_minute: keyData.rate_limit_per_minute || 60,
            expires_at: keyData.expires_at,
            enabled: true,
          },
        ] as never)
        .select()
        .single();

      if (error) throw error;

      // Return the created key with the plaintext key for the user to copy
      return { 
        ...(insertData as object), 
        plaintext_key: apiKey 
      }; // Return plaintext key only on creation
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to create API key: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const updateApiKey = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ApiKey> }) => {
      const { data, error } = await supabase
        .from("api_keys" as never)
        .update(updates as never)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast({
        title: "Success",
        description: "API key updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update API key: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const deleteApiKey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("api_keys" as never)
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast({
        title: "Success",
        description: "API key deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to delete API key: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const toggleEnabled = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("api_keys" as never)
        .update({ enabled } as never)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast({
        title: "Success",
        description: "API key status updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update status: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  return {
    apiKeys,
    isLoading,
    error,
    createApiKey: createApiKey.mutate,
    updateApiKey: updateApiKey.mutate,
    deleteApiKey: deleteApiKey.mutate,
    toggleEnabled: toggleEnabled.mutate,
    isCreating: createApiKey.isPending,
    isUpdating: updateApiKey.isPending,
    isDeleting: deleteApiKey.isPending,
  };
}
