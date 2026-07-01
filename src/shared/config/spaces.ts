/**
 * Four Spaces registry — primary workspace definitions for IA redesign.
 */
import type { ModuleId } from "@/shared/config/modules";
import type { AgencyRole } from "@/shared/data/navigationStructure";

export type SpaceId = "sales" | "knowledge" | "operations" | "eos";

export const SPACE_IDS: SpaceId[] = ["sales", "knowledge", "operations", "eos"];

export interface SpaceDefinition {
  id: SpaceId;
  label: string;
  prefix: string;
  dashboardPath: string;
  icon: string;
  requiredModules?: ModuleId[];
  requiredPermissions?: string[];
  agencyRoles?: AgencyRole[];
  eosOnly?: boolean;
}

export const SPACE_REGISTRY: Record<SpaceId, SpaceDefinition> = {
  sales: {
    id: "sales",
    label: "Sales",
    prefix: "/sales",
    dashboardPath: "/sales/dashboard",
    icon: "Briefcase",
    requiredModules: ["business-dev"],
  },
  knowledge: {
    id: "knowledge",
    label: "Knowledge",
    prefix: "/knowledge",
    dashboardPath: "/knowledge/dashboard",
    icon: "BookOpen",
    requiredModules: ["knowledge"],
  },
  operations: {
    id: "operations",
    label: "Operations",
    prefix: "/operations",
    dashboardPath: "/operations/dashboard",
    icon: "Settings2",
    requiredPermissions: ["settings.admin", "users.admin", "users.view"],
    agencyRoles: ["owner", "pm"],
  },
  eos: {
    id: "eos",
    label: "EOS",
    prefix: "/eos",
    dashboardPath: "/eos/dashboard",
    icon: "Target",
    requiredModules: ["eos"],
    eosOnly: true,
  },
};

export function getSpaceFromPath(pathname: string): SpaceId | null {
  for (const space of SPACE_IDS) {
    const def = SPACE_REGISTRY[space];
    if (pathname === def.prefix || pathname.startsWith(def.prefix + "/")) {
      return space;
    }
  }
  return null;
}

export function getSpaceDefinition(spaceId: SpaceId): SpaceDefinition {
  return SPACE_REGISTRY[spaceId];
}
