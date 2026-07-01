import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useSpace } from "@/contexts/SpaceContext";
import { SPACE_REGISTRY } from "@/shared/config/spaces";
import { findNavItemByPath } from "@/shared/data/spaceNavigation";

export function useSpaceBreadcrumbs() {
  const location = useLocation();
  const { currentSpace } = useSpace();

  return useMemo(() => {
    const spaceDef = SPACE_REGISTRY[currentSpace];
    const match = findNavItemByPath(location.pathname, location.search);

    return {
      spaceLabel: `${spaceDef.label} Space`,
      spacePath: spaceDef.dashboardPath,
      pageTitle: match?.title ?? "Page",
    };
  }, [currentSpace, location.pathname, location.search]);
}
