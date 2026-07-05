import { env } from "@/shared/config/env";

/** Hackathon demo: skip MFA, permissions RPC, and security gates. */
export const isHackathonMode = () => env.hackathonMode;

/** Demo admin credentials (must exist in Supabase Auth). */
export const HACKATHON_DEMO_ADMIN = {
  email: "ceo@collabai.software",
  password: "Demo@123",
} as const;

/** Static admin permissions for hackathon nav / route gates. */
export const HACKATHON_ADMIN_PERMISSIONS = [
  "settings.admin",
  "users.admin",
  "ai.admin",
  "reports.admin",
] as const;

export function hackathonDemoProfile(userId: string, email?: string) {
  return {
    id: userId,
    email: email ?? HACKATHON_DEMO_ADMIN.email,
    full_name: "Demo Admin",
    role: "admin" as const,
    is_active: true,
    agencyRole: "owner" as const,
    isEosUser: false,
  };
}
