/**
 * Setup Checklist Component
 *
 * Displays a visual checklist for developers to verify their environment
 * is properly configured. Useful for first-time setup and troubleshooting.
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

interface CheckItem {
  id: string;
  label: string;
  status: 'checking' | 'success' | 'error' | 'warning';
  message?: string;
  required: boolean;
}

export function SetupChecklist() {
  const [checks, setChecks] = useState<CheckItem[]>([
    {
      id: 'supabase-connection',
      label: 'Supabase Connection',
      status: 'checking',
      required: true,
    },
    {
      id: 'env-variables',
      label: 'Environment Variables',
      status: 'checking',
      required: true,
    },
    {
      id: 'database-tables',
      label: 'Database Tables',
      status: 'checking',
      required: true,
    },
    {
      id: 'admin-user',
      label: 'Admin User Created',
      status: 'checking',
      required: true,
    },
    {
      id: 'openai-key',
      label: 'OpenAI API Key',
      status: 'checking',
      required: false,
    },
    {
      id: 'feature-flags',
      label: 'Feature Flags Configured',
      status: 'checking',
      required: true,
    },
  ]);

  const { features, isLoading: featuresLoading } = useFeatureFlags();

  useEffect(() => {
    runChecks();
  }, [featuresLoading]);

  const updateCheck = (id: string, updates: Partial<CheckItem>) => {
    setChecks((prev) =>
      prev.map((check) => (check.id === id ? { ...check, ...updates } : check))
    );
  };

  const runChecks = async () => {
    // Check 1: Supabase Connection
    try {
      const { error } = await supabase.from('profiles').select('count').limit(1);
      if (error) throw error;
      updateCheck('supabase-connection', {
        status: 'success',
        message: 'Connected successfully',
      });
    } catch (error) {
      updateCheck('supabase-connection', {
        status: 'error',
        message: 'Failed to connect to Supabase',
      });
    }

    // Check 2: Environment Variables
    const hasUrl = !!import.meta.env.VITE_SUPABASE_URL;
    const hasKey = !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const hasPlaceholders =
      import.meta.env.VITE_SUPABASE_URL?.includes('YOUR_PROJECT_ID') ||
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.includes('your-anon-key');

    if (hasUrl && hasKey && !hasPlaceholders) {
      updateCheck('env-variables', {
        status: 'success',
        message: 'All required variables set',
      });
    } else if (hasPlaceholders) {
      updateCheck('env-variables', {
        status: 'error',
        message: 'Please replace placeholder values in .env',
      });
    } else {
      updateCheck('env-variables', {
        status: 'error',
        message: 'Missing required environment variables',
      });
    }

    // Check 3: Database Tables
    try {
      const tables: Array<'profiles' | 'user_roles' | 'clients' | 'meetings' | 'knowledge_entries' | 'app_config'> = [
        'profiles',
        'user_roles',
        'clients',
        'meetings',
        'knowledge_entries',
        'app_config',
      ];
      let allTablesExist = true;

      for (const table of tables) {
        const { error } = await supabase.from(table).select('id').limit(1);
        if (error) {
          allTablesExist = false;
          break;
        }
      }

      if (allTablesExist) {
        updateCheck('database-tables', {
          status: 'success',
          message: 'All core tables exist',
        });
      } else {
        updateCheck('database-tables', {
          status: 'error',
          message: 'Some tables are missing. Run migrations.',
        });
      }
    } catch (error) {
      updateCheck('database-tables', {
        status: 'error',
        message: 'Failed to verify tables',
      });
    }

    // Check 4: Admin User
    try {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('role', 'admin')
        .limit(1);

      if (roles && roles.length > 0) {
        updateCheck('admin-user', {
          status: 'success',
          message: 'Admin user exists',
        });
      } else {
        updateCheck('admin-user', {
          status: 'warning',
          message: 'No admin user found. Create one via SQL.',
        });
      }
    } catch (error) {
      updateCheck('admin-user', {
        status: 'error',
        message: 'Failed to check admin users',
      });
    }

    // Check 5: OpenAI API Key (via edge function)
    try {
      const { data, error } = await supabase.functions.invoke('check-environment');

      if (data && data.secrets && data.secrets.OPENAI_API_KEY) {
        updateCheck('openai-key', {
          status: 'success',
          message: 'OpenAI key configured',
        });
      } else {
        updateCheck('openai-key', {
          status: 'warning',
          message: 'OpenAI key not set. AI features disabled.',
        });
      }
    } catch (error) {
      updateCheck('openai-key', {
        status: 'warning',
        message: 'Could not verify OpenAI key',
      });
    }

    // Check 6: Feature Flags
    if (!featuresLoading) {
      if (features && Object.keys(features).length > 0) {
        const enabledCount = Object.values(features).filter(Boolean).length;
        updateCheck('feature-flags', {
          status: 'success',
          message: `${enabledCount} features enabled`,
        });
      } else {
        updateCheck('feature-flags', {
          status: 'warning',
          message: 'No feature flags found',
        });
      }
    }
  };

  const getStatusIcon = (status: CheckItem['status']) => {
    switch (status) {
      case 'checking':
        return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: CheckItem['status']) => {
    switch (status) {
      case 'checking':
        return <Badge variant="secondary">Checking...</Badge>;
      case 'success':
        return <Badge variant="default" className="bg-green-500">OK</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-500">Warning</Badge>;
    }
  };

  const allRequiredPassed = checks
    .filter((c) => c.required)
    .every((c) => c.status === 'success');

  const hasErrors = checks.some((c) => c.status === 'error');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Setup Checklist</CardTitle>
        <CardDescription>
          Verify your environment is properly configured
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Status */}
        <div className="flex items-center gap-2 p-3 border rounded-md">
          {allRequiredPassed && !hasErrors ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="font-medium text-green-700">
                All required checks passed! 🎉
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <span className="font-medium text-yellow-700">
                Some checks need attention
              </span>
            </>
          )}
        </div>

        {/* Individual Checks */}
        <div className="space-y-3">
          {checks.map((check) => (
            <div
              key={check.id}
              className="flex items-start gap-3 p-3 border rounded-md hover:bg-accent/50 transition-colors"
            >
              <div className="mt-0.5">{getStatusIcon(check.status)}</div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{check.label}</span>
                  {!check.required && (
                    <Badge variant="outline" className="text-xs">
                      Optional
                    </Badge>
                  )}
                </div>
                {check.message && (
                  <p className="text-sm text-muted-foreground">{check.message}</p>
                )}
              </div>
              {getStatusBadge(check.status)}
            </div>
          ))}
        </div>

        {/* Help Section */}
        <div className="pt-4 border-t">
          <h4 className="font-medium mb-2">Need Help?</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>
              📖 <a href="/docs/QUICKSTART.md" className="underline">Quick Start Guide</a>
            </li>
            <li>
              🚩 <a href="/docs/FEATURE_FLAGS.md" className="underline">Feature Flags Reference</a>
            </li>
            <li>
              ⚡ <a href="/docs/EDGE_FUNCTIONS_CATALOG.md" className="underline">Edge Functions Catalog</a>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
