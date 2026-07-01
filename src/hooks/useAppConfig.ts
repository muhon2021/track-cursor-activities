import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AppConfig {
  // Branding
  branding: {
    companyName: string;
    tagline: string;
    supportEmail: string;
    logoUrl?: string;
    faviconUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    emailFromName?: string;
    replyToEmail?: string;
    loginMessage?: string;
    loginBackgroundUrl?: string;
  };
  // Features
  features: {
    enableAIChat: boolean;
    enableKnowledgeBase: boolean;
    enableMeetings: boolean;
    enableTasks: boolean;
    enableNotifications: boolean;
    enableSemanticSearch: boolean;
    enableClients: boolean;
    enableAIAgents: boolean;
    enablePersonalKnowledge: boolean;
    enableFeedback: boolean;
    enableGoogleDrive: boolean;
    enableZoomSync: boolean;
    useGenericMeetings: boolean;
    enableFourSpaces: boolean;
    enableAutomations: boolean;
    enableKbCohere: boolean;
    enableKbSlack: boolean;
    enableKbOcr: boolean;
    enableKbParserAdvanced: boolean;
    enableKbMemoryDecay: boolean;
    enableGraphify: boolean;
  };
  // Email
  email: {
    enableEmailNotifications: boolean;
    fromName: string;
    fromEmail: string;
  };
  // System
  system: {
    maintenanceMode: boolean;
    allowSignups: boolean;
    requireEmailVerification: boolean;
    sessionTimeout: number;
    onboardingCompleted?: boolean;
    templateDataSeeded?: boolean;
  };
}

interface ConfigRow {
  key: string;
  value: any;
  category: string;
  description: string | null;
  is_sensitive: boolean;
}

// Transform flat config rows to nested structure
function transformConfig(rows: ConfigRow[]): AppConfig {
  const config: any = {
    branding: {
      companyName: '',
      tagline: '',
      supportEmail: '',
      logoUrl: '',
      faviconUrl: '',
      primaryColor: '#6366f1',
      secondaryColor: '',
      emailFromName: '',
      replyToEmail: '',
      loginMessage: '',
      loginBackgroundUrl: '',
    },
    features: {},
    email: {},
    system: {},
  };

  rows.forEach((row) => {
    const [category, key] = row.key.split(".");
    if (config[category]) {
      config[category][key] = row.value;
    }
  });

  // Four Spaces disabled — always use legacy Control Tower layout
  if (config.features) {
    config.features.enableFourSpaces = false;
  }

  return config as AppConfig;
}

// Transform nested structure to flat config rows
function flattenConfig(config: AppConfig): Array<{ key: string; value: any; category: string }> {
  const rows: Array<{ key: string; value: any; category: string }> = [];

  Object.entries(config).forEach(([category, values]) => {
    Object.entries(values).forEach(([key, value]) => {
      // Skip undefined or null values to avoid NOT NULL constraint violations
      if (value !== undefined && value !== null) {
        rows.push({
          key: `${category}.${key}`,
          value,
          category,
        });
      }
    });
  });

  return rows;
}

// Fetch all app configuration
export function useAppConfig() {
  return useQuery({
    queryKey: ["app_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_config")
        .select("key, value, category, description, is_sensitive")
        .order("category", { ascending: true });

      if (error) throw error;

      return transformConfig((data || []) as ConfigRow[]);
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Update app configuration
export function useUpdateAppConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: AppConfig) => {
      const flatConfig = flattenConfig(config);

      // Update each config value
      const updates = flatConfig.map(({ key, value, category }) =>
        supabase
          .from("app_config")
          .upsert(
            {
              key,
              value,
              category,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "key" }
          )
      );

      const results = await Promise.all(updates);
      const errors = results.filter((r) => r.error);

      if (errors.length > 0) {
        throw errors[0].error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app_config"] });
      toast.success("Settings saved successfully!");
    },
    onError: (error: any) => {
      console.error("Error saving config:", error);
      toast.error(error.message || "Failed to save settings");
    },
  });
}

// Reset to default configuration
export function useResetAppConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const defaultConfig: AppConfig = {
        branding: {
          companyName: "Control Tower",
          tagline: "AI-Powered Collaboration Platform",
          supportEmail: "support@control-tower.app",
          logoUrl: "",
          faviconUrl: "",
          primaryColor: "#6366f1",
          secondaryColor: "",
          emailFromName: "Control Tower",
          replyToEmail: "",
          loginMessage: "Welcome to Control Tower",
          loginBackgroundUrl: "",
        },
        features: {
          enableAIChat: true,
          enableKnowledgeBase: true,
          enableMeetings: true,
          enableTasks: true,
          enableNotifications: true,
          enableSemanticSearch: true,
          enableClients: true,
          enableAIAgents: true,
          enablePersonalKnowledge: true,
          enableFeedback: true,
          enableGoogleDrive: false,
          enableZoomSync: false,
          useGenericMeetings: false,
          enableFourSpaces: false,
          enableAutomations: true,
          enableKbCohere: false,
          enableKbSlack: false,
          enableKbOcr: false,
          enableKbParserAdvanced: false,
          enableKbMemoryDecay: false,
          enableGraphify: false,
        },
        email: {
          enableEmailNotifications: true,
          fromName: "Control Tower",
          fromEmail: "noreply@control-tower.app",
        },
        system: {
          maintenanceMode: false,
          allowSignups: true,
          requireEmailVerification: false,
          sessionTimeout: 7,
        },
      };

      const flatConfig = flattenConfig(defaultConfig);

      const updates = flatConfig.map(({ key, value, category }) =>
        supabase
          .from("app_config")
          .upsert(
            {
              key,
              value,
              category,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "key" }
          )
      );

      const results = await Promise.all(updates);
      const errors = results.filter((r) => r.error);

      if (errors.length > 0) {
        throw errors[0].error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app_config"] });
      toast.success("Settings reset to defaults!");
    },
    onError: (error: any) => {
      console.error("Error resetting config:", error);
      toast.error("Failed to reset settings");
    },
  });
}
