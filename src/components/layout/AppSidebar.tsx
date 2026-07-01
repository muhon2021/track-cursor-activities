import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useModuleAccess } from "@/shared/hooks/useModuleAccess";
import { useAgencyRole } from "@/hooks/useAgencyRole";
import { useDealPipelineStats } from "@/modules/business-dev/hooks/useDeals";
import {
  dashboardItem,
  navigationGroups,
  type NavItem,
  type NavGroup,
  type AgencyRole,
} from "@/shared/data/navigationStructure";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AIIndicator } from "@/components/ui/ai-indicator";
import {
  LayoutDashboard,
  Users,
  Calendar,
  CheckSquare,
  BookOpen,
  BookMarked,
  Brain,
  Bot,
  ChevronRight,
  MessageSquare,
  MessageCircle,
  Target,
  FolderKanban,
  BarChart3,
  GitBranch,
  Crosshair,
  Eye,
  AlertCircle,
  Repeat,
  Handshake,
  Contact,
  FileText,
  Briefcase,
  ListTodo,
  Settings2,
  Sparkles,
  ScrollText,
  Network,
  Search,
  Calculator,
  CheckCircle,
  Wrench,
  Monitor,
  HelpCircle,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";

// Icon resolver: maps string names from navigation data to actual components
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Calendar,
  CheckSquare,
  BookOpen,
  BookMarked,
  Brain,
  Bot,
  MessageSquare,
  MessageCircle,
  Target,
  FolderKanban,
  BarChart3,
  GitBranch,
  Crosshair,
  Eye,
  AlertCircle,
  Repeat,
  Handshake,
  Contact,
  FileText,
  Briefcase,
  ListTodo,
  Settings2,
  Sparkles,
  ScrollText,
  Network,
  Search,
  Calculator,
  CheckCircle,
  Wrench,
  Monitor,
  HelpCircle,
  ClipboardCheck,
};

function resolveIcon(iconName: string): LucideIcon {
  return iconMap[iconName] || LayoutDashboard;
}

const MENU_STATE_KEY = "sidebar-menu-state";

export function AppSidebar() {
  const location = useLocation();
  const { open } = useSidebar();
  const { profile } = useAuth();
  const { companyName } = useBranding();
  const { isFeatureEnabled } = useFeatureFlags();
  const { hasModule } = useModuleAccess();
  const { agencyRole, isEosUser, isAdmin } = useAgencyRole();
  const { data: dealStats } = useDealPipelineStats();
  const dealStageCounts = dealStats?.by_stage ?? {};
  const currentAgencyRole = agencyRole as AgencyRole | null;

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(MENU_STATE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem(MENU_STATE_KEY, JSON.stringify(openMenus));
    } catch {
      // ignore
    }
  }, [openMenus]);

  const toggleMenu = (key: string) => {
    setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ---- Visibility filters ----
  const isItemVisible = (item: NavItem): boolean => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.featureFlag && !isFeatureEnabled(item.featureFlag as any)) return false;
    if (item.module && !hasModule(item.module)) return false;
    if (item.eosOnly && !isEosUser && !isAdmin) return false;
    if (item.agencyRoles && !isAdmin && currentAgencyRole) {
      if (!item.agencyRoles.includes(currentAgencyRole)) return false;
    }
    return true;
  };

  const isGroupVisible = (group: NavGroup): boolean => {
    if (group.eosOnly && !isEosUser && !isAdmin) return false;
    if (group.agencyRoles && !isAdmin && currentAgencyRole) {
      if (!group.agencyRoles.includes(currentAgencyRole)) return false;
    }
    if (group.featureFlag && !isFeatureEnabled(group.featureFlag as any)) return false;
    if (group.module && !hasModule(group.module)) {
      // still show if any item passes its own gate
      const hasVisibleItem = group.items.some((item) => isItemVisible(item));
      if (!hasVisibleItem) return false;
    }
    return group.items.some((item) => isItemVisible(item));
  };

  const isRouteActive = (href: string): boolean => {
    if (href === "/dashboard") return location.pathname === "/dashboard";
    const path = href.split("?")[0];
    if (location.pathname !== path && !location.pathname.startsWith(path + "/")) return false;
    if (href.includes("?")) {
      const params = new URLSearchParams(href.split("?")[1]);
      const current = new URLSearchParams(location.search);
      return Array.from(params.entries()).every(([k, v]) => current.get(k) === v);
    }
    if (href === "/clients" && location.pathname === "/clients") {
      const status = new URLSearchParams(location.search).get("status");
      return status == null || status === "";
    }
    if (href === "/deals" && location.pathname === "/deals") {
      const tab = new URLSearchParams(location.search).get("tab");
      const stage = new URLSearchParams(location.search).get("stage");
      const tabOk = tab == null || tab === "" || tab === "all";
      const stageOk = stage == null || stage === "" || stage === "all";
      return tabOk && stageOk;
    }
    return true;
  };

  const visibleGroups = navigationGroups.filter(isGroupVisible);
  const DashboardIcon = resolveIcon(dashboardItem.icon);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader
        className={cn(
          "border-b border-sidebar-border",
          open ? "p-4" : "p-0 h-12 flex items-center justify-center"
        )}
      >
        <Link
          to="/dashboard"
          className={cn("flex items-center gap-3", !open && "justify-center")}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          {open && (
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground truncate">
                Control Tower
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {companyName}
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="scrollbar-modern">
        {/* Dashboard - always visible at top */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isRouteActive(dashboardItem.href)}
                tooltip={dashboardItem.title}
              >
                <Link to={dashboardItem.href}>
                  <DashboardIcon />
                  <span>{dashboardItem.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Grouped navigation */}
        {visibleGroups.map((group) => {
          const items = group.items.filter(isItemVisible);
          if (items.length === 0) return null;

          return (
            <SidebarGroup key={group.id}>
              <SidebarGroupLabel className="flex items-center gap-1.5">
                {group.title}
                {group.isAI && <AIIndicator variant="dot" size="sm" />}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const Icon = resolveIcon(item.icon);
                    const children = item.children?.filter(isItemVisible) ?? [];
                    const hasChildren = children.length > 0;
                    const itemKey = `${group.id}-${item.title}`;
                    const childActive = children.some((c) => isRouteActive(c.href));
                    const isOpen =
                      openMenus[itemKey] ?? (childActive || item.headerOnly === true);

                    if (hasChildren) {
                      return (
                        <Collapsible
                          key={itemKey}
                          open={isOpen}
                          onOpenChange={() => toggleMenu(itemKey)}
                          className="group/collapsible"
                        >
                          <SidebarMenuItem>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton
                                tooltip={item.title}
                                isActive={!item.headerOnly && isRouteActive(item.href)}
                              >
                                <Icon />
                                <span>{item.title}</span>
                                <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <SidebarMenuSub>
                                {children.map((child) => {
                                  const ChildIcon = resolveIcon(child.icon);
                                  const isDealsSection = item.href === "/deals";
                                  const allDealsChild =
                                    isDealsSection && child.href === "/deals";
                                  const stageMatch = isDealsSection
                                    ? child.href.match(/stage=(\w+)/)
                                    : null;
                                  const stageCount = stageMatch
                                    ? (dealStageCounts as Record<
                                        string,
                                        { count: number; value: number }
                                      >)[stageMatch[1]]?.count
                                    : undefined;
                                  const badge = allDealsChild
                                    ? dealStats?.total_deals != null
                                      ? String(dealStats.total_deals)
                                      : child.badge
                                    : child.badge ??
                                      (stageCount != null
                                        ? String(stageCount)
                                        : undefined);
                                  return (
                                    <SidebarMenuSubItem key={child.href}>
                                      <SidebarMenuSubButton
                                        asChild
                                        isActive={isRouteActive(child.href)}
                                      >
                                        <Link to={child.href}>
                                          <ChildIcon />
                                          <span>{child.title}</span>
                                          {badge != null && (
                                            <span className="ml-auto text-xs text-muted-foreground">
                                              {badge}
                                            </span>
                                          )}
                                        </Link>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  );
                                })}
                              </SidebarMenuSub>
                            </CollapsibleContent>
                          </SidebarMenuItem>
                        </Collapsible>
                      );
                    }

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={isRouteActive(item.href)}
                          tooltip={item.title}
                        >
                          <Link to={item.href}>
                            <Icon />
                            <span>{item.title}</span>
                            {item.badge && (
                              <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Help</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isRouteActive("/help")}
                tooltip="Help & Guides"
              >
                <Link to="/help">
                  <HelpCircle />
                  <span>Help & Guides</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {isFeatureEnabled("enableFeedback" as any) && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isRouteActive("/feedback")}
                  tooltip="Feedback"
                >
                  <Link to="/feedback">
                    <MessageCircle />
                    <span>Feedback</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {open && (
        <SidebarFooter className="border-t border-sidebar-border">
          <div className="rounded-lg bg-sidebar-accent/50 px-4 py-3">
            <p className="text-sm font-medium text-sidebar-foreground">Framework</p>
            <p className="text-xs text-muted-foreground">v1.0.0 — Enterprise</p>
          </div>
        </SidebarFooter>
      )}

      <SidebarRail />
    </Sidebar>
  );
}
