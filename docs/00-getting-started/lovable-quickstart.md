# Lovable Quickstart Guide

Deploy CollabAi in under 10 minutes using Lovable.dev and Lovable Cloud.

**No CLI, no terminal, no local development required.**

---

## Prerequisites

- Lovable.dev account ([sign up free](https://lovable.dev))
- 10 minutes of your time

---

## Step 1: Remix the Project

1. Open the CollabAi project on Lovable
2. Click **"Remix"** to create your own copy
3. Give your project a name (e.g., "My Company CollabAi")

> 💡 Remixing creates a complete copy that you own and can customize.

---

## Step 2: Enable Lovable Cloud

1. In your new project, click **Cloud** in the left sidebar
2. Click **"Enable Cloud"**
3. Wait for the database to be provisioned (usually < 1 minute)

Lovable Cloud automatically provides:
- ✅ PostgreSQL database
- ✅ Authentication system
- ✅ Edge Functions runtime
- ✅ File storage

---

## Step 3: Set Up Database

The database schema is applied automatically. To verify:

1. Go to **Cloud → Database → Tables**
2. Confirm you see tables like `profiles`, `clients`, `meetings`, etc.

If tables are missing, the migrations will run automatically on first access.

---

## Step 4: Create Admin Account

1. Click the **Preview** to open your app
2. Click **Sign Up**
3. Create an account with your email
4. Go to **Cloud → Database → Tables → user_roles**
5. Click **+ New Row**
6. Add your user ID and role `admin`

```
user_id: [your user ID from profiles table]
role: admin
```

---

## Step 5: Configure Branding (Optional)

1. Log in to your app as admin
2. Go to **Admin → System Settings**
3. Update:
   - App Name
   - Logo URL
   - Primary Color
   - Support Email

---

## Step 6: Enable Features

1. Go to **Admin → System Settings → Features**
2. Toggle on the modules you want:
   - ✅ AI Chat (uses Lovable AI - no API key needed!)
   - ✅ Knowledge Base
   - ✅ Meetings with Zoom sync
   - ✅ Client management

---

## Step 7: Publish

1. Click the **Publish** button (top right)
2. Your app is now live at `yourproject.lovable.app`
3. (Optional) Connect a custom domain in Settings → Domains

---

## Using Lovable AI

Lovable AI is **included automatically** - no OpenAI API key required!

Lovable AI supports:
- AI Chat assistant
- Meeting summaries
- Document analysis
- Semantic search

See [Lovable AI Guide](../06-ai-features/lovable-ai.md) for details.

---

## Next Steps

| Task | Guide |
|------|-------|
| Invite team members | [User Management](../07-admin/user-management.md) |
| Connect Zoom | [Zoom Integration](../05-integrations/providers/zoom.md) |
| Connect Google Drive | [Google Drive](../05-integrations/providers/google/) |
| Configure notifications | [Email Setup](../05-integrations/email-notifications.md) |

---

## Troubleshooting

### Can't log in?
- Check that Supabase Auth is enabled in Cloud settings
- Verify email confirmation is disabled for testing

### Features not working?
- Check feature flags in Admin → System Settings
- Verify the user has the correct role

### AI Chat not responding?
- Lovable AI should work automatically
- Check the browser console for errors

---

## Getting Help

- [Lovable Documentation](https://docs.lovable.dev)
- [Lovable Discord](https://discord.gg/lovable)
- [GitHub Issues](https://github.com/your-org/collabai/issues)
