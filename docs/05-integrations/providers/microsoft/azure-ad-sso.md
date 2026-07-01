# Microsoft Azure AD Single Sign-On (SSO) Setup Guide

This guide will walk you through setting up Microsoft Azure AD SSO authentication for your Control Tower application.

## 📋 Prerequisites

- Azure Active Directory (Azure AD) tenant
- Admin access to Azure Portal
- Admin access to Supabase Dashboard
- Access to your application's environment variables

---

## 🔧 Part 1: Azure Portal Configuration

### Step 1: Register Application in Azure Portal

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **Azure Active Directory** → **App registrations** → **New registration**
3. Fill in the application details:
   - **Name**: `Control Tower SSO` (or your preferred name)
   - **Supported account types**: 
     - **Single tenant** (your organization only) - Recommended for enterprise
     - **Multi-tenant** (any Azure AD directory) - For B2B scenarios
   - **Redirect URI**: 
     - Platform: `Web`
     - URI: `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback`
       - Replace `YOUR_SUPABASE_PROJECT` with your actual Supabase project ID
       - Example: `https://tjkqvbxtziheggurtvcz.supabase.co/auth/v1/callback`
4. Click **Register**

### Step 2: Configure API Permissions

1. In your app registration, go to **API permissions**
2. Click **Add a permission** → **Microsoft Graph** → **Delegated permissions**
3. Add the following permissions:
   - ✅ `User.Read` - Read user profile
   - ✅ `openid` - Sign in and read user profile
   - ✅ `profile` - View user's basic profile
   - ✅ `email` - View user's email address
4. Click **Add permissions**
5. **Important**: Click **Grant admin consent for [Your Organization]** to grant permissions

### Step 3: Create Client Secret

1. Go to **Certificates & secrets** → **Client secrets** → **New client secret**
2. Fill in:
   - **Description**: `Supabase Auth` (or descriptive name)
   - **Expires**: Choose duration (recommended: 24 months)
3. Click **Add**
4. **⚠️ IMPORTANT**: Copy the **Value** immediately - you won't be able to see it again!
   - This is your `AZURE_CLIENT_SECRET`

### Step 4: Get Application Credentials

1. Go to **Overview** tab
2. Copy the following values:
   - **Application (client) ID** → This is your `AZURE_CLIENT_ID`
   - **Directory (tenant) ID** → This is your `AZURE_TENANT_ID`

### Step 5: Configure Redirect URIs

1. Go to **Authentication** → **Platform configurations** → **Web**
2. Add the following redirect URIs:
   - `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback`
   - `https://YOUR_DOMAIN.com/auth/callback` (for production)
   - `http://localhost:5173/auth/callback` (for local development)
3. Under **Implicit grant and hybrid flows**, enable:
   - ✅ **ID tokens** (used for implicit and hybrid flows)
4. Click **Save**

---

## 🔧 Part 2: Supabase Configuration

### Step 1: Enable Azure Provider in Supabase

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **Authentication** → **Providers**
3. Find **Azure** in the provider list
4. **Enable** the provider
5. Configure the following:
   - **Azure Client ID**: Paste your Application (client) ID from Azure
   - **Azure Secret**: Paste your Client Secret from Azure
   - **Azure Tenant ID**: Paste your Directory (tenant) ID from Azure
6. Click **Save**

### Step 2: Configure Edge Function Secrets

1. Go to **Settings** → **Edge Functions** → **Secrets**
2. Add the following secrets:
   - `AZURE_AD_CLIENT_ID` = Your Application (client) ID
   - `AZURE_AD_TENANT_ID` = Your Directory (tenant) ID
   - `AZURE_AD_CLIENT_SECRET` = Your Client Secret

---

## 🔧 Part 3: Frontend Environment Variables

### Step 1: Create/Update `.env` File

Add the following environment variables to your `.env` file:

```env
# Microsoft Azure AD SSO Configuration
VITE_MICROSOFT_CLIENT_ID=your-application-client-id-here
VITE_MICROSOFT_DIRECTORY_ID=your-directory-tenant-id-here
VITE_MICROSOFT_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_MICROSOFT_LOGOUT_URI=http://localhost:5173/login
```

### Step 2: Production Environment Variables

For production, update the redirect and logout URIs:

```env
VITE_MICROSOFT_REDIRECT_URI=https://your-domain.com/auth/callback
VITE_MICROSOFT_LOGOUT_URI=https://your-domain.com/login
```

**Note**: If using Vercel, Netlify, or similar platforms, add these variables in their dashboard under **Environment Variables**.

---

## 🚀 Part 4: Deploy Edge Functions

### Deploy Azure Auth Login Function

```bash
supabase functions deploy azure-auth-login
```

### Deploy Azure Auth Logout Function

```bash
supabase functions deploy azure-auth-logout
```

---

## ✅ Part 5: Testing

### Test Flow

1. **Start your development server**:
   ```bash
   npm run dev
   ```

2. **Navigate to login page**: `http://localhost:5173/login`

3. **Click "Sign in with Microsoft"** button

4. **Microsoft login popup should appear**

5. **Sign in with your Microsoft credentials**

6. **Grant permissions** if prompted

7. **You should be redirected** to `/auth/callback` and then to `/dashboard`

8. **Verify in Supabase Dashboard**:
   - Go to **Authentication** → **Users**
   - You should see your user account created
   - Check that the email matches your Microsoft account

### Verify Database

Run these SQL queries in Supabase SQL Editor:

```sql
-- Check authenticated users
SELECT id, email, created_at, raw_user_meta_data 
FROM auth.users 
WHERE email LIKE '%@yourdomain.com%';

-- Check profiles
SELECT id, email, full_name, azure_ad_id 
FROM profiles 
WHERE email LIKE '%@yourdomain.com%';

-- Check user roles
SELECT u.email, ur.role 
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE u.email LIKE '%@yourdomain.com%';
```

---

## 🔍 Troubleshooting

### Issue: "MSAL configuration error"

**Solution**: Check that all environment variables are set:
- `VITE_MICROSOFT_CLIENT_ID`
- `VITE_MICROSOFT_DIRECTORY_ID`
- `VITE_MICROSOFT_REDIRECT_URI`

### Issue: "Failed to validate Azure token"

**Solution**: 
1. Verify Azure Client Secret is correct in Supabase Edge Function secrets
2. Check that API permissions are granted and admin consent is given
3. Ensure redirect URI matches exactly in Azure Portal

### Issue: "User not created in database"

**Solution**:
1. Check Supabase Edge Function logs for errors
2. Verify database triggers are set up correctly
3. Check that `profiles` table has proper RLS policies

### Issue: "Redirect URI mismatch"

**Solution**:
1. Ensure redirect URI in Azure Portal matches exactly:
   - `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback`
2. Check for trailing slashes or protocol mismatches (http vs https)

### Issue: "Popup blocked"

**Solution**:
1. Allow popups for your domain in browser settings
2. Try using redirect flow instead of popup (modify `msalConfig.ts`)

---

## 📚 Additional Resources

- [Supabase Auth with Azure](https://supabase.com/docs/guides/auth/social-login/auth-azure)
- [Azure App Registration Guide](https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)
- [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/overview)
- [MSAL Browser Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-browser)

---

## 🔐 Security Best Practices

1. **Never commit secrets** to version control
2. **Use environment variables** for all sensitive data
3. **Rotate client secrets** regularly (every 90 days recommended)
4. **Enable MFA** for Azure AD admin accounts
5. **Use single-tenant** registration for enterprise deployments
6. **Monitor authentication logs** in Azure Portal and Supabase

---

## 📝 Implementation Checklist

- [ ] Azure App Registration created
- [ ] API permissions configured and admin consent granted
- [ ] Client Secret created and copied
- [ ] Redirect URIs configured in Azure Portal
- [ ] Azure provider enabled in Supabase Dashboard
- [ ] Edge Function secrets configured
- [ ] Frontend environment variables set
- [ ] Edge functions deployed
- [ ] Tested login flow in development
- [ ] Verified user creation in database
- [ ] Production environment variables configured
- [ ] Production redirect URIs updated

---

## 🎯 Next Steps

After successful setup:

1. **Customize user roles** for Azure AD users
2. **Configure Teams integration** (if needed)
3. **Set up user provisioning** rules
4. **Configure SSO domain restrictions** (if needed)
5. **Monitor authentication metrics**

---

## 💡 Features Implemented

✅ **MSAL-based authentication** - Uses @azure/msal-browser for secure token management
✅ **Auto-registration** - Automatically creates users on first login
✅ **Token refresh** - Automatic token refresh before expiration
✅ **Silent login** - Attempts silent token acquisition on page load
✅ **Error handling** - Comprehensive error handling for all MSAL error types
✅ **Session management** - Properly manages both Azure AD and application sessions
✅ **Logout support** - Handles logout for both Azure AD and regular users

---

For support or questions, please refer to the main documentation or contact your system administrator.

