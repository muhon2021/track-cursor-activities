/**
 * OAuth Callback Page
 * Handles OAuth 2.0 redirect and token exchange
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { retrieveOAuthState } from '@/lib/integration-utils';
import { supabase } from '@/integrations/supabase/client';

type OAuthStatus = 'processing' | 'success' | 'error';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<OAuthStatus>('processing');
  const [message, setMessage] = useState('Processing OAuth callback...');
  const [providerSlug, setProviderSlug] = useState<string | null>(null);

  useEffect(() => {
    handleOAuthCallback();
  }, []);

  const handleOAuthCallback = async () => {
    try {
      // 1. Get code and state from URL params
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // 2. Check for OAuth errors from provider
      if (error) {
        setStatus('error');
        setMessage(
          errorDescription || `OAuth authorization failed: ${error}`
        );
        return;
      }

      // 3. Validate required parameters
      if (!code || !state) {
        setStatus('error');
        setMessage('Missing required OAuth parameters (code or state)');
        return;
      }

      // 4. Retrieve and validate state
      const stateData = retrieveOAuthState(state);
      if (!stateData) {
        setStatus('error');
        setMessage('Invalid or expired OAuth state. Please try again.');
        return;
      }

      // 5. Get provider ID from state
      const { providerId } = stateData;

      // 6. Fetch provider details to get the slug for redirect
      const { data: provider, error: providerError } = await supabase
        .from('integration_providers')
        .select('id, name, slug')
        .eq('id', providerId)
        .single();

      if (providerError || !provider) {
        setStatus('error');
        setMessage('Provider not found. Please try again.');
        return;
      }

      setProviderSlug(provider.slug);
      setMessage(`Connecting to ${provider.name}...`);

      // 7. Build redirect URI (must match the one used in authorization)
      const redirectUri = `${window.location.origin}/admin/integrations/oauth/callback`;

      // 8. Call the oauth-exchange-token edge function
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
        'oauth-exchange-token',
        {
          body: {
            code,
            providerId,
            redirectUri,
          },
        }
      );

      if (tokenError || !tokenData?.success) {
        setStatus('error');
        setMessage(
          tokenData?.message || tokenError?.message || 'Failed to exchange OAuth tokens'
        );
        return;
      }

      // 9. Success!
      setStatus('success');
      setMessage(tokenData.message || `Successfully connected to ${provider.name}`);

      // 10. Redirect to provider detail page after a short delay
      setTimeout(() => {
        navigate(`/admin/integrations/${provider.slug}`, {
          state: { oauthSuccess: true },
        });
      }, 2000);

    } catch (error) {
      setStatus('error');
      setMessage(
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    }
  };

  const handleRetry = () => {
    if (providerSlug) {
      navigate(`/admin/integrations/${providerSlug}`);
    } else {
      navigate('/admin/integrations');
    }
  };

  return (
    <div className="container max-w-2xl mx-auto py-12">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            {status === 'processing' && (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            )}
            {status === 'success' && (
              <CheckCircle2 className="h-8 w-8 text-success" />
            )}
            {status === 'error' && (
              <XCircle className="h-8 w-8 text-destructive" />
            )}

            <div>
              <CardTitle>
                {status === 'processing' && 'Connecting...'}
                {status === 'success' && 'Connection Successful'}
                {status === 'error' && 'Connection Failed'}
              </CardTitle>
              <CardDescription>OAuth 2.0 Authorization</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Status message */}
          <div className="p-4 rounded-lg bg-muted">
            <p className="text-sm">{message}</p>
          </div>

          {/* Progress steps */}
          {status === 'processing' && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Validating OAuth state...
              </p>
              <p className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Exchanging authorization code for access tokens...
              </p>
              <p className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Storing credentials securely...
              </p>
            </div>
          )}

          {/* Success message */}
          {status === 'success' && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-success/10 border border-success/30 dark:bg-green-900/20 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-success dark:text-green-100">
                    Integration connected successfully
                  </p>
                  <p className="text-success dark:text-green-200 mt-1">
                    Your credentials have been stored securely and you can now use this
                    integration. Redirecting...
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error actions */}
          {status === 'error' && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 dark:bg-red-900/20 dark:border-red-800">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-destructive dark:text-red-100">
                    Failed to complete OAuth flow
                  </p>
                  <p className="text-destructive dark:text-red-200 mt-1">
                    Please try connecting again. If the problem persists, check your OAuth
                    configuration or contact support.
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleRetry}>Try Again</Button>
                <Button variant="outline" onClick={() => navigate('/admin/integrations')}>
                  Back to Integrations
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
