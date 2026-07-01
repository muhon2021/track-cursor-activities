# Self-Host Quickstart Guide

Deploy CollabAi on your own infrastructure using GitHub and Supabase.

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| GitHub account | For code hosting |
| Supabase account | Free tier works for development |
| Node.js 18+ | For local development |
| Supabase CLI | For database migrations |
| Basic terminal knowledge | CLI commands required |

**Estimated Time:** 30-45 minutes

---

## Step 1: Fork the Repository

```bash
# Option A: Fork on GitHub, then clone
git clone https://github.com/YOUR_USERNAME/collabai.git
cd collabai

# Option B: Clone directly (if you have access)
git clone https://github.com/org/collabai.git
cd collabai
```

---

## Step 2: Create Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Fill in:
   - Project name: `collabai-production`
   - Database password: (save this securely!)
   - Region: Choose closest to your users
4. Wait for project to provision (~2 minutes)

### Get Your Credentials

From Project Settings → API:

| Credential | Where to Find | Use |
|------------|---------------|-----|
| Project URL | `https://xxxxx.supabase.co` | `VITE_SUPABASE_URL` |
| Anon Key | `eyJhbGc...` (public) | `VITE_SUPABASE_PUBLISHABLE_KEY` |
| Service Role Key | `eyJhbGc...` (secret!) | Edge functions only |
| Project Ref | `xxxxx` | CLI linking |

---

## Step 3: Configure Environment

```bash
# Copy example environment file
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```env
# Required - Supabase Connection
VITE_SUPABASE_PROJECT_ID="your-project-ref"
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"

# Optional - AI Features (choose one)
OPENAI_API_KEY="sk-proj-xxxxx"        # For OpenAI
ANTHROPIC_API_KEY="sk-ant-xxxxx"      # For Claude
GOOGLE_AI_API_KEY="xxxxx"             # For Gemini

# Optional - Integrations
ZOOM_CLIENT_ID="xxxxx"
ZOOM_CLIENT_SECRET="xxxxx"
GOOGLE_CLIENT_ID="xxxxx"
GOOGLE_CLIENT_SECRET="xxxxx"
```

See [Environment Variables](./environment-variables.md) for the complete list.

---

## Step 4: Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Supabase CLI (if not installed)
npm install -g supabase
```

---

## Step 5: Set Up Database

```bash
# Login to Supabase CLI
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Push database migrations
supabase db push
```

This creates all required tables, RLS policies, and functions.

### Verify Tables

In Supabase Dashboard → Table Editor, you should see:
- `profiles`
- `user_roles`
- `clients`
- `meetings`
- `knowledge_entries`
- `app_config`
- And more...

---

## Step 6: Deploy Edge Functions

```bash
# Deploy all edge functions
supabase functions deploy

# Or deploy individually
supabase functions deploy ai-chat-assistant
supabase functions deploy generate-embeddings
```

### Add Function Secrets

In Supabase Dashboard → Settings → Edge Function Secrets:

```
OPENAI_API_KEY=sk-proj-xxxxx
SENDGRID_API_KEY=SG.xxxxx  (optional, for emails)
```

---

## Step 7: Create Admin Account

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open http://localhost:5173

3. Click **Sign Up** and create an account

4. In Supabase Dashboard → Table Editor → `user_roles`:
   - Click **Insert Row**
   - `user_id`: Copy from `profiles` table
   - `role`: `admin`

---

## Step 8: Run Locally

```bash
npm run dev
```

Open http://localhost:5173 - you should see the dashboard!

---

## Step 9: Deploy to Production

### Option A: Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

Add environment variables in Vercel Dashboard.

### Option B: Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod
```

### Option C: Docker

```dockerfile
# Build
docker build -t collabai .

# Run
docker run -p 3000:3000 collabai
```

---

## Project Structure

```
collabai/
├── src/
│   ├── components/     # React components
│   ├── hooks/          # Custom React hooks
│   ├── pages/          # Route pages
│   ├── contexts/       # React contexts
│   └── lib/            # Utility functions
├── supabase/
│   ├── functions/      # Edge functions
│   └── migrations/     # Database migrations
├── docs/               # Documentation
└── public/             # Static assets
```

---

## Next Steps

| Task | Guide |
|------|-------|
| Configure AI | [AI Provider Setup](../06-ai-features/provider-routing.md) |
| Set up Zoom | [Zoom Integration](../05-integrations/providers/zoom.md) |
| Configure email | [SendGrid Setup](../05-integrations/email-notifications.md) |
| Add users | [User Management](../07-admin/user-management.md) |

---

## Troubleshooting

### Database connection fails
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
- Check Supabase project is not paused

### Edge functions not working
- Run `supabase functions deploy` again
- Check function logs in Supabase Dashboard

### AI features not working
- Verify `OPENAI_API_KEY` is set in Edge Function Secrets
- Check the key has sufficient credits

---

## Getting Help

- [GitHub Issues](https://github.com/your-org/collabai/issues)
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
