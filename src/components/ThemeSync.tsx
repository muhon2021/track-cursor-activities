import { useEffect } from "react";
import { useTheme } from "next-themes";
import { usePreferences } from "@/hooks/usePreferences";

/**
 * Applies the user's saved theme from preferences as soon as they are loaded.
 * This ensures dark/light mode persists across logout and login without
 * requiring the user to open the Settings page.
 */
export function ThemeSync() {
  const { data: preferences } = usePreferences();
  const { setTheme } = useTheme();

  useEffect(() => {
    if (!preferences?.appearance?.theme) return;

    const saved = preferences.appearance.theme;
    // next-themes supports "system"; when enableSystem is true it uses OS preference
    const themeToApply = saved === "system" ? "system" : saved;
    setTheme(themeToApply);
  }, [preferences?.appearance?.theme, setTheme]);

  return null;
}
