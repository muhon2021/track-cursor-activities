import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ExternalLink } from "lucide-react";

export default function ZoomDocumentation() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <div className="mb-6">
          <Link to="/admin/integrations/zoom">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Zoom Integration
            </Button>
          </Link>
        </div>

        <Card className="shadow-premium">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Zoom OAuth Setup Guide</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Complete guide for setting up Zoom OAuth integration in your application
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <div className="space-y-6 text-foreground">
              <section>
                <h2 className="text-2xl font-semibold mb-3">Prerequisites</h2>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Zoom account with developer access</li>
                  <li>Admin access to your application</li>
                  <li>Supabase project URL</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">Step 1: Create Zoom OAuth App</h2>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Go to <a href="https://marketplace.zoom.us/develop/create" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Zoom Marketplace <ExternalLink className="h-3 w-3" /></a></li>
                  <li>Click <strong>"Create"</strong> → <strong>"OAuth App"</strong></li>
                  <li>Fill in the app information:
                    <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                      <li><strong>App Name</strong>: Your application name</li>
                      <li><strong>App Type</strong>: Server-to-Server OAuth (recommended) or User-managed OAuth</li>
                      <li><strong>Company Name</strong>: Your company name</li>
                      <li><strong>Developer Contact Information</strong>: Your email</li>
                    </ul>
                  </li>
                </ol>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">Step 2: Configure OAuth Settings</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Redirect URL</h3>
                    <p className="text-muted-foreground mb-2">
                      Add this redirect URL to your Zoom OAuth app:
                    </p>
                    <div className="bg-muted p-3 rounded-lg border border-border">
                      <code className="text-sm font-mono">
                        https://[YOUR_SUPABASE_PROJECT_REF].supabase.co/functions/v1/user-oauth-callback
                      </code>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Replace <code className="bg-muted px-1 rounded">[YOUR_SUPABASE_PROJECT_REF]</code> with your Supabase project reference.
                    </p>
                    <p className="text-sm font-semibold mt-3 mb-1">Example:</p>
                    <div className="bg-muted p-3 rounded-lg border border-border">
                      <code className="text-sm font-mono">
                        https://tjkqvbxtziheggurtvcz.supabase.co/functions/v1/user-oauth-callback
                      </code>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Required Scopes</h3>
                    <p className="text-muted-foreground mb-2">
                      Make sure your Zoom app requests these scopes:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li><code className="bg-muted px-1 rounded">meeting:read</code> - Read meeting information</li>
                      <li><code className="bg-muted px-1 rounded">recording:read</code> - Read meeting recordings</li>
                      <li><code className="bg-muted px-1 rounded">user:read</code> - Read user profile information</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">Step 3: Get Your Credentials</h2>
                <p className="text-muted-foreground mb-2">
                  After creating your OAuth app:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Go to your app's <strong>"App Credentials"</strong> tab</li>
                  <li>Copy your <strong>Client ID</strong></li>
                  <li>Copy your <strong>Client Secret</strong></li>
                  <li>(If using Server-to-Server OAuth) Copy your <strong>Account ID</strong></li>
                </ol>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">Step 4: Configure in Application</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Option A: Via Admin UI (Recommended)</h3>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
                      <li>Navigate to <strong>Admin → Integrations</strong></li>
                      <li>Find <strong>Zoom</strong> in the "Meeting Providers" section</li>
                      <li>Click on the Zoom card</li>
                      <li>Enter your credentials:
                        <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                          <li><strong>Client ID</strong>: Your Zoom OAuth Client ID</li>
                          <li><strong>Client Secret</strong>: Your Zoom OAuth Client Secret</li>
                        </ul>
                      </li>
                      <li>Click <strong>"Save Configuration"</strong></li>
                      <li>Click <strong>"Test Connection"</strong> to verify</li>
                    </ol>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Option B: Via Database (Advanced)</h3>
                    <p className="text-muted-foreground mb-2">
                      Run this SQL query in your Supabase SQL Editor:
                    </p>
                    <div className="bg-muted p-4 rounded-lg border border-border overflow-x-auto">
                      <pre className="text-sm font-mono whitespace-pre-wrap">
{`-- Update Zoom integration configuration
UPDATE organization_integrations
SET 
  config = jsonb_build_object(
    'client_id', 'YOUR_CLIENT_ID',
    'client_secret', 'YOUR_CLIENT_SECRET'
  ),
  enabled = true
WHERE provider_id = (
  SELECT id FROM integration_providers WHERE slug = 'zoom'
);`}
                      </pre>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">Step 5: Test the Connection</h2>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Go to <strong>Admin → Integrations → Zoom</strong></li>
                  <li>Click <strong>"Connect with Zoom"</strong></li>
                  <li>You'll be redirected to Zoom to authorize</li>
                  <li>After authorization, you'll be redirected back</li>
                  <li>Your Zoom account should now show as "Connected"</li>
                </ol>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">Troubleshooting</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">"Provider not properly configured" Error</h3>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li>Make sure you've entered both Client ID and Client Secret</li>
                      <li>Verify the credentials are correct in the Zoom Marketplace</li>
                      <li>Check that the integration is enabled in the database</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">"Invalid redirect URI" Error</h3>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li>Verify the redirect URL in your Zoom app matches exactly:
                        <div className="bg-muted p-2 rounded mt-2">
                          <code className="text-xs font-mono">
                            https://[YOUR_PROJECT].supabase.co/functions/v1/user-oauth-callback
                          </code>
                        </div>
                      </li>
                      <li>Make sure there are no trailing slashes or extra characters</li>
                      <li>Check that your Supabase project URL is correct</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">"Invalid scopes" Error</h3>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li>Verify your Zoom app has the required scopes enabled</li>
                      <li>Check that the scopes match: <code className="bg-muted px-1 rounded">meeting:read</code>, <code className="bg-muted px-1 rounded">recording:read</code>, <code className="bg-muted px-1 rounded">user:read</code></li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Connection Works But Sync Fails</h3>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li>Check that your Zoom account has permission to access meetings</li>
                      <li>Verify that meetings exist in your Zoom account</li>
                      <li>Check the browser console for detailed error messages</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">Environment Variables (Optional)</h2>
                <p className="text-muted-foreground mb-2">
                  For server-to-server OAuth (used by background sync functions), you may also need to set these in Supabase Edge Function secrets:
                </p>
                <div className="bg-muted p-4 rounded-lg border border-border">
                  <pre className="text-sm font-mono whitespace-pre-wrap">
{`ZOOM_CLIENT_ID=your_client_id
ZOOM_CLIENT_SECRET=your_client_secret
ZOOM_ACCOUNT_ID=your_account_id  # Only for Server-to-Server OAuth`}
                  </pre>
                </div>
                <p className="text-muted-foreground mt-2">
                  To set these in Supabase:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Go to <strong>Supabase Dashboard → Edge Functions → Secrets</strong></li>
                  <li>Add each secret individually</li>
                </ol>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">Security Best Practices</h2>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
                  <li><strong>Never commit credentials</strong> to version control</li>
                  <li><strong>Use environment variables</strong> for sensitive data</li>
                  <li><strong>Rotate credentials</strong> if compromised</li>
                  <li><strong>Limit scopes</strong> to only what's needed</li>
                  <li><strong>Monitor OAuth token usage</strong> in the admin dashboard</li>
                </ol>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">Next Steps</h2>
                <p className="text-muted-foreground mb-2">
                  After successful configuration:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Users can connect their Zoom accounts at <strong>Admin → Integrations → Zoom</strong></li>
                  <li>Meetings will sync automatically when users connect</li>
                  <li>View synced meetings at <strong>Admin → Integrations → Zoom → Meetings</strong></li>
                  <li>Access meeting recordings and transcripts in the meeting detail pages</li>
                </ol>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">Support</h2>
                <p className="text-muted-foreground mb-2">
                  If you encounter issues:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Check the <a href="https://marketplace.zoom.us/docs/api-reference" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Zoom API Documentation <ExternalLink className="h-3 w-3" /></a></li>
                  <li>Review error messages in the browser console</li>
                  <li>Check Supabase Edge Function logs</li>
                  <li>Verify your Zoom app status in the Zoom Marketplace</li>
                </ol>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

