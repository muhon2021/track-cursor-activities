import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type ActivityAction =
  | "login"
  | "logout"
  | "create"
  | "update"
  | "delete"
  | "view"
  | "access"
  | "role.created"
  | "role.updated"
  | "role.deleted"
  | "permission.changed"
  | "invite.sent"
  | "invite.resent"
  | "invite.accepted"
  | "invite.cancelled"
  | "invitation.revoked"
  | "user.role_assigned"
  | "user.role_changed"
  | "user.department_changed"
  | "user.suspended"
  | "user.reactivated"
  | "user.removed"
  | "department.created"
  | "department.updated"
  | "department.deleted"
  | "onboarding.completed";

export type ResourceType =
  | "client"
  | "meeting"
  | "knowledge"
  | "task"
  | "user"
  | "ai_chat"
  | "settings"
  | "role"
  | "user_invite"
  | "department"
  | null;

interface LogActivityParams {
  action: ActivityAction;
  resourceType?: ResourceType;
  resourceId?: string;
  details?: Record<string, Json>;
}

/**
 * Log user activity to the activity_logs table
 * This is a fire-and-forget operation - errors are logged but don't throw
 */
export async function logActivity({
  action,
  resourceType = null,
  resourceId,
  details = {},
}: LogActivityParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn("Cannot log activity: No authenticated user");
      return;
    }

    const { error } = await supabase
      .from("activity_logs")
      .insert([{
        user_id: user.id,
        action,
        resource_type: resourceType,
        resource_id: resourceId || null,
        details,
      }]);

    if (error) {
      // Log error but don't throw - activity logging should not break app functionality
      console.error("Failed to log activity:", error.message);
    }
  } catch (error) {
    console.error("Activity logging error:", error);
  }
}

/**
 * Helper to log login activity
 */
export function logLogin(method: string = "email"): void {
  logActivity({
    action: "login",
    details: { method },
  });
}

/**
 * Helper to log logout activity
 */
export function logLogout(): void {
  logActivity({
    action: "logout",
  });
}

/**
 * Helper to log CRUD operations
 */
export function logCrud(
  action: "create" | "update" | "delete",
  resourceType: ResourceType,
  resourceId: string,
  details?: Record<string, Json>
): void {
  logActivity({
    action,
    resourceType,
    resourceId,
    details,
  });
}

/** Log RBAC and onboarding audit events */
export function logRbacEvent(
  action: ActivityAction,
  details?: Record<string, Json>,
  resourceType: ResourceType = null,
  resourceId?: string
): void {
  logActivity({
    action,
    resourceType,
    resourceId,
    details,
  });
}
