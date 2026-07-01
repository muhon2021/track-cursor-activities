import { KnowledgeHealthSection } from "@/components/knowledge/dashboard/KnowledgeHealthSection";
import { KnowledgeAnalyticsSection } from "@/components/knowledge/dashboard/KnowledgeAnalyticsSection";
import { UsageInsightsSection } from "@/components/knowledge/dashboard/UsageInsightsSection";
import { SyncStatusSection } from "@/components/knowledge/dashboard/SyncStatusSection";
import { SourceOverviewSection } from "@/components/knowledge/dashboard/SourceOverviewSection";
import { ParserDashboardSection } from "@/components/knowledge/dashboard/ParserDashboardSection";
import {
  LayoutDashboard,
  BarChart3,
  Search,
  RefreshCw,
  Database,
  FileSearch,
} from "lucide-react";

const SECTIONS = [
  {
    id: "health",
    label: "Health",
    icon: LayoutDashboard,
    Component: KnowledgeHealthSection,
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    Component: KnowledgeAnalyticsSection,
  },
  {
    id: "usage",
    label: "Usage Insights",
    icon: Search,
    Component: UsageInsightsSection,
  },
  {
    id: "sync",
    label: "Sync Status",
    icon: RefreshCw,
    Component: SyncStatusSection,
  },
  {
    id: "sources",
    label: "Sources",
    icon: Database,
    Component: SourceOverviewSection,
  },
  {
    id: "parser",
    label: "Parser",
    icon: FileSearch,
    Component: ParserDashboardSection,
  },
] as const;

export default function KnowledgeDashboard() {
  return (
    <div className="container mx-auto space-y-10 py-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <LayoutDashboard className="h-8 w-8 text-primary" />
          Knowledge Base Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Command center for analytics, usage insights, sync health, and source overview
        </p>
      </div>

      {SECTIONS.map(({ id, label, icon: Icon, Component }) => (
        <section key={id} id={id} className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {label}
          </h2>
          <Component />
        </section>
      ))}
    </div>
  );
}
