import { useAuth } from "@/contexts/AuthContext";

export type AgencyRole = "owner" | "pm" | "ic" | "bd";

/**
 * Returns the current user's agency role and EOS flag.
 *
 * Agency roles (owner / pm / ic / bd) are separate from the DB auth roles
 * (admin / moderator / user) and are stored in user_role_preferences.
 *
 * - agencyRole: undefined means no preference row exists → defaults to IC view
 * - isEosUser: controls whether Owner gets the EOS-enhanced dashboard
 * - isAdmin: true for admin/moderator DB roles (existing behaviour)
 */
export function useAgencyRole() {
  const { profile } = useAuth();

  const agencyRole = profile?.agencyRole ?? null;
  const isEosUser = profile?.isEosUser ?? false;
  const isAdmin = profile?.role === "admin" || profile?.role === "moderator";

  return {
    agencyRole,
    isEosUser,
    isAdmin,
    isOwner: agencyRole === "owner",
    isPM: agencyRole === "pm",
    isIC: agencyRole === "ic" || agencyRole === null,
    isBD: agencyRole === "bd",
  };
}
