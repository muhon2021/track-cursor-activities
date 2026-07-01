import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Brain, Mail } from "lucide-react";
import { checkSignupDomainAllowed } from "@/hooks/useSignupWhitelist";
import { EmailValidationIndicator } from "@/components/auth/EmailValidationIndicator";
import { PasswordStrengthMeter } from "@/components/security/PasswordStrengthMeter";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [emailValid, setEmailValid] = useState(false);
  const [passwordValid, setPasswordValid] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const { signUp, signInWithGoogle, resendVerificationEmail } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setValidationError("");

    if (!emailValid) {
      setError("Please enter a valid email address");
      return;
    }

    if (!passwordValid) {
      setError("Password does not meet security requirements");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    // Validate checkboxes
    if (!termsAccepted || !privacyAccepted) {
      setValidationError("Please accept both Terms and Conditions and Privacy Policy to continue.");
      return;
    }

    setLoading(true);
    try {
      const allowed = await checkSignupDomainAllowed(email);
      if (!allowed) {
        setError("Sign-ups from this email domain are not permitted. Contact your administrator for an invite.");
        return;
      }

      const result = await signUp(email, password, fullName);
      if (result.alreadyRegistered) {
        setError("An account with this email may already exist. Try signing in instead.");
        return;
      }
      if (result.needsEmailConfirmation) {
        setAwaitingVerification(result.email);
        return;
      }
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Signup error:", error);
      setError(error.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    // Validate checkboxes for Google sign in too
    if (!termsAccepted || !privacyAccepted) {
      setValidationError("Please accept both Terms and Conditions and Privacy Policy to continue.");
      return;
    }

    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Google sign in error:", error);
      setError(error.message || "Failed to sign in with Google");
      setLoading(false);
    }
  };

  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const isFormValid =
    termsAccepted &&
    privacyAccepted &&
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8 &&
    passwordsMatch &&
    emailValid &&
    passwordValid;

  const handleResendVerification = async () => {
    if (!awaitingVerification) return;
    setResending(true);
    setError("");
    try {
      await resendVerificationEmail(awaitingVerification);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to resend verification email";
      setError(message);
    } finally {
      setResending(false);
    }
  };

  if (awaitingVerification) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-sm">
              <Brain className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Control Tower</h1>
          </div>

          <Card className="shadow-premium">
            <CardHeader className="space-y-1 pb-4 text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl font-semibold">Check your email</CardTitle>
              <CardDescription>
                We sent a verification link to{" "}
                <span className="font-medium text-foreground">{awaitingVerification}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Click the link in the email to verify your account, then sign in. Check your spam folder if you do not see it within a few minutes.
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full"
                onClick={handleResendVerification}
                disabled={resending}
              >
                {resending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Resend verification email"
                )}
              </Button>
            </CardContent>
            <CardFooter className="flex-col space-y-2 pt-2">
              <p className="text-center text-sm text-muted-foreground">
                Already verified?{" "}
                <Link to="/login" className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-sm">
            <Brain className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Control Tower</h1>
        </div>

        <Card className="shadow-premium">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold">Create an account</CardTitle>
            <CardDescription>
              Enter your details to get started
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              
              {validationError && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                  {validationError}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={loading}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-10"
                />
                <EmailValidationIndicator
                  email={email}
                  onValidationChange={(result) => setEmailValid(result.isValid)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={8}
                  className="h-10"
                />
                <PasswordStrengthMeter
                  password={password}
                  onValidationChange={setPasswordValid}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-10"
                />
                {confirmPassword && !passwordsMatch ? (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                ) : null}
              </div>

              {/* Terms and Privacy Checkboxes */}
              <div className="space-y-3 pt-2">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => {
                      setTermsAccepted(checked === true);
                      setValidationError("");
                    }}
                    disabled={loading}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="terms"
                    className="text-sm font-normal leading-relaxed cursor-pointer"
                  >
                    I agree to the{" "}
                    <Link
                      to="/terms-and-conditions"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline hover:text-primary/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Terms and Conditions
                    </Link>
                  </Label>
                </div>
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="privacy"
                    checked={privacyAccepted}
                    onCheckedChange={(checked) => {
                      setPrivacyAccepted(checked === true);
                      setValidationError("");
                    }}
                    disabled={loading}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="privacy"
                    className="text-sm font-normal leading-relaxed cursor-pointer"
                  >
                    I agree to the{" "}
                    <Link
                      to="/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline hover:text-primary/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Privacy Policy
                    </Link>
                  </Label>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex-col space-y-4 pt-2">
              <Button type="submit" className="h-10 w-full font-medium" disabled={loading || !isFormValid}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full font-medium"
                onClick={handleGoogleSignIn}
                disabled={loading || !isFormValid}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Sign up with Google
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Protected by enterprise-grade security.
        </p>
      </div>
    </div>
  );
}
