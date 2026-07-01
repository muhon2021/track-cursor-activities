# Zoom OAuth Setup Guide

Complete guide for setting up Zoom OAuth integration in your application.

## Prerequisites

- Zoom account with developer access
- Admin access to your application
- Supabase project URL

## Step 1: Create Zoom OAuth App

1. Go to [Zoom Marketplace](https://marketplace.zoom.us/develop/create)
2. Click **"Create"** → **"OAuth App"**
3. Fill in the app information:
   - **App Name**: Your application name
   - **App Type**: Server-to-Server OAuth (recommended) or User-managed OAuth
   - **Company Name**: Your company name
   - **Developer Contact Information**: Your email

## Step 2: Configure OAuth Settings

### Redirect URL

Add this redirect URL to your Zoom OAuth app:

```
https://[YOUR_SUPABASE_PROJECT_REF].supabase.co/functions/v1/user-oauth-callback
```

Replace `[YOUR_SUPABASE_PROJECT_REF]` with your Supabase project reference.

**Example:**
```
https://tjkqvbxtziheggurtvcz.supabase.co/functions/v1/user-oauth-callback
```

### Required Scopes

Make sure your Zoom app requests these scopes:

- `meeting:read` - Read meeting information
- `recording:read` - Read meeting recordings
- `user:read` - Read user profile information

## Step 3: Get Your Credentials

After creating your OAuth app:

1. Go to your app's **"App Credentials"** tab
2. Copy your **Client ID**
3. Copy your **Client Secret**
4. (If using Server-to-Server OAuth) Copy your **Account ID**

## Step 4: Configure in Application

### Option A: Via Admin UI (Recommended)

1. Navigate to **Admin → Integrations**
2. Find **Zoom** in the "Meeting Providers" section
3. Click on the Zoom card
4. Enter your credentials:
   - **Client ID**: Your Zoom OAuth Client ID
   - **Client Secret**: Your Zoom OAuth Client Secret
5. Click **"Save Configuration"**
6. Click **"Test Connection"** to verify

### Option B: Via Database (Advanced)

Run this SQL query in your Supabase SQL Editor:

```sql
-- Update Zoom integration configuration
UPDATE organization_integrations
SET 
  config = jsonb_build_object(
    'client_id', 'YOUR_CLIENT_ID',
    'client_secret', 'YOUR_CLIENT_SECRET'
  ),
  enabled = true
WHERE provider_id = (
  SELECT id FROM integration_providers WHERE slug = 'zoom'
);
```

## Step 5: Test the Connection

1. Go to **Admin → Integrations → Zoom**
2. Click **"Connect with Zoom"**
3. You'll be redirected to Zoom to authorize
4. After authorization, you'll be redirected back
5. Your Zoom account should now show as "Connected"

## Troubleshooting

### "Provider not properly configured" Error

- Make sure you've entered both Client ID and Client Secret
- Verify the credentials are correct in the Zoom Marketplace
- Check that the integration is enabled in the database

### "Invalid redirect URI" Error

- Verify the redirect URL in your Zoom app matches exactly:
  ```
  https://[YOUR_PROJECT].supabase.co/functions/v1/user-oauth-callback
  ```
- Make sure there are no trailing slashes or extra characters
- Check that your Supabase project URL is correct

### "Invalid scopes" Error

- Verify your Zoom app has the required scopes enabled
- Check that the scopes match: `meeting:read`, `recording:read`, `user:read`

### Connection Works But Sync Fails

- Check that your Zoom account has permission to access meetings
- Verify that meetings exist in your Zoom account
- Check the browser console for detailed error messages

## Environment Variables (Optional)

For server-to-server OAuth (used by background sync functions), you may also need to set these in Supabase Edge Function secrets:

```bash
ZOOM_CLIENT_ID=your_client_id
ZOOM_CLIENT_SECRET=your_client_secret
ZOOM_ACCOUNT_ID=your_account_id  # Only for Server-to-Server OAuth
```

To set these in Supabase:
1. Go to **Supabase Dashboard → Edge Functions → Secrets**
2. Add each secret individually

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use environment variables** for sensitive data
3. **Rotate credentials** if compromised
4. **Limit scopes** to only what's needed
5. **Monitor OAuth token usage** in the admin dashboard

## Next Steps

After successful configuration:

1. Users can connect their Zoom accounts at **Admin → Integrations → Zoom**
2. Meetings will sync automatically when users connect
3. View synced meetings at **Admin → Integrations → Zoom → Meetings**
4. Access meeting recordings and transcripts in the meeting detail pages

## Support

If you encounter issues:

1. Check the [Zoom API Documentation](https://marketplace.zoom.us/docs/api-reference)
2. Review error messages in the browser console
3. Check Supabase Edge Function logs
4. Verify your Zoom app status in the Zoom Marketplace

