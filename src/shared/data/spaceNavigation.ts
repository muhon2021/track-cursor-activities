/**
 * Space-scoped navigation — single source of truth for Four Spaces IA.
 */
import type { ModuleId } from "@/shared/config/modules";
import type { SpaceId } from "@/shared/config/spaces";
import type { AgencyRole } from "@/shared/data/navigationStructure";

export interface SpaceNavItem {
  title: string;
  href: string;
  icon: string;
  module?: ModuleId;
  featureFlag?: string;
  adminOnly?: boolean;
  badge?: string;
  children?: SpaceNavItem[];
  headerOnly?: boolean;
  agencyRoles?: AgencyRole[];
  eosOnly?: boolean;
  requiredPermission?: string;
  requiredPermissions?: string[];
}

export interface SpaceNavGroup {
  id: string;
  title: string;
  icon: string;
  isAI?: boolean;
  module?: ModuleId;
  featureFlag?: string;
  items: SpaceNavItem[];
  agencyRoles?: AgencyRole[];
  eosOnly?: boolean;
  adminOnly?: boolean;
}

export const spaceNavigation: Record<SpaceId, SpaceNavGroup[]> = {
  sales: [
    {
      id: "sales-crm",
      title: "CRM",
      icon: "Briefcase",
      module: "business-dev",
      items: [
        {
          title: "Dashboard",
          href: "/sales/dashboard",
          icon: "LayoutDashboard",
        },
        {
          title: "Accounts",
          href: "/sales/accounts",
          icon: "Building2",
          module: "business-dev",
          featureFlag: "enableClients",
        },
        {
          title: "Contacts",
          href: "/sales/contacts",
          icon: "Contact",
          module: "business-dev",
          featureFlag: "enableClients",
        },
        {
          title: "Deals",
          href: "/sales/deals",
          icon: "Handshake",
          module: "business-dev",
          featureFlag: "enableClients",
          headerOnly: true,
          children: [
            {
              title: "Deals Dashboard",
              href: "/sales/deals?tab=overview",
              icon: "LayoutDashboard",
              module: "business-dev",
              featureFlag: "enableClients",
            },
            {
              title: "All Deals",
              href: "/sales/deals",
              icon: "LayoutDashboard",
              module: "business-dev",
              featureFlag: "enableClients",
            },
          ],
        },
        {
          title: "Opportunities",
          href: "/sales/lead-followup",
          icon: "Target",
          module: "lead-followup",
        },
      ],
    },
    {
      id: "sales-intelligence",
      title: "Intelligence",
      icon: "Sparkles",
      isAI: true,
      items: [
        {
          title: "Deal Coaching",
          href: "/sales/deal-coaching",
          icon: "Target",
          adminOnly: true,
          requiredPermissions: ["ai.admin", "settings.admin"],
        },
        {
          title: "Email Drafting",
          href: "/sales/email-drafting",
          icon: "MessageSquare",
          adminOnly: true,
          requiredPermissions: ["ai.admin", "settings.admin"],
        },
        {
          title: "Meeting Analytics",
          href: "/sales/meeting-analytics",
          icon: "Calendar",
          adminOnly: true,
          requiredPermissions: ["meetings.admin", "settings.admin"],
        },
      ],
    },
    {
      id: "sales-reports",
      title: "Reports",
      icon: "BarChart3",
      items: [
        {
          title: "Project Reports",
          href: "/sales/reports/projects",
          icon: "FolderKanban",
          adminOnly: true,
          requiredPermissions: ["projects.admin", "settings.admin"],
        },
        {
          title: "Resource Utilization",
          href: "/sales/reports/resource-utilization",
          icon: "BarChart3",
          adminOnly: true,
          requiredPermissions: ["projects.admin", "settings.admin"],
        },
      ],
    },
  ],

  knowledge: [
    {
      id: "knowledge-core",
      title: "Knowledge",
      icon: "BookOpen",
      module: "knowledge",
      items: [
        {
          title: "Dashboard",
          href: "/knowledge/dashboard",
          icon: "LayoutDashboard",
          requiredPermissions: ["knowledge.admin", "settings.admin"],
        },
        {
          title: "Knowledge Base",
          href: "/knowledge/base",
          icon: "BookOpen",
          module: "knowledge",
          featureFlag: "enableKnowledgeBase",
        },
        {
          title: "Search",
          href: "/knowledge/search",
          icon: "Sparkles",
          module: "knowledge",
          featureFlag: "enableKnowledgeBase",
        },
        {
          title: "Personal Library",
          href: "/knowledge/personal",
          icon: "BookMarked",
          module: "knowledge",
          featureFlag: "enablePersonalKnowledge",
        },
        {
          title: "Categories",
          href: "/knowledge/categories",
          icon: "FolderOpen",
          adminOnly: true,
          requiredPermissions: ["knowledge.admin", "settings.admin"],
        },
        {
          title: "Files",
          href: "/knowledge/files",
          icon: "FileText",
          adminOnly: true,
          requiredPermissions: ["knowledge.admin", "settings.admin"],
        },
        {
          title: "Permissions",
          href: "/knowledge/permissions",
          icon: "Shield",
          adminOnly: true,
          requiredPermissions: ["knowledge.admin", "settings.admin"],
        },
        {
          title: "Playground",
          href: "/knowledge/playground",
          icon: "FlaskConical",
          adminOnly: true,
          requiredPermissions: ["knowledge.admin", "settings.admin"],
        },
      ],
    },
    {
      id: "knowledge-ai",
      title: "AI & Memory",
      icon: "Brain",
      isAI: true,
      items: [
        {
          title: "Browse Agents",
          href: "/knowledge/agents",
          icon: "Bot",
          featureFlag: "enableAIAgents",
        },
        {
          title: "My AI Chat",
          href: "/knowledge/chat",
          icon: "MessageSquare",
          featureFlag: "enableAIAgents",
        },
        {
          title: "AI Hub",
          href: "/knowledge/ai-hub",
          icon: "Brain",
          headerOnly: true,
          adminOnly: true,
          requiredPermissions: ["ai.admin", "settings.admin"],
          children: [
            {
              title: "Memory",
              href: "/knowledge/ai-hub",
              icon: "Database",
              adminOnly: true,
              requiredPermissions: ["ai.admin", "settings.admin"],
            },
            {
              title: "Knowledge Search",
              href: "/knowledge/ai-hub/search",
              icon: "Search",
              adminOnly: true,
              requiredPermissions: ["ai.admin", "settings.admin"],
            },
          ],
        },
        {
          title: "Memory Admin",
          href: "/knowledge/memory-admin",
          icon: "Database",
          adminOnly: true,
          requiredPermissions: ["knowledge.admin", "settings.admin"],
        },
        {
          title: "Embeddings",
          href: "/knowledge/embeddings",
          icon: "Sparkles",
          adminOnly: true,
          requiredPermissions: ["knowledge.admin", "settings.admin"],
        },
        {
          title: "AI Models",
          href: "/knowledge/ai-models",
          icon: "Cpu",
          adminOnly: true,
          requiredPermissions: ["ai.admin", "settings.admin"],
        },
        {
          title: "Agent Analytics",
          href: "/knowledge/agent-analytics",
          icon: "BarChart3",
          adminOnly: true,
          requiredPermissions: ["ai.admin", "settings.admin"],
        },
        {
          title: "Prompt Templates",
          href: "/knowledge/prompt-templates",
          icon: "FileText",
          adminOnly: true,
          requiredPermissions: ["ai.admin", "settings.admin"],
        },
        {
          title: "Agent Categories",
          href: "/knowledge/agent-categories",
          icon: "FolderOpen",
          adminOnly: true,
          requiredPermissions: ["ai.admin", "settings.admin"],
        },
      ],
    },
  ],

  operations: [
    {
      id: "operations-people",
      title: "People & Access",
      icon: "Users",
      items: [
        {
          title: "Dashboard",
          href: "/operations/dashboard",
          icon: "LayoutDashboard",
        },
        {
          title: "User Management",
          href: "/operations/users",
          icon: "Users",
          adminOnly: true,
          requiredPermissions: ["users.admin", "users.view", "settings.admin"],
        },
        {
          title: "Role Management",
          href: "/operations/roles",
          icon: "Shield",
          adminOnly: true,
          requiredPermissions: ["users.admin", "settings.admin"],
        },
        {
          title: "Departments",
          href: "/operations/departments",
          icon: "Building2",
          adminOnly: true,
          requiredPermissions: ["users.admin", "settings.admin"],
        },
        {
          title: "Activity Logs",
          href: "/operations/activity-logs",
          icon: "Activity",
          adminOnly: true,
          requiredPermissions: ["settings.admin"],
        },
      ],
    },
    {
      id: "operations-work",
      title: "Work Management",
      icon: "ListTodo",
      items: [
        {
          title: "Tasks",
          href: "/operations/tasks",
          icon: "CheckSquare",
          module: "actions",
          featureFlag: "enableTasks",
        },
        {
          title: "Task Streams",
          href: "/operations/tasks/streams",
          icon: "GitBranch",
          module: "actions",
          featureFlag: "enableTasks",
        },
        {
          title: "Projects",
          href: "/operations/projects",
          icon: "FolderKanban",
          module: "projects",
        },
        {
          title: "Pods",
          href: "/operations/pods",
          icon: "Layers",
          adminOnly: true,
          requiredPermissions: ["settings.admin"],
        },
        {
          title: "Productivity",
          href: "/operations/productivity",
          icon: "BarChart3",
          module: "productivity",
        },
        {
          title: "Processes",
          href: "/operations/processes",
          icon: "FileText",
          module: "productivity",
        },
      ],
    },
    {
      id: "operations-system",
      title: "System",
      icon: "Settings",
      items: [
        {
          title: "Notifications",
          href: "/operations/notifications",
          icon: "Bell",
          featureFlag: "enableNotifications",
          requiredPermissions: ["notifications.view"],
        },
        {
          title: "Integrations",
          href: "/operations/integrations",
          icon: "Zap",
          adminOnly: true,
          requiredPermissions: ["integrations.admin", "settings.admin"],
        },
        {
          title: "MCP Servers",
          href: "/operations/mcp-servers",
          icon: "Plug",
          adminOnly: true,
          requiredPermissions: ["settings.admin"],
        },
        {
          title: "Feedback",
          href: "/operations/feedback",
          icon: "MessageCircle",
          featureFlag: "enableFeedback",
        },
        {
          title: "Settings",
          href: "/operations/settings/branding",
          icon: "Settings",
          headerOnly: true,
          adminOnly: true,
          requiredPermissions: ["settings.admin"],
          children: [
            { title: "Branding", href: "/operations/settings/branding", icon: "Palette", adminOnly: true, requiredPermissions: ["settings.admin"] },
            { title: "Workspace", href: "/operations/settings/workspace", icon: "Layers", adminOnly: true, requiredPermissions: ["settings.admin"] },
            { title: "Security", href: "/operations/settings/security", icon: "Shield", adminOnly: true, requiredPermissions: ["settings.admin"] },
            { title: "Notifications", href: "/admin/notifications", icon: "Mail", adminOnly: true, requiredPermissions: ["notifications.admin", "settings.admin"] },
            { title: "Advanced", href: "/operations/settings/advanced", icon: "Zap", adminOnly: true, requiredPermissions: ["settings.admin"] },
          ],
        },
      ],
    },
  ],

  eos: [
    {
      id: "eos-strategy",
      title: "Strategy",
      icon: "Target",
      module: "eos",
      eosOnly: true,
      agencyRoles: ["owner"],
      items: [
        {
          title: "Dashboard",
          href: "/eos/dashboard",
          icon: "LayoutDashboard",
          module: "eos",
        },
        {
          title: "V/TO",
          href: "/eos/vto",
          icon: "Eye",
          module: "eos",
        },
        {
          title: "Rocks",
          href: "/eos/rocks",
          icon: "Crosshair",
          module: "eos",
        },
        {
          title: "Scorecards",
          href: "/eos/scorecards",
          icon: "BarChart3",
          module: "eos",
          headerOnly: true,
          children: [
            { title: "Scorecard", href: "/eos/scorecards", icon: "BarChart3", module: "eos" },
            { title: "Scorecard Settings", href: "/eos/admin/scorecards", icon: "Settings", adminOnly: true, requiredPermissions: ["settings.admin"] },
          ],
        },
        {
          title: "IDS",
          href: "/eos/ids",
          icon: "AlertCircle",
          module: "eos",
        },
        {
          title: "Accountability Chart",
          href: "/eos/accountability",
          icon: "Network",
          module: "eos",
        },
        {
          title: "People Analyzer",
          href: "/eos/people-analyzer",
          icon: "Users",
          module: "eos",
        },
        {
          title: "Todos",
          href: "/eos/todos",
          icon: "CheckSquare",
          module: "eos",
        },
        {
          title: "Analytics",
          href: "/eos/analytics",
          icon: "BarChart3",
          module: "eos",
        },
      ],
    },
    {
      id: "eos-meetings",
      title: "Meetings",
      icon: "Calendar",
      module: "meetings",
      items: [
        {
          title: "All Meetings",
          href: "/eos/meetings/schedule",
          icon: "Calendar",
          module: "meetings",
          featureFlag: "enableMeetings",
        },
        {
          title: "Transcripts",
          href: "/eos/meetings/transcripts",
          icon: "ScrollText",
          module: "meetings",
          featureFlag: "enableMeetings",
        },
        {
          title: "Series",
          href: "/eos/meetings/series",
          icon: "Repeat",
          module: "meetings",
          featureFlag: "enableMeetings",
        },
        {
          title: "Pending Assignments",
          href: "/eos/meetings/pending-assignments",
          icon: "ClipboardCheck",
          module: "meetings",
          featureFlag: "enableMeetings",
        },
        {
          title: "AI Match",
          href: "/eos/meetings/transcripts/ai-match",
          icon: "Sparkles",
          module: "meetings",
          featureFlag: "enableMeetings",
          agencyRoles: ["owner"],
        },
      ],
    },
    {
      id: "eos-admin",
      title: "EOS Admin",
      icon: "Shield",
      adminOnly: true,
      items: [
        {
          title: "EOS Hub Admin",
          href: "/eos/admin",
          icon: "Target",
          requiredPermissions: ["settings.admin"],
        },
        {
          title: "V/TO Settings",
          href: "/eos/admin/vto",
          icon: "FileText",
          requiredPermissions: ["settings.admin"],
        },
        {
          title: "Accountability Admin",
          href: "/eos/admin/accountability",
          icon: "Network",
          requiredPermissions: ["settings.admin"],
        },
        {
          title: "OKRs Workspace",
          href: "/eos/admin/okrs",
          icon: "Crosshair",
          requiredPermissions: ["settings.admin"],
        },
      ],
    },
  ],
};

/** Flatten all nav items for search indexing and breadcrumb lookup */
export function flattenSpaceNav(
  spaceId?: SpaceId
): Array<SpaceNavItem & { spaceId: SpaceId; groupTitle: string }> {
  const spaces = spaceId ? [spaceId] : (Object.keys(spaceNavigation) as SpaceId[]);
  const result: Array<SpaceNavItem & { spaceId: SpaceId; groupTitle: string }> = [];

  for (const sid of spaces) {
    for (const group of spaceNavigation[sid]) {
      for (const item of group.items) {
        result.push({ ...item, spaceId: sid, groupTitle: group.title });
        for (const child of item.children ?? []) {
          result.push({ ...child, spaceId: sid, groupTitle: group.title });
        }
      }
    }
  }
  return result;
}

/** Find nav item title for a path (best match) */
export function findNavItemByPath(pathname: string, search = ""): { title: string; spaceId: SpaceId } | null {
  const path = pathname.split("?")[0];
  const all = flattenSpaceNav();
  const withSearch = search ? `${path}?${search.replace(/^\?/, "")}` : path;

  let best: (typeof all)[0] | null = null;
  for (const item of all) {
    const itemPath = item.href.split("?")[0];
    if (withSearch === item.href || path === itemPath || path.startsWith(itemPath + "/")) {
      if (!best || itemPath.length > best.href.split("?")[0].length) {
        best = item;
      }
    }
  }
  if (!best) return null;
  return { title: best.title, spaceId: best.spaceId };
}
