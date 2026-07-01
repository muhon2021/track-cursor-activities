/**
 * Admin EOS Hub — Landing page for all EOS admin configuration.
 *
 * Links to VTO Admin, Scorecard Workspace, Accountability Charts, and future pages.
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  BarChart3,
  Network,
  Settings,
  Target,
  AlertCircle,
  Crosshair,
} from "lucide-react";

const EOS_ADMIN_SECTIONS = [
  {
    title: "VTO Admin",
    description: "Manage Vision/Traction Organizer section templates, titles, and defaults.",
    href: "/admin/eos/vto",
    icon: FileText,
    status: "live" as const,
  },
  {
    title: "Scorecard Workspace",
    description: "Create and configure scorecards with metrics, targets, and goal directions.",
    href: "/admin/eos/scorecards",
    icon: BarChart3,
    status: "live" as const,
  },
  {
    title: "OKRs Workspace",
    description: "Oversee OKR lifecycle, filter by quarter/status, and perform admin triage actions.",
    href: "/admin/eos/okrs",
    icon: Crosshair,
    status: "live" as const,
  },
  {
    title: "Accountability Charts",
    description: "Manage org chart versions, roles, reporting structure, and publish charts.",
    href: "/admin/eos/accountability",
    icon: Network,
    status: "live" as const,
  },
  {
    title: "EOS System Config",
    description: "Configure pod categories, issue priorities, OKR quarter settings.",
    href: "/admin/eos/system",
    icon: Settings,
    status: "planned" as const,
  },
  {
    title: "Import Anonymous Issues",
    description: "Bulk import anonymous issue submissions via CSV or paste.",
    href: "/admin/eos/import-issues",
    icon: AlertCircle,
    status: "planned" as const,
  },
];

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  live: { bg: "bg-success/10", text: "text-success", label: "Live" },
  planned: { bg: "bg-purple-100", text: "text-purple-700", label: "Planned" },
};

export default function AdminEOS() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          EOS Admin
        </h1>
        <p className="text-muted-foreground">
          Configure the Entrepreneurial Operating System module — VTO, Scorecards, Accountability, and more.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {EOS_ADMIN_SECTIONS.map((section) => {
          const Icon = section.icon;
          const status = statusColors[section.status];
          const isClickable = section.status === "live";

          return (
            <Card
              key={section.href}
              className={`transition-colors ${isClickable ? "cursor-pointer hover:border-primary/50" : "opacity-70"}`}
              onClick={() => isClickable && navigate(section.href)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{section.title}</CardTitle>
                  </div>
                  <Badge className={`${status.bg} ${status.text} border-0 text-xs`}>
                    {status.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{section.description}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
