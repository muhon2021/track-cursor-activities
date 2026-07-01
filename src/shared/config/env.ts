/**
 * Environment Configuration
 *
 * Centralized access to all environment variables.
 * Module toggles can be set via VITE_MODULE_* env vars for build-time control.
 * At runtime, the app_modules database table takes precedence.
 */

export const env = {
  // Supabase (required)
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL as string,
    anonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    projectId: import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined,
  },

  // Microsoft Azure AD (optional)
  microsoft: {
    clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID as string | undefined,
    directoryId: import.meta.env.VITE_MICROSOFT_DIRECTORY_ID as string | undefined,
    redirectUri: import.meta.env.VITE_MICROSOFT_REDIRECT_URI as string | undefined,
    logoutUri: import.meta.env.VITE_MICROSOFT_LOGOUT_URI as string | undefined,
    get isConfigured() {
      return Boolean(this.clientId && this.directoryId);
    },
  },

  // Module toggles (build-time defaults, overridden by app_modules at runtime)
  modules: {
    eos: envBool("VITE_MODULE_EOS", true),
    meetings: envBool("VITE_MODULE_MEETINGS", true),
    projects: envBool("VITE_MODULE_PROJECTS", true),
    actions: envBool("VITE_MODULE_ACTIONS", true),
    businessDev: envBool("VITE_MODULE_BUSINESS_DEV", true),
    knowledge: envBool("VITE_MODULE_KNOWLEDGE", true),
    productivity: envBool("VITE_MODULE_PRODUCTIVITY", true),
    automation: envBool("VITE_MODULE_AUTOMATION", true),
    graphify: envBool("VITE_MODULE_GRAPHIFY", true),
    admin: envBool("VITE_MODULE_ADMIN", true),
  },

  // Runtime info
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  mode: import.meta.env.MODE as string,
} as const;

/**
 * Parse a boolean env var with a default value.
 * Accepts "true", "1", "yes" as truthy; "false", "0", "no" as falsy.
 */
function envBool(key: string, defaultValue: boolean): boolean {
  const val = import.meta.env[key];
  if (val === undefined || val === "") return defaultValue;
  return ["true", "1", "yes"].includes(String(val).toLowerCase());
}
