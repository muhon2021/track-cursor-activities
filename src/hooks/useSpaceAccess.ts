import { useMemo } from "react";
import { useModuleAccess } from "@/shared/hooks/useModuleAccess";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useAgencyRole } from "@/hooks/useAgencyRole";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import {
  SPACE_IDS,
  SPACE_REGISTRY,
  type SpaceId,
  type SpaceDefinition,
} from "@/shared/config/spaces";
import type { SpaceNavItem, SpaceNavGroup } from "@/shared/data/spaceNavigation";
import type { AgencyRole } from "@/shared/data/navigationStructure";

import type { AppConfig } from "@/hooks/useAppConfig";

type FeatureKey = keyof AppConfig["features"];

export type SpaceAccessContext = "space" | "admin";

export function useSpaceAccess(options: { context?: SpaceAccessContext } = {}) {
  const context = options.context ?? "space";
  const { profile, profileLoading } = useAuth();
  const { hasModule, isLoading: modulesLoading } = useModuleAccess();
  const { isFeatureEnabled, isLoading: flagsLoading } = useFeatureFlags();
  const { agencyRole, isEosUser, isAdmin } = useAgencyRole();
  const { hasAnyPermission, isLoading: permsLoading } = usePermissions();
  const currentAgencyRole = agencyRole as AgencyRole | null;

  const canAccessSpace = (space: SpaceDefinition): boolean => {
    if (isAdmin || profile?.role === "admin" || profile?.role === "moderator") {
      return true;
    }

    if (space.eosOnly && !isEosUser) {
      return false;
    }

    if (space.agencyRoles && currentAgencyRole) {
      if (!space.agencyRoles.includes(currentAgencyRole)) {
        // Still allow if module/permission checks pass for knowledge/sales
      }
    }

    if (space.requiredPermissions?.length) {
      if (hasAnyPermission(space.requiredPermissions)) return true;
    }

    if (space.requiredModules?.length) {
      const hasAnyModule = space.requiredModules.some((m) => hasModule(m));
      if (hasAnyModule) {
        if (space.id === "knowledge") {
          return (
            hasModule("knowledge") ||
            isFeatureEnabled("enableAIAgents") ||
            isFeatureEnabled("enableKnowledgeBase")
          );
        }
        if (space.id === "sales") return hasModule("business-dev");
        if (space.id === "eos") return hasModule("eos") && isEosUser;
        return true;
      }
    }

    if (space.id === "operations") {
      return (
        hasAnyPermission(["settings.admin", "users.admin", "users.view"]) ||
        currentAgencyRole === "owner" ||
        currentAgencyRole === "pm"
      );
    }

    if (space.id === "knowledge") {
      return (
        hasModule("knowledge") ||
        isFeatureEnabled("enableAIAgents") ||
        isFeatureEnabled("enableKnowledgeBase")
      );
    }

    if (space.id === "sales") {
      return hasModule("business-dev");
    }

    if (space.id === "eos") {
      return hasModule("eos") && (isEosUser || isAdmin);
    }

    return false;
  };

  const visibleSpaces = useMemo(() => {
    return SPACE_IDS.filter((id) => canAccessSpace(SPACE_REGISTRY[id])).map(
      (id) => SPACE_REGISTRY[id]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- canAccessSpace is stable for current auth snapshot
  }, [
    hasModule,
    isAdmin,
    isEosUser,
    currentAgencyRole,
    hasAnyPermission,
    isFeatureEnabled,
    profile?.role,
  ]);

  const isNavItemVisible = (item: SpaceNavItem): boolean => {
    if (item.adminOnly) {
      if (context === "space") return false;
      if (!isAdmin) return false;
    }
    if (item.featureFlag && !isFeatureEnabled(item.featureFlag as FeatureKey)) return false;
    if (item.module && !hasModule(item.module)) return false;
    if (item.eosOnly && !isEosUser && !isAdmin) return false;
    if (item.agencyRoles && !isAdmin && currentAgencyRole) {
      if (!item.agencyRoles.includes(currentAgencyRole)) return false;
    }
    if (item.requiredPermission && !isAdmin) {
      if (!hasAnyPermission([item.requiredPermission, "settings.admin"])) return false;
    }
    if (item.requiredPermissions?.length && !isAdmin) {
      if (!hasAnyPermission([...item.requiredPermissions, "settings.admin"])) return false;
    }
    return true;
  };

  const isNavGroupVisible = (group: SpaceNavGroup): boolean => {
    if (group.adminOnly) {
      if (context === "space") return false;
      if (!isAdmin) return false;
    }
    if (group.eosOnly && !isEosUser && !isAdmin) return false;
    if (group.agencyRoles && !isAdmin && currentAgencyRole) {
      if (!group.agencyRoles.includes(currentAgencyRole)) return false;
    }
    if (group.featureFlag && !isFeatureEnabled(group.featureFlag as FeatureKey)) return false;
    if (group.module && !hasModule(group.module)) {
      const hasVisibleItem = group.items.some((item) => isNavItemVisible(item));
      if (!hasVisibleItem) return false;
    }
    return group.items.some((item) => isNavItemVisible(item));
  };

  return {
    visibleSpaces,
    canAccessSpace: (spaceId: SpaceId) => canAccessSpace(SPACE_REGISTRY[spaceId]),
    isNavItemVisible,
    isNavGroupVisible,
    isLoading: profileLoading || modulesLoading || flagsLoading || permsLoading,
  };
}
