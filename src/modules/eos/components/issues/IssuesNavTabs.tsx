/**
 * Issues Navigation Tabs — space-aware (/eos/ids vs /eos/issues).
 */

import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { getEosIssuesBasePath } from "@/lib/eos-routes";
import {
  List,
  CheckCircle2,
  Archive,
  EyeOff,
  Bot,
  Users,
} from "lucide-react";

interface NavTab {
  label: string;
  suffix: string;
  icon: React.ComponentType<{ className?: string }>;
  matchSuffixes?: string[];
}

const NAV_TABS: NavTab[] = [
  { label: "All Issues", suffix: "/all", icon: List, matchSuffixes: ["/all", ""] },
  { label: "Solved", suffix: "/solved", icon: CheckCircle2 },
  { label: "Archived", suffix: "/archived", icon: Archive },
  { label: "Anonymous", suffix: "/anonymous", icon: EyeOff },
  { label: "AI Suggestions", suffix: "/ai", icon: Bot },
  { label: "By Pod", suffix: "/pod-overview", icon: Users },
];

export function IssuesNavTabs() {
  const location = useLocation();
  const base = getEosIssuesBasePath(location.pathname);

  const isActive = (tab: NavTab) => {
    const href = `${base}${tab.suffix}`;
    if (tab.matchSuffixes) {
      return tab.matchSuffixes.some((s) => {
        const path = s ? `${base}${s}` : base;
        return location.pathname === path;
      });
    }
    return location.pathname === href;
  };

  return (
    <div className="flex items-center gap-1 flex-wrap border-b pb-3 mb-4">
      {NAV_TABS.map((tab) => {
        const Icon = tab.icon;
        const href = tab.suffix ? `${base}${tab.suffix}` : base;
        const active = isActive(tab);
        return (
          <Link
            key={tab.suffix || "root"}
            to={href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
