import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useBranding } from "@/contexts/BrandingContext";
import { useIntegrationStatus } from "@/hooks/useIntegrationStatus";
import { adminNavigation } from "@/shared/data/navigationStructure";
import { Badge } from "@/components/ui/badge";
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
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  LayoutDashboard,
  Users,
  Shield,
  Activity,
  Settings,
  Zap,
  Database,
  ArrowLeft,
  CheckCircle2,
  Brain,
  BarChart,
  ChevronRight,
  MessageSquare,
  Plug,
  Rocket,
  ClipboardList,
  Building2,
  Calendar,
  BarChart3,
  FolderOpen,
  Upload,
  GitBranch,
  Target,
  Crosshair,
  Layers,
  FileText,
  Network,
  Bot,
  Search,
  BookOpen,
  Globe,
  RefreshCw,
  Sparkles,
  Palette,
  Mail,
  FolderKanban,
  ListChecks,
  HeartPulse,
  HardDrive,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Shield,
  Activity,
  Settings,
  Zap,
  Database,
  CheckCircle2,
  Brain,
  BarChart,
  MessageSquare,
  Plug,
  Rocket,
  ClipboardList,
  Building2,
  Calendar,
  BarChart3,
  FolderOpen,
  Upload,
  GitBranch,
  Target,
  Crosshair,
  Layers,
  FileText,
  Network,
  Bot,
  Search,
  BookOpen,
  Globe,
  RefreshCw,
  Sparkles,
  Palette,
  Mail,
  FolderKanban,
  ListChecks,
  HeartPulse,
  HardDrive,
};

function resolveIcon(name: string): LucideIcon {
  return iconMap[name] || LayoutDashboard;
}

const ADMIN_MENU_STATE_KEY = "admin-sidebar-menu-state";

export function AdminSidebar() {
  const location = useLocation();
  const { open } = useSidebar();
  const { companyName } = useBranding();
  const { status: integrationStatus } = useIntegrationStatus();

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(ADMIN_MENU_STATE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_MENU_STATE_KEY, JSON.stringify(openMenus));
    } catch {
      // ignore
    }
  }, [openMenus]);

  const toggleMenu = (key: string) =>
    setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }));

  const isActive = (path: string) =>
    path === "/admin"
      ? location.pathname === "/admin"
      : location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader
        className={cn(
          "h-14 border-b border-sidebar-border px-4",
          !open && "justify-center px-0"
        )}
      >
        <Link
          to="/admin"
          className={cn("flex items-center gap-3", !open && "justify-center")}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          {open && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-sidebar-foreground truncate">
                Admin Panel
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {companyName}
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="scrollbar-modern">
        {/* Back to Dashboard */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Back to Dashboard">
                <Link to="/dashboard">
                  <ArrowLeft />
                  <span>Back to Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {adminNavigation.map((group) => {
          const groupActive = group.items.some((item) =>
            item.children?.length
              ? item.children.some((child) => isActive(child.href))
              : isActive(item.href),
          );

          return (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel
              className={cn(groupActive && "font-semibold text-sidebar-foreground")}
            >
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = resolveIcon(item.icon);
                  const hasChildren = !!item.children?.length;
                  const itemKey = `${group.id}-${item.title}`;
                  const childActive =
                    hasChildren &&
                    item.children!.some((c) => isActive(c.href));
                  const isOpen =
                    openMenus[itemKey] ?? (childActive || item.headerOnly === true);
                  const isIntegrations = item.href === "/admin/integrations";
                  const integrationsBadge =
                    isIntegrations &&
                    integrationStatus &&
                    integrationStatus.connected > 0
                      ? integrationStatus.connected
                      : null;

                  if (hasChildren && item.headerOnly) {
                    return (
                      <Collapsible
                        key={itemKey}
                        open={isOpen}
                        onOpenChange={() => toggleMenu(itemKey)}
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip={item.title}>
                              <Icon />
                              <span>{item.title}</span>
                              <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-150 group-data-[state=open]/collapsible:rotate-90" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {item.children!.map((child) => {
                                const ChildIcon = resolveIcon(child.icon);
                                return (
                                  <SidebarMenuSubItem key={child.href}>
                                    <SidebarMenuSubButton
                                      asChild
                                      isActive={isActive(child.href)}
                                    >
                                      <Link to={child.href}>
                                        <ChildIcon />
                                        <span>{child.title}</span>
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
                        isActive={isActive(item.href)}
                        tooltip={item.title}
                      >
                        <Link to={item.href}>
                          <Icon />
                          <span>{item.title}</span>
                          {integrationsBadge != null && (
                            <Badge
                              variant="secondary"
                              className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-xs"
                            >
                              {integrationsBadge}
                            </Badge>
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
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {open ? (
          <div className="px-2 py-1 text-xs font-medium uppercase tracking-[0.01em] text-muted-foreground">
            Admin · {companyName}
          </div>
        ) : null}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
