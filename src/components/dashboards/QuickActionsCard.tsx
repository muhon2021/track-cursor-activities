import { Link } from "react-router-dom";
import {
  UserPlus,
  FolderPlus,
  CalendarPlus,
  ClipboardList,
  AlertTriangle,
  CheckSquare,
  Clock,
  BarChart3,
  Zap,
  Handshake,
  Target,
  Mail,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAgencyRole } from "@/hooks/useAgencyRole";

interface QuickAction {
  label: string;
  icon: React.ElementType;
  to: string;
  description?: string;
  variant?: "default" | "outline";
}

const OWNER_ACTIONS: QuickAction[] = [
  {
    label: "New Client",
    icon: UserPlus,
    to: "/clients/new",
    description: "Add a client to CRM",
  },
  {
    label: "New Project",
    icon: FolderPlus,
    to: "/projects/new",
    description: "Start a new project",
  },
  {
    label: "Schedule Meeting",
    icon: CalendarPlus,
    to: "/meetings/new",
    description: "Book a meeting",
  },
  {
    label: "Log Issue",
    icon: AlertTriangle,
    to: "/eos/issues",
    description: "Raise an EOS issue",
  },
];

const PM_ACTIONS: QuickAction[] = [
  {
    label: "New Task",
    icon: CheckSquare,
    to: "/tasks/new",
    description: "Create a task",
  },
  {
    label: "Schedule Meeting",
    icon: CalendarPlus,
    to: "/meetings/new",
    description: "Book a meeting",
  },
  {
    label: "Log Note",
    icon: ClipboardList,
    to: "/knowledge",
    description: "Capture a note",
  },
  {
    label: "Team Capacity",
    icon: BarChart3,
    to: "/productivity",
    description: "Review team load",
  },
];

const BD_ACTIONS: QuickAction[] = [
  {
    label: "New Deal",
    icon: Handshake,
    to: "/deals",
    description: "Create a deal",
  },
  {
    label: "New Contact",
    icon: UserPlus,
    to: "/contacts",
    description: "Add a contact",
  },
  {
    label: "Follow-Ups",
    icon: Target,
    to: "/lead-followup",
    description: "Check follow-ups",
  },
  {
    label: "Quick Email",
    icon: Mail,
    to: "/contacts",
    description: "Draft outreach",
  },
];

const IC_ACTIONS: QuickAction[] = [
  {
    label: "New Task",
    icon: CheckSquare,
    to: "/tasks/new",
    description: "Create a task",
  },
  {
    label: "Log Time",
    icon: Clock,
    to: "/productivity",
    description: "Record your hours",
  },
  {
    label: "All My Tasks",
    icon: ClipboardList,
    to: "/tasks",
    description: "View task list",
  },
  {
    label: "Schedule Meeting",
    icon: CalendarPlus,
    to: "/meetings/new",
    description: "Book a meeting",
  },
];

function ActionButton({ action }: { action: QuickAction }) {
  const Icon = action.icon;
  return (
    <Button
      variant="outline"
      size="sm"
      asChild
      className="h-auto flex-col gap-1.5 py-3 hover:bg-muted/50 hover:border-primary/30 transition-colors"
    >
      <Link to={action.to}>
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium leading-tight text-center">{action.label}</span>
      </Link>
    </Button>
  );
}

export function QuickActionsCard() {
  const { agencyRole, isOwner, isPM, isBD } = useAgencyRole();

  const actions = isOwner ? OWNER_ACTIONS : isPM ? PM_ACTIONS : isBD ? BD_ACTIONS : IC_ACTIONS;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4 text-muted-foreground" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("grid gap-2", "grid-cols-4")}>
          {actions.map((action) => (
            <ActionButton key={action.label} action={action} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
