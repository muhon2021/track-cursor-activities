import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, Shield, Crown, Briefcase, Code } from "lucide-react";

const TEST_ACCOUNTS = [
  { label: "CEO / Owner", email: "ceo@collabai.software", role: "owner", icon: Crown, color: "border-amber-500/30 hover:bg-amber-500/10" },
  { label: "Project Manager", email: "demo@collabai.software", role: "pm", icon: Briefcase, color: "border-blue-500/30 hover:bg-blue-500/10" },
  { label: "IC", email: "ic@collabai.software", role: "ic", icon: Code, color: "border-emerald-500/30 hover:bg-emerald-500/10" },
  { label: "Business Dev", email: "bd@collabai.software", role: "bd", icon: Shield, color: "border-purple-500/30 hover:bg-purple-500/10" },
] as const;

const TEST_PASSWORD = "Demo@123"; // Must match docs/public_website/features.md; ensure demo users exist in Supabase Auth.
const isProduction = typeof window !== "undefined" && window.location.hostname === "spark-start-kit-86.lovable.app";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [quickLoading, setQuickLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { user, signIn, signInWithGoogle, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    setLoading(true);

    try {
      await signIn(email, password);
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Login error:", error);
      setError(error.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Google sign in error:", error);
      setError(error.message || "Failed to sign in with Google");
      setLoading(false);
    }
  };

  const handleQuickLogin = async (acctEmail: string) => {
    setQuickLoading(acctEmail);
    setError("");
    try {
      if (user) await signOut();
      await signIn(acctEmail, TEST_PASSWORD);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Quick login failed");
    } finally {
      setQuickLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-sm">
            <Brain className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Control Tower</h1>
        </div>

        {/* Quick Login — hidden in production */}
        {!isProduction && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">🧪 Quick Login</CardTitle>
              <CardDescription className="text-xs">Switch between test accounts instantly</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 pb-4">
              {TEST_ACCOUNTS.map((acct) => {
                const Icon = acct.icon;
                const isLoading = quickLoading === acct.email;
                return (
                  <button
                    key={acct.email}
                    type="button"
                    onClick={() => handleQuickLogin(acct.email)}
                    disabled={!!quickLoading}
                    className={`relative flex items-center gap-2 rounded-lg border p-3 text-left transition-all ${acct.color} disabled:opacity-50`}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Icon className="h-4 w-4 shrink-0" />}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold truncate">{acct.label}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0">{acct.role}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{acct.email}</p>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        )}

        <Card className="shadow-premium">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold">Welcome back</CardTitle>
            <CardDescription>Sign in to your account to continue</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} className="h-10" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary">Forgot password?</Link>
                </div>
                <Input id="password" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} className="h-10" />
              </div>
            </CardContent>
            <CardFooter className="flex-col space-y-4 pt-2">
              <Button type="submit" className="h-10 w-full font-medium" disabled={loading}>
                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>) : "Sign in"}
              </Button>
              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Or continue with</span></div>
              </div>
              <Button type="button" variant="outline" className="h-10 w-full font-medium" onClick={handleGoogleSignIn} disabled={loading}>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Sign in with Google
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link to="/signup" className="font-medium text-primary hover:underline">Sign up</Link>
              </p>
            </CardFooter>
          </form>
        </Card>

        <p className="text-center text-xs text-muted-foreground">Protected by enterprise-grade security.</p>
      </div>
    </div>
  );
}
