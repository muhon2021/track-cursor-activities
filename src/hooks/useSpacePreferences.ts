import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/cache";
import type { SpaceId } from "@/shared/config/spaces";

export interface SpaceFavorite {
  title: string;
  href: string;
  spaceId: SpaceId;
  icon: string;
}

export interface SpaceRecentPage {
  title: string;
  href: string;
  spaceId: SpaceId;
  visitedAt: string;
}

export interface UserSpacePreferences {
  id: string;
  user_id: string;
  default_space: SpaceId;
  favorites: SpaceFavorite[];
  recent_pages: SpaceRecentPage[];
  updated_at: string;
}

const DEFAULT_PREFERENCES: Omit<UserSpacePreferences, "id" | "user_id" | "updated_at"> = {
  default_space: "sales",
  favorites: [],
  recent_pages: [],
};

export function useSpacePreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.spaces.preferences(user?.id ?? ""),
    queryFn: async (): Promise<UserSpacePreferences | null> => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("user_space_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.debug("user_space_preferences unavailable:", error.message);
        return {
          id: "local",
          user_id: user.id,
          updated_at: new Date().toISOString(),
          ...DEFAULT_PREFERENCES,
        };
      }

      if (!data) {
        return {
          id: "local",
          user_id: user.id,
          updated_at: new Date().toISOString(),
          ...DEFAULT_PREFERENCES,
        };
      }

      return {
        id: data.id,
        user_id: data.user_id,
        default_space: data.default_space as SpaceId,
        favorites: (data.favorites as unknown as SpaceFavorite[]) ?? [],
        recent_pages: (data.recent_pages as unknown as SpaceRecentPage[]) ?? [],
        updated_at: data.updated_at,
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const upsertMutation = useMutation({
    mutationFn: async (
      patch: Partial<Pick<UserSpacePreferences, "default_space" | "favorites" | "recent_pages">>
    ) => {
      if (!user) throw new Error("Not authenticated");

      const current = query.data ?? {
        id: "local",
        user_id: user.id,
        updated_at: new Date().toISOString(),
        ...DEFAULT_PREFERENCES,
      };

      const payload = {
        user_id: user.id,
        default_space: patch.default_space ?? current.default_space,
        favorites: patch.favorites ?? current.favorites,
        recent_pages: patch.recent_pages ?? current.recent_pages,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("user_space_preferences")
        .upsert(payload as never, { onConflict: "user_id" })
        .select("*")
        .single();

      if (error) {
        console.debug("Failed to save space preferences:", error.message);
        return { ...current, ...patch, updated_at: payload.updated_at } as UserSpacePreferences;
      }

      return {
        id: data.id,
        user_id: data.user_id,
        default_space: data.default_space as SpaceId,
        favorites: (data.favorites as unknown as SpaceFavorite[]) ?? [],
        recent_pages: (data.recent_pages as unknown as SpaceRecentPage[]) ?? [],
        updated_at: data.updated_at,
      };
    },
    onSuccess: (data) => {
      if (user) {
        queryClient.setQueryData(queryKeys.spaces.preferences(user.id), data);
      }
    },
  });

  const setDefaultSpace = (spaceId: SpaceId) => {
    upsertMutation.mutate({ default_space: spaceId });
  };

  const toggleFavorite = (item: SpaceFavorite) => {
    const current = query.data?.favorites ?? [];
    const exists = current.some((f) => f.href === item.href);
    const favorites = exists
      ? current.filter((f) => f.href !== item.href)
      : [...current, item];
    upsertMutation.mutate({ favorites });
  };

  const isFavorite = (href: string) => {
    return (query.data?.favorites ?? []).some((f) => f.href === href);
  };

  const trackRecentPage = (page: Omit<SpaceRecentPage, "visitedAt">) => {
    const current = query.data?.recent_pages ?? [];
    const filtered = current.filter((p) => p.href !== page.href);
    const recent_pages = [
      { ...page, visitedAt: new Date().toISOString() },
      ...filtered,
    ].slice(0, 8);
    upsertMutation.mutate({ recent_pages });
  };

  return {
    preferences: query.data,
    defaultSpace: query.data?.default_space ?? "sales",
    favorites: query.data?.favorites ?? [],
    recentPages: query.data?.recent_pages ?? [],
    isLoading: query.isLoading,
    setDefaultSpace,
    toggleFavorite,
    isFavorite,
    trackRecentPage,
  };
}
