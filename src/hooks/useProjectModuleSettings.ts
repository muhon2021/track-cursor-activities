/**
 * Project Module Settings
 *
 * Admin-configurable project detail tabs stored in `system_settings`
 * (category = 'project_modules'). Each module key maps to a toggle
 * controlling whether the corresponding tab appears in ProjectDetailPage.
 *
 * Provides:
 * - useProjectModuleSettings() — admin view: all modules with enabled state
 * - useEnabledProjectModules() — detail view: map of enabled module keys
 * - useToggleProjectModule() — mutation to persist toggle changes
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ProjectModule {
  key: string;
  label: string;
  description: string;
  icon: string;
}

export interface ProjectModuleSetting extends ProjectModule {
  enabled: boolean;
}

// Static module definitions
export const PROJECT_MODULES: ProjectModule[] = [
  { key: "tasks", label: "Tasks", description: "Task management and external PM sync", icon: "CheckSquare" },
  { key: "integrations", label: "Integrations", description: "External service connections", icon: "Network" },
  { key: "client_portal", label: "Client Portal", description: "Client-facing project portal", icon: "Users" },
  { key: "checklist", label: "Checklist", description: "Project checklists and tracking", icon: "ClipboardList" },
  { key: "risks", label: "Risks", description: "Risk identification and management", icon: "AlertTriangle" },
  { key: "files", label: "Docs & Meetings", description: "Files and meeting transcripts", icon: "FileText" },
  { key: "finance", label: "Billing", description: "Invoices, payments, and billing info", icon: "DollarSign" },
];

const SETTINGS_KEY = ["project-module-settings"];
const ENABLED_KEY = ["enabled-project-modules"];
const CATEGORY = "project_modules";

async function fetchModuleToggles(): Promise<Record<string, boolean>> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("key, value")
    .eq("category", CATEGORY);
  if (error) throw error;

  const toggles: Record<string, boolean> = {};
  (data || []).forEach((row) => {
    toggles[row.key] = row.value === true || row.value === "true";
  });
  return toggles;
}

// Admin view — all modules with their enabled state from system_settings
export function useProjectModuleSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async (): Promise<ProjectModuleSetting[]> => {
      const toggles = await fetchModuleToggles();
      return PROJECT_MODULES.map((mod) => ({
        ...mod,
        // Default to enabled if no row exists yet
        enabled: mod.key in toggles ? toggles[mod.key] : true,
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
}

// Detail view — enabled/disabled map for tabs
export function useEnabledProjectModules() {
  return useQuery({
    queryKey: ENABLED_KEY,
    queryFn: async (): Promise<Record<string, boolean>> => {
      const toggles = await fetchModuleToggles();
      const result: Record<string, boolean> = { overview: true };
      PROJECT_MODULES.forEach((mod) => {
        result[mod.key] = mod.key in toggles ? toggles[mod.key] : true;
      });
      // Alias finance -> billing so the ProjectDetailPage \"billing\" tab
      // respects the same toggle as the Finance/Billing module key.
      if ("finance" in result && !("billing" in result)) {
        result.billing = result.finance;
      }
      return result;
    },
    staleTime: 1000 * 60 * 5,
  });
}

// Mutation to toggle a module on/off — upserts into system_settings
export function useToggleProjectModule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("system_settings")
        .upsert(
          {
            category: CATEGORY,
            key,
            value: enabled as unknown as null, // JSON column accepts boolean
            description: `Toggle for project detail tab: ${key}`,
          },
          { onConflict: "category,key" }
        );
      if (error) throw error;
    },
    onSuccess: (_data, { key, enabled }) => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      queryClient.invalidateQueries({ queryKey: ENABLED_KEY });
      toast({
        title: `${key} tab ${enabled ? "enabled" : "disabled"}`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });
}
