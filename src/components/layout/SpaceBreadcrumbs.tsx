import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useSpaceBreadcrumbs } from "@/hooks/useSpaceBreadcrumbs";
import { getSpaceFromPath } from "@/shared/config/spaces";
import { useLocation } from "react-router-dom";

const GLOBAL_PATHS = ["/profile", "/settings", "/help", "/onboarding", "/sessions"];

export function SpaceBreadcrumbs() {
  const location = useLocation();
  const { spaceLabel, spacePath, pageTitle } = useSpaceBreadcrumbs();
  const inSpace = getSpaceFromPath(location.pathname) !== null;
  const isGlobal = GLOBAL_PATHS.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + "/")
  );

  if (!inSpace || isGlobal) return null;

  return (
    <div className="border-b border-border bg-background/80 px-4 py-2 lg:px-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={spacePath}>{spaceLabel}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
