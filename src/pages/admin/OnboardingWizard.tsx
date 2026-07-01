/**
 * Onboarding Wizard - New Client Setup
 * Step-by-step wizard for configuring a new deployment
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Building2,
  Palette,
  Settings,
  Sparkles,
  Rocket,
  Users,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useEffect } from 'react';

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'organization',
    title: 'Company Information',
    description: 'Configure your organization name and basic settings',
    icon: Building2,
  },
  {
    id: 'branding',
    title: 'Branding',
    description: 'Customize your platform appearance',
    icon: Palette,
  },
  {
    id: 'invitations',
    title: 'User Invitations',
    description: 'Invite your team members',
    icon: Users,
  },
  {
    id: 'departments',
    title: 'Department Setup',
    description: 'Organize teams and departments',
    icon: Building2,
  },
  {
    id: 'integrations',
    title: 'Integrations',
    description: 'Connect external systems',
    icon: Settings,
  },
  {
    id: 'knowledge',
    title: 'Knowledge Sources',
    description: 'Configure knowledge base sources',
    icon: Sparkles,
  },
  {
    id: 'ai-setup',
    title: 'AI Setup',
    description: 'Enable AI features and agents',
    icon: Sparkles,
  },
  {
    id: 'complete',
    title: 'Go Live',
    description: 'Review and finish setup',
    icon: Rocket,
  },
];

interface OnboardingData {
  // Organization
  organizationName: string;
  adminEmail: string;
  // Branding
  platformName: string;
  primaryColor: string;
  logoUrl: string;
  // Features
  enableAIChat: boolean;
  enableKnowledgeBase: boolean;
  enableMeetings: boolean;
  enableTasks: boolean;
  enableAIAgents: boolean;
  // Data seeding
  seedAIAgents: boolean;
  seedKnowledgeCategories: boolean;
  seedSampleData: boolean;
}

const defaultData: OnboardingData = {
  organizationName: '',
  adminEmail: '',
  platformName: 'Control Tower',
  primaryColor: '#3b82f6',
  logoUrl: '',
  enableAIChat: true,
  enableKnowledgeBase: true,
  enableMeetings: true,
  enableTasks: true,
  enableAIAgents: true,
  seedAIAgents: true,
  seedKnowledgeCategories: true,
  seedSampleData: false,
};

// Admin User Check Component
function AdminUserCheck() {
  const [adminCount, setAdminCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminUsers();
  }, []);

  const checkAdminUsers = async () => {
    try {
      setLoading(true);
      const { count, error } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');

      if (error) throw error;
      setAdminCount(count ?? 0);
    } catch (error) {
      console.error('Error checking admin users:', error);
      setAdminCount(0);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <ShieldCheck className="h-16 w-16 text-primary mx-auto mb-3" />
        <h3 className="text-lg font-semibold">Admin User Verification</h3>
        <p className="text-muted-foreground mt-1">
          Ensure at least one admin user exists for platform management
        </p>
      </div>

      {adminCount === 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-2">No Admin Users Found</p>
            <p className="text-sm">
              You need at least one admin user to manage this platform. Please:
            </p>
            <ol className="list-decimal list-inside text-sm mt-2 space-y-1">
              <li>Navigate to User Management after setup</li>
              <li>Promote a user to admin role</li>
              <li>Or follow the ADMIN-SETUP-GUIDE.md documentation</li>
            </ol>
          </AlertDescription>
        </Alert>
      )}

      {adminCount && adminCount > 0 && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-success" />
          <AlertDescription>
            <p className="font-medium text-success">Admin Users Configured ✓</p>
            <p className="text-sm mt-1">
              {adminCount} admin user(s) found. Your platform is ready for management.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <div className="border rounded-lg p-4 bg-muted/50">
        <h4 className="font-medium mb-2">Quick Actions</h4>
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            onClick={() => window.open('/admin/users', '_blank')}
            className="justify-start"
          >
            Open User Management
          </Button>
          <Button
            variant="ghost"
            onClick={() => window.open('/docs/ADMIN-SETUP-GUIDE.md', '_blank')}
            className="justify-start text-sm"
          >
            View Admin Setup Guide
          </Button>
        </div>
      </div>

      <Alert>
        <AlertDescription className="text-sm">
          <p className="font-medium mb-1">What are admin users?</p>
          <p>
            Admin users have full access to the admin panel at <code>/admin</code> and can:
          </p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Manage other users and roles</li>
            <li>Configure system settings</li>
            <li>View analytics and reports</li>
            <li>Manage integrations</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(defaultData);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;

  const updateData = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  // Save configuration mutation
  const saveConfig = useMutation({
    mutationFn: async () => {
      // Save organization settings
      const configs = [
        { key: 'branding.platformName', value: data.platformName, category: 'branding' },
        { key: 'branding.primaryColor', value: data.primaryColor, category: 'branding' },
        { key: 'branding.logoUrl', value: data.logoUrl, category: 'branding' },
        { key: 'organization.name', value: data.organizationName, category: 'organization' },
        { key: 'organization.adminEmail', value: data.adminEmail, category: 'organization' },
        { key: 'features.enableAIChat', value: data.enableAIChat, category: 'features' },
        { key: 'features.enableKnowledgeBase', value: data.enableKnowledgeBase, category: 'features' },
        { key: 'features.enableMeetings', value: data.enableMeetings, category: 'features' },
        { key: 'features.enableTasks', value: data.enableTasks, category: 'features' },
        { key: 'features.enableAIAgents', value: data.enableAIAgents, category: 'features' },
        { key: 'system.onboardingCompleted', value: true, category: 'system' },
        { key: 'system.onboardingCompletedAt', value: new Date().toISOString(), category: 'system' },
      ];

      for (const config of configs) {
        const { error } = await supabase
          .from('app_config')
          .upsert({ ...config, updated_at: new Date().toISOString() }, { onConflict: 'key' });

        if (error) throw error;
      }

      // Seed template data if requested
      if (data.seedAIAgents || data.seedKnowledgeCategories || data.seedSampleData) {
        const { error } = await supabase.functions.invoke('seed-template-data', {
          body: {
            options: {
              seedAIAgents: data.seedAIAgents,
              seedKnowledgeCategories: data.seedKnowledgeCategories,
              seedSampleData: data.seedSampleData,
            },
          },
        });

        if (error) throw error;
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-config'] });
      toast.success('Setup completed successfully!');
    },
    onError: (error: Error) => {
      toast.error(`Setup failed: ${error.message}`);
    },
  });

  const goNext = () => {
    const currentStepId = WIZARD_STEPS[currentStep].id;
    if (!completedSteps.includes(currentStepId)) {
      setCompletedSteps((prev) => [...prev, currentStepId]);
    }

    const percent = Math.round(((currentStep + 1) / WIZARD_STEPS.length) * 100);
    supabase.from('app_config').upsert({
      key: 'tenant.onboarding_progress',
      value: { steps: completedSteps, currentStep: currentStepId, percent },
      category: 'system',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

    if (currentStep === WIZARD_STEPS.length - 2) {
      saveConfig.mutate();
    }

    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const canProceed = () => {
    switch (WIZARD_STEPS[currentStep].id) {
      case 'organization':
        return data.organizationName.trim().length > 0;
      case 'branding':
        return data.platformName.trim().length > 0;
      default:
        return true;
    }
  };

  const renderStepContent = () => {
    switch (WIZARD_STEPS[currentStep].id) {
      case 'organization':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name *</Label>
              <Input
                id="orgName"
                placeholder="e.g., Acme Corporation"
                value={data.organizationName}
                onChange={(e) => updateData({ organizationName: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                This will be displayed in the admin panel and reports
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminEmail">Admin Email</Label>
              <Input
                id="adminEmail"
                type="email"
                placeholder="admin@yourcompany.com"
                value={data.adminEmail}
                onChange={(e) => updateData({ adminEmail: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                System notifications will be sent to this address
              </p>
            </div>
          </div>
        );

      case 'branding':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="platformName">Platform Name *</Label>
              <Input
                id="platformName"
                placeholder="e.g., Control Tower"
                value={data.platformName}
                onChange={(e) => updateData({ platformName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primaryColor"
                  type="color"
                  value={data.primaryColor}
                  onChange={(e) => updateData({ primaryColor: e.target.value })}
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={data.primaryColor}
                  onChange={(e) => updateData({ primaryColor: e.target.value })}
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL (optional)</Label>
              <Input
                id="logoUrl"
                placeholder="https://yourcompany.com/logo.png"
                value={data.logoUrl}
                onChange={(e) => updateData({ logoUrl: e.target.value })}
              />
            </div>
          </div>
        );

      case 'invitations':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Invite team members with roles and department assignments.
            </p>
            <Button variant="outline" onClick={() => navigate('/admin/users/invitations')}>
              Open Invitations
            </Button>
          </div>
        );

      case 'departments':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Set up departments and assign users to teams.
            </p>
            <Button variant="outline" onClick={() => navigate('/admin/departments')}>
              Manage Departments
            </Button>
          </div>
        );

      case 'integrations':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect CRM, calendar, and collaboration tools.
            </p>
            <Button variant="outline" onClick={() => navigate('/admin/integrations')}>
              Configure Integrations
            </Button>
          </div>
        );

      case 'knowledge':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure knowledge sources and categories.
            </p>
            <Button variant="outline" onClick={() => navigate('/admin/integrations')}>
              Knowledge Sources
            </Button>
          </div>
        );

      case 'ai-setup':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              Enable AI features for your organization.
            </p>
            {[
              { key: 'enableAIChat', label: 'AI Chat Assistant' },
              { key: 'enableAIAgents', label: 'AI Agents' },
              { key: 'enableKnowledgeBase', label: 'Knowledge Base' },
            ].map((feature) => (
              <div key={feature.key} className="flex items-center justify-between p-4 border rounded-lg">
                <p className="font-medium">{feature.label}</p>
                <Switch
                  checked={data[feature.key as keyof OnboardingData] as boolean}
                  onCheckedChange={(checked) =>
                    updateData({ [feature.key]: checked } as Partial<OnboardingData>)
                  }
                />
              </div>
            ))}
          </div>
        );

      case 'features':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              Enable or disable features based on your needs. You can change these later.
            </p>
            {[
              { key: 'enableAIChat', label: 'AI Chat Assistant', description: 'Chat with AI for quick answers' },
              { key: 'enableKnowledgeBase', label: 'Knowledge Base', description: 'Document storage and search' },
              { key: 'enableMeetings', label: 'Meetings', description: 'Meeting scheduling and transcripts' },
              { key: 'enableTasks', label: 'Task Management', description: 'Track and assign tasks' },
              { key: 'enableAIAgents', label: 'AI Agents', description: 'Automated AI workflows' },
            ].map((feature) => (
              <div key={feature.key} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{feature.label}</p>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
                <Switch
                  checked={data[feature.key as keyof OnboardingData] as boolean}
                  onCheckedChange={(checked) => updateData({ [feature.key]: checked })}
                />
              </div>
            ))}
          </div>
        );

      case 'data':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              Optionally seed the platform with template data to get started quickly.
            </p>
            {[
              { key: 'seedAIAgents', label: 'AI Agent Templates', description: 'Pre-configured AI agents for common tasks' },
              { key: 'seedKnowledgeCategories', label: 'Knowledge Categories', description: 'Default categories for organizing content' },
              { key: 'seedSampleData', label: 'Sample Data', description: 'Demo client and example content (for testing)' },
            ].map((option) => (
              <div key={option.key} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{option.label}</p>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
                <Switch
                  checked={data[option.key as keyof OnboardingData] as boolean}
                  onCheckedChange={(checked) => updateData({ [option.key]: checked })}
                />
              </div>
            ))}
          </div>
        );

      case 'admin-check':
        return <AdminUserCheck />;

      case 'complete':
        return (
          <div className="space-y-6 text-center py-6">
            {saveConfig.isPending ? (
              <>
                <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
                <p className="text-lg">Setting up your platform...</p>
              </>
            ) : saveConfig.isSuccess ? (
              <>
                <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
                <div>
                  <h3 className="text-xl font-semibold">Setup Complete!</h3>
                  <p className="text-muted-foreground mt-2">
                    Your platform has been configured and is ready to use.
                  </p>
                </div>
                <div className="flex gap-4 justify-center mt-6">
                  <Button onClick={() => navigate('/admin/system-settings')}>
                    View Settings
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/dashboard')}>
                    Go to Dashboard
                  </Button>
                </div>
              </>
            ) : saveConfig.isError ? (
              <Alert variant="destructive">
                <AlertDescription>
                  Setup failed. Please try again or contact support.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Rocket className="h-16 w-16 text-primary mx-auto" />
                <div>
                  <h3 className="text-xl font-semibold">Ready to Launch!</h3>
                  <p className="text-muted-foreground mt-2">
                    Review your settings and click "Complete Setup" to finish.
                  </p>
                </div>
                <div className="text-left bg-muted p-4 rounded-lg max-w-md mx-auto">
                  <h4 className="font-medium mb-2">Configuration Summary:</h4>
                  <ul className="space-y-1 text-sm">
                    <li>Organization: {data.organizationName}</li>
                    <li>Platform Name: {data.platformName}</li>
                    <li>Features: {[
                      data.enableAIChat && 'AI Chat',
                      data.enableKnowledgeBase && 'Knowledge Base',
                      data.enableMeetings && 'Meetings',
                      data.enableTasks && 'Tasks',
                      data.enableAIAgents && 'AI Agents',
                    ].filter(Boolean).join(', ')}</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Platform Setup</h1>
        <p className="text-muted-foreground">
          Configure your new deployment in a few simple steps
        </p>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Step {currentStep + 1} of {WIZARD_STEPS.length}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step Indicators */}
      <div className="flex justify-between">
        {WIZARD_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isCompleted = completedSteps.includes(step.id);

          return (
            <div
              key={step.id}
              className={`flex flex-col items-center gap-1 ${
                isActive ? 'text-primary' : isCompleted ? 'text-success' : 'text-muted-foreground'
              }`}
            >
              <div
                className={`p-2 rounded-full ${
                  isActive ? 'bg-primary/10' : isCompleted ? 'bg-success/10' : 'bg-muted'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <span className="text-xs hidden sm:block">{step.title}</span>
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{WIZARD_STEPS[currentStep].title}</CardTitle>
          <CardDescription>{WIZARD_STEPS[currentStep].description}</CardDescription>
        </CardHeader>
        <CardContent>{renderStepContent()}</CardContent>
      </Card>

      {/* Navigation */}
      {WIZARD_STEPS[currentStep].id !== 'complete' && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={goNext} disabled={!canProceed()}>
            {currentStep === WIZARD_STEPS.length - 2 ? 'Complete Setup' : 'Next'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
