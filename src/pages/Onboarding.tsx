import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/hooks/useDepartments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  LayoutDashboard,
  Bot,
  BookOpen,
  CheckSquare,
  Plug,
} from "lucide-react";
import { toast } from "sonner";
import { logRbacEvent } from "@/lib/activity-logger";

const STEPS = [
  { id: 1, title: "Welcome" },
  { id: 2, title: "Profile" },
  { id: 3, title: "Tour" },
  { id: 4, title: "Integrations" },
  { id: 5, title: "Finish" },
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Kolkata",
  "UTC",
];

export default function Onboarding() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const { data: departments } = useDepartments();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    job_title: "",
    department_id: "",
    timezone: "UTC",
  });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await (supabase as any)
        .from("onboarding_progress")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.completed_at) {
        navigate("/dashboard", { replace: true });
        return;
      }
      if (data?.current_step) setStep(data.current_step);

      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, metadata")
        .eq("id", user.id)
        .single();

      if (prof) {
        const meta = (prof.metadata as Record<string, string>) || {};
        setProfile({
          full_name: prof.full_name || "",
          job_title: meta.job_title || "",
          department_id: meta.department_id || "",
          timezone: meta.timezone || "UTC",
        });
      }
      setLoading(false);
    };
    load();
  }, [user, navigate]);

  const saveProgress = async (nextStep: number, completed = false) => {
    if (!user) return;
    await (supabase as any).from("onboarding_progress").upsert(
      {
        user_id: user.id,
        current_step: nextStep,
        steps_completed: { [`step_${step}`]: true },
        completed_at: completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  };

  const handleProfileSave = async () => {
    if (!user || !profile.full_name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ full_name: profile.full_name });
      await supabase
        .from("profiles")
        .update({
          metadata: {
            job_title: profile.job_title,
            department_id: profile.department_id,
            timezone: profile.timezone,
          },
        })
        .eq("id", user.id);

      if (profile.department_id) {
        await (supabase as any).from("department_users").upsert(
          { department_id: profile.department_id, user_id: user.id },
          { onConflict: "department_id,user_id" }
        );
      }

      await saveProgress(3);
      setStep(3);
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await saveProgress(5, true);
      await supabase.from("app_config").upsert({
        key: `user.${user.id}.onboarding_completed`,
        value: true,
        category: "user_preferences",
        description: "User onboarding completion status",
      });
      logRbacEvent("onboarding.completed", { user_id: user.id });
      toast.success("Welcome to Control Tower!");
      navigate("/dashboard");
    } catch {
      toast.error("Failed to complete onboarding");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const progress = (step / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <CardTitle>User Onboarding</CardTitle>
            <span className="text-sm text-muted-foreground">
              Step {step} of {STEPS.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          <CardDescription>{STEPS[step - 1]?.title}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 && (
            <div className="text-center py-8 space-y-4">
              <Sparkles className="mx-auto h-12 w-12 text-primary" />
              <h2 className="text-2xl font-bold">Welcome to Control Tower</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Let&apos;s get your profile set up so you can start using the platform.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Job Title</Label>
                <Input
                  value={profile.job_title}
                  onChange={(e) => setProfile({ ...profile, job_title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={profile.department_id}
                  onValueChange={(v) => setProfile({ ...profile, department_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {(departments ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select
                  value={profile.timezone}
                  onValueChange={(v) => setProfile({ ...profile, timezone: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: LayoutDashboard, title: "Dashboard", desc: "Your command center" },
                { icon: Bot, title: "AI Hub", desc: "Agents and assistants" },
                { icon: BookOpen, title: "Knowledge Base", desc: "Search and documents" },
                { icon: CheckSquare, title: "Tasks", desc: "Actions and streams" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="rounded-lg border p-4">
                  <Icon className="h-8 w-8 text-primary mb-2" />
                  <h3 className="font-medium">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Your organization may connect systems like CRM, project tools, and calendars.
              </p>
              {["Salesforce", "HubSpot", "Jira", "Microsoft Teams", "Google Drive"].map((name) => (
                <div key={name} className="flex items-center gap-3 rounded-lg border p-3">
                  <Plug className="h-5 w-5 text-muted-foreground" />
                  <span>{name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">Available via Integrations</span>
                </div>
              ))}
            </div>
          )}

          {step === 5 && (
            <div className="text-center py-8 space-y-4">
              <h2 className="text-2xl font-bold">You&apos;re all set!</h2>
              <p className="text-muted-foreground">
                Head to your dashboard to start working.
              </p>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1 || saving}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {step === 2 ? (
              <Button onClick={handleProfileSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : step === 5 ? (
              <Button onClick={handleFinish} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Go to Dashboard
              </Button>
            ) : (
              <Button
                onClick={async () => {
                  const next = step + 1;
                  await saveProgress(next);
                  setStep(next);
                }}
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
