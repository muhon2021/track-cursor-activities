import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  User,
  Building2,
  Rocket,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface OnboardingData {
  fullName: string;
  company: string;
  role: string;
  bio: string;
  goals: string;
}

const STEPS = [
  {
    id: 1,
    title: "Welcome to Control Tower",
    description: "Let's get you set up in just a few steps",
    icon: Sparkles,
  },
  {
    id: 2,
    title: "Tell us about yourself",
    description: "Help us personalize your experience",
    icon: User,
  },
  {
    id: 3,
    title: "Your organization",
    description: "Set up your workspace details",
    icon: Building2,
  },
  {
    id: 4,
    title: "You're all set!",
    description: "Start collaborating with AI",
    icon: Rocket,
  },
];

export default function OnboardingWizard({
  open,
  onClose,
  onComplete,
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    fullName: "",
    company: "",
    role: "",
    bio: "",
    goals: "",
  });

  const progress = (currentStep / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("No user found");
      }

      // Update user profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: data.fullName,
          metadata: {
            company: data.company,
            role: data.role,
            bio: data.bio,
          },
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Save onboarding completion status
      const { error: configError } = await supabase.from("app_config").upsert({
        key: `user.${user.id}.onboarding_completed`,
        value: true,
        category: "user_preferences",
        description: "User onboarding completion status",
      });

      if (configError) throw configError;

      // Log the activity
      await supabase.functions.invoke("log-activity", {
        body: {
          user_id: user.id,
          action: "onboarding.completed",
          details: {
            completed_at: new Date().toISOString(),
          },
        },
      });

      toast.success("Welcome aboard! Your profile has been set up.");
      onComplete();
    } catch (error: any) {
      console.error("Onboarding error:", error);
      toast.error("Failed to complete onboarding");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    toast.info("You can complete your profile later in Settings");
    onComplete();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6 py-8">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-6">
                <Sparkles className="h-12 w-12 text-primary" />
              </div>
            </div>
            <div className="text-center space-y-3">
              <h3 className="text-2xl font-bold">Welcome to Control Tower!</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                We're excited to have you here. Let's take a moment to set up your
                profile and get you started with AI-powered collaboration.
              </p>
            </div>
            <div className="space-y-3 pt-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">AI-Powered Chat</p>
                  <p className="text-sm text-muted-foreground">
                    Get instant answers and assistance
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Knowledge Base</p>
                  <p className="text-sm text-muted-foreground">
                    Store and search your documents
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Smart Meetings</p>
                  <p className="text-sm text-muted-foreground">
                    Track and analyze your meetings
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 py-4">
            <div className="flex justify-center">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {data.fullName
                    ? data.fullName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                    : "?"}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  value={data.fullName}
                  onChange={(e) => setData({ ...data, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Your Role</Label>
                <Input
                  id="role"
                  placeholder="Product Manager, Developer, etc."
                  value={data.role}
                  onChange={(e) => setData({ ...data, role: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio (Optional)</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell us a bit about yourself..."
                  value={data.bio}
                  onChange={(e) => setData({ ...data, bio: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 py-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-6">
                <Building2 className="h-12 w-12 text-primary" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company">Company Name</Label>
                <Input
                  id="company"
                  placeholder="Acme Corp"
                  value={data.company}
                  onChange={(e) => setData({ ...data, company: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goals">What are your goals? (Optional)</Label>
                <Textarea
                  id="goals"
                  placeholder="What do you want to achieve with Control Tower?"
                  value={data.goals}
                  onChange={(e) => setData({ ...data, goals: e.target.value })}
                  rows={4}
                />
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6 py-8">
            <div className="flex justify-center">
              <div className="rounded-full bg-green-500/10 p-6">
                <Rocket className="h-12 w-12 text-green-500" />
              </div>
            </div>
            <div className="text-center space-y-3">
              <h3 className="text-2xl font-bold">You're all set!</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Your profile has been created. You can now start exploring all the
                features Control Tower has to offer.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="font-medium">Next steps:</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Explore the dashboard and familiarize yourself with the interface</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Try the AI chat to see how it can help you</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Upload documents to your knowledge base</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Set up integrations in Settings (optional)</span>
                </li>
              </ul>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    if (currentStep === 2) {
      return data.fullName.trim() !== "";
    }
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <DialogTitle className="text-xl">
              {STEPS[currentStep - 1].title}
            </DialogTitle>
            <span className="text-sm text-muted-foreground">
              Step {currentStep} of {STEPS.length}
            </span>
          </div>
          <DialogDescription>{STEPS[currentStep - 1].description}</DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <Progress value={progress} className="h-2" />

        {/* Step Content */}
        <div className="min-h-[300px]">{renderStepContent()}</div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div>
            {currentStep > 1 && currentStep < STEPS.length && (
              <Button variant="ghost" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {currentStep < STEPS.length && (
              <Button variant="outline" onClick={handleSkip}>
                Skip for now
              </Button>
            )}
            {currentStep < STEPS.length - 1 && (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            {currentStep === STEPS.length - 1 && (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            {currentStep === STEPS.length && (
              <Button onClick={handleComplete} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    Get Started
                    <Rocket className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
