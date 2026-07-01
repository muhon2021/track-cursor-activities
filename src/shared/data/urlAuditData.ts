/**
 * URL audit data - per PROJECTS-EXACT-FILE-LIST.
 * Parent and child routes for /projects for analytics or audit.
 */
export interface UrlAuditEntry {
  path: string;
  label: string;
  module?: string;
  children?: UrlAuditEntry[];
}

export const urlAuditData: UrlAuditEntry[] = [
  {
    path: "/projects",
    label: "Projects",
    module: "projects",
    children: [
      { path: "/projects/:slug/overview", label: "Overview" },
      { path: "/projects/:slug/tasks", label: "Tasks" },
      { path: "/projects/:slug/integrations", label: "Integrations" },
      { path: "/projects/:slug/client_portal", label: "Client Portal" },
      { path: "/projects/:slug/checklist", label: "Checklist" },
      { path: "/projects/:slug/risks", label: "Risks" },
      { path: "/projects/:slug/comments", label: "Comments" },
      { path: "/projects/:slug/files", label: "Files" },
      { path: "/projects/:slug/finance", label: "Finance" },
    ],
  },
  { path: "/okrs", label: "OKRs", module: "eos" },
];
