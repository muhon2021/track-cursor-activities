/**
 * OAuth Callback Handler
 * Handles redirects from OAuth providers (Google, Microsoft, etc.)
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { logLogin } from "@/lib/activity-logger";

function logOAuthLogin(sessionUser: Session["user"]) {
  const fromIdentity = sessionUser.identities?.[0]?.provider;
  const fromMeta = sessionUser.app_metadata?.provider as string | undefined;
  const provider = fromIdentity || fromMeta || "oauth";
  if (provider === "google") logLogin("google");
  else if (provider === "azure") logLogin("microsoft");
  else logLogin(provider);
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Completing sign in...");

  useEffect(() => {
    const timers: {
      redirect?: ReturnType<typeof setTimeout>;
      wait?: ReturnType<typeof setTimeout>;
    } = {};
    const ctx = { cancelled: false, subscription: null as { unsubscribe: () => void } | null };
    let done = false;

    const clearWaitTimer = () => {
      if (timers.wait) {
        clearTimeout(timers.wait);
        timers.wait = undefined;
      }
    };

    const finishSuccess = (session: Session) => {
      if (done) return;
      done = true;
      ctx.subscription?.unsubscribe();
      clearWaitTimer();
      logOAuthLogin(session.user);
      setStatus("success");
      setMessage("Sign in successful! Redirecting...");
      toast({
        title: "Welcome!",
        description: "You've successfully signed in.",
      });
      timers.redirect = setTimeout(() => navigate("/dashboard"), 1000);
    };

    const finishError = (msg: string, showToast = true) => {
      if (done) return;
      done = true;
      ctx.subscription?.unsubscribe();
      clearWaitTimer();
      setStatus("error");
      setMessage(msg);
      if (showToast) {
        toast({
          title: "Authentication failed",
          description: msg,
          variant: "destructive",
        });
      }
      timers.redirect = setTimeout(() => navigate("/login"), 3000);
    };

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (ctx.cancelled) return;

        if (error) {
          console.error("Auth callback error:", error);
          finishError(error.message || "Authentication failed");
          return;
        }

        if (data.session) {
          finishSuccess(data.session);
          return;
        }

        // PKCE: session may appear shortly after URL is processed
        const {
          data: { subscription: sub },
        } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === "SIGNED_IN" && session) {
            finishSuccess(session);
          }
        });
        ctx.subscription = sub;

        timers.wait = setTimeout(() => {
          if (!done) {
            finishError("No session found. Redirecting to login...", false);
          }
        }, 8000);
      } catch (error: unknown) {
        console.error("Unexpected error in auth callback:", error);
        const msg = error instanceof Error ? error.message : "An unexpected error occurred";
        finishError(msg);
      }
    })();

    return () => {
      ctx.cancelled = true;
      if (timers.redirect) clearTimeout(timers.redirect);
      if (timers.wait) clearTimeout(timers.wait);
      ctx.subscription?.unsubscribe();
    };
  }, [navigate, toast]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <LoadingSpinner />
          <p className={`mt-4 text-center ${
            status === "error" ? "text-destructive" : "text-muted-foreground"
          }`}>
            {message}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
