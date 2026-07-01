import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { User, Session, AuthError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logLogin, logLogout } from "@/lib/activity-logger";
import { recordLoginAttempt } from "@/hooks/useSecurityHardening";

interface Profile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
  is_active?: boolean;
  password_expires_at?: string | null;
  failed_login_count?: number;
  locked_until?: string | null;
  requires_password_change?: boolean;
  // Agency role for dashboard routing (owner | pm | ic)
  agencyRole?: "owner" | "pm" | "ic" | "bd";
  // EOS flag: owner sees EOS-enhanced dashboard when true
  isEosUser?: boolean;
}

export interface SignUpResult {
  needsEmailConfirmation: boolean;
  email: string;
  alreadyRegistered?: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  /** True while fetchProfile (including role resolution) is in flight. */
  profileLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<SignUpResult>;
  resendVerificationEmail: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  signInWithSSO: (provider: 'google' | 'azure', scopes?: string[]) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  /** Re-fetches agency_role + is_eos_user and patches local profile state. */
  refreshAgencyPreferences: () => Promise<void>;
  /** Re-fetches full profile including security hardening fields. */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const { toast } = useToast();

  // Prevents two concurrent fetchProfile calls from racing against each other.
  // The second caller waits for the first to finish rather than starting a
  // parallel query that can return role: undefined and briefly show Access Denied.
  const isFetchingProfileRef = useRef(false);
  const profileUserIdRef = useRef<string | null>(null);

  // Fetch user role from user_roles table (picks highest-privilege role)
  const fetchUserRole = async (userId: string): Promise<string | undefined> => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) {
        console.error("Error fetching user role:", error);
        return undefined;
      }
      if (!data || data.length === 0) return undefined;
      // Prioritize admin > moderator > user
      const roles = data.map((r) => r.role);
      if (roles.includes("admin")) return "admin";
      if (roles.includes("moderator")) return "moderator";
      return roles[0];
    } catch (error) {
      console.error("Error fetching user role:", error);
      return undefined;
    }
  };

  // Fetch agency role preferences from user_role_preferences table
  const fetchAgencyPreferences = async (
    userId: string
  ): Promise<{ agencyRole?: "owner" | "pm" | "ic" | "bd"; isEosUser: boolean }> => {
    try {
      const { data, error } = await (supabase as any)
        .from("user_role_preferences")
        .select("agency_role, is_eos_user")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching agency preferences:", error);
        return { isEosUser: false };
      }

      return {
        agencyRole: (data?.agency_role as "owner" | "pm" | "ic" | "bd" | null) ?? undefined,
        isEosUser: data?.is_eos_user ?? false,
      };
    } catch (error) {
      console.error("Error fetching agency preferences:", error);
      return { isEosUser: false };
    }
  };

  // Fetch or create user profile.
  // Guards against concurrent calls: if a fetch is already in flight for any
  // user, the second caller returns immediately. This prevents the race where
  // two simultaneous fetches (one from onAuthStateChange, one from getSession)
  // can produce a profile with role: undefined on the first call, briefly
  // satisfying (profile !== null) while failing the isAdmin check.
  const fetchProfile = async (userId: string, options?: { silent?: boolean }) => {
    if (isFetchingProfileRef.current) return;
    isFetchingProfileRef.current = true;
    const silent = options?.silent ?? false;
    if (!silent) {
      setProfileLoading(true);
    }
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      // Fetch role and agency preferences in parallel
      const [role, agencyPrefs] = await Promise.all([
        fetchUserRole(userId),
        fetchAgencyPreferences(userId),
      ]);

      if (error) {
        // Profile doesn't exist, create it
        if (error.code === "PGRST116") {
          const user = (await supabase.auth.getUser()).data.user;
          const { data: newProfile, error: createError } = await supabase
            .from("profiles")
            .insert([
              {
                id: userId,
                email: user?.email,
                full_name: user?.user_metadata?.full_name || user?.user_metadata?.name,
                avatar_url: user?.user_metadata?.avatar_url,
              },
            ])
            .select()
            .single();

          if (createError) throw createError;
          const nextProfile = { ...newProfile, role, ...agencyPrefs };
          profileUserIdRef.current = userId;
          setProfile(nextProfile);
        } else {
          throw error;
        }
      } else {
        const nextProfile = { ...data, role, ...agencyPrefs };
        profileUserIdRef.current = userId;
        setProfile(nextProfile);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      isFetchingProfileRef.current = false;
      setProfileLoading(false);
    }
  };

  // Initialize auth state
  useEffect(() => {
    // Set up auth state listener FIRST.
    // IMPORTANT: setLoading(false) must NOT be called synchronously here when a
    // user session exists. If we call it before fetchProfile resolves, the
    // AdminRoute briefly sees (loading=false, user≠null, profile≠null but
    // role=undefined) and flashes "Access Denied".  Instead we await fetchProfile
    // inside the deferred setTimeout callback before clearing the loading flag.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Only synchronous state updates here to avoid Supabase client deadlock
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Token refresh on tab focus must not re-block the UI or remount routes.
        if (event === "TOKEN_REFRESHED") {
          return;
        }

        const sameUser = profileUserIdRef.current === session.user.id;

        // Defer Supabase calls with setTimeout to prevent deadlock.
        // setLoading(false) is intentionally moved INSIDE this async callback so
        // it fires only after fetchProfile (and thus role resolution) completes.
        setTimeout(async () => {
          await fetchProfile(session.user.id, { silent: sameUser });
          setLoading(false);
        }, 0);
      } else {
        profileUserIdRef.current = null;
        setProfile(null);
        setLoading(false);
      }
    });

    // Belt-and-suspenders: also check getSession() in case the INITIAL_SESSION
    // event from onAuthStateChange has not yet fired (rare edge-case).
    // fetchProfile is deduplicated by isFetchingProfileRef so it will only run
    // once regardless of how many times it is called.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sign in with email/password
  const signIn = async (email: string, password: string) => {
    try {
      const { data: isLocked, error: lockError } = await supabase.rpc("is_account_locked", {
        p_email: email,
      });

      if (!lockError && isLocked) {
        throw {
          message: "Account is temporarily locked due to too many failed login attempts.",
        } as AuthError;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        void recordLoginAttempt(email, false);
        throw error;
      }

      void recordLoginAttempt(email, true);

      // Log login activity
      logLogin("email");

      toast({
        title: "Welcome back!",
        description: "You've successfully signed in.",
      });
    } catch (error) {
      const authError = error as AuthError;
      toast({
        title: "Sign in failed",
        description: authError.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const authRedirectUrl = () => `${window.location.origin}/auth/callback`;

  // Sign up with email/password
  const signUp = async (email: string, password: string, fullName?: string): Promise<SignUpResult> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: authRedirectUrl(),
          data: {
            full_name: fullName,
          },
        },
      });
      if (error) throw error;

      const alreadyRegistered =
        !!data.user && (!data.user.identities || data.user.identities.length === 0);
      const needsEmailConfirmation = !data.session && !!data.user && !alreadyRegistered;

      if (alreadyRegistered) {
        toast({
          title: "Account may already exist",
          description: "Try signing in or use password reset if you forgot your password.",
          variant: "destructive",
        });
        return { needsEmailConfirmation: false, email, alreadyRegistered: true };
      }

      if (needsEmailConfirmation) {
        toast({
          title: "Account created!",
          description: "Check your email for a verification link.",
        });
      } else {
        toast({
          title: "Account created!",
          description: "You're signed in and ready to go.",
        });
      }

      return { needsEmailConfirmation, email };
    } catch (error) {
      const authError = error as AuthError;
      toast({
        title: "Sign up failed",
        description: authError.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const resendVerificationEmail = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: authRedirectUrl(),
      },
    });
    if (error) throw error;
    toast({
      title: "Verification email sent",
      description: "Check your inbox and spam folder for the confirmation link.",
    });
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error) {
      const authError = error as AuthError;
      toast({
        title: "Google sign in failed",
        description: authError.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  // Sign in with Microsoft (Azure AD) - MSAL-based with new window flow
  const signInWithMicrosoft = async () => {
    try {
      // Try MSAL-based login first if configured
      const msalConfig = await import('@/lib/msalConfig');
      const azureAuth = await import('@/lib/azureAuth');
      
      const configValidation = msalConfig.validateMSALConfig();
      if (configValidation.valid) {
        // Check if we have a stored response from previous auth
        const storedResponse = azureAuth.getStoredMSALResponse();
        if (storedResponse && storedResponse.accessToken) {
          // Complete login with stored response
          const result = await azureAuth.completeAzureLoginFromRedirect();
          if (result?.user) {
            toast({
              title: "Welcome!",
              description: "You've successfully signed in with Microsoft.",
            });
            logLogin("microsoft");
            return;
          }
        }
        
        // Initiate window-based auth flow (works in iframes)
        const authResult = await azureAuth.initiateAzureLoginRedirect();
        if (authResult) {
          // Complete login with the result
          const result = await azureAuth.completeAzureLoginFromRedirect();
          if (result?.user) {
            toast({
              title: "Welcome!",
              description: "You've successfully signed in with Microsoft.",
            });
            logLogin("microsoft");
            return;
          }
        }
        return;
      }
      
      // Fallback to Supabase OAuth if MSAL not configured
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "email profile openid User.Read",
        },
      });
      if (error) throw error;
      
      // Log login activity
      logLogin("microsoft");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const authError = error as AuthError;
      const isCancelled = authError?.message === "Authentication window was closed";
      toast({
        title: isCancelled ? "Sign-in cancelled" : "Microsoft sign in failed",
        description: isCancelled ? "You closed the sign-in window. Try again when you're ready." : authError.message,
        variant: isCancelled ? "default" : "destructive",
      });
      throw error;
    }
  };

  // Generic SSO sign in
  const signInWithSSO = async (provider: 'google' | 'azure', scopes?: string[]) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: scopes?.join(' '),
        },
      });
      if (error) throw error;

      // Log SSO login
      logLogin(provider === 'azure' ? 'microsoft' : provider);
    } catch (error) {
      const authError = error as AuthError;
      toast({
        title: "SSO sign in failed",
        description: authError.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      // Log logout activity before signing out
      logLogout();
      
      // Check if user is Azure AD user
      const isAzureADUser = localStorage.getItem('isAzureADUser') === 'true';
      
      // Call backend logout endpoint if Azure AD user
      if (isAzureADUser) {
        try {
          const { data: logoutData } = await supabase.functions.invoke('azure-auth-logout', {
            body: {
              isAzureAD: true,
            },
          });
          
          // If logout URL is provided, redirect to Microsoft logout
          if (logoutData?.logoutUrl) {
            // Clear local storage first
            localStorage.clear();
            sessionStorage.clear();
            
            // Redirect to Microsoft logout
            window.location.href = logoutData.logoutUrl;
            return;
          }
        } catch (error) {
          console.error('Error calling logout endpoint:', error);
          // Continue with regular logout
        }
      }
      
      // Clear MSAL cache if Azure AD user
      if (isAzureADUser) {
        try {
          const msalConfig = await import('@/lib/msalConfig');
          const msalInstance = await msalConfig.getMSALInstance();
          await msalInstance.logoutPopup();
        } catch (error) {
          console.error('Error logging out from MSAL:', error);
          // Continue with regular logout
        }
      }
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      toast({
        title: "Signed out",
        description: "You've been successfully signed out.",
      });
    } catch (error) {
      const authError = error as AuthError;
      console.error("Sign out error:", authError);
      toast({
        title: "Sign out failed",
        description: authError.message,
        variant: "destructive",
      });
    } finally {
      // Always clear client auth state and storage so login never shows a stale session.
      setUser(null);
      setProfile(null);
      setSession(null);
      setLoading(false);
      setProfileLoading(false);
      isFetchingProfileRef.current = false;
      profileUserIdRef.current = null;
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (storageError) {
        console.error("Error clearing storage on sign out:", storageError);
      }
    }
  };

  // Update profile
  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update(updates as any)
        .eq("id", user.id);

      if (error) throw error;

      setProfile((prev) => (prev ? { ...prev, ...updates } : null));
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Update failed",
        description: "Failed to update profile.",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Re-fetch agency preferences and patch profile state in place.
  // Called after role assignment so the dashboard re-routes without a full reload.
  const refreshAgencyPreferences = async () => {
    if (!user) return;
    const prefs = await fetchAgencyPreferences(user.id);
    setProfile((prev) => (prev ? { ...prev, ...prefs } : null));
  };

  const refreshProfile = async () => {
    if (!user) return;
    await fetchProfile(user.id, { silent: true });
  };

  const value = {
    user,
    profile,
    session,
    loading,
    profileLoading,
    signIn,
    signUp,
    resendVerificationEmail,
    signInWithGoogle,
    signInWithMicrosoft,
    signInWithSSO,
    signOut,
    updateProfile,
    refreshAgencyPreferences,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
