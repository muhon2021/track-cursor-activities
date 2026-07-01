import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { OKR } from "@/modules/eos/types";

/**
 * Permission helper for OKR actions.
 * Company/team OKRs: only admin can edit/delete/duplicate/close.
 * Personal OKRs: owner or admin.
 */
export function useOKRPermissions(okr: OKR | null) {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  return useMemo(() => {
    if (!okr || !user) {
      return {
        canEdit: false,
        canDelete: false,
        canDuplicate: false,
        canClose: false,
        canUpdate: false,
      };
    }

    const type = okr.okr_type || "personal";
    const isOwner = okr.owner_id === user.id || okr.created_by === user.id;

    if (type === "company" || type === "team") {
      return {
        canEdit: isAdmin,
        canDelete: isAdmin,
        canDuplicate: isAdmin,
        canClose: isAdmin,
        canUpdate: isAdmin,
      };
    }

    const canManage = isAdmin || isOwner;
    return {
      canEdit: canManage,
      canDelete: canManage,
      canDuplicate: canManage,
      canClose: canManage,
      canUpdate: canManage,
    };
  }, [okr, user, isAdmin]);
}
