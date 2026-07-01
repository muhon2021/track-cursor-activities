import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface UserPreferences {
  notifications: {
    email: boolean;
    push: boolean;
    meetings: boolean;
    clients: boolean;
    tasks: boolean;
    aiAgents: boolean;
  };
  appearance: {
    theme: "light" | "dark" | "system";
    language: string;
  };
  privacy: {
    profileVisibility: "public" | "team" | "private";
    activityTracking: boolean;
  };
  ai: {
    enableSuggestions: boolean;
    autoSummarize: boolean;
  };
}

const DEFAULT_PREFERENCES: UserPreferences = {
  notifications: {
    email: true,
    push: true,
    meetings: true,
    clients: true,
    tasks: true,
    aiAgents: false,
  },
  appearance: {
    theme: "system",
    language: "en",
  },
  privacy: {
    profileVisibility: "team",
    activityTracking: true,
  },
  ai: {
    enableSuggestions: true,
    autoSummarize: false,
  },
};

// Fetch user preferences from metadata column
export function usePreferences() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["preferences", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .select("metadata")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      // Extract preferences from metadata.preferences
      const metadata = data?.metadata as Record<string, unknown> | null;
      const userPrefs = (metadata?.preferences as Record<string, unknown>) || {};
      
      return {
        ...DEFAULT_PREFERENCES,
        ...userPrefs,
        notifications: {
          ...DEFAULT_PREFERENCES.notifications,
          ...(userPrefs.notifications as Record<string, unknown> || {}),
        },
        appearance: {
          ...DEFAULT_PREFERENCES.appearance,
          ...(userPrefs.appearance as Record<string, unknown> || {}),
        },
        privacy: {
          ...DEFAULT_PREFERENCES.privacy,
          ...(userPrefs.privacy as Record<string, unknown> || {}),
        },
        ai: {
          ...DEFAULT_PREFERENCES.ai,
          ...(userPrefs.ai as Record<string, unknown> || {}),
        },
      } as UserPreferences;
    },
    enabled: !!user,
  });
}

// Update user preferences in metadata column
export function useUpdatePreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: Partial<UserPreferences>) => {
      if (!user) throw new Error("User not authenticated");

      // Get current metadata
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("metadata")
        .eq("id", user.id)
        .single();

      const currentMetadata = (currentProfile?.metadata as Record<string, unknown>) || {};
      const currentPrefs = (currentMetadata.preferences as Record<string, unknown>) || {};

      // Merge with current preferences
      const updatedPrefs = {
        ...currentPrefs,
        ...preferences,
        notifications: {
          ...(currentPrefs.notifications as Record<string, unknown> || {}),
          ...preferences.notifications,
        },
        appearance: {
          ...(currentPrefs.appearance as Record<string, unknown> || {}),
          ...preferences.appearance,
        },
        privacy: {
          ...(currentPrefs.privacy as Record<string, unknown> || {}),
          ...preferences.privacy,
        },
        ai: {
          ...(currentPrefs.ai as Record<string, unknown> || {}),
          ...preferences.ai,
        },
      };

      // Update metadata with new preferences
      const { data, error } = await supabase
        .from("profiles")
        .update({ 
          metadata: JSON.parse(JSON.stringify({ 
            ...currentMetadata, 
            preferences: updatedPrefs 
          }))
        })
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences", user?.id] });
      toast.success("Settings saved successfully!");
    },
    onError: (error: unknown) => {
      console.error("Error updating preferences:", error);
      toast.error("Failed to save settings");
    },
  });
}

// Reset preferences to defaults
export function useResetPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");

      // Get current metadata to preserve other fields
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("metadata")
        .eq("id", user.id)
        .single();

      const currentMetadata = (currentProfile?.metadata as Record<string, unknown>) || {};

      const { data, error } = await supabase
        .from("profiles")
        .update({ 
          metadata: JSON.parse(JSON.stringify({ 
            ...currentMetadata, 
            preferences: DEFAULT_PREFERENCES 
          }))
        })
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences", user?.id] });
      toast.info("Settings reset to defaults");
    },
    onError: (error: unknown) => {
      console.error("Error resetting preferences:", error);
      toast.error("Failed to reset settings");
    },
  });
}
