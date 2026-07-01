import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isModuleBundled, type ModuleId, MODULE_REGISTRY } from "@/shared/config/modules";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

interface ModuleAccessResult {
  hasModule: (moduleId: ModuleId) => boolean;
  enabledModules: ModuleId[];
  isLoading: boolean;
}

export function useModuleAccess(): ModuleAccessResult {
  const { user } = useAuth();
  const { isFeatureEnabled, isLoading: flagsLoading } = useFeatureFlags();

  const { data: dbModules, isLoading: modulesLoading } = useQuery({
    queryKey: ["app_modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_modules")
        .select("slug, is_active")
        .order("sort_order");

      if (error) {
        console.debug("app_modules table not available, using feature flags:", error.message);
        return null;
      }

      return data as Array<{ slug: string; is_active: boolean }>;
    },
    staleTime: 1000 * 60 * 10,
    retry: false,
  });

  const { data: userModules, isLoading: userModulesLoading } = useQuery({
    queryKey: ["user_modules", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.rpc("get_user_modules");
      if (error) {
        console.debug("get_user_modules unavailable:", error.message);
        return null;
      }
      return ((data ?? []) as unknown as Array<{ slug: string }>).map((m) => ({
        slug: m.slug,
        is_active: true,
      }));
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const hasModule = (moduleId: ModuleId): boolean => {
    const mod = MODULE_REGISTRY[moduleId];
    if (!mod) return false;
    if (mod.isCore) return true;
    if (!isModuleBundled(moduleId)) return false;

    if (userModules !== null && userModules !== undefined && userModules.length > 0) {
      const entry = userModules.find((m) => m.slug === moduleId);
      return entry ? entry.is_active : false;
    }

    if (dbModules !== null && dbModules !== undefined) {
      const dbEntry = dbModules.find((m) => m.slug === moduleId);
      if (dbEntry) return dbEntry.is_active;
    }

    const primaryFlagMap: Partial<Record<ModuleId, string>> = {
      actions: "enableTasks",
      meetings: "enableMeetings",
      knowledge: "enableKnowledgeBase",
      "business-dev": "enableClients",
      graphify: "enableGraphify",
    };

    const primaryFlag = primaryFlagMap[moduleId];
    if (primaryFlag) {
      return isFeatureEnabled(primaryFlag as any);
    }

    return true;
  };

  const enabledModules = Object.keys(MODULE_REGISTRY).filter((id) =>
    hasModule(id as ModuleId)
  ) as ModuleId[];

  return {
    hasModule,
    enabledModules,
    isLoading: flagsLoading || modulesLoading || userModulesLoading,
  };
}
