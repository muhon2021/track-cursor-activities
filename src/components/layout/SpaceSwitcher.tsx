import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useSpaceOptional } from "@/contexts/SpaceContext";
import {
  Briefcase,
  BookOpen,
  Settings2,
  Target,
  ChevronsUpDown,
  Check,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const SPACE_ICONS: Record<string, LucideIcon> = {
  Briefcase,
  BookOpen,
  Settings2,
  Target,
};

/** Sidebar dropdown — matches legacy layout (no top-bar tabs). */
export function SpaceSidebarSwitcher() {
  const spaceCtx = useSpaceOptional();
  if (!spaceCtx) return null;

  const { visibleSpaces, currentSpace, setCurrentSpace } = spaceCtx;
  if (visibleSpaces.length <= 1) return null;

  const active = visibleSpaces.find((s) => s.id === currentSpace) ?? visibleSpaces[0];
  const ActiveIcon = SPACE_ICONS[active.icon] ?? Briefcase;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="mt-2 h-8 w-full justify-between gap-2 px-2 text-xs font-medium"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <ActiveIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{active.label} Space</span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {visibleSpaces.map((space) => {
          const Icon = SPACE_ICONS[space.icon] ?? Briefcase;
          const isActive = currentSpace === space.id;
          return (
            <DropdownMenuItem
              key={space.id}
              onClick={() => setCurrentSpace(space.id)}
              className="gap-2"
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{space.label} Space</span>
              {isActive ? <Check className="h-4 w-4 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Mobile: compact space links in user area */
export function SpaceSwitcherLinks() {
  const spaceCtx = useSpaceOptional();
  if (!spaceCtx) return null;

  const { visibleSpaces, currentSpace } = spaceCtx;

  return (
    <>
      {visibleSpaces.map((space) => (
        <Link
          key={space.id}
          to={space.dashboardPath}
          className={cn(
            "text-sm",
            currentSpace === space.id ? "font-medium text-primary" : "text-muted-foreground"
          )}
        >
          {space.label} Space
        </Link>
      ))}
    </>
  );
}
