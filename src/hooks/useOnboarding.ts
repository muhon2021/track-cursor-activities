import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      setLoading(true);
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        setLoading(false);
        return;
      }

      setUser(currentUser);

      const { data: progress } = await (supabase as any)
        .from("onboarding_progress")
        .select("completed_at")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (progress?.completed_at) {
        setShowOnboarding(false);
        setLoading(false);
        return;
      }

      const { data: config } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", `user.${currentUser.id}.onboarding_completed`)
        .maybeSingle();

      const hasCompletedOnboarding = config?.value === true;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", currentUser.id)
        .single();

      const hasProfile = profile?.full_name && profile.full_name.trim() !== "";
      setShowOnboarding(!hasCompletedOnboarding || !hasProfile);
    } catch (error) {
      console.error("Error checking onboarding status:", error);
      setShowOnboarding(true);
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = async () => {
    if (!user) return;
    try {
      await (supabase as any).from("onboarding_progress").upsert(
        {
          user_id: user.id,
          current_step: 5,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      await supabase.from("app_config").upsert({
        key: `user.${user.id}.onboarding_completed`,
        value: true,
        category: "user_preferences",
        description: "User onboarding completion status",
      });
      setShowOnboarding(false);
    } catch (error) {
      console.error("Error completing onboarding:", error);
    }
  };

  const skipOnboarding = () => setShowOnboarding(false);

  return {
    showOnboarding,
    loading,
    completeOnboarding,
    skipOnboarding,
    user,
  };
}

/** Returns whether authenticated user should be redirected to /onboarding */
export function useOnboardingRedirect() {
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: progress } = await (supabase as any)
        .from("onboarding_progress")
        .select("completed_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (progress?.completed_at) {
        setNeedsOnboarding(false);
      } else {
        const { data: config } = await supabase
          .from("app_config")
          .select("value")
          .eq("key", `user.${user.id}.onboarding_completed`)
          .maybeSingle();
        setNeedsOnboarding(config?.value !== true);
      }
      setLoading(false);
    };
    check();
  }, []);

  return { needsOnboarding, loading };
}
