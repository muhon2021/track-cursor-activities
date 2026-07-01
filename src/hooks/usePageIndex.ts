import { useMemo } from "react";
import { flattenSpaceNav } from "@/shared/data/spaceNavigation";
import { SPACE_REGISTRY, type SpaceId } from "@/shared/config/spaces";
import { useSpaceAccess } from "@/hooks/useSpaceAccess";

export interface PageSearchResult {
  title: string;
  href: string;
  spaceId: SpaceId;
  spaceLabel: string;
  breadcrumb: string;
}

export function usePageIndex(): PageSearchResult[] {
  const { visibleSpaces, isNavItemVisible } = useSpaceAccess();
  const visibleIds = new Set(visibleSpaces.map((s) => s.id));

  return useMemo(() => {
    const items = flattenSpaceNav().filter(
      (item) => visibleIds.has(item.spaceId) && isNavItemVisible(item)
    );

    return items.map((item) => ({
      title: item.title,
      href: item.href,
      spaceId: item.spaceId,
      spaceLabel: SPACE_REGISTRY[item.spaceId].label,
      breadcrumb: `${SPACE_REGISTRY[item.spaceId].label} Space > ${item.title}`,
    }));
  }, [visibleIds, isNavItemVisible]);
}

export function searchPageIndex(
  pages: PageSearchResult[],
  query: string
): PageSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return pages.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.breadcrumb.toLowerCase().includes(q) ||
      p.spaceLabel.toLowerCase().includes(q)
  );
}
