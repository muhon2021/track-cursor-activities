/**
 * Legacy route → Four Spaces route mapping.
 * Used by redirect layer when enableFourSpaces is active.
 */

/** Exact path redirects (pathname only) */
export const LEGACY_PATH_REDIRECTS: Record<string, string> = {
  "/dashboard": "/sales/dashboard",
  "/admin": "/operations/dashboard",
  "/clients": "/sales/accounts",
  "/contacts": "/sales/contacts",
  "/deals": "/sales/deals",
  "/lead-followup": "/sales/lead-followup",
  "/okrs": "/eos/rocks",
  "/personal-knowledge": "/knowledge/personal",
  "/tasks": "/operations/tasks",
  "/streams": "/operations/tasks/streams",
  "/projects": "/operations/projects",
  "/pod/management": "/operations/pods",
  "/productivity": "/operations/productivity",
  "/process": "/operations/processes",
  "/notifications": "/operations/notifications",
  "/feedback": "/operations/feedback",
  "/ai-agents": "/knowledge/chat",
  "/agents": "/knowledge/agents",
  "/meetings": "/eos/meetings/transcripts",
  "/meetings-v2": "/eos/meetings/schedule",
};

/** Prefix redirects — longest match first */
export const LEGACY_PREFIX_REDIRECTS: Array<{ from: string; to: string }> = [
  { from: "/admin/knowledge/playground", to: "/knowledge/playground" },
  { from: "/admin/knowledge/dashboard", to: "/knowledge/dashboard" },
  { from: "/admin/knowledge/permissions", to: "/knowledge/permissions" },
  { from: "/admin/knowledge/categories", to: "/knowledge/categories" },
  { from: "/admin/knowledge/files", to: "/knowledge/files" },
  { from: "/admin/knowledge/embeddings", to: "/knowledge/embeddings" },
  { from: "/admin/knowledge", to: "/knowledge/dashboard" },
  { from: "/admin/ai-hub/knowledge-search", to: "/knowledge/ai-hub/search" },
  { from: "/admin/ai-hub/memory", to: "/knowledge/ai-hub" },
  { from: "/admin/ai-hub", to: "/knowledge/ai-hub" },
  { from: "/admin/ai/deal-coaching", to: "/sales/deal-coaching" },
  { from: "/admin/ai/email-drafting", to: "/sales/email-drafting" },
  { from: "/admin/ai/analytics", to: "/knowledge/agent-analytics" },
  { from: "/admin/ai/agents", to: "/knowledge/agents" },
  { from: "/admin/ai/agent-categories", to: "/knowledge/agent-categories" },
  { from: "/admin/ai/prompt-templates", to: "/knowledge/prompt-templates" },
  { from: "/admin/ai/chat", to: "/knowledge/chat" },
  { from: "/admin/ai", to: "/knowledge/agent-analytics" },
  { from: "/admin/memory/admin", to: "/knowledge/memory-admin" },
  { from: "/admin/memory", to: "/knowledge/ai-hub" },
  { from: "/admin/eos/scorecards", to: "/eos/admin/scorecards" },
  { from: "/admin/eos/accountability", to: "/eos/admin/accountability" },
  { from: "/admin/eos/vto", to: "/eos/admin/vto" },
  { from: "/admin/eos/okrs", to: "/eos/admin/okrs" },
  { from: "/admin/eos", to: "/eos/admin" },
  { from: "/admin/reports/projects", to: "/sales/reports/projects" },
  { from: "/admin/reports/resource-utilization", to: "/sales/reports/resource-utilization" },
  { from: "/admin/reports", to: "/sales/reports/projects" },
  { from: "/admin/settings", to: "/operations/settings/branding" },
  { from: "/admin/integrations", to: "/operations/integrations" },
  { from: "/admin/tasks/streams", to: "/operations/tasks/streams" },
  { from: "/admin/tasks", to: "/operations/tasks/streams" },
  { from: "/admin/users/invitations", to: "/operations/users/invitations" },
  { from: "/admin/users", to: "/operations/users" },
  { from: "/admin/roles/permissions", to: "/operations/roles/permissions" },
  { from: "/admin/roles", to: "/operations/roles" },
  { from: "/admin/department", to: "/operations/departments" },
  { from: "/admin/departments", to: "/operations/departments" },
  { from: "/admin/audit-logs", to: "/operations/activity-logs" },
  { from: "/admin/logs", to: "/operations/activity-logs" },
  { from: "/admin/feedback", to: "/operations/feedback" },
  { from: "/admin/meeting-analytics", to: "/sales/meeting-analytics" },
  { from: "/admin/mcp-servers", to: "/operations/mcp-servers" },
  { from: "/admin/pods", to: "/operations/pods" },
  { from: "/admin/ai-models", to: "/knowledge/ai-models" },
  { from: "/admin", to: "/operations/dashboard" },
  { from: "/clients", to: "/sales/accounts" },
  { from: "/contacts", to: "/sales/contacts" },
  { from: "/deals", to: "/sales/deals" },
  { from: "/lead-followup", to: "/sales/lead-followup" },
  { from: "/meetings", to: "/eos/meetings" },
  { from: "/tasks/stream", to: "/operations/tasks/stream" },
  { from: "/tasks", to: "/operations/tasks" },
  { from: "/projects", to: "/operations/projects" },
  { from: "/eos/issues", to: "/eos/ids" },
  { from: "/eos/scorecard", to: "/eos/scorecards" },
];

/**
 * Resolve a legacy path to its Four Spaces equivalent.
 * Returns null if path is already a canonical space route.
 */
export function resolveLegacyRedirect(pathname: string, search = ""): string | null {
  // Already on a new space route — do not redirect
  if (
    pathname.startsWith("/sales/") ||
    pathname.startsWith("/operations/") ||
    pathname.startsWith("/knowledge/") ||
    pathname.startsWith("/eos/")
  ) {
    return null;
  }

  const exact = LEGACY_PATH_REDIRECTS[pathname];
  if (exact) {
    return search ? `${exact}${search.startsWith("?") ? search : `?${search}`}` : exact;
  }

  for (const { from, to } of LEGACY_PREFIX_REDIRECTS) {
    if (pathname === from || pathname.startsWith(from + "/")) {
      const suffix = pathname.slice(from.length);
      const target = `${to}${suffix}`;
      return search ? `${target}${search.startsWith("?") ? search : `?${search}`}` : target;
    }
  }

  return null;
}

/**
 * Resolve a Four Spaces path back to its legacy equivalent.
 * Used when enableFourSpaces is disabled.
 */
export function resolveSpaceToLegacyRedirect(pathname: string, search = ""): string | null {
  const withSearch = (path: string) =>
    search ? `${path}${search.startsWith("?") ? search : `?${search}`}` : path;

  for (const [legacy, space] of Object.entries(LEGACY_PATH_REDIRECTS)) {
    if (pathname === space) {
      return withSearch(legacy);
    }
    if (pathname.startsWith(space + "/")) {
      const suffix = pathname.slice(space.length);
      return withSearch(`${legacy}${suffix}`);
    }
  }

  for (const { from, to } of LEGACY_PREFIX_REDIRECTS) {
    if (pathname === to) {
      return withSearch(from);
    }
    if (pathname.startsWith(to + "/")) {
      const suffix = pathname.slice(to.length);
      return withSearch(`${from}${suffix}`);
    }
  }

  if (pathname.startsWith("/sales/")) return withSearch("/dashboard");
  if (pathname.startsWith("/knowledge/")) return withSearch("/knowledge");
  if (pathname.startsWith("/operations/")) return withSearch("/dashboard");

  // Four Spaces EOS-only paths → legacy EOS routes
  if (pathname === "/eos/dashboard") return withSearch("/eos");
  if (pathname === "/eos/rocks") return withSearch("/okrs");
  if (pathname.startsWith("/eos/meetings/")) {
    const suffix = pathname.slice("/eos/meetings".length);
    return withSearch(`/meetings${suffix || ""}`);
  }
  if (pathname.startsWith("/eos/ids")) return withSearch(pathname.replace("/eos/ids", "/eos/issues"));
  if (pathname.startsWith("/eos/scorecards")) return withSearch(pathname.replace("/eos/scorecards", "/eos/scorecard"));

  return null;
}

/** Default space dashboard for a user preference value */
export function getDashboardForSpace(spaceId: string): string {
  const map: Record<string, string> = {
    sales: "/sales/dashboard",
    knowledge: "/knowledge/dashboard",
    operations: "/operations/dashboard",
    eos: "/eos/dashboard",
  };
  return map[spaceId] ?? "/sales/dashboard";
}
