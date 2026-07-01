/**
 * Module Registry
 *
 * Defines the available modules, their metadata, and provides runtime checks.
 *
 * Resolution order:
 * 1. Build-time: VITE_MODULE_* env vars determine if module code is included
 * 2. Runtime: `app_modules` DB table determines if module is active (admin toggle)
 * 3. Per-user: `user_module_permissions` table determines per-user access
 *
 * This file handles layer 1 (build-time). Layers 2 & 3 are handled by
 * the useModuleAccess() hook.
 *
 * Feature-flag policy: Some modules (meetings, knowledge, actions, business-dev)
 * also use requiresFeatureFlag for runtime toggling via app_config. Projects and
 * productivity are module-only (no feature flag); enable/disable via module registry.
 */

import { env } from "./env";

export type ModuleId =
  | "platform"
  | "eos"
  | "meetings"
  | "projects"
  | "actions"
  | "business-dev"
  | "lead-followup"
  | "knowledge"
  | "graphify"
  | "productivity"
  | "automation"
  | "admin";

export interface ModuleDefinition {
  id: ModuleId;
  name: string;
  description: string;
  icon: string; // lucide icon name
  category: "core" | "business" | "intelligence" | "operations";
  isCore: boolean; // Core modules cannot be disabled
  dependencies: ModuleId[];
  defaultEnabled: boolean;
  featureFlags: string[]; // Legacy app_config feature flags this module covers
}

/**
 * Master module registry.
 * This is the single source of truth for all module definitions.
 */
export const MODULE_REGISTRY: Record<ModuleId, ModuleDefinition> = {
  platform: {
    id: "platform",
    name: "Platform Core",
    description: "Authentication, layouts, navigation, UI components, and configuration",
    icon: "Layout",
    category: "core",
    isCore: true,
    dependencies: [],
    defaultEnabled: true,
    featureFlags: [],
  },
  actions: {
    id: "actions",
    name: "Actions",
    description: "Standalone task management with streams, comments, and subtasks",
    icon: "CheckSquare",
    category: "operations",
    isCore: false,
    dependencies: ["platform"],
    defaultEnabled: true,
    featureFlags: ["enableTasks"],
  },
  eos: {
    id: "eos",
    name: "EOS",
    description: "Entrepreneurial Operating System - V/TO, OKRs, issues, scorecards, accountability",
    icon: "Target",
    category: "business",
    isCore: false,
    dependencies: ["platform"],
    defaultEnabled: true,
    featureFlags: [],
  },
  meetings: {
    id: "meetings",
    name: "Meetings",
    description: "Meeting lifecycle management with AI summaries and Zoom integration",
    icon: "Calendar",
    category: "operations",
    isCore: false,
    dependencies: ["platform"],
    defaultEnabled: true,
    featureFlags: ["enableMeetings"],
  },
  knowledge: {
    id: "knowledge",
    name: "Knowledge Base",
    description: "Knowledge management with vector embeddings and semantic search",
    icon: "BookOpen",
    category: "intelligence",
    isCore: false,
    dependencies: ["platform"],
    defaultEnabled: true,
    featureFlags: ["enableKnowledgeBase", "enablePersonalKnowledge", "enableSemanticSearch"],
  },
  graphify: {
    id: "graphify",
    name: "Graphify",
    description: "Knowledge graph intelligence with relationship-based retrieval and hybrid RAG context",
    icon: "Network",
    category: "intelligence",
    isCore: false,
    dependencies: ["platform", "knowledge"],
    defaultEnabled: true,
    featureFlags: ["enableGraphify"],
  },
  projects: {
    id: "projects",
    name: "Projects",
    description: "Project lifecycle management with billing, milestones, and resource projection",
    icon: "FolderKanban",
    category: "business",
    isCore: false,
    dependencies: ["platform"],
    defaultEnabled: true,
    featureFlags: [],
  },
  "business-dev": {
    id: "business-dev",
    name: "Business Development",
    description: "Deal pipeline, client management, contacts, and CRM integration",
    icon: "TrendingUp",
    category: "business",
    isCore: false,
    dependencies: ["platform"],
    defaultEnabled: true,
    featureFlags: ["enableClients"],
  },
  "lead-followup": {
    id: "lead-followup",
    name: "Lead Follow-Up",
    description: "Contact management and engagement tracking with AI-powered sentiment analysis and email automation",
    icon: "Target",
    category: "business",
    isCore: false,
    dependencies: ["platform", "business-dev"],
    defaultEnabled: true,
    featureFlags: [],
  },
  productivity: {
    id: "productivity",
    name: "Productivity",
    description: "Team and individual productivity metrics, department analysis, AI insights",
    icon: "BarChart3",
    category: "operations",
    isCore: false,
    dependencies: ["platform"],
    defaultEnabled: true,
    featureFlags: [],
  },
  automation: {
    id: "automation",
    name: "Automation",
    description: "No-code workflow automation with triggers, actions, and approvals",
    icon: "Workflow",
    category: "operations",
    isCore: false,
    dependencies: ["platform"],
    defaultEnabled: true,
    featureFlags: ["enableAutomations"],
  },
  admin: {
    id: "admin",
    name: "Admin",
    description: "Administrative control panel for platform configuration",
    icon: "Shield",
    category: "core",
    isCore: true,
    dependencies: ["platform"],
    defaultEnabled: true,
    featureFlags: [],
  },
};

/**
 * Check if a module is enabled at build time (via env vars).
 * Core modules (platform, admin) are always enabled.
 */
export function isModuleBundled(moduleId: ModuleId): boolean {
  const mod = MODULE_REGISTRY[moduleId];
  if (!mod) return false;
  if (mod.isCore) return true;

  const envMap: Record<string, boolean> = {
    eos: env.modules.eos,
    meetings: env.modules.meetings,
    projects: env.modules.projects,
    actions: env.modules.actions,
    "business-dev": env.modules.businessDev,
    knowledge: env.modules.knowledge,
    graphify: env.modules.graphify,
    productivity: env.modules.productivity,
    automation: env.modules.automation,
  };

  return envMap[moduleId] ?? mod.defaultEnabled;
}

/**
 * Get all bundled (build-time enabled) modules.
 */
export function getBundledModules(): ModuleDefinition[] {
  return Object.values(MODULE_REGISTRY).filter((mod) => isModuleBundled(mod.id));
}

/**
 * Get all module definitions.
 */
export function getAllModules(): ModuleDefinition[] {
  return Object.values(MODULE_REGISTRY);
}

/**
 * Get a module definition by ID.
 */
export function getModule(moduleId: ModuleId): ModuleDefinition | undefined {
  return MODULE_REGISTRY[moduleId];
}
