import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getSpaceFromPath,
  SPACE_REGISTRY,
  type SpaceId,
} from "@/shared/config/spaces";
import { useSpaceAccess } from "@/hooks/useSpaceAccess";
import { useSpacePreferences } from "@/hooks/useSpacePreferences";
import { findNavItemByPath } from "@/shared/data/spaceNavigation";
import { getDashboardForSpace } from "@/lib/space-routes";

interface SpaceContextType {
  currentSpace: SpaceId;
  setCurrentSpace: (spaceId: SpaceId) => void;
  visibleSpaces: ReturnType<typeof useSpaceAccess>["visibleSpaces"];
  isLoading: boolean;
}

const SpaceContext = createContext<SpaceContextType | undefined>(undefined);

export function SpaceProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { visibleSpaces, canAccessSpace, isLoading: accessLoading } = useSpaceAccess();
  const { defaultSpace, setDefaultSpace, trackRecentPage, isLoading: prefsLoading } =
    useSpacePreferences();

  const pathSpace = getSpaceFromPath(location.pathname);
  const [currentSpace, setCurrentSpaceState] = useState<SpaceId>(pathSpace ?? defaultSpace);

  useEffect(() => {
    if (pathSpace) {
      setCurrentSpaceState(pathSpace);
    }
  }, [pathSpace]);

  useEffect(() => {
    if (!pathSpace && !accessLoading && !prefsLoading) {
      const preferred = visibleSpaces.some((s) => s.id === defaultSpace)
        ? defaultSpace
        : visibleSpaces[0]?.id ?? "sales";
      setCurrentSpaceState(preferred);
    }
  }, [pathSpace, defaultSpace, visibleSpaces, accessLoading, prefsLoading]);

  useEffect(() => {
    if (accessLoading || prefsLoading) return;
    if (pathSpace && !canAccessSpace(pathSpace)) {
      const fallback = visibleSpaces[0]?.id ?? "sales";
      navigate(getDashboardForSpace(fallback), { replace: true });
    }
  }, [pathSpace, canAccessSpace, visibleSpaces, accessLoading, prefsLoading, navigate]);

  useEffect(() => {
    const navMatch = findNavItemByPath(location.pathname, location.search);
    if (navMatch && pathSpace) {
      trackRecentPage({
        title: navMatch.title,
        href: `${location.pathname}${location.search}`,
        spaceId: navMatch.spaceId,
      });
    }
  }, [location.pathname, location.search, pathSpace, trackRecentPage]);

  const setCurrentSpace = useCallback(
    (spaceId: SpaceId) => {
      if (!canAccessSpace(spaceId)) return;
      setCurrentSpaceState(spaceId);
      setDefaultSpace(spaceId);
      navigate(SPACE_REGISTRY[spaceId].dashboardPath);
    },
    [canAccessSpace, navigate, setDefaultSpace]
  );

  const value = useMemo(
    () => ({
      currentSpace: pathSpace ?? currentSpace,
      setCurrentSpace,
      visibleSpaces,
      isLoading: accessLoading || prefsLoading,
    }),
    [pathSpace, currentSpace, setCurrentSpace, visibleSpaces, accessLoading, prefsLoading]
  );

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

export function useSpace() {
  const ctx = useContext(SpaceContext);
  if (!ctx) {
    throw new Error("useSpace must be used within SpaceProvider");
  }
  return ctx;
}

/** Safe variant for shared components (e.g. TopNav) that may render outside SpaceProvider */
export function useSpaceOptional() {
  return useContext(SpaceContext);
}
